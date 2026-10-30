// Petits outils de statistique partagés par les progressions (vélo, course) : médiane et moindres carrés avec incertitude robuste.

export const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/** Inverse d'une petite matrice carrée (élimination de Gauss) ; null si elle n'est pas inversible (colonnes qui disent la même chose). */
function inverse(a: number[][]): number[][] | null {
  const k = a.length;
  const m = a.map((ligne, i) => [...ligne, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < k; i++) {
    let p = i;
    for (let j = i + 1; j < k; j++) if (Math.abs(m[j][i]) > Math.abs(m[p][i])) p = j;
    if (Math.abs(m[p][i]) < 1e-9) return null;
    [m[i], m[p]] = [m[p], m[i]];
    const d = m[i][i];
    m[i] = m[i].map((v) => v / d);
    for (let j = 0; j < k; j++) {
      if (j === i) continue;
      const f = m[j][i];
      if (f) m[j] = m[j].map((v, t) => v - f * m[i][t]);
    }
  }
  return m.map((ligne) => ligne.slice(k));
}

/** Moindres carrés avec écarts-types robustes (HC1) : les coefficients et l'incertitude de chacun. Null si le modèle est dégénéré. */
export function regression(x: number[][], y: number[]): { b: number[]; se: number[] } | null {
  const n = x.length;
  const k = x[0].length;
  if (n <= k) return null;
  const xtx = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, c) => x.reduce((s, ligne) => s + ligne[a] * ligne[c], 0)));
  const inv = inverse(xtx);
  if (!inv) return null;
  const xty = Array.from({ length: k }, (_, a) => x.reduce((s, ligne, i) => s + ligne[a] * y[i], 0));
  const b = inv.map((ligne) => ligne.reduce((s, v, c) => s + v * xty[c], 0));
  const e = y.map((v, i) => v - x[i].reduce((s, xv, a) => s + xv * b[a], 0));
  const meat = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, c) => x.reduce((s, ligne, i) => s + ligne[a] * ligne[c] * e[i] * e[i], 0)));
  const tmp = inv.map((ligne) => Array.from({ length: k }, (_, c) => ligne.reduce((s, v, m) => s + v * meat[m][c], 0)));
  const echelle = n / (n - k);
  const se = Array.from({ length: k }, (_, a) => Math.sqrt(Math.max(0, tmp[a].reduce((s, v, m) => s + v * inv[m][a], 0) * echelle)));
  return { b, se };
}
