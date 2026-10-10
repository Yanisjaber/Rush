// ============================================================
// CORS restreint : seules les origines de l'app peuvent appeler les fonctions
// depuis un navigateur (l'authentification reste portée par le JWT Supabase).
// ============================================================

const PROD_ORIGINS = ["https://yanisjaber.github.io"];
// Développement local : n'importe quel port de localhost / 127.0.0.1.
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/;

export function isAllowedOrigin(origin: string): boolean {
  return PROD_ORIGINS.includes(origin) || DEV_ORIGIN.test(origin);
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
