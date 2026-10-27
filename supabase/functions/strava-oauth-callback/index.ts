// ============================================================
// Edge Function : strava-oauth-callback
//
// Reçoit le callback OAuth de Strava :
//   GET ?code=XXX&state=<état à usage unique créé par oauth-start>
//
// Consomme l'état (table oauth_states) pour retrouver l'utilisateur et l'URL
// de retour (aucun JWT dans l'URL), puis échange le code contre les tokens
// Strava (via client_secret),
// enregistre la connexion (connexions_app) et les jetons (Vault),
// redirige vers l'app avec un flag de succès.
//
// Déploiement :
//   supabase functions deploy strava-oauth-callback --no-verify-jwt
//
// Secrets requis (à définir avant le deploy) :
//   supabase secrets set STRAVA_CLIENT_ID=248376
//   supabase secrets set STRAVA_CLIENT_SECRET=xxxx
//   supabase secrets set APP_REDIRECT_URL=https://yanisjaber.github.io/Rush/
//
// Note : --no-verify-jwt car Strava appelle cette URL sans en-tête d'auth ;
// l'identité vient de l'état à usage unique (oauth_states).
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { FALLBACK_REDIRECT, consumeState, pickSafeReturnUrl, redirectToApp } from "../_shared/oauth-state.ts";
import { ecrireJetons } from "../_shared/jetons.ts";

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
      // Le texte vient de l'URL : on ne le renvoie à l'app que s'il ressemble à un code d'erreur simple.
      return redirectToApp(returnUrl, { strava_error: /^[a-z_]{1,40}$/.test(error) ? error : "strava_refused" });
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
    // Les droits accordés arrivent dans l'URL de retour (la réponse de l'échange n'en contient en général pas).
    const scopeAccorde = (url.searchParams.get("scope") || tokens.scope || "").slice(0, 200) || null;
    // Connexion déjà présente ? (pour défaire proprement si l'enregistrement des jetons échoue)
    const { data: avant } = await sbAdmin.from("connexions_app").select("id").eq("user_id", user.id).eq("app", "strava").maybeSingle();
    const expiresAt = new Date((tokens.expires_at || 0) * 1000).toISOString();

    const { error: insertErr } = await sbAdmin
      .from("connexions_app")
      .upsert({
        user_id: user.id,
        app: "strava",
        external_id: athlete.id != null ? String(athlete.id) : null,
        athlete_name: `${athlete.firstname || ""} ${athlete.lastname || ""}`.trim() || null,
        expires_at: expiresAt,
        scope: scopeAccorde,
        // first_connected_at n'est pas écrit ici : la base le remplit à la 1re connexion et une reconnexion ne le réécrit pas
      }, { onConflict: "user_id,app" });

    if (insertErr) {
      console.error("Insert connexions_app failed:", insertErr.code || "", insertErr.message || "");
      return redirectToApp(returnUrl, { strava_error: "db_insert_failed" });
    }

    // Les jetons sont chiffrés dans Vault (jamais stockés en clair dans la table)
    try {
      await ecrireJetons(sbAdmin, user.id, "strava", { access_token: tokens.access_token, refresh_token: tokens.refresh_token }, expiresAt);
    } catch (_e) {
      // Pas de connexion « fantôme » (ligne sans jetons) : si elle vient d'être créée, on la retire.
      if (!avant) await sbAdmin.from("connexions_app").delete().eq("user_id", user.id).eq("app", "strava");
      return redirectToApp(returnUrl, { strava_error: "token_save_failed" });
    }

    // ===== 4) Compléter le profil avec le FTP / le poids connus de Strava, SANS jamais écraser ce que l'utilisateur a saisi =====
    // (l'identifiant d'athlète est dans connexions_app.external_id ; le prénom du profil reste celui que l'utilisateur a choisi)
    // On ne remplit que les champs encore vides.
    if (athlete.ftp || athlete.weight) {
      const { data: profil } = await sbAdmin.from("user_profiles").select("ftp, weight").eq("user_id", user.id).maybeSingle();
      const profilStrava: Record<string, unknown> = { user_id: user.id };
      if (athlete.ftp && profil?.ftp == null) profilStrava.ftp = athlete.ftp;
      if (athlete.weight && profil?.weight == null) profilStrava.weight = athlete.weight;
      if (Object.keys(profilStrava).length > 1) await sbAdmin.from("user_profiles").upsert(profilStrava, { onConflict: "user_id" });
    }

    // ===== 5) Redirection vers l'app avec flag de succès =====
    return redirectToApp(returnUrl, { strava_connected: "1" });
  } catch (e) {
    console.error("Unhandled error:", String((e as any)?.message || e).slice(0, 300));
    return redirectToApp(returnUrl, { strava_error: "unexpected" });
  }
});
