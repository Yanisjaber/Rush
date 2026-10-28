import type { DonneesAccueil } from './accueil.ts';

type Etat = Pick<DonneesAccueil, 'seances' | 'dernieres' | 'planifiees' | 'objectifs' | 'force' | 'hyrox' | 'connecte' | 'erreur'>;

/** Le compte a-t-il la moindre donnée ? `dernieres` n'a pas de limite de date : une sortie d'il y a deux ans compte. */
export function aDesDonnees(d: Etat): boolean {
  return (
    d.seances.length > 0 ||
    d.dernieres.length > 0 ||
    d.planifiees.length > 0 ||
    d.objectifs.length > 0 ||
    d.force.series.length > 0 ||
    d.force.programmes.length > 0 ||
    d.hyrox.tests.length > 0 ||
    !!d.hyrox.objectif
  );
}

/** Écran de démarrage : ni donnée, ni connexion. Une connexion suffit à avoir un accueil normal (même sans sortie encore), tout comme une vieille sortie. */
export function compteVide(d: Etat, demo: boolean): boolean {
  return !demo && !d.erreur && !d.connecte && !aDesDonnees(d);
}

/** Message « connecte une app » : compte réel, sans connexion, qui a déjà des données (sinon l'écran de démarrage fait déjà le travail), pas encore fermé. */
export function bandeauConnexionVisible(d: Etat, demo: boolean, ferme: boolean | null): boolean {
  return !demo && !d.erreur && !d.connecte && aDesDonnees(d) && ferme === false;
}
