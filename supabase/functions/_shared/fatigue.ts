// ============================================================
// Puissance après fatigue d'une sortie (pilier Endurance du niveau global vélo : la durabilité « D »).
//
// « Après fatigue » = une fois qu'on a déjà fait 30 kJ par kg de travail (2100 kJ pour 70 kg). Le travail cumulé se calcule seconde par seconde (somme des watts, en joules).
// On garde le meilleur 20 min dont la fenêtre DÉMARRE après ce seuil : clé `fat20` de `power_curve`. Rien si la sortie n'atteint pas le seuil ou n'a plus 20 min derrière.
// Le poids vient du profil (70 kg si absent). rpc_piliers_annuels divise le meilleur `fat20` de l'année par le meilleur 20 min frais (clé `1200`) : ratio_dur.
// ============================================================

export const KJ_PAR_KG = 30;
export const POIDS_PAR_DEFAUT_KG = 70;
const FENETRE_S = 1200;

/** `{ fat20 }` (watts, entier) pour une sortie à 1 point par seconde, ou rien. `poidsKg` : le poids du profil. */
export function cleFatigue(watts: readonly unknown[], poidsKg?: number | null): Record<string, number> {
  const n = watts?.length ?? 0;
  if (n < FENETRE_S) return {};
  const poids = Number(poidsKg) > 0 ? Number(poidsKg) : POIDS_PAR_DEFAUT_KG;
  const seuilJ = KJ_PAR_KG * poids * 1000;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const p = Number(watts[i]);
    cum[i + 1] = cum[i] + (p > 0 ? p : 0);
  }
  // La première seconde où le travail déjà fait atteint le seuil
  let debut = -1;
  for (let i = 0; i <= n; i++) {
    if (cum[i] >= seuilJ) { debut = i; break; }
  }
  if (debut < 0 || debut + FENETRE_S > n) return {};
  let meilleur = 0;
  for (let i = debut; i + FENETRE_S <= n; i++) {
    const moy = (cum[i + FENETRE_S] - cum[i]) / FENETRE_S;
    if (moy > meilleur) meilleur = moy;
  }
  return meilleur > 0 ? { fat20: Math.round(meilleur) } : {};
}
