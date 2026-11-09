// ============================================================
// Edge Function : strava-trace
//
// Renvoie la TRACE (positions GPS, altitude, distance) d'une activité Strava de l'utilisateur connecté, pour la carte et le profil
// d'altitude de l'écran d'une sortie. La synchro Strava ne garde pas les positions (voir strava-streams) : on les demande à Strava
// à l'ouverture de l'écran, et rien n'est stocké.
//
// Appel (front, POST, JWT Supabase dans Authorization) :
//   body JSON : { "activity_id": "<uuid de la ligne activities>" }
//   réponse   : { ok: true, trace: { latlng: [[lat, lon], ...], altitude: [m, ...], distance: [m, ...] } | null,
//                 courbes: { distance|velocity_smooth|heartrate|altitude|cadence|watts: { data: [...] } } | null }
//   (600 points au plus ; trace null quand l'activité n'a pas de GPS ; les courbes servent à la page 2 de la sortie)
//
// Sécurité :
//   - l'activité doit appartenir à l'utilisateur du JWT (filtre user_id côté service role) ;
//   - aucun jeton Strava n'est jamais renvoyé ni journalisé ;
//   - seules des listes de nombres validés sont renvoyées (voir _shared/trace-strava.ts).
//
// Déploiement :
//   supabase functions deploy strava-trace
//
// Secrets requis (déjà définis pour strava-streams) :
//   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeadersFor } from "../_shared/cors.ts";
import { joindreJetons, ecrireRenouvellementStrava } from "../_shared/jetons.ts";
import { nettoyerCourbes, nettoyerTrace } from "../_shared/trace-strava.ts";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STRAVA_API = "https://www.strava.com/api/v3";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let corsHeaders: Record<string, string> = {};

Deno.serve(async (req) => {
  corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // 1) Qui appelle ? (JWT Supabase)
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "missing_jwt" }, 401);
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "invalid_jwt" }, 401);

    // 2) Entrée validée : un uuid, rien d'autre
    const body = await safeJson(req);
    const activityId = String(body?.activity_id || "");
    if (!UUID.test(activityId)) return json({ error: "invalid_activity_id" }, 400);

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 3) L'activité doit être à l'utilisateur et venir de Strava
    const { data: act, error: actErr } = await sbAdmin
      .from("activities").select("id, strava_id").eq("id", activityId).eq("user_id", user.id).maybeSingle();
    if (actErr) return json({ error: "query_failed" }, 500);
    if (!act) return json({ error: "activity_not_found" }, 404);
    if (!act.strava_id) return json({ error: "not_a_strava_activity" }, 400);

    // 4) Jeton Strava de l'utilisateur (rafraîchi si besoin)
    const { data: conn } = await sbAdmin
      .from("connexions_app").select("user_id, app, expires_at")
      .eq("user_id", user.id).eq("app", "strava").maybeSingle();
    if (!conn) return json({ error: "no_strava_connection" }, 400);
    await joindreJetons(sbAdmin, conn); // jetons déchiffrés (Vault)

    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) <= new Date(Date.now() + 60_000)) {
      const refreshed = await refreshStravaToken(conn.refresh_token);
      if (!refreshed) return json({ error: "token_refresh_failed" }, 502);
      accessToken = refreshed.access_token;
      await ecrireRenouvellementStrava(sbAdmin, user.id, refreshed);
    }

    // 5) Positions, altitude et distance de l'activité
    const res = await fetch(
      `${STRAVA_API}/activities/${encodeURIComponent(String(act.strava_id))}/streams?keys=latlng,altitude,distance,velocity_smooth,heartrate,cadence,watts&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 429) return json({ error: "rate_limited" }, 429);
    if (res.status === 404) return json({ ok: true, trace: null, courbes: null }); // pas de flux du tout
    if (!res.ok) return json({ error: "strava_error" }, 502);

    const flux = await res.json();
    return json({ ok: true, trace: nettoyerTrace(flux), courbes: nettoyerCourbes(flux) });
  } catch (e: any) {
    console.error("strava-trace unhandled:", e?.message || "erreur");
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function safeJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}
async function refreshStravaToken(refreshToken: string) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token", refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}
