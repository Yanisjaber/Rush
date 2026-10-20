// Séances réalisées : retouches des séances Strava. Fonctions pures, sans réseau.
// Port de app/src/lib/data/retouches.js (sans les formulaires de saisie, qui viendront avec la saisie des séances).
//
// Les séances Strava sont réécrites à chaque synchro : on ne les modifie jamais. Tes changements (nom, sport, durée, distance,
// D+, charge, effort, notes) sont stockés à part dans `activity_edits` (data jsonb, clé = strava_id) et réappliqués à l'affichage.
// Une séance saisie à la main (source = 'manual') est une vraie ligne de `activities` : on la modifie.
import type { Seance } from './types.ts';

type Ligne = Seance & Record<string, unknown>;

/** Clé d'une séance dans activity_edits : le strava_id (en texte), sinon l'identifiant de la ligne. */
export const cleRetouche = (ligne: { strava_id?: unknown; id?: unknown } | null | undefined): string | null =>
  ligne?.strava_id != null ? String(ligne.strava_id) : ligne?.id != null ? String(ligne.id) : null;

/** Une séance est-elle modifiable directement ? (saisie à la main, pas issue de Strava ou Garmin) */
export const estManuelle = (ligne: { source?: unknown } | null | undefined): boolean => ligne?.source === 'manual';

/** Applique une retouche (objet `data` de activity_edits) à une ligne de activities. Renvoie une copie ; ne touche jamais l'originale. */
export function appliquer<T extends Seance>(ligne: T, retouche: unknown): T {
  if (!retouche || typeof retouche !== 'object') return ligne;
  const d = retouche as Record<string, unknown>;
  const r = { ...ligne } as Ligne;
  // On garde les valeurs d'origine (avant retouche) : elles servent à ne recalculer que ce qui a changé
  r.origine = ligne.origine || {
    name: ligne.name, sport: ligne.sport, moving_time: ligne.moving_time, distance_km: ligne.distance_km,
    tss: ligne.tss, total_elevation_gain: ligne.total_elevation_gain, rpe: ligne.rpe, user_notes: ligne.user_notes,
  };
  if (typeof d.name === 'string' && d.name) r.name = d.name;
  if (typeof d.sport === 'string' && d.sport) r.sport = d.sport;
  if (Number.isFinite(d.duration)) r.moving_time = (d.duration as number) * 60;
  if (Number.isFinite(d.distance_km)) r.distance_km = d.distance_km as number;
  if (Number.isFinite(d.tss)) r.tss = d.tss as number;
  if (Number.isFinite(d.elevation_gain)) r.total_elevation_gain = d.elevation_gain as number;
  if (Number.isFinite(d.rpe)) r.rpe = d.rpe as number;
  if (typeof d.notes === 'string') r.user_notes = d.notes;
  r.retouchee = true;
  return r as T;
}

/** Applique les retouches d'une table { cle: data } à une liste de séances. */
export function appliquerTout<T extends Seance>(lignes: T[] | null | undefined, table: Record<string, unknown> | null | undefined): T[] {
  if (!Array.isArray(lignes) || !table) return lignes || [];
  return lignes.map((l) => {
    const cle = cleRetouche(l);
    return cle && Object.hasOwn(table, cle) ? appliquer(l, table[cle]) : l;
  });
}
