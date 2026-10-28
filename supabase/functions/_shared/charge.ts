// ============================================================
// Charge d'une séance Strava : UNE seule règle pour tous les chemins d'arrivée
// (synchro complète `strava-ingest`, webhook `strava-webhook`).
//
// Avant : le webhook ne prenait que la puissance normalisée et la FTP du profil, l'ingest prenait aussi la
// puissance moyenne et estimait la FTP : la même séance n'avait pas le même TSS selon son chemin.
//
// Règle : TSS de puissance (puissance normalisée, sinon moyenne, et FTP du profil, sinon estimée),
// sinon TSS cardio (FC moyenne / LTHR), sinon 0. (Le résumé de charge « effort ressenti » est ajouté côté app.)
// ============================================================
// deno-lint-ignore-file no-explicit-any

/** Seuil cardio : celui du profil, sinon 92 % de la FC max. */
export function lthrEffectif(profil: { lthr?: number | null; hr_max?: number | null } | null | undefined): number | null {
  if (profil?.lthr) return profil.lthr;
  return profil?.hr_max ? Math.round(profil.hr_max * 0.92) : null;
}

/** Puissance retenue pour une activité Strava : normalisée si elle existe, sinon moyenne. */
export function puissanceRetenue(a: any): number {
  return a?.weighted_average_watts || a?.average_watts || 0;
}

/**
 * FTP à utiliser : celle du profil, sinon 95 % de la meilleure puissance sur 20 min (power_profile),
 * sinon 90 % de la meilleure puissance retenue parmi `activites` (celles qu'on vient de récupérer).
 */
export async function ftpEffective(sb: any, userId: string, ftpProfil: number | null, activites: any[] = []): Promise<number | null> {
  if (ftpProfil) return ftpProfil;
  try {
    const { data: pp } = await sb.from("power_profile")
      .select("best_watts").eq("user_id", userId).eq("duration_s", 1200).maybeSingle();
    if (pp?.best_watts) return Math.round(pp.best_watts * 0.95);
  } catch (_) { /* power_profile pas encore calculé */ }
  const meilleures = activites.map(puissanceRetenue).filter((x: number) => x > 0);
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
export function computeTss(a: any, ftp: number | null, lthr: number | null): number {
  const dur = a?.moving_time || a?.elapsed_time || 0;
  if (!dur) return 0;
  const durHr = dur / 3600;
  const np = puissanceRetenue(a);
  if (np && ftp) {
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
  const np = puissanceRetenue(a);
  const intensity = (np && ftp) ? np / ftp : 0;
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
    avg_watts: a.average_watts ? Math.round(a.average_watts) : null,
    max_watts: a.max_watts ? Math.round(a.max_watts) : null,
    np: np ? Math.round(np) : null,
    intensity: intensity ? +intensity.toFixed(3) : null,
    ftp_at_time: ftp,
    avg_cadence: a.average_cadence ? Math.round(a.average_cadence) : null,
    max_cadence: null,
    kj: a.kilojoules ? Math.round(a.kilojoules) : null,
    calories: a.calories ? Math.round(a.calories) : null,
    tss,
    has_heartrate: !!a.has_heartrate,
    has_power: !!(a.device_watts || np),
    device_watts: !!a.device_watts,
  };
}
