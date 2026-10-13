// Catalogue des analyses : chaque widget qui a une page d'analyse y est relié. Une analyse = un module de calcul pur
// (dans lib/analyse/) et quelques réglages. La page (routes/Analyse.svelte) lit ce catalogue.
import { familleAffichage } from '../data/familles.js';
import { analyserCharge } from './charge.js';
import { analyserForme } from './forme.js';
import { analyserPredictions } from './predictions.js';

const NOM_PERIODE = { sem12: '3 mois', sem26: '6 mois', sem52: '12 mois' };
export const PERIODES = [
  { cle: 'sem12', libelle: '3 mois', semaines: 12 },
  { cle: 'sem26', libelle: '6 mois', semaines: 26 },
  { cle: 'sem52', libelle: '12 mois', semaines: 52 },
];

export const ANALYSES = {
  charge: {
    titre: 'Charge d\'entraînement',
    sousTitre: 'Monte-t-elle à un rythme sain ? Est-elle bien répartie ?',
    periodes: true,
    periodeDefaut: 'sem26',
    calculer: (d, o) => analyserCharge({ seances: d.seances, aujourdhui: o.aujourdhui, semaines: o.semaines, nomSport: o.nomSport }),
  },
  forme: {
    titre: 'Forme et fraîcheur',
    sousTitre: 'Où en es-tu, et comment arriver frais à ta prochaine compétition ?',
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
    sousTitre: 'Ton niveau, tes temps probables et tes allures d\'entraînement',
    periodes: false,
    sportImpose: 'course', // l'analyse ne parle que de course à pied, quel que soit le filtre
    calculer: (d, o) => analyserPredictions({ seances: d.seances, objectifs: d.objectifs, hrMax: d.hrMax, aujourdhui: o.aujourdhui, nomSport: o.nomSport }),
  },
};

/** Widget de l'accueil → analyse ouverte quand on le touche. */
export const ANALYSE_DU_WIDGET = { charge: 'charge', forme: 'forme', predictions: 'predictions' };

export const estAnalyse = (id) => typeof id === 'string' && Object.hasOwn(ANALYSES, id);
export const periodeValide = (cle, defaut = 'sem26') => (Object.hasOwn(NOM_PERIODE, cle) ? cle : defaut);
