// D'où vient chaque indicateur des analyses de musculation : mesuré, calculé ou estimé (voir components/Source.svelte).
// Un seul endroit pour tout classer : on ajoute `source` aux chiffres, aux graphiques et aux parties de l'analyse Rush
// d'après leur titre. Ce qui n'est pas listé est « calculé » (le cas le plus courant).
const M = 'mesure';
const E = 'estimation';

const SOURCES = {
  tonnage: {
    chiffres: { 'Séances par semaine': M },
    graphiques: {},
    parties: { 'La fatigue qui s\'accumule': E, 'Ta trajectoire': E },
  },
  groupes: {
    chiffres: { 'Séries par semaine': M },
    graphiques: { 'Ton corps, groupe par groupe': E },
    parties: { 'Les muscles en retard': E, 'Les portions oubliées': E, 'Un souci de volume, pas d\'équilibre': E },
  },
  chargemuscu: {
    chiffres: { 'Groupe le plus fatigué': E, 'Intensité moyenne': E, 'Séries avec RIR noté': M },
    graphiques: { 'Fatigue de chaque groupe musculaire': E },
    parties: { 'Où en est ta fatigue': E, 'La fatigue qui s\'accumule': E, 'L\'intensité de ton travail': E },
  },
  records: {
    chiffres: { 'Records récents': M, 'Exercices suivis': M },
    graphiques: {},
    parties: { 'Le rythme de ta force': E, 'Tu es dans un pic': E },
  },
};

/** Ajoute le champ `source` à chaque chiffre, graphique et partie Rush d'une analyse de musculation (sans toucher aux autres). */
export function appliquerSources(analyse) {
  const regles = SOURCES[analyse?.id];
  if (!regles || analyse.insuffisant) return analyse;
  const de = (table, cle) => table[cle] || 'calcul';
  return {
    ...analyse,
    chiffres: analyse.chiffres.map((c) => ({ ...c, source: de(regles.chiffres, c.etiquette) })),
    graphiques: analyse.graphiques.map((g) => ({ ...g, source: de(regles.graphiques, g.titre) })),
    rush: analyse.rush ? { ...analyse.rush, parties: analyse.rush.parties.map((p) => ({ ...p, source: de(regles.parties, p.titre) })) } : analyse.rush,
  };
}
