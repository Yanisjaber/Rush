// ============================================================
// Edge Function : strava-ingest
//
// Récupère toutes les activités Strava de l'utilisateur connecté
// et les insère dans la table activities.
//
// Appelée par le front (POST) avec le JWT Supabase dans Authorization.
//
// Flow :
//   1. Vérifier le JWT pour identifier l'user
//   2. Lire les tokens Strava (Vault, via connexions_app.secret_id)
//   3. Refresh si expiré
//   4. Fetch /athlete/activities paginé : TOUT l'historique à chaque appel (pas de synchro incrémentale)
//   5. Mapper chaque activité au format de notre table 'activities'
//   6. Upsert par batches
//   7. (daily_metrics : recalculé par le déclencheur SQL sur `activities`, plus ici)
//   8. Retourner un résumé { imported, errors }
//
// Déploiement :
//   supabase functions deploy strava-ingest
//   (avec verification JWT activée, c'est l'authent standard)
//
// Note timeout : Supabase Edge Functions ont 60s max. Pour gros historiques
// (>2000 activités), pourrait nécessiter pagination côté client + appels multiples.
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeadersFor } from "../_shared/cors.ts";
import { joindreJetons, ecrireRenouvellementStrava } from "../_shared/jetons.ts";
import { stravaToRow, lthrEffectif, ftpEffective } from "../_shared/charge.ts";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STRAVA_API = "https://www.strava.com/api/v3";
const BATCH_SIZE = 100;
const PER_PAGE = 100;

// CORS restreint (voir _shared/cors.ts) : les en-têtes sont calculés PAR requête (pas de variable partagée
// entre deux requêtes simultanées).
Deno.serve((req) => gerer(req, corsHeadersFor(req)));

async function gerer(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
  const json = (body: any, status = 200) => reponseJson(corsHeaders, body, status);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ===== 1) Auth via JWT =====
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "missing_jwt" }, 401);

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "invalid_jwt" }, 401);

    // ===== 2) Récupérer les tokens Strava + profil athlète (FTP, HRmax, LTHR) =====
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: conn, error: connErr } = await sbAdmin
      .from("connexions_app")
      .select("*")
      .eq("user_id", user.id)
      .eq("app", "strava")
      .maybeSingle();

    if (connErr || !conn) {
      return json({ error: "no_strava_connection" }, 400);
    }
    await joindreJetons(sbAdmin, conn); // jetons déchiffrés (Vault)

    // FTP / HRmax / LTHR vivent dans user_profiles, pas dans connexions_app.
    // On les récupère pour pouvoir calculer le TSS correctement.
    const { data: profile } = await sbAdmin
      .from("user_profiles")
      .select("ftp, hr_max, lthr")
      .eq("user_id", user.id)
      .maybeSingle();
    const athleteFtp = profile?.ftp || null;
    const athleteLthr = lthrEffectif(profile);

    // Marquer le sync comme "running"
    await sbAdmin.from("connexions_app").update({
      last_sync_status: "running",
      last_sync_at: new Date().toISOString(),
    }).eq("user_id", user.id).eq("app", "strava");

    // ===== 3) Refresh token si expiré =====
    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) <= new Date(Date.now() + 60_000)) {
      const refreshed = await refreshStravaToken(conn.refresh_token);
      if (!refreshed) {
        await markError(sbAdmin, user.id, "token_refresh_failed");
        return json({ error: "token_refresh_failed" }, 500);
      }
      accessToken = refreshed.access_token;
      await ecrireRenouvellementStrava(sbAdmin, user.id, refreshed);
    }

    // ===== 4) Fetch activités paginé =====
    // Sync INCREMENTAL : si des activites existent deja, on ne recupere que celles
    // posterieures a la plus recente (avec 7 jours de recouvrement pour les editions),
    // sauf si le front demande un resync complet ({ full: true }).
    let reqBody: any = {};
    try { reqBody = await req.json(); } catch (_) { reqBody = {}; }
    // Toute resynchro repart du JOUR 0 : les faits Strava (heures, durees,
    // distances, noms) sont rafraichis sur tout l'historique. Les champs
    // CALCULES des lignes existantes (ftp_at_time / intensity / tss) sont
    // preserves plus bas — l'historique de charge n'est jamais recalcule
    // avec le FTP du jour.
    // Mode { hours_only: true } : ne met a jour QUE start_date_local.
    const hoursOnly = reqBody && reqBody.hours_only === true;
    const afterParam = "";
    const all: any[] = [];
    let page = 1;
    while (page <= 50) { // garde-fou
      // Retry sur les 5xx transitoires de Strava (souvent 500 {"message":"error"})
      let res: Response;
      let attempt = 0;
      while (true) {
        res = await fetch(`${STRAVA_API}/athlete/activities?page=${page}&per_page=${PER_PAGE}${afterParam}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.status < 500 || attempt >= 3) break;
        attempt++;
        console.warn(`Strava ${res.status} on page ${page}, retry ${attempt}`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
      if (res.status === 401) {
        await markError(sbAdmin, user.id, "strava_unauthorized");
        return json({ error: "strava_unauthorized" }, 401);
      }
      if (res.status === 429) {
        // Rate limit Strava (100/15min) : on stoppe ce qu'on a déjà
        console.warn("Strava rate limit hit at page", page);
        break;
      }
      if (!res.ok) {
        const txt = await res.text();
        await markError(sbAdmin, user.id, `strava_${res.status}_${txt.slice(0, 80)}`);
        return json({ error: `strava_${res.status}` }, 500);
      }
      const acts = await res.json();
      if (!acts.length) break;
      all.push(...acts);
      if (acts.length < PER_PAGE) break;
      page++;
    }

    if (hoursOnly) {
      let updated = 0;
      for (const a of all) {
        const sdl = a && (a.start_date_local || a.start_date);
        if (!a || !a.id || !sdl) continue;
        const { error: hErr, count } = await sbAdmin
          .from("activities")
          .update({ start_date_local: sdl }, { count: "exact" })
          .eq("user_id", user.id)
          .eq("strava_id", a.id);
        if (!hErr && count) updated += count;
      }
      await sbAdmin.from("connexions_app").update({
        last_sync_status: "ok",
        last_sync_at: new Date().toISOString(),
      }).eq("user_id", user.id).eq("app", "strava");
      return json({ ok: true, hours_only: true, fetched: all.length, updated });
    }

    // ===== 4b) FTP effectif : profil sinon ESTIMÉ (règle commune avec le webhook, voir _shared/charge.ts) =====
    const effFtp = await ftpEffective(sbAdmin, user.id, athleteFtp, all);

    // ===== 5) Mapper au format de notre table =====
    // On écarte les activités à date aberrante (ex. epoch 1970) → jamais insérées.
    const ACT_DATE_FLOOR = "2000-01-01";
    const rows = all
      .filter((a: any) => a && a.id)
      .map((a: any) => stravaToRow(a, user.id, effFtp, athleteLthr))
      .filter((r: any) => {
        const iso = String(r.start_date_local || "").slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso >= ACT_DATE_FLOOR;
      });

    // ===== 5b) Preserve l'historique calcule des lignes existantes =====
    // (sinon un resync jour-0 recalculerait tout au FTP du jour et
    // falsifierait la courbe de charge passee)
    {
      const prev = new Map<string, any>();
      for (let off = 0; ; off += 1000) {
        const { data: ex } = await sbAdmin
          .from("activities")
          .select("strava_id, ftp_at_time, intensity, tss")
          .eq("user_id", user.id)
          .not("strava_id", "is", null)
          .range(off, off + 999);
        (ex || []).forEach((r: any) => prev.set(String(r.strava_id), r));
        if (!ex || ex.length < 1000) break;
      }
      for (const r of rows) {
        const old = prev.get(String(r.strava_id));
        if (old && old.ftp_at_time) {
          r.ftp_at_time = old.ftp_at_time;
          r.intensity = old.intensity;
          r.tss = old.tss;
        }
      }
    }

    // ===== 6) Upsert par batches =====
    let inserted = 0;
    let errors = 0;
    let firstError: string | null = null;
    let firstErrorBatchIndex = -1;
    let firstErrorSample: any = null;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: upErr } = await sbAdmin
        .from("activities")
        .upsert(batch, { onConflict: "user_id,strava_id" });
      if (upErr) {
        console.error(`Upsert batch ${i / BATCH_SIZE} error:`, upErr.message, upErr.details, upErr.hint);
        console.error("Sample row from failing batch:", JSON.stringify(batch[0]));
        errors += batch.length;
        if (!firstError) {
          firstError = `${upErr.message}${upErr.details ? ' | ' + upErr.details : ''}${upErr.hint ? ' | hint: ' + upErr.hint : ''}`;
          firstErrorBatchIndex = i / BATCH_SIZE;
          firstErrorSample = batch[0];
        }
      } else {
        inserted += batch.length;
      }
    }

    // ===== 6a-bis) Courses Strava -> categorie competition =====
    // workout_type Strava : Ride 11 = course, Run 1 = course. On reclasse
    // toute ligne dont la categorie n'a JAMAIS ete choisie par l'utilisateur
    // (category_set_by_user faux) — un choix manuel n'est jamais ecrase.
    {
      const raceIds = all
        .filter((a: any) => a && a.id && (a.workout_type === 11 || a.workout_type === 1))
        .map((a: any) => a.id);
      for (let i = 0; i < raceIds.length; i += 200) {
        const { error: rcErr } = await sbAdmin
          .from("activities")
          .update({ category: "competition" })
          .eq("user_id", user.id)
          .neq("category_set_by_user", true)
          .in("strava_id", raceIds.slice(i, i + 200));
        if (rcErr) console.error("Categorie course:", rcErr.message);
      }
    }

    // ===== 6b) Purge des activités à date aberrante déjà en base (toutes sources) =====
    {
      const { error: delActErr } = await sbAdmin
        .from("activities")
        .delete()
        .eq("user_id", user.id)
        .lt("start_date_local", ACT_DATE_FLOOR);
      if (delActErr) console.error("Purge activités aberrantes:", delActErr.message);
    }

    // ===== 7) daily_metrics =====
    // Plus de calcul ici : le déclencheur SQL sur `activities` (recalc_daily_metrics, qui exclut les étapes
    // fusionnées et va jusqu'à aujourd'hui) recalcule la forme à chaque écriture, et pg_cron chaque nuit.
    const { count: totalActsInDb } = await sbAdmin
      .from("activities").select("id", { count: "exact", head: true }).eq("user_id", user.id);

    // ===== 8) Marquer sync OK =====
    await sbAdmin.from("connexions_app").update({
      last_sync_status: "ok",
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
      total_activities_synced: totalActsInDb || inserted,
    }).eq("user_id", user.id).eq("app", "strava");

    return json({
      ok: true,
      pages_fetched: page,
      activities_received: all.length,
      activities_inserted: inserted,
      activities_errored: errors,
      first_error: firstError,
      first_error_batch: firstErrorBatchIndex,
      first_error_sample: firstErrorSample,
    });
  } catch (e: any) {
    console.error("strava-ingest unhandled:", e);
    return json({ error: "internal_error" }, 500);
  }
}

// ============ HELPERS ============
function reponseJson(corsHeaders: Record<string, string>, body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function markError(sb: any, userId: string, msg: string) {
  await sb.from("connexions_app").update({
    last_sync_status: "error",
    last_sync_error: msg.slice(0, 500),
    last_sync_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("app", "strava");
}

async function refreshStravaToken(refreshToken: string) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}
