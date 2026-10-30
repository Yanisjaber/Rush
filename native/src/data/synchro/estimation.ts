// Le temps de la synchro des courbes de puissance. Deux durées, gardées séparées :
//  - le temps de CALCUL : ce que prennent les sorties elles-mêmes (la barre et « il reste environ… » ne comptent que lui) ;
//  - les PAUSES imposées par Strava (100 demandes par 15 minutes, environ 1 000 par jour), annoncées à part.
// Strava repart de zéro à chaque quart d'heure pile (:00, :15, :30, :45) et chaque jour à minuit UTC.
// Fonctions pures : voir native/tests/synchro/estimation.test.ts et docs/native/SYNCHRO_STRAVA.md.

export interface QuotaStrava {
  limite15: number;
  limiteJour: number;
  usage15: number;
  usageJour: number;
}

/** Les limites d'une appli Strava par défaut, quand le serveur n'a pas encore pu les lire dans les en-têtes de Strava. */
export const QUOTA_DEFAUT: QuotaStrava = { limite15: 100, limiteJour: 1000, usage15: 0, usageJour: 0 };

/** Le quota de la réponse du serveur : seulement s'il est complet et sensé (entiers positifs, limites non nulles). Le serveur envoie les noms limite15, limiteJour, usage15, usageJour. */
export function quotaValide(v: unknown): QuotaStrava | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const entier = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : null);
  const limite15 = entier(o.limite15);
  const limiteJour = entier(o.limiteJour);
  const usage15 = entier(o.usage15);
  const usageJour = entier(o.usageJour);
  if (!limite15 || !limiteJour || usage15 === null || usageJour === null) return null;
  return { limite15, limiteJour, usage15, usageJour };
}

/** Le temps de calcul d'une sortie avant d'en avoir mesuré une vraie : une demande à Strava, le calcul de la courbe, l'écriture. */
export const SECONDES_PAR_SORTIE_DEFAUT = 2;

const QUART = 15 * 60 * 1000;
const JOUR = 24 * 60 * 60 * 1000;

export const prochainQuartHeure = (ms: number): number => (Math.floor(ms / QUART) + 1) * QUART;
export const prochainMinuitUtc = (ms: number): number => (Math.floor(ms / JOUR) + 1) * JOUR;

/** Le temps de calcul qui reste, en secondes. */
export function tempsCalcul(restantes: number, secParSortie: number): number {
  return Math.max(0, restantes) * Math.max(0, secParSortie);
}

export interface Pauses {
  nombre: number;
  secondes: number;
  /** Au moins une des pauses attend minuit (limite du jour) : l'attente se compte alors en heures. */
  parJour: boolean;
}

/**
 * Les pauses qu'imposera Strava pour traiter `restantes` sorties à partir de `maintenantMs` : on suit le quota,
 * on traite tant qu'il reste des demandes, puis on attend le prochain quart d'heure (ou minuit UTC si la limite du jour est atteinte).
 */
export function pausesAPrevoir(restantes: number, quota: QuotaStrava, maintenantMs: number, secParSortie: number): Pauses {
  let n = Math.max(0, Math.floor(restantes));
  let q15 = Math.max(0, quota.limite15 - quota.usage15);
  let qJour = Math.max(0, quota.limiteJour - quota.usageJour);
  let t = maintenantMs;
  const sortie: Pauses = { nombre: 0, secondes: 0, parJour: false };
  if (quota.limite15 <= 0 || quota.limiteJour <= 0) return sortie;
  for (let tour = 0; n > 0 && tour < 2000; tour++) {
    const k = Math.min(n, q15, qJour);
    if (k > 0) {
      t += k * secParSortie * 1000;
      n -= k;
      q15 -= k;
      qJour -= k;
    }
    if (n === 0) break;
    const jour = qJour <= 0;
    const fin = jour ? prochainMinuitUtc(t) : prochainQuartHeure(t);
    sortie.nombre++;
    sortie.secondes += (fin - t) / 1000;
    sortie.parJour ||= jour;
    t = fin;
    q15 = quota.limite15;
    if (jour) qJour = quota.limiteJour;
  }
  return sortie;
}

/** Combien de secondes avant la reprise, quand Strava a dit stop (le quart d'heure suivant, ou minuit UTC si la limite du jour est atteinte). */
export function secondesAvantReprise(quota: QuotaStrava | null, maintenantMs: number): number {
  const q = quota ?? QUOTA_DEFAUT;
  const fin = q.usageJour >= q.limiteJour ? prochainMinuitUtc(maintenantMs) : prochainQuartHeure(maintenantMs);
  return Math.max(1, Math.ceil((fin - maintenantMs) / 1000));
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

/** Le compte à rebours d'une pause : « 11 min 20 s » (en secondes en dessous d'une minute). */
export function formaterCompteARebours(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

/** L'avancement de 0 à 1 : la part des sorties déjà calculées (chaque sortie prend à peu près le même temps, donc c'est aussi la part du temps de calcul). */
export function avancement(faites: number, total: number): number {
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, faites / total));
}
