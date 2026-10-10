// ============================================================
// Edge Function : oauth-start
//
// Démarre un flux OAuth (Strava / Whoop) sans exposer le JWT Supabase :
// crée un `state` aléatoire à usage unique (table oauth_states), lié à
// l'utilisateur connecté, que le navigateur envoie ensuite au fournisseur.
//
// Appel (front, POST, JWT Supabase dans Authorization) :
//   body JSON : { "provider": "strava" | "whoop", "returnUrl": "https://…/" }
//   réponse   : { "state": "<hex 64>" }
//
// Déploiement :
//   supabase functions deploy oauth-start
//
// Pré-requis : migration supabase/migrations/2026-10-10_oauth_states.sql
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ALLOWED_RETURN_URLS, STATE_TTL_MIN, corsHeadersFor, newState,
} from "../_shared/oauth-state.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PROVIDERS = ["strava", "whoop"];

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || "");
    const returnUrl = String(body?.returnUrl || "");
    if (!PROVIDERS.includes(provider)) return json({ error: "invalid_provider" }, 400);
    if (!ALLOWED_RETURN_URLS.includes(returnUrl)) return json({ error: "invalid_return_url" }, 400);

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Ménage : états expirés (jamais consommés)
    const cutoff = new Date(Date.now() - STATE_TTL_MIN * 60_000).toISOString();
    await sbAdmin.from("oauth_states").delete().lt("created_at", cutoff);

    const state = newState();
    const { error: insErr } = await sbAdmin.from("oauth_states").insert({
      state, user_id: user.id, provider, return_url: returnUrl,
    });
    if (insErr) {
      console.error("oauth-start insert failed:", insErr);
      return json({ error: "state_insert_failed" }, 500);
    }
    return json({ state });
  } catch (e) {
    console.error("oauth-start unhandled:", e);
    return json({ error: "unexpected" }, 500);
  }
});
