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
