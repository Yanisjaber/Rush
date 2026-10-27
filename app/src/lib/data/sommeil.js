// Sommeil : petits calculs d'heures et de segments à partir des nuits Garmin (table garmin_sleep, une ligne par nuit).
// Le score et les analyses sont dans score-sommeil.js.
// Fonctions pures, sans accès réseau : faciles à tester.

/** Heure « HH:MM » d'un horodatage « AAAA-MM-JJ HH:MM » (ou null si absent/mal formé). */
export function heureDe(horodatage) {
  // accepte « AAAA-MM-JJ HH:MM », « AAAA-MM-JJTHH:MM:SS » ou « HH:MM »
  const m = /(?:^|[ T])(\d{1,2}):(\d{2})/.exec(String(horodatage || ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Remet des minutes (éventuellement > 24 h) en « HH:MM ». */
export function heureDepuisMinutes(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return null;
  const t = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Heure « HH:MM » `minutes` minutes après l'heure de coucher « HH:MM » (null sans heure de coucher). Passe minuit sans jamais écrire « :60 ». */
export function heureApres(coucher, minutes) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(coucher || '');
  if (!m || minutes == null || Number.isNaN(Number(minutes))) return null;
  return heureDepuisMinutes(Number(m[1]) * 60 + Number(m[2]) + Math.round(minutes));
}

/**
 * Segments exploitables de l'hypnogramme : [début_min, fin_min, niveau] avec des nombres, un niveau de 0 à 3 et une fin après le début.
 * Tout le reste (segment mal formé, valeur vide, colonne qui n'est pas une liste) est ignoré au lieu de faire planter l'écran.
 */
export function segmentsValides(nuit) {
  if (!Array.isArray(nuit?.segments)) return [];
  return nuit.segments.filter(
    (s) => Array.isArray(s) && s.length >= 3 && [s[0], s[1], s[2]].every((v) => typeof v === 'number' && Number.isFinite(v)) && Number.isInteger(s[2]) && s[2] >= 0 && s[2] <= 3 && s[0] >= 0 && s[1] > s[0],
  );
}

/**
 * La nuit voisine de `date` dans une liste de nuits triée de la plus récente à la plus ancienne.
 * sens = -1 : la nuit d'avant (plus ancienne) ; +1 : la nuit d'après (plus récente). Renvoie sa date, ou null s'il n'y en a pas.
 * On saute les jours sans nuit : seules les nuits qui existent sont atteignables.
 */
export function nuitVoisine(nuits, date, sens) {
  const i = (nuits || []).findIndex((n) => n.date === date);
  if (i < 0) return null;
  return nuits[i - sens]?.date ?? null;
}
