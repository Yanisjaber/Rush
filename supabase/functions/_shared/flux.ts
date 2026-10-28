// ============================================================
// Flux Strava : remise à 1 point par seconde.
//
// Les calculs de courbe de puissance (meilleure moyenne sur N secondes) supposent que le point n°i est la
// seconde n°i. Or un flux Strava peut avoir des trous (pause automatique, enregistrement « intelligent » toutes
// les 2 à 4 s) : l'indice n'est alors plus la seconde et les durées sont fausses.
//
// Règle : on place chaque point à sa seconde (flux `time`). Un trou de 10 s ou moins garde la dernière valeur
// (enregistrement intelligent), un trou plus long vaut 0 (pause : on ne pédale pas).
// Sans flux `time` exploitable (absent, longueur différente, temps non croissant), on rend la série telle quelle.
// ============================================================

const TROU_MAX_S = 10;
const DUREE_MAX_S = 24 * 3600; // garde-fou : on ne fabrique pas de série de plus de 24 h

export function reechantillonner1Hz(valeurs: any[], temps: any[]): any[] {
  if (!Array.isArray(valeurs) || !Array.isArray(temps)) return valeurs || [];
  const n = valeurs.length;
  if (n < 2 || temps.length !== n) return valeurs;
  const t0 = Number(temps[0]);
  if (!Number.isFinite(t0)) return valeurs;
  for (let i = 1; i < n; i++) {
    const t = Number(temps[i]);
    if (!Number.isFinite(t) || t <= Number(temps[i - 1])) return valeurs; // temps non croissant
  }
  const total = Math.round(Number(temps[n - 1]) - t0) + 1;
  if (total === n) return valeurs;          // déjà à 1 Hz
  if (total > DUREE_MAX_S || total < n) return valeurs;
  const sortie = new Array(total).fill(0);
  for (let i = 0; i < n; i++) {
    const debut = Math.round(Number(temps[i]) - t0);
    const fin = i + 1 < n ? Math.round(Number(temps[i + 1]) - t0) : debut + 1; // exclu
    const v = valeurs[i] == null ? 0 : valeurs[i];
    sortie[debut] = v;
    const trou = fin - debut;
    if (trou > 1 && trou <= TROU_MAX_S) for (let k = debut + 1; k < fin; k++) sortie[k] = v;
  }
  return sortie;
}
