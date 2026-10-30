// Le temps de la synchro des flux et des courbes : le temps de CALCUL (sorties restantes × temps moyen d'une sortie) et l'avancement.
// Les pauses de Strava (100 demandes par quart d'heure, environ 1 000 par jour) ne sont ni prévues ni comptées : quand la limite est atteinte, le calcul s'arrête.
// Fonctions pures : voir native/tests/synchro/estimation.test.ts et docs/native/SYNCHRO_STRAVA.md.

/** Le temps de calcul d'une sortie avant d'en avoir mesuré une vraie : une demande à Strava, le calcul de la courbe, l'écriture. */
export const SECONDES_PAR_SORTIE_DEFAUT = 2;

/** Le temps de calcul qui reste, en secondes. */
export function tempsCalcul(restantes: number, secParSortie: number): number {
  return Math.max(0, restantes) * Math.max(0, secParSortie);
}

/** Une durée lisible, arrondie : « moins d'une minute », « 7 min », « 3 h 20 », « 1 jour et 6 h ». Le mot « environ » est ajouté par l'écran. */
export function formaterDuree(secondes: number): string {
  const s = Math.max(0, secondes);
  if (s < 45) return 'moins d\'une minute';
  const min = Math.round(s / 60);
  if (min < 10) return `${min} min`;
  if (min < 90) return `${Math.round(min / 5) * 5} min`;
  const heures = Math.floor(min / 60);
  if (heures < 24) {
    const reste = Math.round((min - heures * 60) / 10) * 10;
    if (reste === 60) return `${heures + 1} h`;
    return reste ? `${heures} h ${String(reste).padStart(2, '0')}` : `${heures} h`;
  }
  const jours = Math.floor(heures / 24);
  const h = Math.round(min / 60 - jours * 24);
  if (h === 24) return `${jours + 1} jour${jours + 1 > 1 ? 's' : ''}`;
  const j = `${jours} jour${jours > 1 ? 's' : ''}`;
  return h ? `${j} et ${h} h` : j;
}

/**
 * Le compteur affiché, continu : il avance à vitesse constante (la vitesse moyenne mesurée depuis le début), pas de saut à chaque réponse du serveur.
 * Le serveur ne répond qu'à la fin d'un lot : le compteur ne dépasse jamais la dernière sortie du lot en cours, et s'il est en retard sur le chiffre confirmé,
 * il le rattrape en glissant (environ 1,5 s) au lieu de sauter. Appelée à chaque image d'animation, avec `dt` le temps écoulé depuis la précédente (en secondes).
 *  affiche : valeur actuelle (décimale) · confirmees : sorties confirmées par le serveur · vitesse : sorties par seconde · tailleLot : sorties demandées dans le lot.
 */
export function avancerAffichage(affiche: number, confirmees: number, total: number, vitesse: number, dt: number, tailleLot: number): number {
  const plafond = Math.min(total, confirmees + Math.max(0, tailleLot - 1));
  const retard = Math.max(0, confirmees - affiche);
  const v = Math.max(0, vitesse) + retard / 1.5;
  return Math.max(0, Math.min(plafond, affiche + v * Math.max(0, dt)));
}

/** Un pourcentage avec une décimale et une virgule : « 2,3 », « 100 ». Jamais 100 tant que tout n'est pas fait (99,96 s'écrit 99,9). */
export function formaterPourcent(part: number): string {
  const p = Math.min(1, Math.max(0, part)) * 100;
  if (p >= 100) return '100';
  return (Math.floor(p * 10) / 10).toFixed(1).replace('.', ',');
}

/** L'avancement de 0 à 1 : la part des sorties déjà importées (chaque sortie prend à peu près le même temps, donc c'est aussi la part du temps de calcul). */
export function avancement(faites: number, total: number): number {
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, faites / total));
}
