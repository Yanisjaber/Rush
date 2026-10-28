import { sb } from '../supabase';
import type { Cycle } from '../../types';
import type { FormulaireCycle } from '../../calendrier/cycles';
import { resultat, UUID, type Resultat } from './commun';

// --- Cycles d'entraînement (table training_cycles) : lecture et écriture ---------------------------------------------------------------
// La RLS limite chacun à ses lignes ; on filtre quand même par user_id. La base refuse un troisième cycle le même jour (code 23514).
const COLONNES_CYCLE = 'id,name,from_date,to_date,color,sport';

/** Le message d'une erreur d'écriture de cycle : on ne montre jamais le texte brut de la base, seulement une phrase claire. */
export function messageCycle(code: unknown): string {
  if (code === '23514') return 'La base refuse ce cycle : trois cycles ne peuvent pas se chevaucher, et les dates et la couleur doivent être valides.';
  if (code === '42P01') return "Les cycles ne sont pas encore activés sur ton serveur (la migration « training_cycles » reste à appliquer).";
  if (code === '42501') return "Tu n'as pas le droit de faire ça.";
  return "Impossible d'enregistrer ce cycle pour le moment.";
}

/** Les cycles qui touchent la période [debut, fin] (pour la grille d'un mois). */
export async function chargerCycles(userId: string, debutIso: string, finIso: string): Promise<Resultat<Cycle[]>> {
  const r = await sb.from('training_cycles').select(COLONNES_CYCLE).eq('user_id', userId).lte('from_date', finIso).gte('to_date', debutIso).order('from_date', { ascending: true }).limit(100);
  return resultat(r, 'Impossible de charger tes cycles.');
}

/** Tous les cycles de l'utilisateur, du plus récent au plus ancien (pour l'écran des cycles). */
export async function chargerTousCycles(userId: string): Promise<Resultat<Cycle[]>> {
  const r = await sb.from('training_cycles').select(COLONNES_CYCLE).eq('user_id', userId).order('from_date', { ascending: false }).limit(200);
  return resultat(r, 'Impossible de charger tes cycles.');
}

export async function creerCycle(userId: string, v: FormulaireCycle): Promise<Resultat<Cycle>> {
  const r = await sb.from('training_cycles').insert({ user_id: userId, ...v }).select(COLONNES_CYCLE).single();
  if (r.error) {
    console.error('[app/api] création du cycle', r.error.code || '');
    return { data: null, erreur: messageCycle(r.error.code) };
  }
  return { data: r.data as Cycle, erreur: '' };
}

export async function modifierCycle(userId: string, id: string, v: FormulaireCycle): Promise<Resultat<Cycle>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Cycle introuvable.' };
  const r = await sb.from('training_cycles').update(v).eq('user_id', userId).eq('id', id).select(COLONNES_CYCLE).maybeSingle();
  if (r.error) {
    console.error('[app/api] modification du cycle', r.error.code || '');
    return { data: null, erreur: messageCycle(r.error.code) };
  }
  return r.data ? { data: r.data as Cycle, erreur: '' } : { data: null, erreur: 'Cycle introuvable.' };
}

export async function supprimerCycle(userId: string, id: string): Promise<{ erreur: string }> {
  if (!UUID.test(String(id))) return { erreur: 'Cycle introuvable.' };
  const r = await sb.from('training_cycles').delete().eq('user_id', userId).eq('id', id);
  if (r.error) {
    console.error('[app/api] suppression du cycle', r.error.code || '');
    return { erreur: messageCycle(r.error.code) };
  }
  return { erreur: '' };
}
