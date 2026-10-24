// Ce qu'on sait d'une compétition à la création : fédérations, niveaux, types d'épreuve, temps cible, allure ou vitesse moyenne. Fonctions pures, sans écran ni réseau.
// Les listes viennent de l'ancienne version du site (fédérations par sport, catégories d'âge de la FFA).
import { formatAllure, formatAllure100m, formatKm } from './format.ts';

export type CategorieFederation = 'cyclisme' | 'course' | 'triathlon' | 'natation';

/** Le type brut (Ride, Run…) → la famille qui décide des fédérations ; null si le sport n'a pas de fédération proposée. */
export function categorieFederation(type: string): CategorieFederation | null {
  if (type === 'Ride') return 'cyclisme';
  if (type === 'Run') return 'course';
  if (type === 'Triathlon' || type === 'Duathlon') return 'triathlon';
  if (type === 'Swim') return 'natation';
  return null;
}

export const FEDERATIONS: Record<CategorieFederation, string[]> = {
  cyclisme: ['FFC', 'UFOLEP', 'FSGT'],
  course: ['FFA', 'Hors stade'],
  triathlon: ['FFTri'],
  natation: ['FFN'],
};

/** Les fédérations proposées pour un sport (liste vide : le champ n'est pas montré). */
export const federationsDuSport = (type: string): string[] => {
  const c = categorieFederation(type);
  return c ? FEDERATIONS[c] : [];
};

/** Types d'épreuve proposés en cyclisme (pour les autres sports, le type se tape librement : « Route », « Trail »…). */
export const TYPES_EPREUVE_VELO = ['Circuit', 'Course en ligne', 'Contre la montre'];

/** Formats de triathlon et d'enchaînement. */
export const FORMATS_TRI = ['XS', 'S', 'M', 'L', 'XL'];

/** Les catégories d'âge de la FFA (réforme de 2020) : [code, libellé]. */
export const CATEGORIES_FFA: [string, string][] = [
  ['EA', 'EA · Éveil athlétique (U10)'], ['PO', 'PO · Poussin (U12)'], ['BE', 'BE · Benjamin (U14)'], ['MI', 'MI · Minime (U16)'],
  ['CA', 'CA · Cadet (U18)'], ['JU', 'JU · Junior (U20)'], ['ES', 'ES · Espoir (U23)'], ['SE', 'SE · Senior (23-34)'],
  ['M0', 'M0 · Master 35-39'], ['M1', 'M1 · Master 40-44'], ['M2', 'M2 · Master 45-49'], ['M3', 'M3 · Master 50-54'], ['M4', 'M4 · Master 55-59'],
  ['M5', 'M5 · Master 60-64'], ['M6', 'M6 · Master 65-69'], ['M7', 'M7 · Master 70-74'], ['M8', 'M8 · Master 75-79'], ['M9', 'M9 · Master 80-84'], ['M10', 'M10 · Master 85+'],
];

const EXEMPLE_NIVEAU: Record<string, string> = { FFC: 'Open 1-3, Access 3-4', UFOLEP: '2e-3e cat', FSGT: '3e-4e cat', FFTri: 'D3, Open' };

/** Le niveau est une liste fermée (catégories FFA) ou un texte libre (avec un exemple selon la fédération). */
export function champNiveau(federation: string): { liste: [string, string][] | null; exemple: string } {
  return federation === 'FFA' ? { liste: CATEGORIES_FFA, exemple: '' } : { liste: null, exemple: EXEMPLE_NIVEAU[federation] ? `ex : ${EXEMPLE_NIVEAU[federation]}` : 'Niveau ou catégorie' };
}

/** Le format n'existe qu'en triathlon et en duathlon. */
export const aUnFormat = (type: string): boolean => type === 'Triathlon' || type === 'Duathlon';

/**
 * Un temps cible écrit à la main → des minutes. Accepte « 3h45 », « 3h », « 3:45 » (heures:minutes), « 45 » (minutes) et « 45 min ».
 * Vide → { ok: true, minutes: null }. Illisible ou hors de 1 min à 72 h → { ok: false }.
 */
export function lireTempsCible(texte: string): { ok: true; minutes: number | null } | { ok: false } {
  const t = String(texte ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return { ok: true, minutes: null };
  let m: RegExpExecArray | null;
  let minutes: number;
  if ((m = /^(\d{1,2})h(\d{1,2})?(?:min|m)?$/.exec(t))) minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = /^(\d{1,2}):([0-5]\d)$/.exec(t))) minutes = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = /^(\d{1,4})(?:min|m)?$/.exec(t))) minutes = Number(m[1]);
  else return { ok: false };
  return minutes >= 1 && minutes <= 72 * 60 ? { ok: true, minutes } : { ok: false };
}

/** Des minutes → « 3h45 », « 3h », « 45 min ». */
export function texteTempsCible(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

/** L'allure (course), la vitesse (vélo et autres) ou l'allure aux 100 m (natation) que le temps cible et la distance donnent ; null si l'un des deux manque. */
export function allureMoyenne(type: string, km: number | null, minutes: number | null): { libelle: string; valeur: string } | null {
  if (km == null || minutes == null || !(km > 0) || !(minutes > 0)) return null;
  if (type === 'Run') return { libelle: 'Allure moy.', valeur: formatAllure((minutes * 60) / km) };
  if (type === 'Swim') return { libelle: 'Allure moy.', valeur: `${formatAllure100m((minutes * 60) / (km * 10))}` };
  return { libelle: 'Vitesse moy.', valeur: `${formatKm(km / (minutes / 60))} km/h` };
}
