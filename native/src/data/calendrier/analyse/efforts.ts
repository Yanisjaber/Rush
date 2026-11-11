import { VITESSE_ARRET } from './flux.ts';
import type { Flux1Hz } from './flux.ts';

// Repérer dans le flux les efforts d'une séance fractionnée (lignes droites, répétitions) quand le chrono ne suit pas le plan à la seconde :
// on cherche les accélérations nettes, on garde celles qui ont la durée voulue, et on les mesure. Fonctions pures : aucun écran, aucun réseau.

export interface Effort {
  debutS: number;
  dureeS: number;
  /** Secondes par km sur l'effort. */
  allure: number;
  /** Cœur moyen sur l'effort, null sans cœur. */
  fc: number | null;
}

/** Lissage de la vitesse (s) : un effort de 20 s ne se voit pas sur 1 s de bruit GPS. */
const LISSAGE_S = 5;

const mediane = (a: number[]) => {
  const t = [...a].sort((x, y) => x - y);
  return t.length ? t[Math.floor(t.length / 2)] : 0;
};

/**
 * Les efforts de durée voisine de `dureeCibleS` (de 0,4 à 2,5 fois la durée voulue). `vitesseCible` (m/s) place le seuil de détection à mi-chemin entre l'allure de fond et l'allure visée ;
 * sans elle, un effort est une accélération d'au moins 15 % sur la vitesse médiane. Dans l'ordre du temps.
 */
export function detecterEfforts(f: Flux1Hz, dureeCibleS: number, vitesseCible: number | null): Effort[] {
  const n = f.n;
  if (n < 60 || !(dureeCibleS > 0)) return [];
  const lisse: number[] = new Array(n).fill(0);
  const demi = Math.floor(LISSAGE_S / 2);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let k = 0;
    for (let j = Math.max(0, i - demi); j <= Math.min(n - 1, i + demi); j++) {
      s += f.v[j];
      k++;
    }
    lisse[i] = s / k;
  }
  const fond = mediane(lisse.filter((x) => x > VITESSE_ARRET));
  if (!(fond > 0)) return [];
  const seuil = vitesseCible && vitesseCible > fond * 1.08 ? fond + 0.5 * (vitesseCible - fond) : fond * 1.15;

  // Les suites de secondes au-dessus du seuil, les trous de 3 s ou moins étant comblés
  const bruts: { a: number; b: number }[] = [];
  let a = -1;
  for (let i = 0; i <= n; i++) {
    const dessus = i < n && lisse[i] >= seuil;
    if (dessus && a < 0) a = i;
    if (!dessus && a >= 0) {
      bruts.push({ a, b: i });
      a = -1;
    }
  }
  const fusion: { a: number; b: number }[] = [];
  for (const s of bruts) {
    const dernier = fusion[fusion.length - 1];
    if (dernier && s.a - dernier.b <= 3) dernier.b = s.b;
    else fusion.push({ ...s });
  }
  const mini = Math.max(5, 0.4 * dureeCibleS);
  const maxi = 2.5 * dureeCibleS + 5;
  return fusion
    .filter((s) => s.b - s.a >= mini && s.b - s.a <= maxi)
    .map((s) => {
      let metres = 0;
      let fcS = 0;
      let fcK = 0;
      for (let i = s.a; i < s.b; i++) {
        metres += f.v[i];
        if (f.fc[i] > 0) {
          fcS += f.fc[i];
          fcK++;
        }
      }
      return { debutS: s.a, dureeS: s.b - s.a, allure: metres > 0 ? ((s.b - s.a) * 1000) / metres : 0, fc: fcK ? fcS / fcK : null };
    })
    .filter((e) => e.allure > 0);
}
