// ============================================================
// Charge d'une séance Strava : UNE seule règle pour tous les chemins d'arrivée
// (synchro complète `strava-ingest`, webhook `strava-webhook`).
//
// Avant : le webhook ne prenait que la puissance normalisée et la FTP du profil, l'ingest prenait aussi la
// puissance moyenne et estimait la FTP : la même séance n'avait pas le même TSS selon son chemin.
//
// Règle (2 nov. 2026) : TSS de puissance seulement avec un VRAI capteur (`device_watts`) ET une puissance normalisée, et une FTP (profil, sinon estimée) ;
// sinon TSS cardio (FC moyenne / LTHR), sinon 0. Les watts estimés par Strava et la simple puissance moyenne (qui sous-estime une sortie variée) ne servent plus à la charge.
// (Le résumé de charge « effort ressenti » est ajouté côté app.)
// La base a le dernier mot : `recalc_ftp_tss` (supabase/migrations/2026-11-02_ftp_glissante.sql) applique la même règle avec la FTP de l'époque de chaque sortie.
// ============================================================
// deno-lint-ignore-file no-explicit-any

/** Seuil cardio : celui du profil, sinon 92 % de la FC max. */
export function lthrEffectif(profil: { lthr?: number | null; hr_max?: number | null } | null | undefined): number | null {
  if (profil?.lthr) return profil.lthr;
  return profil?.hr_max ? Math.round(profil.hr_max * 0.92) : null;
}

/** Puissance affichée et stockée (colonne `np`) pour une activité Strava : normalisée si elle existe, sinon moyenne. Ne sert PAS à la charge : voir `puissanceCharge`. */
export function puissanceRetenue(a: any): number {
  return a?.weighted_average_watts || a?.average_watts || 0;
}

/** Les sports où la puissance sert à la charge : le vélo (pas électrique). Même liste que `recalc_ftp_tss` côté base. */
const SPORTS_VELO_PUISSANCE = ["Ride", "VirtualRide", "GravelRide", "MountainBikeRide"];

/** Puissance qui compte pour la charge : la puissance normalisée d'un vrai capteur de puissance sur un vélo non électrique, sinon 0 (watts estimés, simple moyenne, capteur de foulée en course, vélo électrique : la charge passe au cardio). */
export function puissanceCharge(a: any): number {
  const sport = a?.sport_type || a?.type || "";
  return a?.device_watts && a?.weighted_average_watts && SPORTS_VELO_PUISSANCE.includes(sport) ? a.weighted_average_watts : 0;
}

/**
 * FTP à utiliser : celle du profil, sinon 95 % de la meilleure puissance sur 20 min (power_profile),
 * sinon 90 % de la meilleure puissance normalisée d'un vrai capteur parmi `activites` (celles qu'on vient de récupérer).
 */
export async function ftpEffective(sb: any, userId: string, ftpProfil: number | null, activites: any[] = []): Promise<number | null> {
  if (ftpProfil) return ftpProfil;
  try {
    const { data: pp } = await sb.from("power_profile")
      .select("watts_90d, watts_alltime").eq("user_id", userId).eq("duration_s", 1200).maybeSingle();
    const w20 = pp?.watts_90d || pp?.watts_alltime; // forme récente d'abord, sinon le record
    if (w20) return Math.round(w20 * 0.95);
  } catch (_) { /* power_profile pas encore calculé */ }
  const meilleures = activites.map(puissanceCharge).filter((x: number) => x > 0);
  if (meilleures.length) return Math.round(Math.max(...meilleures) * 0.90);
  // Repli : meilleure puissance déjà enregistrée dans les séances de l'utilisateur
  try {
    const { data: top } = await sb.from("activities")
      .select("np").eq("user_id", userId).not("np", "is", null).order("np", { ascending: false }).limit(1).maybeSingle();
    if (top?.np) return Math.round(top.np * 0.90);
  } catch (_) { /* pas de séance avec puissance */ }
  return null;
}

/** TSS d'une activité Strava (voir la règle en tête de fichier). */
/** Une intensité (puissance normalisée ÷ FTP) de plus de 1,5 n'existe pas : c'est une FTP absurde (4 W) ou une puissance fausse. On ne s'en sert pas (voir recalc_ftp_tss). */
export const INTENSITE_MAX = 1.5;

export function computeTss(a: any, ftp: number | null, lthr: number | null): number {
  const dur = a?.moving_time || a?.elapsed_time || 0;
  if (!dur) return 0;
  const durHr = dur / 3600;
  const np = puissanceCharge(a);
  if (np && ftp && np / ftp <= INTENSITE_MAX) {
    const intensity = np / ftp;
    return Math.round(durHr * intensity * intensity * 100);
  }
  const avgHr = a?.average_heartrate || 0;
  if (avgHr && lthr) {
    const intensity = avgHr / lthr;
    return Math.round(durHr * intensity * intensity * 100);
  }
  return 0;
}

/** Une activité Strava → une ligne de la table `activities`. */
export function stravaToRow(a: any, userId: string, ftp: number | null, lthr: number | null) {
  // Les watts estimés par Strava (pas de capteur : `device_watts` faux) ne sont pas rangés : l'app ne les montre pas et ne les utilise pas (3 nov. 2026)
  const np = a.device_watts ? puissanceRetenue(a) : 0;
  const intensiteBrute = (puissanceCharge(a) && ftp) ? puissanceCharge(a) / ftp : 0;
  const intensity = intensiteBrute <= INTENSITE_MAX ? intensiteBrute : 0; // une intensité absurde (FTP de 4 W) n'est pas rangée
  const tss = computeTss(a, ftp, lthr);
  const distKm = a.distance ? +(a.distance / 1000).toFixed(2) : null;
  const speedMs = a.average_speed || 0;
  const maxSpeedMs = a.max_speed || 0;

  return {
    user_id: userId,
    source: "strava",
    strava_id: a.id,
    name: a.name || "Activité",
    sport: a.sport_type || a.type || "",
    start_date_local: a.start_date_local || a.start_date,
    elapsed_time: a.elapsed_time != null ? Math.round(a.elapsed_time) : null,
    moving_time: a.moving_time != null ? Math.round(a.moving_time) : null,
    distance_km: distKm,
    total_elevation_gain: a.total_elevation_gain != null ? Math.round(a.total_elevation_gain) : null,
    total_elevation_loss: a.total_elevation_loss != null ? Math.round(a.total_elevation_loss) : null,
    avg_speed_kmh: speedMs ? +(speedMs * 3.6).toFixed(2) : null,
    max_speed_kmh: maxSpeedMs ? +(maxSpeedMs * 3.6).toFixed(2) : null,
    avg_heartrate: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    max_heartrate: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    avg_watts: a.device_watts && a.average_watts ? Math.round(a.average_watts) : null,
    max_watts: a.device_watts && a.max_watts ? Math.round(a.max_watts) : null,
    np: np ? Math.round(np) : null,
    intensity: intensity ? +intensity.toFixed(3) : null,
    ftp_at_time: ftp,
    avg_cadence: a.average_cadence ? Math.round(a.average_cadence) : null,
    max_cadence: null,
    kj: a.device_watts && a.kilojoules ? Math.round(a.kilojoules) : null,
    calories: a.calories ? Math.round(a.calories) : null,
    tss,
    has_heartrate: !!a.has_heartrate,
    has_power: !!a.device_watts,
    device_watts: !!a.device_watts,
    // Température moyenne (°C, appareil avec capteur) et type de séance choisi dans Strava (1 / 11 = compétition) ; null si absents
    avg_temp: Number.isFinite(Number(a.average_temp)) && a.average_temp != null ? Math.round(a.average_temp) : null,
    workout_type: Number.isInteger(a.workout_type) ? a.workout_type : null,
  };
}
