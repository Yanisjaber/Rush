import { sb } from '../supabase';
import type { Note } from '../../types';
import type { LigneNote } from '../../calendrier/ajouts';
import { COLONNES_NOTE, resultat, UUID, type Resultat } from './commun';

/** Notes qui recouvrent la période et jours de repos de la période. */
export async function chargerAnnotations(userId: string, debutIso: string, finIso: string): Promise<Resultat<{ notes: Note[]; repos: string[] }>> {
  const [notes, repos] = await Promise.all([
    sb.from('day_notes').select(COLONNES_NOTE).eq('user_id', userId).lte('from_date', finIso).gte('to_date', debutIso).order('from_date', { ascending: true }).limit(300),
    sb.from('rest_day').select('iso_date').eq('user_id', userId).gte('iso_date', debutIso).lte('iso_date', finIso).limit(400),
  ]);
  if (notes.error || repos.error) {
    console.error('[app/api] annotations', notes.error?.code || repos.error?.code || '');
    return { data: null, erreur: 'Impossible de charger tes notes.' };
  }
  return { data: { notes: (notes.data as unknown as Note[]) || [], repos: ((repos.data as { iso_date: string }[]) || []).map((r) => r.iso_date) }, erreur: '' };
}

/** Écrit une note (ligne validée par validerNote) dans day_notes. */
export async function creerNoteJour(userId: string, ligne: LigneNote): Promise<Resultat<Note>> {
  const client_id = `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const r = await sb.from('day_notes').insert({ ...ligne, user_id: userId, client_id }).select(COLONNES_NOTE).single();
  return resultat(r, "Impossible d'enregistrer la note.");
}

/** Modifie une note qui t'appartient (ligne validée par validerNote). */
export async function modifierNoteJour(userId: string, id: string, ligne: LigneNote): Promise<Resultat<Note>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Note introuvable.' };
  const r = await sb.from('day_notes').update(ligne).eq('user_id', userId).eq('id', id).select(COLONNES_NOTE).maybeSingle();
  const res = resultat<Note | null>(r, 'Impossible de modifier la note.');
  return res.erreur ? { data: null, erreur: res.erreur } : res.data ? { data: res.data, erreur: '' } : { data: null, erreur: 'Note introuvable.' };
}

/** Supprime une note qui t'appartient. */
export async function supprimerNoteJour(userId: string, id: string): Promise<{ erreur: string }> {
  if (!UUID.test(String(id))) return { erreur: 'Note introuvable.' };
  const r = await sb.from('day_notes').delete().eq('user_id', userId).eq('id', id);
  return { erreur: resultat(r, 'Impossible de supprimer la note.').erreur };
}

/** Pose un jour de repos (table rest_day, un jour par ligne ; poser deux fois le même jour ne fait rien de plus). */
export async function poserRepos(userId: string, iso: string): Promise<{ erreur: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { erreur: 'Date invalide.' };
  const r = await sb.from('rest_day').upsert({ user_id: userId, iso_date: iso }, { onConflict: 'user_id,iso_date' });
  return { erreur: resultat(r, "Impossible de poser ce jour de repos.").erreur };
}

/** Retire un jour de repos. */
export async function retirerRepos(userId: string, iso: string): Promise<{ erreur: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { erreur: 'Date invalide.' };
  const r = await sb.from('rest_day').delete().eq('user_id', userId).eq('iso_date', iso);
  return { erreur: resultat(r, 'Impossible de retirer ce jour de repos.').erreur };
}
