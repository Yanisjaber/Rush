// Calculs du carnet de force. Port de app/src/lib/data/force.js : pour l'instant seulement les records par séance.
import type { SerieForce } from './types.ts';

const nombre = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arrondi1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * 1RM estimé (la charge qu'on soulèverait une seule fois) par la formule d'Epley : poids × (1 + reps / 30).
 * Au-delà de 12 répétitions, l'estimation n'est plus fiable : on renvoie null. Poids nul (gainage, pompes) : null.
 */
export function unRmEstime(poids: unknown, reps: unknown): number | null {
  const p = nombre(poids);
  const r = nombre(reps);
  if (!(p > 0) || !(r >= 1) || r > 12) return null;
  return arrondi1(r === 1 ? p : p * (1 + r / 30));
}

/**
 * Les records battus dans chaque séance. Un record = le meilleur 1RM estimé d'un exercice dans cette séance dépasse tout ce que tu
 * avais fait avant sur le même exercice (la toute première séance d'un exercice n'est pas un record : rien à battre).
 * Renvoie une Map : identifiant de la séance (activity_id des séries) → liste des noms d'exercices dont c'était un record.
 * Les séries sans séance rattachée (activity_id vide) sont ignorées : il n'y a pas de séance où afficher le record.
 */
export function recordsParSeance(series: SerieForce[]): Map<string, string[]> {
  const parExo = new Map<string, { nom: string; jours: Map<string, { rm: number; id: string | null }> }>();
  for (const s of series) {
    const rm = unRmEstime(s.weight_kg, s.reps);
    if (rm == null) continue;
    const date = String(s.date).slice(0, 10);
    let e = parExo.get(s.exercise_key);
    if (!e) parExo.set(s.exercise_key, (e = { nom: s.exercise_name, jours: new Map() }));
    const j = e.jours.get(date);
    if (!j) e.jours.set(date, { rm, id: s.activity_id || null });
    else {
      if (rm > j.rm) j.rm = rm;
      if (!j.id && s.activity_id) j.id = s.activity_id;
    }
  }
  const sortie = new Map<string, string[]>();
  for (const e of parExo.values()) {
    let meilleur: number | null = null;
    for (const [, j] of [...e.jours.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (meilleur != null && j.rm > meilleur && j.id) {
        const liste = sortie.get(j.id) ?? [];
        liste.push(e.nom);
        sortie.set(j.id, liste);
      }
      if (meilleur == null || j.rm > meilleur) meilleur = j.rm;
    }
  }
  return sortie;
}
