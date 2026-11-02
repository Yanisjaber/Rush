// ============================================================
// Charge cardio d'une sortie, calculée seconde par seconde (TRIMP à poids carré, sur l'échelle du TSS).
//
// Avant : le TSS cardio d'une sortie venait de sa FC MOYENNE : (FC moyenne / LTHR)² × heures × 100. Une sortie variée (intervalles, côtes) paraissait plus facile
// que sa vraie charge : la moyenne des carrés est plus grande que le carré de la moyenne.
// Maintenant : on garde, pour chaque sortie, deux nombres indépendants de la LTHR : le nombre de secondes avec un cardio (`hr_s`) et la somme des carrés des
// cardios (`hr_sq`). La base en tire le TSS avec la LTHR du moment : TSS = 100 × hr_sq / (LTHR² × 3600), c'est-à-dire la moyenne de (FC / LTHR)² sur le temps
// × les heures × 100. Une heure à la LTHR vaut 100, comme pour la puissance, et le CTL reste cohérent. Les zones et la LTHR se recalculent à l'affichage, jamais stockées.
// Pourquoi un poids carré plutôt que le TRIMP de Banister : il ne demande pas la FC de repos (absente du profil) et reste proche de lui entre 60 et 90 % de la FC max.
// Stocké dans `power_curve` (clés hr_s, hr_sq) avec les autres résumés ; lu par recalc_ftp_tss (supabase/migrations/2026-11-02_ftp_glissante.sql).
// Seules les secondes avec un cardio plausible comptent (une pause garde un cardio à 0 après rééchantillonnage ; un capteur qui décroche donne 0 ou une valeur absurde).
// ============================================================

const FC_MIN = 40;
const FC_MAX = 230;

/** Les clés à ranger dans power_curve : `hr_s` (secondes avec cardio) et `hr_sq` (somme des carrés, en bpm²·s). Rien sans cardio. `fc` : un point par seconde. */
export function cleCardio(fc: readonly unknown[]): Record<string, number> {
  let secondes = 0;
  let somme = 0;
  for (let i = 0; i < (fc?.length ?? 0); i++) {
    const v = Number(fc[i]);
    if (!(v >= FC_MIN && v <= FC_MAX)) continue;
    secondes++;
    somme += v * v;
  }
  return secondes > 0 ? { hr_s: secondes, hr_sq: Math.round(somme) } : {};
}
