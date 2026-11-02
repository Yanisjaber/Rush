// ============================================================
// Découplage cardiaque d'une sortie longue (pilier Endurance du niveau global vélo).
//
// Sur une sortie d'au moins 90 min avec puissance et cardio, on compare l'efficacité (EF = puissance normalisée / FC moyenne) de la 1re moitié
// et de la 2e moitié, échauffement (10 premières minutes) mis à part. Une sortie où l'efficacité tient (découplage proche de 0 %)
// montre une bonne endurance ; un découplage de 12 % ou plus montre qu'on a tenu ses watts au prix d'un cœur qui monte.
//   drift = (EF 1re moitié − EF 2e moitié) / EF 1re moitié × 100, en %, arrondi au dixième (peut être négatif).
// Seules les secondes avec un cardio comptent (une pause garde ses watts à 0 et son cardio à 0 après rééchantillonnage : elle est ignorée).
// Change le 3 nov. 2026 : la puissance normalisée remplace la puissance moyenne et la durée minimale passe de 2 h à 90 min (clé `drift` à la place de `derive`).
// Stocké dans `power_curve` (clé `drift`). Les sorties « Z2 » (celles qui comptent pour le pilier) sont triées par rpc_piliers_annuels, qui connaît la FTP de l'année :
// la médiane des 10 dernières sorties Z2 de l'année est faite là-bas.
// ============================================================

export const DERIVE_DUREE_MINI_S = 90 * 60;
const ECHAUFFEMENT_S = 600;
/** Une moitié a besoin d'au moins 20 min de cardio mesuré. */
const SECONDES_MINI_MOITIE = 1200;
/** En dessous de cette moyenne, la sortie est une balade : son rapport watts / cardio ne dit rien. */
const WATTS_MOYENS_MINI = 60;
/** La puissance normalisée se lisse sur 30 s (méthode de Coggan). */
const LISSAGE_NP_S = 30;

/** La puissance normalisée d'une suite de watts (1 point par seconde) : racine 4e de la moyenne des puissances lissées sur 30 s, élevées à la 4e. 0 si trop court. */
export function puissanceNormalisee(watts: readonly number[]): number {
  const n = watts.length;
  if (n < LISSAGE_NP_S) return 0;
  let somme = 0;
  let quatrieme = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    somme += watts[i];
    if (i >= LISSAGE_NP_S) somme -= watts[i - LISSAGE_NP_S];
    if (i >= LISSAGE_NP_S - 1) {
      const m = somme / LISSAGE_NP_S;
      quatrieme += m * m * m * m;
      k++;
    }
  }
  return k ? Math.pow(quatrieme / k, 0.25) : 0;
}

/** Le découplage d'une sortie (`{ drift }`), ou rien si la sortie est trop courte, sans cardio ou trop peu appuyée. `watts` et `fc` sont à 1 point par seconde. */
export function cleDerive(watts: readonly unknown[], fc: readonly unknown[]): Record<string, number> {
  const n = Math.min(watts?.length ?? 0, fc?.length ?? 0);
  if (n < DERIVE_DUREE_MINI_S) return {};
  const milieu = Math.floor((ECHAUFFEMENT_S + n) / 2);
  const moitie = (debut: number, fin: number) => {
    const w: number[] = [];
    let c = 0;
    for (let i = debut; i < fin; i++) {
      const f = Number(fc[i]);
      if (!(f > 0)) continue;
      const p = Number(watts[i]);
      w.push(p > 0 ? p : 0);
      c += f;
    }
    const k = w.length;
    return { np: puissanceNormalisee(w), moy: k ? w.reduce((s, x) => s + x, 0) / k : 0, c: k ? c / k : 0, k };
  };
  const a = moitie(ECHAUFFEMENT_S, milieu);
  const b = moitie(milieu, n);
  if (a.k < SECONDES_MINI_MOITIE || b.k < SECONDES_MINI_MOITIE) return {};
  if ((a.moy + b.moy) / 2 < WATTS_MOYENS_MINI) return {};
  const ef1 = a.np / a.c;
  const ef2 = b.np / b.c;
  if (!(ef1 > 0)) return {};
  return { drift: Math.round(((ef1 - ef2) / ef1) * 1000) / 10 };
}
