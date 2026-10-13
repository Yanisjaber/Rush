// ============================================================
// Edge Function : delete-account
//
// Supprime DÉFINITIVEMENT le compte de l'utilisateur connecté et toutes ses données.
//   1. (au mieux) révoque l'autorisation de l'app chez Strava ;
//   2. supprime l'utilisateur Supabase Auth : toutes les tables de l'app sont reliées à auth.users
//      avec « on delete cascade », donc ses lignes disparaissent avec lui.
//
// Appel (front, POST, JWT Supabase dans Authorization) :
//   body JSON : { "confirmation": "SUPPRIMER", "etape": "preparer" | "purger" | "supprimer" }
//     - confirmation exigée, pour éviter tout appel accidentel ;
//     - etape (3 appels successifs, ce qui permet une barre d'avancement et évite qu'une suppression trop longue soit coupée) :
//         "preparer"  : révoque l'accès chez Strava (au mieux) et renvoie { ok, total } = nombre de lignes lourdes à effacer ;
//         "purger"    : efface un lot de données lourdes et renvoie { ok, restant, total } (à répéter jusqu'à restant = 0) ;
//         "supprimer" : supprime le compte (le reste part en cascade) ;
//     - sans etape : ancien comportement en un seul appel (révocation Strava, puis suppression du compte).
//   réponse   : { ok: true, ... }
//
// Sécurité :
//   - on ne supprime que l'utilisateur identifié par le JWT : jamais un identifiant fourni par le client ;
//   - aucun jeton n'est renvoyé ni journalisé.
//
// Déploiement : supabase functions deploy delete-account
// Secrets : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeadersFor } from "../_shared/cors.ts";
import { lireJetons } from "../_shared/jetons.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Taille d'un lot de suppression (petit : chaque lot reste court et ne peut pas être coupé)
const LOT = 300;

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

    // 2) Confirmation explicite
    const body = await safeJson(req);
    if (body?.confirmation !== "SUPPRIMER") return json({ error: "confirmation_required" }, 400);

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const etape = body?.etape === undefined ? "tout" : String(body.etape);
    if (!["tout", "preparer", "purger", "supprimer"].includes(etape)) return json({ error: "invalid_step" }, 400);

    // Étape « purger » : un lot de données lourdes (métriques, courbes, activités), l'utilisateur vient toujours du JWT
    if (etape === "purger") {
      const { data, error } = await sbAdmin.rpc("rpc_purge_compte", { p_user: user.id, p_lot: LOT });
      if (error) {
        console.error("delete-account: purge échouée", error.code || "", error.message || "");
        return json({ error: "purge_failed" }, 500);
      }
      return json({ ok: true, restant: Number(data?.total ?? 0) });
    }

    // Étape « supprimer » : le compte lui-même (la cascade efface le reste, désormais léger)
    if (etape === "supprimer") return await supprimerUtilisateur(sbAdmin, user.id);

    // Étapes « preparer » et « tout » : 3) Révocation chez Strava, au mieux (si elle échoue, la suppression continue :
    //    l'utilisateur peut toujours retirer l'app depuis ses réglages Strava).
    try {
      const jetons = await lireJetons(sbAdmin, user.id, "strava");
      if (jetons?.access_token) {
        await fetch("https://www.strava.com/oauth/deauthorize", {
          method: "POST",
          headers: { Authorization: `Bearer ${jetons.access_token}` },
        });
      }
    } catch (_e) {
      // volontairement ignoré
    }

    if (etape === "preparer") {
      const { data, error } = await sbAdmin.rpc("rpc_purge_compte", { p_user: user.id, p_lot: 0 }); // lot 0 = juste compter
      if (error) {
        console.error("delete-account: comptage échoué", error.code || "", error.message || "");
        return json({ error: "count_failed" }, 500);
      }
      return json({ ok: true, total: Number(data?.total ?? 0) });
    }

    // Ancien comportement (sans etape) : suppression directe
    return await supprimerUtilisateur(sbAdmin, user.id);
  } catch (_e) {
    console.error("delete-account unhandled");
    return json({ error: "internal_error" }, 500);
  }
});

// Suppression de l'utilisateur Supabase Auth ; on journalise la vraie cause en cas d'échec (jamais de jeton)
async function supprimerUtilisateur(sbAdmin: any, userId: string): Promise<Response> {
  const { error: delErr } = await sbAdmin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("delete-account: deleteUser a échoué", delErr.status || "", delErr.code || "", String(delErr.message || "").slice(0, 200));
    return json({ error: "delete_failed" }, 500);
  }
  return json({ ok: true });
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function safeJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}
