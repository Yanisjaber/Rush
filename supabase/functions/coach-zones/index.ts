// ============================================================
// Edge Function : coach-zones — « Faire calculer mes zones par le coach » (écran Paramètres › Zones).
//
// Appel (POST, JWT Supabase dans Authorization, corps JSON vide ou {} ) :
//   → { ok: true, proposition: { puissance?: number[], cardio?: number[], allure?: number[] }, explication: "…" }
//   → { ok: false, error: "…", message: "…" } avec le bon statut HTTP
//
// Le modèle propose seulement les limites des zones (voir _shared/coach-zones.ts) ; le code les valide (plafond absolu de 10 points) ; rien n'est écrit :
// l'utilisateur voit la proposition sur une carte et la valide dans l'app, avec ses droits.
//
// Sécurité : l'utilisateur vient du JWT vérifié ; mêmes barrières que le chat (liste blanche coach_acces, accord de partage des données) ;
// le modèle ne reçoit que des nombres ; les journaux ne contiennent aucune donnée ; CORS restreint (_shared/cors.ts).
//
// Déploiement : supabase functions deploy coach-zones
// Secrets : ceux de coach-chat (ANTHROPIC_API_KEY…), facultatif COACH_MODELE.
// ============================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import { coutMicroUsd } from '../_shared/coach-couts.ts';
import { CONFIG_PAR_DEFAUT, jourLocal } from '../_shared/coach-chat.ts';
import { contexteZones, modelesProposables, OUTIL_ZONES, PROMPT_ZONES, validerProposition } from '../_shared/coach-zones.ts';
import type { DonneesZones } from '../_shared/coach-zones.ts';
import { corsHeadersFor } from '../_shared/cors.ts';
import { creerClientAnthropic } from '../coach-chat/modele-anthropic.ts';
import { creerStockage } from '../coach-chat/stockage.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DUREES_PUISSANCE = [5, 60, 300, 600, 1200, 3600];

Deno.serve((req) => gerer(req, corsHeadersFor(req)));

async function gerer(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
  const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!jwt) return json({ ok: false, error: 'missing_jwt' }, 401);
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(jwt);
    if (authErr || !user) return json({ ok: false, error: 'invalid_jwt' }, 401);

    const cle = Deno.env.get('ANTHROPIC_API_KEY');
    if (!cle) {
      console.error('coach-zones: ANTHROPIC_API_KEY absente');
      return json({ ok: false, error: 'service_non_configure', message: 'Le coach est indisponible pour le moment.' }, 503);
    }
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const stockage = creerStockage(sbUser, sbAdmin);

    // Mêmes barrières que le chat : liste blanche, puis accord de partage des données
    if (!(await stockage.aAcces(user.id))) return json({ ok: false, error: 'acces_refuse', message: "Le coach n'est pas encore ouvert pour ton compte." }, 403);
    const reglages = await stockage.lireReglages(user.id);
    if (!reglages?.accord) return json({ ok: false, error: 'accord_requis', message: 'Avant de demander quoi que ce soit au coach, accepte le partage de tes données dans l\'onglet Coach.' }, 403);

    const donnees = await lireDonnees(sbUser, user.id);
    const proposables = modelesProposables(donnees.references);
    if (!proposables.length) return json({ ok: false, error: 'references_manquantes', message: 'Renseigne au moins ta FTP, ta FC au seuil (ou ta FC max) ou ta vitesse seuil pour que le coach calcule des zones.' }, 422);

    const modele = Deno.env.get('COACH_MODELE') || CONFIG_PAR_DEFAUT.modele;
    const reponse = await creerClientAnthropic({ apiKey: cle, modele }).repondre(
      { system: PROMPT_ZONES, messages: [{ role: 'user', content: contexteZones(donnees) }], outils: [OUTIL_ZONES as any], maxTokens: 900 },
      () => {},
    );
    // La dépense est comptée, comme pour le chat
    await stockage.compter(user.id, jourLocal(new Date()), reponse.usage, coutMicroUsd(modele, reponse.usage)).catch(() => console.error('coach-zones: comptage échoué'));

    const appel = reponse.outils.find((o) => o.name === OUTIL_ZONES.name);
    if (!appel) return json({ ok: false, error: 'pas_de_proposition', message: "Le coach n'a pas réussi à proposer des zones. Réessaie dans un instant." }, 502);
    const v = validerProposition(appel.input, proposables);
    if (!v.ok) return json({ ok: false, error: v.erreur, message: "La proposition du coach n'a pas passé les contrôles. Réessaie dans un instant." }, 502);
    return json({ ok: true, proposition: v.proposition, explication: v.explication });
  } catch (e: any) {
    console.error('coach-zones: erreur inattendue', e?.name || '');
    return json({ ok: false, error: 'erreur_interne', message: 'Quelque chose a mal tourné. Réessaie dans un instant.' }, 500);
  }
}

/** Les données de l'athlète (lues avec SES droits, la RLS s'applique) : seulement des nombres. */
async function lireDonnees(sb: any, userId: string): Promise<DonneesZones> {
  const profil = await sb.from('user_profiles').select('ftp, hr_max, lthr, extras').eq('user_id', userId).maybeSingle();
  const hrMax = Number(profil.data?.hr_max) > 0 ? Number(profil.data.hr_max) : null;
  const lthrSaisie = Number(profil.data?.lthr) > 0 ? Number(profil.data.lthr) : null;
  const seuil = Number(profil.data?.extras?.threshold_speed) > 0 ? Number(profil.data.extras.threshold_speed) : null;
  const ftp = Number(profil.data?.ftp) > 0 ? Number(profil.data.ftp) : null;

  const courbe = await sb.from('power_profile').select('duration_s, watts_90d, watts_alltime').eq('user_id', userId).in('duration_s', DUREES_PUISSANCE).order('duration_s');
  const depuisAn = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const fcs = await sb.from('activities').select('max_heartrate').eq('user_id', userId).gte('start_date_local', depuisAn).gt('max_heartrate', 100).lte('max_heartrate', 220).limit(2000);
  const valeursFc: number[] = (fcs.data ?? []).map((r: any) => Number(r.max_heartrate)).filter((x: number) => Number.isFinite(x)).sort((a: number, b: number) => a - b);
  const depuis90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const course = await sb.from('activities').select('distance_km, moving_time, avg_heartrate').eq('user_id', userId).ilike('sport', '%run%').gte('start_date_local', depuis90).gte('distance_km', 5).gt('moving_time', 0).limit(300);
  const efforts = (course.data ?? [])
    .map((r: any) => ({ km: Math.round(Number(r.distance_km) * 10) / 10, kmh: Math.round((Number(r.distance_km) / (Number(r.moving_time) / 3600)) * 10) / 10, fcMoyenne: Number(r.avg_heartrate) > 0 ? Math.round(Number(r.avg_heartrate)) : null }))
    .filter((e: any) => Number.isFinite(e.kmh))
    .sort((a: any, b: any) => b.kmh - a.kmh)
    .slice(0, 5);

  return {
    references: { ftp, lthr: lthrSaisie ?? (hrMax ? Math.round(hrMax * 0.92) : null), seuilKmh: seuil },
    fcMax: hrMax,
    courbePuissance: (courbe.data ?? []).map((r: any) => ({ duree_s: Number(r.duration_s), w90: Number(r.watts_90d) > 0 ? Math.round(Number(r.watts_90d)) : null, wTout: Number(r.watts_alltime) > 0 ? Math.round(Number(r.watts_alltime)) : null })),
    fcMaxObservee: { p99: valeursFc.length >= 10 ? valeursFc[Math.min(valeursFc.length - 1, Math.floor(valeursFc.length * 0.99))] : null, sorties: valeursFc.length },
    effortsCourse: efforts,
  };
}
