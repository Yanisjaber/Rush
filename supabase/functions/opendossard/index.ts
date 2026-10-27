// ============================================================
// Edge Function : opendossard
//
// Proxy serveur vers l'API Open Dossard (https://app-v2.opendossard.com/api/v2).
// Les identifiants Open Dossard restent CÔTÉ SERVEUR (secrets) — le navigateur
// ne les voit jamais. Le front appelle cette fonction avec son JWT Supabase.
//
// Appel (front, POST, JWT Supabase dans Authorization) :
//   body JSON : { "action": "...", ...params }
//   actions :
//     - "search-licence"  { q }                 → recherche de licence (nom / numéro)
//     - "palmares"        { licenceId }          → palmarès + résultats du coureur
//     - "competitions"    { filters? }           → liste d'épreuves (filtres OD)
//
// Déploiement :
//   supabase secrets set OPENDOSSARD_EMAIL=... OPENDOSSARD_PASSWORD=...
//   supabase functions deploy opendossard
// Secrets requis : OPENDOSSARD_EMAIL, OPENDOSSARD_PASSWORD,
//                  SUPABASE_URL, SUPABASE_ANON_KEY (déjà présents).
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeadersFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OD_EMAIL = Deno.env.get("OPENDOSSARD_EMAIL") || "";
const OD_PASSWORD = Deno.env.get("OPENDOSSARD_PASSWORD") || "";
const OD_BASE = "https://app-v2.opendossard.com/api/v2";

// Plafond d'appels par utilisateur (les identifiants Open Dossard sont partagés par tous les comptes) :
// 30 appels par minute, compté dans la mémoire de l'instance.
const MAX_APPELS = 30;
const FENETRE_MS = 60_000;
const appels = new Map<string, number[]>();
function tropDAppels(userId: string): boolean {
  const maintenant = Date.now();
  const recents = (appels.get(userId) || []).filter((t) => maintenant - t < FENETRE_MS);
  recents.push(maintenant);
  appels.set(userId, recents);
  if (appels.size > 5000) appels.clear(); // garde-fou mémoire
  return recents.length > MAX_APPELS;
}

// Cache du token OD en mémoire de l'instance (réutilisé tant qu'il est valide).
let _odToken: string | null = null;

async function odLogin(): Promise<string> {
  const res = await fetch(`${OD_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: OD_EMAIL, password: OD_PASSWORD }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`od_login_failed_${res.status}:${txt.slice(0, 120)}`);
  }
  const data = await res.json();
  if (!data.accessToken) throw new Error("od_login_no_token");
  _odToken = data.accessToken;
  return _odToken;
}

// GET sur l'API OD avec bearer ; re-login une fois si 401.
async function odGet(path: string): Promise<any> {
  if (!_odToken) await odLogin();
  let res = await fetch(`${OD_BASE}${path}`, {
    headers: { "Authorization": `Bearer ${_odToken}` },
  });
  if (res.status === 401) {
    await odLogin();
    res = await fetch(`${OD_BASE}${path}`, {
      headers: { "Authorization": `Bearer ${_odToken}` },
    });
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`od_get_failed_${res.status}:${txt.slice(0, 160)}`);
  }
  return res.json();
}

function qs(params: Record<string, any>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

// CORS restreint (voir _shared/cors.ts) : les en-têtes sont calculés PAR requête (pas de variable partagée
// entre deux requêtes simultanées).
Deno.serve((req) => gerer(req, corsHeadersFor(req)));

async function gerer(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
  const json = (body: any, status = 200) => reponseJson(corsHeaders, body, status);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) Auth Supabase : seul un utilisateur connecté peut appeler la fonction.
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "missing_jwt" }, 401);
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "invalid_jwt" }, 401);

    if (tropDAppels(user.id)) return json({ error: "rate_limited" }, 429);

    if (!OD_EMAIL || !OD_PASSWORD) {
      console.error("opendossard: secrets OPENDOSSARD_EMAIL / OPENDOSSARD_PASSWORD manquants");
      return json({ error: "od_credentials_missing" }, 500);
    }

    // 2) Routage par action
    const body = await safeJson(req);
    const action = String(body?.action || "");

    if (action === "search-licence") {
      const q = String(body?.q || "").trim().slice(0, 80);
      if (!q) return json({ error: "missing_q" }, 400);
      // /licences/search?q= renvoie les licences correspondantes
      const data = await odGet(`/licences/search${qs({ q })}`);
      return json({ ok: true, results: data });
    }

    if (action === "palmares") {
      const licenceId = parseInt(String(body?.licenceId), 10);
      if (!licenceId) return json({ error: "missing_licenceId" }, 400);
      const data = await odGet(`/races/palmares/${licenceId}`);
      return json({ ok: true, palmares: data });
    }

    if (action === "competitions") {
      const f = body?.filters || {};
      // Bornes : pas de limite géante, textes courts, tri parmi des valeurs connues.
      const borne = (v: any, min: number, max: number, defaut: number) => {
        const n = parseInt(String(v), 10);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
      };
      const texte = (v: any) => (v == null ? undefined : String(v).slice(0, 80));
      const data = await odGet(`/competitions${qs({
        offset: borne(f.offset, 0, 10000, 0), limit: borne(f.limit, 1, 50, 30),
        search: texte(f.search), dept: texte(f.dept), fede: texte(f.fede),
        competitionType: texte(f.competitionType),
        startDate: texte(f.startDate), endDate: texte(f.endDate),
        orderBy: f.orderBy === "eventDate" || f.orderBy === "name" ? f.orderBy : "eventDate",
        orderDirection: f.orderDirection === "DESC" ? "DESC" : "ASC",
      })}`);
      return json({ ok: true, competitions: data });
    }

    return json({ error: "unknown_action", action }, 400);
  } catch (e: any) {
    // Le détail (réponse d'Open Dossard) reste dans les journaux, jamais renvoyé au navigateur.
    console.error("opendossard unhandled:", String(e?.message || e).slice(0, 300));
    const enAmont = String(e?.message || "").startsWith("od_");
    return json({ error: enAmont ? "od_upstream_error" : "internal_error" }, enAmont ? 502 : 500);
  }
}

function reponseJson(corsHeaders: Record<string, string>, body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function safeJson(req: Request): Promise<any> { try { return await req.json(); } catch { return {}; } }
