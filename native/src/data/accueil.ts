// Tout ce que l'Accueil affiche, chargé d'un coup : une enveloppe unique, la même pour la démo et pour un vrai compte.
// Port de routes/Accueil.svelte. Ce fichier est pur (aucun réseau) : le chargement d'un vrai compte est dans chargement.ts.
import { donneesDemo, objectifHyroxDemo, programmesDemo, seriesForceDemo, testsHyroxDemo } from './demo.ts';
import { familleAffichage, familleBarre } from './familles.ts';
import { fusionnerFamilles } from './sports-choisis.ts';
import type { Metrique, Objectif, ObjectifHyrox, PointPuissance, Prevue, Profil, ProgrammeForce, Seance, SerieForce, TestHyrox } from './types.ts';

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
  const f = new Set(d.seances.map((s) => familleBarre(s.sport)));
  if (d.force.programmes.length || d.force.series.length) f.add('muscu');
  if (d.hyrox.tests.length || d.hyrox.objectif || d.objectifs.some((o) => familleAffichage(o.sport) === 'hyrox')) f.add('hyrox');
  return fusionnerFamilles([...f], d.sportsChoisis);
}

/** Les données d'exemple : mêmes formes que celles de la base, sans compte. */
export function donneesDemoAccueil(aujourdhui: Date = new Date()): DonneesAccueil {
  const d = donneesDemo(aujourdhui);
  return {
    profil: d.profil,
    metriques: d.metriques,
    seances: d.seances,
    dernieres: d.seances,
    objectifs: d.objectifs,
    puissance: d.puissance,
    planifiees: d.planifiees,
    force: { series: seriesForceDemo(aujourdhui), programmes: programmesDemo() },
    hyrox: { tests: testsHyroxDemo(aujourdhui), objectif: objectifHyroxDemo() },
    sportsChoisis: null,
    erreur: '',
    erreurSport: '',
  };
}
