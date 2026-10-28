// ============================================================
// Edge Function : strava-webhook
//
// Reçoit les events Strava en temps réel via leur système de webhooks
// (https://developers.strava.com/docs/webhooks/).
//
// Flow :
//   GET ?hub.mode=subscribe&hub.challenge=XXX&hub.verify_token=YYY
//     → Strava valide l'URL lors de l'inscription. On renvoie le challenge
//       en JSON si le verify_token matche le nôtre.
//
//   POST { aspect_type, event_time, object_id, object_type, owner_id, ... }
//     → On traite l'event :
//       - object_type=activity, aspect_type=create  → fetch + insert
//       - object_type=activity, aspect_type=update  → fetch + upsert (TSS/IF peut changer)
//       - object_type=activity, aspect_type=delete  → delete
//       - object_type=athlete, updates.authorized=false → désauthorisation, on supprime
//         la strava_connection (l'user reste, juste plus de sync auto)
//
// Déploiement :
//   supabase functions deploy strava-webhook --no-verify-jwt
//
// Secrets requis :
//   STRAVA_CLIENT_ID
//   STRAVA_CLIENT_SECRET
//   SUPABASE_URL (auto)
//   SUPABASE_SERVICE_ROLE_KEY (auto)
//   STRAVA_WEBHOOK_VERIFY_TOKEN  ← à définir, une chaîne aléatoire qu'on partage avec Strava
//   STRAVA_WEBHOOK_SUBSCRIPTION_ID ← id de l'abonnement (GET /push_subscriptions), filtre les faux events
//
// Abonnement (1 seule fois, voir docs/installation/SETUP_STRAVA_WEBHOOK.md) :
//   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
//     -F client_id=$STRAVA_CLIENT_ID \
//     -F client_secret=$STRAVA_CLIENT_SECRET \
//     -F callback_url=https://<projet>.supabase.co/functions/v1/strava-webhook \
//     -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
//
// Note : Strava n'autorise QU'UN SEUL abonnement actif par client_id.
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { joindreJetons, ecrireRenouvellementStrava } from "../_shared/jetons.ts";
import { stravaToRow, lthrEffectif, ftpEffective } from "../_shared/charge.ts";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Pas de valeur par défaut : sans secret défini, la validation Strava est refusée.
const VERIFY_TOKEN = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN") || "";
// Id de l'abonnement Strava (GET /push_subscriptions). Strava ne signe pas les
// events : on vérifie au moins que subscription_id correspond au nôtre.
const SUBSCRIPTION_ID = Deno.env.get("STRAVA_WEBHOOK_SUBSCRIPTION_ID") || "";

const STRAVA_API = "https://www.strava.com/api/v3";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ============================================================
  // 1) GET — Strava validation challenge (au moment de l'abonnement)
  // ============================================================
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    console.log(`[webhook] GET validation : mode=${mode} token=${token ? "(set)" : "(missing)"}`);
    if (VERIFY_TOKEN && mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return json({ "hub.challenge": challenge });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ============================================================
  // 2) POST — Event Strava
  // ============================================================
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let event: any;
  try {
    event = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  console.log("[webhook] event:", JSON.stringify({ object_type: event?.object_type, aspect_type: event?.aspect_type, object_id: event?.object_id }));

  // Strava n'authentifie pas ses events : on écarte ceux qui ne viennent pas de NOTRE abonnement.
  // Le filtre est OBLIGATOIRE : sans STRAVA_WEBHOOK_SUBSCRIPTION_ID, aucun event n'est traité
  // (n'importe qui pourrait sinon déclencher des appels à Strava avec de faux events).
  // (200 pour éviter les retentatives, mais aucun traitement.)
  if (!SUBSCRIPTION_ID) {
    console.error("[webhook] STRAVA_WEBHOOK_SUBSCRIPTION_ID non défini : event ignoré");
    return json({ ok: true });
  }
  if (String(event?.subscription_id ?? "") !== SUBSCRIPTION_ID) {
    console.warn("[webhook] subscription_id inattendu, event ignoré");
    return json({ ok: true });
  }

  // ⚠ IMPORTANT : Strava attend une réponse 200 RAPIDEMENT (< 2s) sinon il retente.
  // On retourne tout de suite, puis on traite en arrière-plan.
  const responsePromise = (async () => {
    try {
      await handleEvent(event);
    } catch (e) {
      console.error("[webhook] handleEvent error:", e);
    }
  })();

  // Cas spécial Deno : utiliser EdgeRuntime.waitUntil pour finir le traitement
  // après avoir répondu. Fallback : attendre normalement.
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(responsePromise);
  } else {
    await responsePromise;
  }

  return json({ ok: true });
});

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
async function handleEvent(event: any) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const objectType = event.object_type;
  const aspectType = event.aspect_type;
  const objectId = event.object_id;
  const ownerId = event.owner_id;
  const updates = event.updates || {};

  if (!ownerId) {
    console.warn("[webhook] no owner_id, skipping");
    return;
  }

  // ===== Désauthorisation =====
  // Si l'athlète a révoqué l'autorisation de l'app via Strava → on supprime la connection.
  if (objectType === "athlete" && updates.authorized === "false") {
    console.log(`[webhook] deauth annoncée pour athlete ${ownerId} : vérification auprès de Strava`);
    const { data: authConns } = await sb.from("connexions_app").select("*")
      .eq("app", "strava").eq("external_id", String(ownerId));
    for (const c of authConns || []) {
      await joindreJetons(sb, c); // jetons déchiffrés (Vault)
      // Le refresh_token ne marche plus ssi l'accès a vraiment été révoqué.
      const refreshed = await refreshStravaToken(c.refresh_token);
      if (refreshed) {
        console.warn(`[webhook] deauth ignorée pour user ${c.user_id} : l'accès Strava est toujours valide`);
        await ecrireRenouvellementStrava(sb, c.user_id, refreshed);
      } else {
        await sb.from("connexions_app").delete().eq("user_id", c.user_id).eq("app", "strava");
      }
    }
    return;
  }

  // ===== Events sur activités =====
  if (objectType !== "activity") {
    console.log(`[webhook] event ignoré : object_type=${objectType}`);
    return;
  }

  // Récupère TOUTES les connections liées à cet athlète Strava (external_id ; peut être >1 user)
  const { data: conns } = await sb
    .from("connexions_app")
    .select("*")
    .eq("app", "strava")
    .eq("external_id", String(ownerId));

  if (!conns || conns.length === 0) {
    console.warn(`[webhook] aucune connection pour athlete ${ownerId}`);
    return;
  }

  for (const conn of conns) {
    try {
      await joindreJetons(sb, conn); // jetons déchiffrés (Vault)
      if (aspectType === "delete") {
        // On ne supprime que si Strava confirme que l'activité n'existe plus (404).
        if (await stravaActivityStillExists(sb, conn, objectId)) {
          console.warn(`[webhook] delete ignoré : activité ${objectId} toujours présente chez Strava`);
        } else {
          await handleActivityDelete(sb, conn.user_id, objectId);
        }
      } else {
        // create ou update : on (re)fetch l'activité complète
        await handleActivityUpsert(sb, conn, objectId);
      }
      // Marquer le temps de dernier event reçu
      await sb.from("connexions_app").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "ok",
      }).eq("user_id", conn.user_id).eq("app", "strava");
    } catch (e: any) {
      console.error(`[webhook] erreur user ${conn.user_id}:`, e);
      await sb.from("connexions_app").update({
        last_sync_status: "error",
        last_sync_error: String(e?.message || e).slice(0, 500),
      }).eq("user_id", conn.user_id).eq("app", "strava");
    }
  }
}

// Renvoie true si l'activité existe encore chez Strava (ou en cas de doute :
// on préfère ne rien supprimer).
async function stravaActivityStillExists(sb: any, conn: any, activityId: number): Promise<boolean> {
  let accessToken = conn.access_token;
  if (new Date(conn.expires_at) <= new Date(Date.now() + 60_000)) {
    const refreshed = await refreshStravaToken(conn.refresh_token);
    if (!refreshed) return true;
    accessToken = refreshed.access_token;
    await ecrireRenouvellementStrava(sb, conn.user_id, refreshed);
  }
  const res = await fetch(`${STRAVA_API}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.status !== 404;
}

// ============================================================
// CREATE / UPDATE : fetch + upsert
// ============================================================
async function handleActivityUpsert(sb: any, conn: any, activityId: number) {
  // 1) Token refresh si nécessaire
  let accessToken = conn.access_token;
  if (new Date(conn.expires_at) <= new Date(Date.now() + 60_000)) {
    const refreshed = await refreshStravaToken(conn.refresh_token);
    if (!refreshed) throw new Error("token_refresh_failed");
    accessToken = refreshed.access_token;
    await ecrireRenouvellementStrava(sb, conn.user_id, refreshed);
  }

  // 2) Fetch activité depuis Strava
  const res = await fetch(`${STRAVA_API}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) {
    console.warn(`[webhook] activité ${activityId} introuvable (probablement supprimée)`);
    await handleActivityDelete(sb, conn.user_id, activityId);
    return;
  }
  if (!res.ok) throw new Error(`strava_api_${res.status}`);
  const activity = await res.json();

  // 3) Récupérer FTP/HRmax/LTHR de l'user pour le calcul TSS
  const { data: profile } = await sb
    .from("user_profiles")
    .select("ftp, hr_max, lthr")
    .eq("user_id", conn.user_id)
    .maybeSingle();
  // FTP : profil sinon estimée (même règle que la synchro complète, voir _shared/charge.ts)
  const ftp = await ftpEffective(sb, conn.user_id, profile?.ftp || null, [activity]);
  const lthr = lthrEffectif(profile);

  // 4) Mapper + upsert
  const row = stravaToRow(activity, conn.user_id, ftp, lthr);
  const { error: upErr } = await sb
    .from("activities")
    .upsert(row, { onConflict: "user_id,strava_id" });
  if (upErr) throw upErr;
  console.log(`[webhook] activité ${activityId} (${row.name}) upserted pour user ${conn.user_id}`);

  // Course Strava (workout_type Ride 11 / Run 1) -> categorie competition,
  // sauf si la categorie a ete choisie par l'utilisateur (jamais ecrasee).
  if (activity.workout_type === 11 || activity.workout_type === 1) {
    await sb.from("activities")
      .update({ category: "competition" })
      .eq("user_id", conn.user_id)
      .eq("strava_id", activityId)
      .neq("category_set_by_user", true);
  }

  // 5) daily_metrics : recalculé par le déclencheur SQL sur `activities` (plus de calcul ici)
}

// ============================================================
// DELETE : supprimer activité
// ============================================================
async function handleActivityDelete(sb: any, userId: string, activityId: number) {
  const { error: delErr } = await sb
    .from("activities")
    .delete()
    .eq("user_id", userId)
    .eq("strava_id", activityId);
  if (delErr) throw delErr;
  console.log(`[webhook] activité ${activityId} supprimée pour user ${userId}`);
  // daily_metrics : recalculé par le déclencheur SQL sur `activities`
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
