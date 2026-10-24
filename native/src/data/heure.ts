// Des heures « HH:MM » et des dates « AAAA-MM-JJ » pour les sélecteurs natifs (qui parlent en objets Date). Fonctions pures.

const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** « 18:30 » → une Date locale à cette heure (aujourd'hui) ; une heure illisible donne midi. */
export function dateDepuisHeure(heure: string, jour: Date = new Date()): Date {
  const m = HEURE.exec(String(heure ?? ''));
  const d = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), m ? Number(m[1]) : 12, m ? Number(m[2]) : 0, 0, 0);
  return d;
}

/** Une Date → « 07:05 » (heure locale, sur deux chiffres). */
export const heureDepuisDate = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** « 2026-10-26 » → une Date locale ce jour-là à midi (à midi : aucun changement d'heure ne fait changer le jour). */
export const dateDepuisJour = (iso: string): Date => new Date(`${String(iso).slice(0, 10)}T12:00:00`);

/** Une Date → « AAAA-MM-JJ » (jour local). */
export const jourDepuisDate = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Une heure saisie est-elle au bon format ? */
export const heureValide = (heure: string): boolean => HEURE.test(String(heure ?? ''));

const deux = (n: number) => String(n).padStart(2, '0');

/** Une durée (heures et minutes saisies) → « HH:MM » pour les roues du sélecteur ; illisible → 00:00, au-delà de 23 h 59 → borné. */
export function heureDepuisDuree(heures: string, minutes: string): string {
  const h = Math.min(23, Math.max(0, Math.trunc(Number(heures)) || 0));
  const m = Math.min(59, Math.max(0, Math.trunc(Number(minutes)) || 0));
  return `${deux(h)}:${deux(m)}`;
}

/** « 04:37 » (choisi sur les roues) → { heures: '4', minutes: '37' } ; illisible → 0 h 0 min. */
export function dureeDepuisHeure(heure: string): { heures: string; minutes: string } {
  const m = HEURE.exec(String(heure ?? ''));
  return m ? { heures: String(Number(m[1])), minutes: String(Number(m[2])) } : { heures: '0', minutes: '0' };
}

/** La durée écrite pour l'œil : « 4 h 37 min », « 2 h », « 37 min ». */
export function texteDureeSaisie(heures: string, minutes: string): string {
  const h = Math.trunc(Number(heures)) || 0;
  const m = Math.trunc(Number(minutes)) || 0;
  if (h && m) return `${h} h ${deux(m)} min`;
  return h ? `${h} h` : `${m} min`;
}

/** Une durée en minutes (« 165 ») → { heures: '2', minutes: '45' } ; illisible ou négative → 0 h 0 min. */
export function heuresMinutesDepuis(minutes: string): { heures: string; minutes: string } {
  const total = Math.max(0, Math.trunc(Number(minutes)) || 0);
  return { heures: String(Math.floor(total / 60)), minutes: String(total % 60) };
}

/** « 02:45 » (choisi sur les roues) → la durée en minutes, en texte : « 165 ». */
export function minutesDepuisHeure(heure: string): string {
  const { heures, minutes } = dureeDepuisHeure(heure);
  return String(Number(heures) * 60 + Number(minutes));
}
