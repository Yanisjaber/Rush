// Une enveloppe d'Accueil complète construite avec les données générées (pour les tests seulement).
import type { DonneesAccueil } from '../../src/data/accueil/accueil.ts';
import { donneesDemo, objectifHyroxDemo, programmesDemo, seriesForceHistoriqueDemo, testsHyroxHistoriqueDemo } from './demo.ts';

export function donneesDemoAccueil(aujourdhui: Date = new Date(), options: { prevuesAujourdhui?: number } = {}): DonneesAccueil {
  const d = donneesDemo(aujourdhui, undefined, options);
  return {
    profil: d.profil,
    metriques: d.metriques,
    seances: d.seances,
    dernieres: d.seances,
    objectifs: d.objectifs,
    puissance: d.puissance,
    planifiees: d.planifiees,
    force: { series: seriesForceHistoriqueDemo(aujourdhui), programmes: programmesDemo() },
    hyrox: { tests: testsHyroxHistoriqueDemo(aujourdhui), objectif: objectifHyroxDemo() },
    sportsChoisis: null,
    connecte: false,
    erreur: '',
    erreurSport: '',
  };
}
