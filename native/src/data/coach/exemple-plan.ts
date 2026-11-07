// Un plan d'exemple (« blessure au genou, 10 jours »), le même que dans les maquettes. Deux usages :
//   - les tests, qui vérifient l'aperçu sur un plan réaliste ;
//   - le mode développement : on peut afficher la carte dans le Coach sans passer par le serveur (voir useCoach, __DEV__).
// Les jours sont calculés à partir d'aujourd'hui, donc la carte a toujours l'air d'un plan réel.
import { ajouterJours } from './apercu-plan.ts';
import type { CartePlanning, LignePlan } from './types.ts';

/** Les cartes d'exemple portent cet identifiant : jamais envoyées au serveur */
export const PREFIXE_EXEMPLE = 'exemple-';

export function lignesPlanExemple(aujourdhui: string): LignePlan[] {
  const j = (n: number) => ajouterJours(aujourdhui, n);
  return [
    { op: 'indisponibilite', texte: 'Déclarer : blessure du jour 1 au jour 10', type: 'blessure', du: j(1), au: j(10) },
    { op: 'supprimer', texte: 'Supprimer : course 60 min', raison: 'blessure', sport: 'course', minutes: 60, de: j(1) },
    { op: 'ajouter', texte: 'Ajouter : course Footing facile 30 min', raison: 'reprise progressive', sport: 'course', minutes: 30, vers: j(12) },
    { op: 'supprimer', texte: 'Supprimer : vélo 120 min', raison: 'blessure', sport: 'velo', minutes: 120, de: j(2) },
    { op: 'ajouter', texte: 'Ajouter : vélo Endurance 60 min', raison: 'reprise progressive', sport: 'velo', minutes: 60, vers: j(13) },
    { op: 'supprimer', texte: 'Supprimer : course 45 min', raison: 'blessure', sport: 'course', minutes: 45, de: j(4) },
    { op: 'ajouter', texte: 'Ajouter : course Footing facile 30 min', raison: 'reprise progressive', sport: 'course', minutes: 30, vers: j(14) },
    { op: 'supprimer', texte: 'Supprimer : vélo 90 min', raison: "blessure ; aucun jour libre qui respecte tes règles d'ici 14 jours", sport: 'velo', minutes: 90, de: j(6) },
    { op: 'supprimer', texte: 'Supprimer : vélo 180 min', raison: "blessure ; aucun jour libre qui respecte tes règles d'ici 14 jours", sport: 'velo', minutes: 180, de: j(8) },
  ];
}

export function cartePlanExemple(aujourdhui: string, id = `${PREFIXE_EXEMPLE}${aujourdhui}`): CartePlanning {
  return {
    id,
    genre: 'planning',
    etat: 'proposee',
    intention: 'Blessure au genou, 10 jours',
    lignes: lignesPlanExemple(aujourdhui),
    charge_avant: 460,
    charge_apres: 100,
  };
}

/** Une semaine de 4 séances construite par le serveur (« fais-moi ma semaine » : deux sorties vélo et deux footings) */
export function cartePlanSemaineExemple(aujourdhui: string, id = `${PREFIXE_EXEMPLE}semaine-${aujourdhui}`): CartePlanning {
  const j = (n: number) => ajouterJours(aujourdhui, n);
  const ajout = (sport: string, minutes: number, jour: number, nom: string): LignePlan => ({
    op: 'ajouter', texte: `Ajouter : ${sport === 'velo' ? 'vélo' : 'course'} ${nom} ${minutes} min`, sport, minutes, vers: j(jour),
  });
  return {
    id,
    genre: 'planning',
    etat: 'proposee',
    intention: 'Ma semaine : deux sorties vélo et deux footings',
    lignes: [ajout('velo', 90, 1, 'Endurance'), ajout('course', 50, 3, 'Footing facile'), ajout('velo', 120, 5, 'Sortie longue'), ajout('course', 45, 6, 'Footing facile')],
    charge_avant: 0,
    charge_apres: 312,
  };
}

/** Un seul jour de repos posé (« mets-moi un repos jeudi ») */
export function cartePlanReposExemple(aujourdhui: string, id = `${PREFIXE_EXEMPLE}repos-${aujourdhui}`): CartePlanning {
  const jour = ajouterJours(aujourdhui, 3);
  return {
    id,
    genre: 'planning',
    etat: 'proposee',
    intention: 'Repos le jour de ton choix',
    lignes: [{ op: 'repos', texte: 'Poser un jour de repos', vers: jour, poser: true }],
    charge_avant: 120,
    charge_apres: 120,
  };
}

/** Les cartes d'essai, dans l'ordre où l'appui long du mode développement les propose */
export const EXEMPLES = [cartePlanExemple, cartePlanSemaineExemple, cartePlanReposExemple] as const;
