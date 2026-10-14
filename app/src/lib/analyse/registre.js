// Catalogue des analyses : chaque widget qui a une page d'analyse y est relié. Une analyse = un module de calcul pur
// (dans lib/analyse/) et quelques réglages. La page (routes/Analyse.svelte) lit ce catalogue.
import { familleAffichage } from '../data/familles.js';
import { analyserCharge } from './charge.js';
import { analyserForme } from './forme.js';
import { analyserPredictions } from './predictions.js';
import { analyserRegularite } from './regularite.js';
import { rushCharge, rushForme, rushPredictions, rushRegularite, rushGroupes, rushRecords } from './rush.js';
import { analyserTonnage, analyserGroupes, analyserRecords } from './muscu.js';

const NOM_PERIODE = { sem12: '3 mois', sem26: '6 mois', sem52: '12 mois' };
export const PERIODES = [
  { cle: 'sem12', libelle: '3 mois', semaines: 12 },
  { cle: 'sem26', libelle: '6 mois', semaines: 26 },
  { cle: 'sem52', libelle: '12 mois', semaines: 52 },
];

// Tout l'historique chargé (dix ans) pour les analyses qui n'ont pas de sélecteur de période, comme les records
const HISTORIQUE_SEMAINES = 520;

export const ANALYSES = {
  charge: {
    titre: 'Charge d\'entraînement',
    periodes: true,
    periodeDefaut: 'sem26',
    calculer: (d, o) => analyserCharge({ seances: d.seances, aujourdhui: o.aujourdhui, semaines: o.semaines, nomSport: o.nomSport }),
  },
  forme: {
    titre: 'Forme et fraîcheur',
    periodes: true,
    periodeDefaut: 'sem26',
    calculer: (d, o) =>
      analyserForme({
        seances: d.seances,
        planifiees: d.planifiees,
        objectifs: d.objectifs.filter((x) => o.famille === 'tout' || familleAffichage(x.sport) === o.famille),
        courues: d.seances.filter((s) => s.category === 'competition'),
        aujourdhui: o.aujourdhui,
        semaines: o.semaines,
        nomSport: o.nomSport,
      }),
  },
  predictions: {
    titre: 'Prédictions de temps',
    periodes: false,
    sportImpose: 'course', // l'analyse ne parle que de course à pied, quel que soit le filtre
    calculer: (d, o) => analyserPredictions({ seances: d.seances, objectifs: d.objectifs, hrMax: d.hrMax, aujourdhui: o.aujourdhui, nomSport: o.nomSport }),
  },
  regularite: {
    titre: 'Régularité',
    periodes: true,
    periodeDefaut: 'sem12',
    calculer: (d, o) => analyserRegularite({ seances: d.seances, aujourdhui: o.aujourdhui, semaines: o.semaines }),
  },
  tonnage: {
    titre: 'Tonnage et régularité',
    periodes: true,
    periodeDefaut: 'sem26',
    sportImpose: 'muscu', // l'analyse ne parle que de musculation, quel que soit le filtre
    calculer: (d, o) => analyserTonnage({ series: d.series, aujourdhui: o.aujourdhui, semaines: o.semaines }),
  },
  groupes: {
    titre: 'Équilibre musculaire',
    periodes: false,
    sportImpose: 'muscu',
    calculer: (d, o) => analyserGroupes({ series: d.series, aujourdhui: o.aujourdhui }),
  },
  records: {
    titre: 'Records et progression',
    periodes: false, // les records se cherchent dans tout l'historique : pas de sélecteur de période
    sportImpose: 'muscu',
    calculer: (d, o) => analyserRecords({ series: d.series, aujourdhui: o.aujourdhui, semaines: HISTORIQUE_SEMAINES }),
  },
};

// L'analyse Rush (diagnostic croisé + plan) s'ajoute au résultat de chaque analyse qui a assez de données.
// Le tonnage la fournit lui-même (rush-tonnage.js) ; les autres la déduisent de leur champ `brut`.
const RUSH = { charge: rushCharge, forme: rushForme, predictions: rushPredictions, regularite: rushRegularite, groupes: rushGroupes, records: rushRecords };
for (const [id, fabrique] of Object.entries(RUSH)) {
  const calculer = ANALYSES[id].calculer;
  ANALYSES[id].calculer = (d, o) => {
    const a = calculer(d, o);
    return a.insuffisant || !a.brut ? a : { ...a, rush: fabrique(a) };
  };
}

/** Widget de l'accueil → analyse ouverte quand on le touche. */
export const ANALYSE_DU_WIDGET = { charge: 'charge', forme: 'forme', predictions: 'predictions', tonnage: 'tonnage', groupes: 'groupes', records: 'records', regularite: 'regularite' };

export const estAnalyse = (id) => typeof id === 'string' && Object.hasOwn(ANALYSES, id);
export const periodeValide = (cle, defaut = 'sem26') => (Object.hasOwn(NOM_PERIODE, cle) ? cle : defaut);
