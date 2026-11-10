// ============================================================
// Edge Function : coach-analyse-sortie — le retour du coach sur UNE sortie (page 4 de l'écran d'une sortie, docs/ia/ANALYSE_SORTIE.md).
//
// Appel (POST, JWT Supabase dans Authorization, corps JSON de 10 Ko au plus) :
//   { "activity_id": "<uuid>", "signaux": { type, allures_km, fc_km, fc_max, derive_pct, zones_pct, zones_estimees, cadence_moy, cadence_cv_pct } }
//   → { ok: true, paragraphes: ["…", …], depuis_cache: bool }   (les chiffres importants sont entourés de [[ ]])
//   → { ok: false, error, message } avec le bon statut HTTP (403 sans accès ou sans accord, 404, 422, 502…)
//
// Sécurité :
//   - l'utilisateur vient du JWT vérifié, jamais du corps ; la sortie est lue avec SON jeton (RLS) : une sortie d'un autre compte est « introuvable » ;
//   - liste blanche (coach_acces) et accord de partage (coach_reglages) comme le chat ;
//   - la requête ne contient que des nombres bornés et un type fermé : aucun texte externe n'arrive jusqu'au modèle (nom de sortie, notes, Strava) ;
//   - le modèle n'a aucun outil et n'écrit nulle part ; la lettre est relue (chaque chiffre doit venir des faits), sinon refusée ;
//   - seule cette fonction écrit dans sortie_analyses (service role) ; les journaux ne contiennent que des nombres ;
//   - CORS restreint (_shared/cors.ts).
//
// Déploiement : supabase functions deploy coach-analyse-sortie
// Secrets : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (déjà là), ANTHROPIC_API_KEY ; facultatif : COACH_MODELE (claude-haiku-5-5)
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import { analyserSortie } from '../_shared/analyse-sortie-service.ts';
import type { DepsAnalyse } from '../_shared/analyse-sortie-service.ts';
import { CONFIG_PAR_DEFAUT } from '../_shared/coach-chat.ts';
import { corsHeadersFor } from '../_shared/cors.ts';
import { creerClientAnthropic } from '../coach-chat/modele-anthropic.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TAILLE_MAX_CORPS = 10_000;
const COLONNES = 'sport,moving_time,elapsed_time,distance_km,total_elevation_gain,avg_heartrate,avg_watts,np';

Deno.serve((req) => gerer(req, corsHeadersFor(req)));

async function gerer(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
  const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!jwt) return json({ error: 'missing_jwt' }, 401);
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'invalid_jwt' }, 401);

    const brut = await req.text();
    if (brut.length > TAILLE_MAX_CORPS) return json({ ok: false, error: 'corps_trop_gros', message: 'Requête trop grande.' }, 413);
    let corps: unknown;
    try {
      corps = JSON.parse(brut);
    } catch {
      return json({ ok: false, error: 'json_invalide', message: 'Requête invalide.' }, 400);
    }

    const cle = Deno.env.get('ANTHROPIC_API_KEY');
    if (!cle) {
      console.error('coach-analyse-sortie: ANTHROPIC_API_KEY absente');
      return json({ ok: false, error: 'service_non_configure', message: 'Le coach est indisponible pour le moment.' }, 503);
    }
    const modele = Deno.env.get('COACH_MODELE') || CONFIG_PAR_DEFAUT.modele;
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Une lecture qui échoue fait échouer la demande (jamais « autorisé par défaut »)
    const lecture = (nom: string, error: any) => {
      console.error(`coach-analyse-sortie: ${nom} échouée`, error?.code || '');
      throw new Error('base');
    };
    const deps: DepsAnalyse = {
      modele: creerClientAnthropic({ apiKey: cle, modele }),
      nomModele: modele,
      async aAcces(userId) {
        const { data, error } = await sbUser.from('coach_acces').select('user_id').eq('user_id', userId).maybeSingle();
        if (error) lecture('accès', error);
        return !!data;
      },
      async accordDonnees(userId) {
        const { data, error } = await sbUser.from('coach_reglages').select('accord_donnees').eq('user_id', userId).maybeSingle();
        if (error) lecture('accord', error);
        return data?.accord_donnees === true;
      },
      async lireActivite(userId, id) {
        const { data, error } = await sbUser.from('activities').select(COLONNES).eq('id', id).eq('user_id', userId).maybeSingle();
        if (error) lecture('sortie', error);
        return data ?? null;
      },
      async lireCache(userId, id) {
        const { data, error } = await sbUser.from('sortie_analyses').select('empreinte,contenu').eq('activity_id', id).eq('user_id', userId).maybeSingle();
        if (error) lecture('cache', error);
        return data ?? null;
      },
      async ecrireCache(userId, id, empreinte, contenu, nomModele) {
        const { error } = await sbAdmin.from('sortie_analyses').upsert({ activity_id: id, user_id: userId, empreinte, contenu, modele: nomModele, created_at: new Date().toISOString() }, { onConflict: 'activity_id' });
        // Un cache qui ne s'écrit pas n'empêche pas de rendre la lettre
        if (error) console.error('coach-analyse-sortie: écriture du cache échouée', error?.code || '');
      },
      journal: (i) => console.log(`coach-analyse-sortie: tokens ${i.tokensEntree}/${i.tokensSortie}, essais ${i.essais}`),
    };

    const r = await analyserSortie(user.id, corps, deps);
    return json(r.corps, r.statut);
  } catch (e) {
    console.error('coach-analyse-sortie: erreur inattendue', (e as any)?.name || '');
    return json({ ok: false, error: 'erreur_interne', message: 'Quelque chose a mal tourné. Réessaie dans un instant.' }, 500);
  }
}
