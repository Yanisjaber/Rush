import { sb } from '../supabase';
import type { Seance } from '../../types';
import type { LigneSortie } from '../../calendrier/ajouts';
import { COLONNES_SEANCE, resultat, UUID, type Resultat } from './commun';

/** Écrit une activité déjà faite (ligne validée par validerSortie) dans activities, avec source = 'manual' : une vraie ligne qu'on pourra modifier, contrairement à celles de Strava. */
export async function creerSortie(userId: string, ligne: LigneSortie): Promise<Resultat<Seance>> {
  const client_id = `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const r = await sb.from('activities').insert({ ...ligne, user_id: userId, client_id }).select(COLONNES_SEANCE).single();
  return resultat(r, "Impossible d'enregistrer cette activité.");
}

/**
 * Modifie une activité saisie à la main (ligne validée par validerSortie). Le filtre `source = 'manual'` est là en plus de la RLS : une activité Strava ne se modifie jamais d'ici.
 */
export async function modifierSortie(userId: string, id: string, ligne: LigneSortie): Promise<Resultat<Seance>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Activité introuvable.' };
  const { source: _source, category: _categorie, ...colonnes } = ligne;
  const r = await sb.from('activities').update(colonnes).eq('user_id', userId).eq('id', id).eq('source', 'manual').select(COLONNES_SEANCE).maybeSingle();
  const res = resultat<Seance | null>(r, "Impossible de modifier cette activité.");
  return res.erreur ? { data: null, erreur: res.erreur } : res.data ? { data: res.data, erreur: '' } : { data: null, erreur: 'Activité introuvable.' };
}

/** Supprime une activité saisie à la main (jamais une activité Strava). Dit « introuvable » si aucune ligne n'a été supprimée. */
export async function supprimerSortie(userId: string, id: string): Promise<{ erreur: string }> {
  if (!UUID.test(String(id))) return { erreur: 'Activité introuvable.' };
  const r = await sb.from('activities').delete().eq('user_id', userId).eq('id', id).eq('source', 'manual').select('id');
  const res = resultat<{ id: string }[]>(r, 'Impossible de supprimer cette activité.');
  if (res.erreur) return { erreur: res.erreur };
  return { erreur: res.data && res.data.length ? '' : 'Activité introuvable.' };
}
