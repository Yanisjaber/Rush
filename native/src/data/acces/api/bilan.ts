import { sb } from '../supabase';
import type { ObjectifAnnuel } from '../../bilan/bilan.ts';
import type { Seance } from '../../types';
import { resultat, UUID, type Resultat } from './commun';
import { avecRetouches } from './retouches-cache';

// ---------------------------------------------------------------------------
// Bilan annuel : tout l'historique d'activités et objectifs annuels
// ---------------------------------------------------------------------------

const COLONNES_BILAN = 'id,strava_id,name,sport,start_date_local,moving_time,distance_km,total_elevation_gain,tss';
const TAILLE_PAGE = 1000; // l'API renvoie au plus 1000 lignes par requête : on lit par pages

const PAGES_MAX = 100; // garde-fou : 100 000 activités ; au-delà, on le dit au lieu d'afficher un bilan tronqué

/** Tout l'historique, de la toute première activité à la fin de l'année (colonnes légères), par pages de 1000. Les étapes fusionnées d'un triathlon sont déjà comptées par leur parent. */
export async function chargerActivitesBilan(userId: string, annee: number): Promise<Resultat<Seance[]>> {
  const toutes: Seance[] = [];
  let complet = false;
  for (let page = 0; page < PAGES_MAX; page++) {
    const r = await sb
      .from('activities')
      .select(COLONNES_BILAN)
      .eq('user_id', userId)
      .is('merged_into', null)
      .lte('start_date_local', `${annee}-12-31T23:59:59`)
      .order('start_date_local', { ascending: true })
      .order('id', { ascending: true }) // second critère : sans lui, deux séances à la même heure peuvent être doublées ou sautées entre deux pages
      .range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1);
    if (r.error) {
      console.error('[app/api] bilan', r.error.code || '');
      return { data: null, erreur: 'Impossible de charger tes activités.' };
    }
    const lignes = (r.data as unknown as Seance[]) || [];
    toutes.push(...lignes);
    if (lignes.length < TAILLE_PAGE) {
      complet = true;
      break;
    }
  }
  if (!complet) return { data: null, erreur: 'Ton historique est trop long pour être chargé en entier.' };
  return { data: await avecRetouches(userId, toutes), erreur: '' };
}

const COLONNES_OBJECTIF_ANNUEL = 'id,year,sport,template,target,current_manual';
const versObjectif = (l: { id: string; year: number; sport: string; template: string; target: unknown; current_manual: number | null }): ObjectifAnnuel => ({
  id: l.id,
  annee: l.year,
  sport: l.sport,
  template: l.template,
  target: Number(l.target),
  currentManual: l.current_manual ?? undefined,
});

/** Tous les objectifs annuels de l'utilisateur (toutes années). */
export async function chargerObjectifsAnnuels(userId: string): Promise<Resultat<ObjectifAnnuel[]>> {
  const r = await sb.from('yearly_goals').select(COLONNES_OBJECTIF_ANNUEL).eq('user_id', userId).order('year', { ascending: false }).limit(500);
  const res = resultat<Parameters<typeof versObjectif>[0][]>(r, 'Impossible de charger tes objectifs.');
  return { data: res.data ? res.data.map(versObjectif) : null, erreur: res.erreur };
}

/** Ce qu'on écrit pour un objectif annuel (voir validerObjectif). */
export interface ValeursObjectif {
  sport: string;
  template: string;
  target: number;
  current_manual: number | null;
}

/** Le message d'une erreur d'écriture d'objectif : jamais le texte brut de la base. */
export function messageObjectif(code: unknown): string {
  if (code === '23505') return 'Cet objectif existe déjà pour cette année : modifie-le plutôt.';
  if (code === '23514') return 'La base refuse ces valeurs : la cible doit être positive et raisonnable.';
  if (code === '42501') return "Tu n'as pas le droit de faire ça.";
  return "Impossible d'enregistrer l'objectif pour le moment.";
}

/** Crée un objectif annuel. `client_id` : identifiant de l'appareil, comme pour les notes. */
export async function creerObjectifAnnuel(userId: string, annee: number, v: ValeursObjectif): Promise<Resultat<ObjectifAnnuel>> {
  const client_id = `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const r = await sb.from('yearly_goals').insert({ ...v, user_id: userId, year: annee, client_id }).select(COLONNES_OBJECTIF_ANNUEL).single();
  if (r.error) {
    console.error('[app/api] création de l\'objectif', r.error.code || '');
    return { data: null, erreur: messageObjectif(r.error.code) };
  }
  return { data: versObjectif(r.data as Parameters<typeof versObjectif>[0]), erreur: '' };
}

/** Modifie un objectif annuel (seule la cible et la saisie changent). */
export async function modifierObjectifAnnuel(userId: string, id: string, v: ValeursObjectif): Promise<Resultat<ObjectifAnnuel>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Objectif introuvable.' };
  const r = await sb.from('yearly_goals').update({ target: v.target, current_manual: v.current_manual }).eq('user_id', userId).eq('id', id).select(COLONNES_OBJECTIF_ANNUEL).maybeSingle();
  if (r.error) {
    console.error('[app/api] modification de l\'objectif', r.error.code || '');
    return { data: null, erreur: messageObjectif(r.error.code) };
  }
  return r.data ? { data: versObjectif(r.data as Parameters<typeof versObjectif>[0]), erreur: '' } : { data: null, erreur: 'Objectif introuvable.' };
}

export async function supprimerObjectifAnnuel(userId: string, id: string): Promise<{ erreur: string }> {
  if (!UUID.test(String(id))) return { erreur: 'Objectif introuvable.' };
  const r = await sb.from('yearly_goals').delete().eq('user_id', userId).eq('id', id);
  if (r.error) {
    console.error('[app/api] suppression de l\'objectif', r.error.code || '');
    return { erreur: messageObjectif(r.error.code) };
  }
  return { erreur: '' };
}
