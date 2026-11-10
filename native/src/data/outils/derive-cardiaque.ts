import type { FluxBruts } from './courbes-sortie.ts';

// La dérive cardiaque d'une sortie (« découplage aérobie ») : à effort égal, de combien le cœur monte entre la première et la seconde moitié.
// On compare le rendement (vitesse ou puissance divisée par la FC) des deux moitiés du temps de mouvement : (rendement 1 − rendement 2) / rendement 1.
// Positif = le cœur a dérivé (plus de battements pour la même allure) ; autour de 0 à 5 % = endurance solide. Fonction pure : aucun écran, aucun réseau.

export interface DeriveCardiaque {
  /** En pourcent, une décimale. Positif = le cœur a dérivé. */
  pct: number;
  /** Ce qui est comparé au cœur : la puissance (vélo avec capteur) ou la vitesse. */
  base: 'puissance' | 'vitesse';
}

/** Durée minimale de mouvement (s) : en dessous, la dérive n'a pas de sens (l'échauffement domine). */
const DUREE_MIN_S = 20 * 60;

export function deriveCardiaque(brut: FluxBruts | null | undefined, famille: 'velo' | 'autre'): DeriveCardiaque | null {
  const fc = brut?.fc;
  const temps = brut?.temps;
  if (!brut || !fc || !temps || fc.length !== temps.length || fc.length < 20) return null;
  // Le vélo compare la puissance au cœur quand il y en a une ; sinon (et pour la course, la natation…) la vitesse (m/s)
  const puissance = famille === 'velo' && brut.watts && brut.watts.length === fc.length && brut.watts.some((w) => w > 0);
  const sortie = puissance ? brut.watts : brut.vitesse;
  if (!sortie || sortie.length !== fc.length) return null;

  // Le temps de mouvement : une pause plus longue que trois fois l'écart habituel ne compte pas
  const n = fc.length;
  const ecarts = temps.slice(1).map((t, i) => t - temps[i]).filter((e) => e > 0);
  if (!ecarts.length) return null;
  const mediane = [...ecarts].sort((a, b) => a - b)[Math.floor(ecarts.length / 2)];
  const dt = (i: number) => (i < n - 1 ? Math.min(Math.max(0, temps[i + 1] - temps[i]), mediane * 3) : mediane);
  const total = Array.from({ length: n }, (_, i) => dt(i)).reduce((a, b) => a + b, 0);
  if (total < DUREE_MIN_S) return null;

  // Chaque moitié : la sortie moyenne et le cœur moyen, sur les points où les deux existent (sortie > 0)
  const moitie: { sortie: number; fc: number; t: number }[] = [
    { sortie: 0, fc: 0, t: 0 },
    { sortie: 0, fc: 0, t: 0 },
  ];
  let cumul = 0;
  for (let i = 0; i < n; i++) {
    const d = dt(i);
    const m = moitie[cumul < total / 2 ? 0 : 1];
    cumul += d;
    const s = sortie[i];
    const c = fc[i];
    if (!Number.isFinite(s) || !Number.isFinite(c) || s <= 0 || c < 30) continue;
    m.sortie += s * d;
    m.fc += c * d;
    m.t += d;
  }
  // Chaque moitié doit avoir au moins un quart du temps en points valides
  if (moitie.some((m) => m.t < total / 8)) return null;
  const [r1, r2] = moitie.map((m) => m.sortie / m.fc);
  if (!(r1 > 0) || !Number.isFinite(r2)) return null;
  return { pct: Math.round(((r1 - r2) / r1) * 1000) / 10, base: puissance ? 'puissance' : 'vitesse' };
}
