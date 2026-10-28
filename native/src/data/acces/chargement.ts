// Chargement de l'Accueil d'un vrai compte : lecture seule, via Supabase.
import { chargerDernieresSeances, chargerLiensProgrammes, chargerMetriques, chargerObjectifHyrox, chargerObjectifs, chargerPlanifiees, chargerProfil, chargerProgrammes, chargerPuissance, chargerSeances, chargerSeriesForce, aUneConnexion, chargerSportsChoisis, chargerTestsHyrox } from './api';
import type { DonneesAccueil } from '../accueil/accueil';
import { dateIsoLocale } from '../outils/format';
import { nettoyerSports } from '../sports/sports-choisis';

/** Charge l'Accueil d'un vrai compte (lecture seule). Ne lève jamais : une donnée absente donne une liste vide et un message. */
export async function chargerAccueil(userId: string): Promise<DonneesAccueil> {
  const bientot = dateIsoLocale(new Date(Date.now() + 60 * 86400e3)); // séances prévues des 60 prochains jours
  const aujourdhui = dateIsoLocale();
  const [profil, metriques, seances, objectifs, puissance, series, programmes, tests, objectifHyrox, prevues, liens, dernieres, sports, connexion] = await Promise.all([
    chargerProfil(userId),
    chargerMetriques(userId),
    chargerSeances(userId),
    chargerObjectifs(userId, 10),
    chargerPuissance(userId),
    chargerSeriesForce(userId),
    chargerProgrammes(userId),
    chargerTestsHyrox(userId),
    chargerObjectifHyrox(userId),
    chargerPlanifiees(userId, aujourdhui, bientot),
    chargerLiensProgrammes(userId, aujourdhui, bientot), // programme relié à chaque séance prévue (tolérant si la colonne n'existe pas)
    chargerDernieresSeances(userId), // sans limite de date : la liste « Dernières séances » ne se vide pas pendant une pause
    chargerSportsChoisis(userId),
    aUneConnexion(userId),
  ]);
  const liensProgramme = liens.data ?? {};
  return {
    profil: profil.data,
    metriques: metriques.data ?? [],
    seances: seances.data ?? [],
    dernieres: dernieres.data ?? [], // non bloquant : sans elles, l'accueil s'affiche quand même
    objectifs: objectifs.data ?? [],
    puissance: puissance.data ?? [],
    planifiees: (prevues.data ?? []).map((p) => (liensProgramme[p.id] ? { ...p, programme_id: liensProgramme[p.id] } : p)),
    force: { series: series.data ?? [], programmes: programmes.data ?? [] },
    hyrox: { tests: tests.data ?? [], objectif: objectifHyrox.data ?? null },
    sportsChoisis: nettoyerSports(sports.data),
    connecte: connexion !== false, // lecture impossible (null) : on suppose connecté, pour ne pas montrer un faux écran de démarrage
    erreur: [profil, metriques, seances, objectifs, puissance].map((r) => r.erreur).find(Boolean) || '',
    // Force et Hyrox : tables ajoutées par la migration 2026-10-13. Si elle n'est pas appliquée, on affiche l'accueil quand même.
    erreurSport: [series, programmes, tests, objectifHyrox].some((r) => r.erreur)
      ? "Le carnet de force et le suivi Hyrox ne répondent pas : la migration « force_hyrox » n'est peut-être pas appliquée sur ta base."
      : '',
  };
}
