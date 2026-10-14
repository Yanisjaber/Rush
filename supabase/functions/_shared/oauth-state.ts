// ============================================================
// Helpers partagés OAuth (Strava) : URLs de retour autorisées,
// état à usage unique, CORS restreint aux origines du site.
// ============================================================
// deno-lint-ignore-file no-explicit-any

// URLs vers lesquelles on peut renvoyer l'utilisateur après l'OAuth
// (liste blanche exacte : évite l'open redirect).
export const ALLOWED_RETURN_URLS = [
  "http://localhost:5173/", // développement local
  "https://yanisjaber.github.io/Rush/",
  "https://yanisjaber.github.io/Rush/index.html",
];
export const FALLBACK_REDIRECT = Deno.env.get("APP_REDIRECT_URL") || "https://yanisjaber.github.io/Rush/";

export const STATE_TTL_MIN = 10;

export function pickSafeReturnUrl(requested: string | null | undefined): string {
  return requested && ALLOWED_RETURN_URLS.includes(requested) ? requested : FALLBACK_REDIRECT;
}

export { corsHeadersFor } from "./cors.ts";

export function newState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Consomme un état : le supprime et le renvoie s'il existe, correspond au
// fournisseur et n'a pas expiré. Usage unique (delete ... returning).
export async function consumeState(sbAdmin: any, state: string, provider: string) {
  const cutoff = new Date(Date.now() - STATE_TTL_MIN * 60_000).toISOString();
  const { data, error } = await sbAdmin
    .from("oauth_states")
    .delete()
    .eq("state", state)
    .eq("provider", provider)
    .gte("created_at", cutoff)
    .select("user_id, return_url")
    .maybeSingle();
  if (error || !data) return null;
  return data as { user_id: string; return_url: string };
}

export function redirectToApp(baseUrl: string, params: Record<string, string>): Response {
  const url = new URL(baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Response.redirect(url.toString(), 302);
}
