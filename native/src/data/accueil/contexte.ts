// L'enveloppe de données que reçoit chaque widget. Port de la construction de `contexte` dans routes/Accueil.svelte :
// toujours la même forme, filtrée par le sport choisi.
import type { DonneesAccueil } from './accueil.ts';
import { garderSeance } from '../sports/familles.ts';
import type { Contexte } from '../types.ts';

export function construireContexte(donnees: DonneesAccueil, filtre: string): Contexte {
  const garde = (x: { sport?: string }) => filtre === 'tout' || garderSeance(x, filtre);
  return {
    seances: donnees.seances.filter(garde),
    toutesSeances: donnees.seances,
    // les plus récentes, quelle que soit leur date : la liste ne se vide pas pendant une pause
    dernieres: donnees.dernieres.filter(garde),
    metriques: donnees.metriques,
    objectifs: donnees.objectifs,
    planifiees: donnees.planifiees.filter(garde),
    profil: donnees.profil,
    puissance: donnees.puissance,
    hrMax: donnees.profil?.hr_max || null,
    filtre,
    force: donnees.force,
    hyrox: donnees.hyrox,
  };
}
