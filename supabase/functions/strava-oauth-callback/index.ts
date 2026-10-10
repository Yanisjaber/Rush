// ============================================================
// Edge Function : strava-oauth-callback
//
// Reçoit le callback OAuth de Strava :
//   GET ?code=XXX&state=<état à usage unique créé par oauth-start>
//
// Consomme l'état (table oauth_states) pour retrouver l'utilisateur et l'URL
// de retour (aucun JWT dans l'URL), puis échange le code contre les tokens
// Strava (via client_secret),
// stocke dans la table strava_connections,
// redirige vers l'app avec un flag de succès.
//
// Déploiement :
//   supabase functions deploy strava-oauth-callback --no-verify-jwt
//
// Secrets requis (à définir avant le deploy) :
//   supabase secrets set STRAVA_CLIENT_ID=248376
//   supabase secrets set STRAVA_CLIENT_SECRET=xxxx
//   supabase secrets set APP_REDIRECT_URL=https://yanisjaber.github.io/coach-ia/
//
// Note : --no-verify-jwt car Strava appelle cette URL sans en-tête d'auth ;
// l'identité vient de l'état à usage unique (oauth_states).
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { FALLBACK_REDIRECT, consumeState, pickSafeReturnUrl, redirectToApp } from "../_shared/oauth-state.ts";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  let returnUrl = FALLBACK_REDIRECT;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return redirectToApp(returnUrl, { strava_error: error });
    }
    if (!code || !state) {
      return redirectToApp(returnUrl, { strava_error: "missing_code_or_state" });
    }

    // ===== 1) Consommer l'état (usage unique) : identifie l'utilisateur =====
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const consumed = await consumeState(sbAdmin, state, "strava");
    if (!consumed) return redirectToApp(returnUrl, { strava_error: "invalid_state" });
    returnUrl = pickSafeReturnUrl(consumed.return_url);
    const user = { id: consumed.user_id };

    // ===== 2) Échanger le code Strava contre les tokens =====
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("Strava token exchange failed:", tokenRes.status, txt);
      return redirectToApp(returnUrl, { strava_error: `token_exchange_${tokenRes.status}` });
    }

    const tokens: any = await tokenRes.json();
    if (!tokens.access_token) {
      return redirectToApp(returnUrl, { strava_error: "no_access_token" });
    }

    // ===== 3) Stocker dans connexions_app (service_role pour bypass RLS) =====
    const athlete = tokens.athlete || {};
    const expiresAt = new Date((tokens.expires_at || 0) * 1000).toISOString();

    const { error: insertErr } = await sbAdmin
      .from("connexions_app")
      .upsert({
        user_id: user.id,
        app: "strava",
        external_id: athlete.id != null ? String(athlete.id) : null,
        athlete_name: `${athlete.firstname || ""} ${athlete.lastname || ""}`.trim() || null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope || null,
        first_connected_at: new Date().toISOString(),
      }, { onConflict: "user_id,app" });

    if (insertErr) {
      console.error("Insert strava_connections failed:", insertErr);
      return redirectToApp(returnUrl, { strava_error: "db_insert_failed" });
    }

    // ===== 4) Mettre à jour aussi user_profiles avec FTP / weight / strava_athlete_id =====
    await sbAdmin
      .from("user_profiles")
      .upsert({
        user_id: user.id,
        display_name: `${athlete.firstname || ""} ${athlete.lastname || ""}`.trim() || null,
        strava_athlete_id: athlete.id,
        ftp: athlete.ftp || null,
        weight: athlete.weight || null,
      }, { onConflict: "user_id" });

    // ===== 5) Redirection vers l'app avec flag de succès =====
    return redirectToApp(returnUrl, { strava_connected: "1" });
  } catch (e) {
    console.error("Unhandled error:", e);
    return redirectToApp(returnUrl, { strava_error: "unexpected" });
  }
});
