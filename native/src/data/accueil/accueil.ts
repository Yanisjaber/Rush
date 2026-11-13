// Tout ce que l'Accueil affiche, chargé d'un coup : une enveloppe unique.
// Port de routes/Accueil.svelte. Ce fichier est pur (aucun réseau) : le chargement d'un vrai compte est dans chargement.ts.
import { familleAffichage, familleSport } from '../sports/familles.ts';
import { fusionnerFamilles } from '../sports/sports-choisis.ts';
import type { Metrique, Objectif, ObjectifHyrox, PointPuissance, Prevue, Profil, ProgrammeForce, Seance, SerieForce, TestHyrox } from '../types.ts';

export interface DonneesAccueil {
  profil: Profil | null;
  metriques: Metrique[];
  seances: Seance[];
  dernieres: Seance[];
  objectifs: Objectif[];
  puissance: PointPuissance[];
  planifiees: Prevue[];
  force: { series: SerieForce[]; programmes: ProgrammeForce[] };
  hyrox: { tests: TestHyrox[]; objectif: ObjectifHyrox | null };
  /** Sports choisis par l'utilisateur (null : jamais demandé). */
  sportsChoisis: string[] | null;
  /** Le compte a une connexion (Strava ou autre). En cas de doute (lecture impossible), vrai : on ne dérange pas. */
  connecte: boolean;
  /** Message si une donnée essentielle n'a pas pu être lue (l'écran s'affiche quand même avec ce qui est là). */
  erreur: string;
  /** Message si le carnet de force ou le suivi Hyrox ne répondent pas. */
  erreurSport: string;
}

/**
 * Sports de l'utilisateur : ceux de ses séances, plus la muscu s'il a un programme ou des séries,
 * plus Hyrox s'il a un test ou un objectif Hyrox, puis ses sports choisis en premier.
 */
export function famillesDe(d: Pick<DonneesAccueil, 'seances' | 'force' | 'hyrox' | 'objectifs' | 'sportsChoisis'>): string[] {
  // Hyrox n'est plus un sport principal : ses séances comptent dans « Autre »
  const f = new Set(d.seances.map((s) => familleSport(s.sport)).map((c) => (c === 'hyrox' ? 'autre' : c)));
  if (d.force.programmes.length || d.force.series.length) f.add('muscu');
  return fusionnerFamilles([...f], d.sportsChoisis);
}

/** Une enveloppe vide, avec un message d'erreur : pour ne jamais laisser l'écran bloqué si le chargement échoue. */
export function donneesAccueilVides(erreur: string): DonneesAccueil {
  return {
    profil: null,
    metriques: [],
    seances: [],
    dernieres: [],
    objectifs: [],
    puissance: [],
    planifiees: [],
    force: { series: [], programmes: [] },
    hyrox: { tests: [], objectif: null },
    sportsChoisis: null,
    connecte: true,
    erreur,
    erreurSport: '',
  };
}
