// Sous-disciplines d'un sport (pour l'instant l'athlétisme) : liste, nettoyage. Fonctions pures, sans réseau.
// Stockage : colonne `disciplines` de user_preferences, un objet { sport: [clés] } (ex. { athletisme: ['100m', 'hauteur'] }).

/** Toutes les disciplines de l'athlétisme, par famille d'épreuves. */
export const DISCIPLINES_ATHLE = [
  { titre: 'Sprint', disciplines: [{ cle: '60m', nom: '60 m' }, { cle: '100m', nom: '100 m' }, { cle: '200m', nom: '200 m' }, { cle: '400m', nom: '400 m' }] },
  {
    titre: 'Haies',
    disciplines: [{ cle: '60m-haies', nom: '60 m haies' }, { cle: '100m-haies', nom: '100 m haies' }, { cle: '110m-haies', nom: '110 m haies' }, { cle: '400m-haies', nom: '400 m haies' }],
  },
  {
    titre: 'Demi-fond',
    disciplines: [{ cle: '800m', nom: '800 m' }, { cle: '1500m', nom: '1 500 m' }, { cle: '3000m', nom: '3 000 m' }, { cle: 'steeple', nom: '3 000 m steeple' }],
  },
  { titre: 'Fond', disciplines: [{ cle: '5000m', nom: '5 000 m' }, { cle: '10000m', nom: '10 000 m' }, { cle: 'cross', nom: 'Cross-country' }] },
  {
    titre: 'Route',
    disciplines: [{ cle: '5km-route', nom: '5 km route' }, { cle: '10km-route', nom: '10 km route' }, { cle: 'semi', nom: 'Semi-marathon' }, { cle: 'marathon', nom: 'Marathon' }, { cle: '100km', nom: '100 km' }],
  },
  { titre: 'Relais', disciplines: [{ cle: '4x100m', nom: '4 × 100 m' }, { cle: '4x400m', nom: '4 × 400 m' }] },
  { titre: 'Marche athlétique', disciplines: [{ cle: '20km-marche', nom: '20 km marche' }, { cle: '35km-marche', nom: '35 km marche' }] },
  { titre: 'Sauts', disciplines: [{ cle: 'hauteur', nom: 'Saut en hauteur' }, { cle: 'perche', nom: 'Saut à la perche' }, { cle: 'longueur', nom: 'Saut en longueur' }, { cle: 'triple-saut', nom: 'Triple saut' }] },
  { titre: 'Lancers', disciplines: [{ cle: 'poids', nom: 'Lancer du poids' }, { cle: 'disque', nom: 'Lancer du disque' }, { cle: 'marteau', nom: 'Lancer du marteau' }, { cle: 'javelot', nom: 'Lancer du javelot' }] },
  { titre: 'Épreuves combinées', disciplines: [{ cle: 'pentathlon', nom: 'Pentathlon' }, { cle: 'heptathlon', nom: 'Heptathlon' }, { cle: 'decathlon', nom: 'Décathlon' }] },
];

/** Les sports qui ont des sous-disciplines : sport → liste des groupes. */
export const DISCIPLINES = { athletisme: DISCIPLINES_ATHLE };

const clesDe = (sport) => (Object.hasOwn(DISCIPLINES, sport) ? DISCIPLINES[sport].flatMap((g) => g.disciplines.map((d) => d.cle)) : []);

/** Nom lisible d'une discipline (ou la clé si elle est inconnue). */
export function nomDiscipline(sport, cle) {
  if (!Object.hasOwn(DISCIPLINES, sport)) return cle;
  for (const g of DISCIPLINES[sport]) {
    const d = g.disciplines.find((x) => x.cle === cle);
    if (d) return d.nom;
  }
  return cle;
}

/**
 * Nettoie des disciplines venues du stockage ou de l'écran : sports connus seulement, clés connues, sans doublon, dans l'ordre de l'écran.
 * Si `sportsChoisis` est donné, les disciplines d'un sport qui n'est plus coché sont retirées.
 * Renvoie toujours un objet ({} si rien de valable).
 */
export function nettoyerDisciplines(brut, sportsChoisis = null) {
  const resultat = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return resultat;
  for (const sport of Object.keys(DISCIPLINES)) {
    if (sportsChoisis && !sportsChoisis.includes(sport)) continue;
    const valeurs = Array.isArray(brut[sport]) ? new Set(brut[sport].filter((c) => typeof c === 'string')) : new Set();
    const liste = clesDe(sport).filter((c) => valeurs.has(c));
    if (liste.length) resultat[sport] = liste;
  }
  return resultat;
}
