// L'écran de détail d'une séance : les chiffres à montrer selon le sport, et les lignes de tours. Fonctions pures, sans réseau
// (testées dans tests/seance-detail.test.ts).
import { familleAffichage } from './familles.ts';
import { formatAllure, formatAllureDepuisKmh, formatDuree, formatKm, formatNombre } from './format.ts';
import type { Seance, Tour } from './types.ts';

export interface ChiffreSeance {
  cle: string;
  libelle: string;
  valeur: string;
  unite?: string;
  note?: string;
}

const positif = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const secondesParKm = (s: Seance): number | null => (positif(s.distance_km) && positif(s.moving_time) ? s.moving_time / s.distance_km : null);

/** Durée de tour : « 4'32" » sous l'heure, sinon « 1h02 » (un tour de 1 km dure quelques minutes, un tour de station quelques dizaines de secondes). */
export function formatDureeTour(secondes: number): string {
  const s = Math.round(secondes);
  if (s >= 3600) return formatDuree(s);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
}

/**
 * Les chiffres d'une séance, dans l'ordre où on les cherche : durée, distance, allure (course, natation) ou vitesse (vélo), dénivelé,
 * cardio, puissance, cadence, énergie, charge, effort ressenti. Un chiffre absent n'est pas listé.
 */
export function chiffresSeance(s: Seance): ChiffreSeance[] {
  const famille = familleAffichage(s.sport);
  const liste: ChiffreSeance[] = [];
  if (positif(s.moving_time)) {
    const ecoule = positif(s.elapsed_time) && s.elapsed_time - s.moving_time >= 120 ? `${formatDuree(s.elapsed_time)} au total` : undefined;
    liste.push({ cle: 'duree', libelle: 'Durée', valeur: formatDuree(s.moving_time), note: ecoule });
  }
  if (positif(s.distance_km)) liste.push({ cle: 'distance', libelle: 'Distance', valeur: formatKm(s.distance_km, s.distance_km < 10 ? 2 : 1), unite: 'km' });
  const spk = secondesParKm(s);
  if (spk && (famille === 'course' || famille === 'hyrox')) liste.push({ cle: 'allure', libelle: 'Allure', valeur: formatAllure(spk).replace('/km', ''), unite: '/km' });
  else if (spk && famille === 'natation') liste.push({ cle: 'allure', libelle: 'Allure', valeur: formatAllureDepuisKmh(s.distance_km! / (s.moving_time / 3600), true), unite: '/100 m' });
  else if (spk && famille === 'velo') liste.push({ cle: 'vitesse', libelle: 'Vitesse', valeur: formatKm(positif(s.avg_speed_kmh) ? s.avg_speed_kmh : s.distance_km! / (s.moving_time / 3600)), unite: 'km/h' });
  if (positif(s.total_elevation_gain)) liste.push({ cle: 'denivele', libelle: 'Dénivelé', valeur: formatNombre(Math.round(s.total_elevation_gain)), unite: 'm' });
  if (positif(s.avg_heartrate)) liste.push({ cle: 'fc', libelle: 'Cardio moyen', valeur: String(Math.round(s.avg_heartrate)), unite: 'bpm', note: positif(s.max_heartrate) ? `max ${Math.round(s.max_heartrate)}` : undefined });
  if (positif(s.avg_watts)) liste.push({ cle: 'watts', libelle: 'Puissance moyenne', valeur: String(Math.round(s.avg_watts)), unite: 'W', note: positif(s.np) ? `normalisée ${Math.round(s.np)}` : undefined });
  if (positif(s.avg_cadence)) liste.push({ cle: 'cadence', libelle: 'Cadence', valeur: String(Math.round(s.avg_cadence)), unite: famille === 'velo' ? 'tr/min' : 'pas/min' });
  if (positif(s.kj)) liste.push({ cle: 'energie', libelle: 'Énergie', valeur: formatNombre(Math.round(s.kj)), unite: 'kJ' });
  else if (positif(s.calories)) liste.push({ cle: 'energie', libelle: 'Énergie', valeur: formatNombre(Math.round(s.calories)), unite: 'kcal' });
  if (positif(s.tss)) liste.push({ cle: 'charge', libelle: 'Charge', valeur: String(Math.round(s.tss)), unite: 'pts' });
  if (positif(s.rpe)) liste.push({ cle: 'rpe', libelle: 'Effort ressenti', valeur: String(Math.round(s.rpe)), unite: '/10' });
  return liste;
}

export interface LigneTour {
  cle: string;
  numero: number;
  /** Le nom donné par la montre, s'il en a un qui n'est pas juste « Lap 3 ». */
  nom: string;
  duree: string;
  /** « 1,00 km » ou « 50 m » ; vide pour un tour sans distance. */
  distance: string;
  /** L'allure ou la vitesse du tour, selon le sport ; vide sans distance. */
  rythme: string;
}

const NOM_PAR_DEFAUT = /^(lap|tour)\s*\d*$/i;

/** Les tours prêts à afficher : leur temps, leur distance et leur allure (course, Hyrox), vitesse (vélo) ou allure au 100 m (natation). */
export function lignesTours(tours: Tour[], sport: string): LigneTour[] {
  const famille = familleAffichage(sport);
  return tours.map((t, i) => {
    const temps = positif(t.moving_time) ? t.moving_time : t.elapsed_time;
    const avecDistance = positif(t.distance) && positif(temps);
    let rythme = '';
    if (avecDistance) {
      if (famille === 'velo') rythme = `${formatKm((t.distance / 1000) / (temps / 3600))} km/h`;
      else if (famille === 'natation') rythme = `${formatAllureDepuisKmh(t.distance / 1000 / (temps / 3600), true)}/100 m`;
      else rythme = formatAllure(temps / (t.distance / 1000));
    }
    const nom = (t.name || '').trim();
    return {
      cle: String(i),
      numero: Number.isFinite(t.index) && t.index > 0 ? t.index : i + 1,
      nom: nom && !NOM_PAR_DEFAUT.test(nom) ? nom : '',
      duree: formatDureeTour(temps),
      distance: positif(t.distance) ? (t.distance >= 1000 ? `${formatKm(t.distance / 1000, 2)} km` : `${Math.round(t.distance)} m`) : '',
      rythme,
    };
  });
}

/** La phrase affichée quand les tours ne peuvent pas être chargés (même texte que sur le web). */
export function messageTours(statut: number, code: unknown): string {
  if (statut === 429 || code === 'rate_limited') return 'Strava demande de patienter quelques minutes avant de réessayer.';
  if (code === 'no_strava_connection') return 'Connecte Strava dans Paramètres › Connexions pour voir les tours.';
  if (code === 'not_a_strava_activity') return "Cette séance ne vient pas de Strava : ses tours ne sont pas disponibles.";
  if (code === 'activity_not_found') return 'Séance introuvable.';
  if (statut === 404) return "Les tours ne sont pas encore activés sur ton serveur (fonction « strava-laps » à déployer).";
  return 'Impossible de récupérer les tours pour le moment.';
}

/** Nettoie la réponse de strava-laps : on ne fait pas confiance à son contenu (types, bornes, 100 tours au plus). */
export function toursValides(brut: unknown): Tour[] {
  if (!Array.isArray(brut)) return [];
  const nombre = (v: unknown, max: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(Number(v), max) : 0);
  return brut.slice(0, 100).map((t: Record<string, unknown> | null, i) => ({
    index: nombre(t?.index, 1000) || i + 1,
    name: typeof t?.name === 'string' ? t.name.slice(0, 60) : '',
    elapsed_time: nombre(t?.elapsed_time, 86400),
    moving_time: nombre(t?.moving_time, 86400),
    distance: nombre(t?.distance, 1_000_000),
  })).filter((t) => t.elapsed_time > 0 || t.moving_time > 0);
}
