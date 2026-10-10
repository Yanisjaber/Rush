// ============================================================
// Edge Function : whoop-oauth-callback
//
// Reçoit le callback OAuth de Whoop :  GET ?code=XXX&state=<état à usage unique créé par oauth-start>
//
// 1. consomme l'état (oauth_states) → utilisateur + URL de retour
// 2. vérifie le JWT (identité de l'utilisateur Supabase)
// 3. échange le code contre les tokens Whoop (avec client_secret, redirect_uri)
// 4. récupère le profil Whoop (whoop_user_id)
// 5. stocke dans whoop_connections (service_role → bypass RLS)
// 6. redirige vers l'app avec ?whoop_connected=1
//
// Déploiement :
//   supabase functions deploy whoop-oauth-callback --no-verify-jwt
//
// Secrets requis :
//   supabase secrets set WHOOP_CLIENT_ID=xxxx
//   supabase secrets set WHOOP_CLIENT_SECRET=xxxx
//   supabase secrets set WHOOP_REDIRECT_URI=https://<projet>.supabase.co/functions/v1/whoop-oauth-callback
//   (WHOOP_REDIRECT_URI doit être IDENTIQUE à celui envoyé par le front et
//    déclaré dans le portail développeur Whoop.)
//   APP_REDIRECT_URL (déjà défini pour Strava) sert de fallback de redirection.
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FALLBACK_REDIRECT, consumeState, pickSafeReturnUrl, redirectToApp } from "../_shared/oauth-state.ts";

const WHOOP_CLIENT_ID = Deno.env.get("WHOOP_CLIENT_ID")!;
const WHOOP_CLIENT_SECRET = Deno.env.get("WHOOP_CLIENT_SECRET")!;
const WHOOP_REDIRECT_URI = Deno.env.get("WHOOP_REDIRECT_URI")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API = "https://api.prod.whoop.com/developer/v2";


Deno.serve(async (req) => {
  let returnUrl = FALLBACK_REDIRECT;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) return redirectToApp(returnUrl, { whoop_error: error });
    if (!code || !state) return redirectToApp(returnUrl, { whoop_error: "missing_code_or_state" });

    // ===== 1) Consommer l'état (usage unique) : identifie l'utilisateur =====
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const consumed = await consumeState(sbAdmin, state, "whoop");
    if (!consumed) return redirectToApp(returnUrl, { whoop_error: "invalid_state" });
    returnUrl = pickSafeReturnUrl(consumed.return_url);
    const user = { id: consumed.user_id };

    // ===== 2) Échanger le code contre les tokens (form-encoded) =====
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: WHOOP_CLIENT_ID,
      client_secret: WHOOP_CLIENT_SECRET,
      redirect_uri: WHOOP_REDIRECT_URI,
    });
    const tokenRes = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("Whoop token exchange failed:", tokenRes.status, txt);
      return redirectToApp(returnUrl, { whoop_error: `token_exchange_${tokenRes.status}` });
    }
    const tokens: any = await tokenRes.json();
    if (!tokens.access_token) return redirectToApp(returnUrl, { whoop_error: "no_access_token" });

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000 - 60_000).toISOString();

    // ===== 3) Récupérer le profil Whoop (id + nom) =====
    let whoopUserId: string | null = null;
    let athleteName: string | null = null;
    try {
      const profRes = await fetch(`${WHOOP_API}/user/profile/basic`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profRes.ok) {
        const prof = await profRes.json();
        whoopUserId = prof?.user_id != null ? String(prof.user_id) : null;
        athleteName = `${prof?.first_name || ""} ${prof?.last_name || ""}`.trim() || null;
      }
    } catch (_) { /* non bloquant */ }

    // ===== 4) Stocker dans whoop_connections =====
    const { error: upErr } = await sbAdmin.from("connexions_app").upsert({
      user_id: user.id,
      app: "whoop",
      external_id: whoopUserId != null ? String(whoopUserId) : null,
      athlete_name: athleteName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      first_connected_at: new Date().toISOString(),
      last_sync_status: "connected",
    }, { onConflict: "user_id,app" });
    if (upErr) {
      console.error("Insert whoop_connections failed:", upErr);
      return redirectToApp(returnUrl, { whoop_error: "db_insert_failed" });
    }

    return redirectToApp(returnUrl, { whoop_connected: "1" });
  } catch (e) {
    console.error("whoop-oauth-callback unhandled:", e);
    return redirectToApp(returnUrl, { whoop_error: "unexpected" });
  }
});
