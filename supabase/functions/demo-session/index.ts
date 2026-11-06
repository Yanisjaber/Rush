// ============================================================
// Edge Function : demo-session
//
// Le bouton « Essayer la démo » de l'app : renvoie une session (jetons) du COMPTE DE DÉMO, un vrai compte rempli de séances simulées (supabase/seed-demo/semer-demo.mts),
// en LECTURE SEULE (règles restrictives de 2026-11-05_compte_demo_lecture_seule.sql). Le mot de passe du compte n'est jamais dans l'app : il vit dans les secrets de cette fonction.
//
// Appel (app, POST, sans compte) : réponse { access_token, refresh_token, expires_in } ; l'app fait ensuite `supabase.auth.setSession(...)`.
//
// Sécurité :
//   - aucune entrée n'est lue : la fonction ne peut renvoyer qu'une session du compte de démo, jamais celle d'un autre compte ;
//   - le compte de démo ne peut rien écrire (RLS) et n'a aucune connexion Strava ;
//   - CORS limité aux origines de l'app (_shared/cors.ts).
//
// Déploiement (appelée AVANT toute connexion, donc sans vérification du JWT) :
//   supabase functions deploy demo-session --no-verify-jwt
//
// Secrets : DEMO_EMAIL, DEMO_PASSWORD (posés par le script de remplissage), SUPABASE_URL, SUPABASE_ANON_KEY (déjà définis).
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeadersFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const email = Deno.env.get("DEMO_EMAIL");
  const password = Deno.env.get("DEMO_PASSWORD");
  if (!email || !password) return json({ error: "demo_indisponible" }, 503);

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: "demo_indisponible" }, 503);
    const { access_token, refresh_token, expires_in } = data.session;
    return json({ access_token, refresh_token, expires_in });
  } catch (_e) {
    return json({ error: "demo_indisponible" }, 503);
  }
});
