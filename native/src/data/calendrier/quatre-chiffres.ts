// Les quatre chiffres de la première page d'une activité (sortie réalisée, séance prévue, compétition). Fonction pure, sans écran (testée dans tests/calendrier/quatre-chiffres.test.ts).
// On parcourt l'ordre voulu pour le sport : une clé simple est prise si le chiffre existe ; un groupe de clés donne le premier chiffre présent du groupe
// (ex. la puissance du vélo, sinon le dénivelé). Les places restantes sont remplies par la liste de repli, puis par rien : on ne dépasse jamais quatre.

export type Ordre = (string | string[])[];

export function choisirChiffres<T extends { cle: string }>(chiffres: T[], ordre: Ordre, repli: string[] = [], n = 4): T[] {
  const pris: T[] = [];
  const prendre = (cle: string) => {
    const c = chiffres.find((x) => x.cle === cle);
    if (c && !pris.includes(c) && pris.length < n) pris.push(c);
    return !!c;
  };
  for (const e of ordre) {
    if (typeof e === 'string') prendre(e);
    else for (const cle of e) if (!pris.some((c) => c.cle === cle) && prendre(cle)) break;
  }
  for (const cle of repli) prendre(cle);
  return pris;
}

/** L'ordre des quatre chiffres d'une sortie réalisée selon le sport (type brut : Run, Ride, AlpineSki…). */
export function ordreSortie(sport: string, famille: string): { ordre: Ordre; repli: string[] } {
  if (sport === 'AlpineSki' || sport === 'Snowboard') return { ordre: ['descendu', 'vmax', 'descentes', 'duree', 'distance', 'denivele'], repli: ['fc', 'charge'] };
  if (sport === 'BackcountrySki') return { ordre: ['denivele', 'descendu', 'duree', 'distance'], repli: ['fc', 'charge'] };
  if (sport === 'NordicSki' || sport === 'RollerSki') return { ordre: ['distance', 'duree', 'vitesse', 'denivele'], repli: ['fc', 'charge'] };
  if (famille === 'course') return { ordre: ['distance', 'duree', 'allure', 'denivele'], repli: ['fc', 'charge'] };
  if (famille === 'velo') return { ordre: ['distance', 'duree', 'vitesse', ['watts', 'denivele']], repli: ['fc', 'charge'] };
  if (famille === 'natation') return { ordre: ['distance', 'duree', 'allure', 'fc'], repli: ['charge', 'energie'] };
  if (famille === 'muscu') return { ordre: ['duree', 'fc', 'charge', 'energie'], repli: ['rpe'] };
  if (famille === 'hyrox') return { ordre: ['duree', 'distance', 'allure', 'fc'], repli: ['charge'] };
  return { ordre: ['duree', 'distance', 'fc', 'charge'], repli: ['energie', 'rpe'] };
}

/** L'ordre des quatre chiffres d'une séance prévue ou d'une compétition. */
export function ordrePrevue(competition: boolean): { ordre: Ordre; repli: string[] } {
  return competition
    ? { ordre: ['cible', 'distance', 'allure', 'dplus'], repli: ['charge', 'effort'] }
    : { ordre: ['duree', ['distance', 'charge'], 'allure', ['charge', 'effort']], repli: ['dplus', 'watts', 'bpm'] };
}
