// ============================================================
// Edge Function : disconnect-integration
//
// Déconnecte une intégration ET efface toutes les données associées
// de l'utilisateur (option "tout effacer").
//
// Appel (front, POST, JWT Supabase dans Authorization) :
//   body JSON : { "provider": "strava", "wipe": true | false }
//
// wipe=false (déconnexion seule) → supprime UNIQUEMENT la connexion
//   (connexions_app). Les données importées restent.
// wipe=true (déconnexion + suppression) :
//   provider=strava → supprime power_profile, daily_metrics, les activités
//     venues de Strava (pas les séances manuelles), la connexion (connexions_app),
//     et remet à zéro ftp/weight (issus de Strava) dans user_profiles.
//
// Utilise la service_role (bypass RLS) mais ne touche QUE les lignes de
// l'utilisateur identifié par le JWT → un user ne peut effacer que ses données.
//
// Déploiement :
//   supabase functions deploy disconnect-integration
// Secrets : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (déjà présents).
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeadersFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tables de données effaçables (dans l'ordre des clés étrangères).
const STEP_TABLES = ["power_profile", "daily_metrics", "activities"];

// CORS restreint (voir _shared/cors.ts) : renseigné à chaque requête.
let corsHeaders: Record<string, string> = {};

Deno.serve(async (req) => {
  corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "missing_jwt" }, 401);
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "invalid_jwt" }, 401);

    const body = await safeJson(req);
    const provider = String(body?.provider || "").toLowerCase();
    const wipe = body?.wipe === true; // false/absent = déconnexion seule
    const only = body?.only ? String(body.only) : null; // traiter UNE seule étape (barre de progression)
    if (provider !== "strava") {
      return json({ error: "invalid_provider" }, 400);
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const uid = user.id;
    const deleted: Record<string, boolean> = {};

    // ===== Mode "une étape" : le front pilote la progression table par table =====
    if (only) {
      if (only === "user_profiles_reset") {
        if (provider === "strava") {
          await sb.from("user_profiles").update({ ftp: null, weight: null }).eq("user_id", uid);
        }
        return json({ ok: true, step: only });
      }
      if (only === "connexions_app") {
        const { error } = await sb.from("connexions_app").delete().eq("user_id", uid).eq("app", provider);
        if (error) { console.error("delete connexions_app:", error.message); return json({ error: "delete_connexions_app_failed", detail: error.message }, 500); }
        return json({ ok: true, step: only });
      }
      // Liste blanche : on ne laisse jamais le client choisir une table au hasard.
      if (!STEP_TABLES.includes(only)) return json({ error: "invalid_step" }, 400);
      const { error } = await effacerTable(sb, only, uid);
      if (error) { console.error(`delete ${only}:`, error.message); return json({ error: `delete_${only}_failed`, detail: error.message }, 500); }
      return json({ ok: true, step: only });
    }

    // Tables de DONNÉES à vider selon le mode (la connexion est supprimée à part,
    // car elle vit dans la table mutualisée connexions_app filtrée par app).
    // Ordre FK : daily_metrics.main_activity_id et power_profile.activity_id_*
    // référencent activities → on les vide avant activities.
    const tables: string[] = wipe ? STEP_TABLES : [];

    for (const table of tables) {
      const { error } = await effacerTable(sb, table, uid);
      if (error) { console.error(`delete ${table}:`, error.message); return json({ error: `delete_${table}_failed`, detail: error.message }, 500); }
      deleted[table] = true;
    }

    // Supprimer la connexion de cette app uniquement (table mutualisée).
    {
      const { error } = await sb.from("connexions_app").delete().eq("user_id", uid).eq("app", provider);
      if (error) { console.error("delete connexions_app:", error.message); return json({ error: "delete_connexions_app_failed", detail: error.message }, 500); }
      deleted["connexions_app"] = true;
    }

    // En mode wipe Strava, on remet aussi à zéro les infos athlète issues de Strava.
    if (wipe && provider === "strava") {
      await sb.from("user_profiles").update({
        ftp: null, weight: null,
      }).eq("user_id", uid);
      deleted["user_profiles_reset"] = true;
    }

    return json({ ok: true, provider, wipe, deleted });
  } catch (e: any) {
    console.error("disconnect-integration unhandled:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});

// Efface les lignes d'une table pour cet utilisateur. Pour `activities`, on ne
// supprime QUE les séances venues de Strava (strava_id renseigné) : les séances
// saisies à la main ou importées d'un fichier restent, avec leur force/Hyrox.
// daily_metrics est ensuite recalculé par le déclencheur sur `activities`.
function effacerTable(sb: any, table: string, uid: string) {
  let q = sb.from(table).delete().eq("user_id", uid);
  if (table === "activities") q = q.not("strava_id", "is", null);
  return q;
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function safeJson(req: Request): Promise<any> { try { return await req.json(); } catch { return {}; } }
