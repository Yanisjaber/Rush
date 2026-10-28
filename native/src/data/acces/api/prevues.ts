import { avertissementLimite } from '../../calendrier/calendrier';
import { dateIsoLocale } from '../../outils/format';
import { sb } from '../supabase';
import type { Objectif, Prevue, PrevueComplete } from '../../types';
import type { LignePrevue } from '../../calendrier/ajouts';
import type { Modele } from '../../calendrier/modeles';
import { COLONNES_PLANIFIEE, resultat, UUID, type Resultat } from './commun';

const COLONNES_OBJECTIF = 'id,name,date,sport,km,d_plus,priority,duration,category';

/** Prochaines compétitions (objectifs), de la plus proche à la plus lointaine. */
export async function chargerObjectifs(userId: string, limite = 3): Promise<Resultat<Objectif[]>> {
  const r = await sb
    .from('activity_planned')
    .select(COLONNES_OBJECTIF)
    .eq('user_id', userId)
    .eq('category', 'competition')
    .gte('date', dateIsoLocale())
    .order('date', { ascending: true })
    .limit(limite);
  return resultat(r, 'Impossible de charger tes objectifs.');
}

const LIMITE_PLANIFIEES = 600;

/** Séances prévues entre deux dates ISO incluses. */
export async function chargerPlanifiees(userId: string, debutIso: string, finIso: string): Promise<Resultat<Prevue[]>> {
  const r = await sb
    .from('activity_planned')
    .select(COLONNES_PLANIFIEE)
    .eq('user_id', userId)
    .gte('date', debutIso)
    .lte('date', finIso)
    .order('date', { ascending: true })
    .limit(LIMITE_PLANIFIEES);
  const res = resultat<Prevue[]>(r, 'Impossible de charger les séances prévues.');
  if (res.data) res.erreur = avertissementLimite(res.data.length, LIMITE_PLANIFIEES, 'séances prévues');
  return res;
}

/**
 * Programmes reliés aux séances prévues d'une période : { identifiant de la séance prévue : identifiant du programme }.
 * Tolérante : tant que la colonne programme_id n'existe pas en base, la requête échoue et on répond « pas de lien ».
 */
export async function chargerLiensProgrammes(userId: string, debutIso: string, finIso: string): Promise<Resultat<Record<string, string>>> {
  const r = await sb.from('activity_planned').select('id,programme_id').eq('user_id', userId).gte('date', debutIso).lte('date', finIso).not('programme_id', 'is', null).limit(300);
  const liens: Record<string, string> = Object.create(null);
  if (r.error) return { data: liens, erreur: '' };
  for (const l of (r.data as { id: unknown; programme_id: unknown }[]) || []) liens[String(l.id)] = String(l.programme_id);
  return { data: liens, erreur: '' };
}

// --- Ajouts depuis le « + » du calendrier : séance prévue, compétition, note ---------------------------------------------------------------
// La RLS limite chacun à ses lignes ; user_id vient toujours de la session. Les erreurs de la base ne sont jamais montrées telles quelles.

/** Écrit une séance prévue ou une compétition (ligne validée par validerSeance / validerCompetition) dans activity_planned. */
export async function creerPrevue(userId: string, ligne: LignePrevue): Promise<Resultat<Prevue>> {
  const r = await sb.from('activity_planned').insert({ ...ligne, user_id: userId }).select(COLONNES_PLANIFIEE).single();
  return resultat(r, ligne.category === 'competition' ? "Impossible d'enregistrer cette compétition." : "Impossible d'enregistrer cette séance.");
}

const COLONNES_PREVUE_COMPLETE = `${COLONNES_PLANIFIEE},est_watts,est_bpm,est_kj,est_if,gpx_content,priority,type,target,laps,federation,race_level,tri_format`;

/** Une séance prévue ou une compétition de l'utilisateur avec toutes ses colonnes. Un identifiant qui n'est pas un UUID n'existe pas (pas de requête). */
export async function chargerPrevue(userId: string, id: string): Promise<Resultat<PrevueComplete | null>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  const r = await sb.from('activity_planned').select(COLONNES_PREVUE_COMPLETE).eq('user_id', userId).eq('id', id).maybeSingle();
  const res = resultat<PrevueComplete | null>(r, 'Impossible de charger cette séance.');
  if (!res.erreur && !res.data) return { data: null, erreur: 'Séance introuvable.' };
  return res;
}

/**
 * Ce qu'une modification efface quand le formulaire ne le renvoie plus : sans blocs ni parcours, une ligne validée n'a pas ces clés, et un « update » les laisserait
 * telles quelles en base. On les remet donc à null explicitement, avant d'appliquer la ligne.
 */
const EFFACES_A_LA_MODIFICATION = { structure: null, est_watts: null, est_bpm: null, est_kj: null, est_if: null, gpx_name: null, gpx_content: null };

/** Modifie une séance prévue ou une compétition qui t'appartient (ligne validée par validerSeance / validerCompetition). La catégorie ne change jamais. */
export async function modifierPrevue(userId: string, id: string, ligne: LignePrevue): Promise<Resultat<Prevue>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  const { category: _categorie, ...colonnes } = ligne;
  const r = await sb.from('activity_planned').update({ ...EFFACES_A_LA_MODIFICATION, ...colonnes }).eq('user_id', userId).eq('id', id).eq('category', ligne.category).select(COLONNES_PLANIFIEE).maybeSingle();
  const res = resultat<Prevue | null>(r, ligne.category === 'competition' ? 'Impossible de modifier cette compétition.' : 'Impossible de modifier cette séance.');
  return res.erreur ? { data: null, erreur: res.erreur } : res.data ? { data: res.data, erreur: '' } : { data: null, erreur: 'Séance introuvable.' };
}

/** Supprime une séance prévue ou une compétition qui t'appartient. */
export async function supprimerPrevue(userId: string, id: string): Promise<{ erreur: string }> {
  if (!UUID.test(String(id))) return { erreur: 'Séance introuvable.' };
  const r = await sb.from('activity_planned').delete().eq('user_id', userId).eq('id', id);
  return { erreur: resultat(r, 'Impossible de supprimer cette séance.').erreur };
}

const COLONNES_MODELE = 'id,sport,sport_raw,name,duration_min,tss,description,rpe,distance_km,dplus,structure';

/** Les modèles de séance de l'utilisateur (table activity_template), classés par nom. */
export async function chargerModeles(userId: string): Promise<Resultat<Modele[]>> {
  const r = await sb.from('activity_template').select(COLONNES_MODELE).eq('user_id', userId).order('name', { ascending: true }).limit(500);
  return resultat(r, 'Impossible de charger tes modèles.');
}
