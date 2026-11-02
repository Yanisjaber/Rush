// ============================================================
// Dérive cardiaque d'une sortie longue (pilier Endurance du niveau global vélo).
//
// Sur une sortie d'au moins 2 h avec puissance et cardio, on compare le rapport watts / cardio (l'« efficacité ») de la 1re moitié
// et de la 2e moitié, échauffement (10 premières minutes) mis à part. Une sortie où l'efficacité tient (dérive proche de 0 %)
// montre une bonne endurance ; une dérive de 10 % ou plus montre qu'on a tenu ses watts au prix d'un cœur qui monte.
//   derive = (efficacité 1re moitié − efficacité 2e moitié) / efficacité 1re moitié × 100, en %, arrondi au dixième (peut être négatif).
// Seules les secondes avec un cardio comptent (une pause garde ses watts à 0 et son cardio à 0 après rééchantillonnage : elle est ignorée).
// Stocké dans `power_curve` (clé `derive`) ; l'agrégation par année est faite par rpc_piliers_annuels (médiane des sorties de l'année).
// ============================================================

export const DERIVE_DUREE_MINI_S = 2 * 3600;
const ECHAUFFEMENT_S = 600;
/** Une moitié a besoin d'au moins 30 min de cardio mesuré. */
const SECONDES_MINI_MOITIE = 1800;
/** En dessous de cette moyenne, la sortie est une balade : son rapport watts / cardio ne dit rien. */
const WATTS_MOYENS_MINI = 60;

/** La dérive d'une sortie (`{ derive }`), ou rien si la sortie est trop courte, sans cardio ou trop peu appuyée. `watts` et `fc` sont à 1 point par seconde. */
export function cleDerive(watts: readonly unknown[], fc: readonly unknown[]): Record<string, number> {
  const n = Math.min(watts?.length ?? 0, fc?.length ?? 0);
  if (n < DERIVE_DUREE_MINI_S) return {};
  const milieu = Math.floor((ECHAUFFEMENT_S + n) / 2);
  const moitie = (debut: number, fin: number) => {
    let w = 0, c = 0, k = 0;
    for (let i = debut; i < fin; i++) {
      const f = Number(fc[i]);
      if (!(f > 0)) continue;
      const p = Number(watts[i]);
      w += p > 0 ? p : 0;
      c += f;
      k++;
    }
    return { w: k ? w / k : 0, c: k ? c / k : 0, k };
  };
  const a = moitie(ECHAUFFEMENT_S, milieu);
  const b = moitie(milieu, n);
  if (a.k < SECONDES_MINI_MOITIE || b.k < SECONDES_MINI_MOITIE) return {};
  if ((a.w + b.w) / 2 < WATTS_MOYENS_MINI) return {};
  const ef1 = a.w / a.c;
  const ef2 = b.w / b.c;
  if (!(ef1 > 0)) return {};
  return { derive: Math.round(((ef1 - ef2) / ef1) * 1000) / 10 };
}
