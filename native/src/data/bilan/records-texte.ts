// Écrire les records : leur valeur avec son unité, et le titre et la date de chaque entrée du podium. Fonctions pures.
import { formatDateLongue, formatNum, texteHM } from '../outils/format.ts';
import { ecrireTemps } from '../sports/hyrox.ts';
import type { EntreeRecord, RecordTop } from './records.ts';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « 11 mai » à partir d'une date ISO. */
export const jourMois = (iso: string): string => `${Number(iso.slice(8, 10))} ${MOIS[Number(iso.slice(5, 7)) - 1]}`;

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** « 11 janv. » (sans l'année) à partir d'une date ISO : pour les endroits étroits. */
export const jourMoisCourt = (iso: string): string => `${Number(iso.slice(8, 10))} ${MOIS_COURTS[Number(iso.slice(5, 7)) - 1]}`;
/** « 25 févr. 2023 » à partir d'une date ISO : pour les endroits étroits. */
export const dateCourte = (iso: string): string => `${Number(iso.slice(8, 10))} ${MOIS_COURTS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** Une valeur de record : le nombre écrit (« 6h25 », « 122,4 », « 8 372 ») et son unité (vide quand le nombre la porte déjà, comme pour une durée). */
export function texteValeurRecord(valeur: number, unite: string): { nombre: string; unite: string } {
  if (unite === 'min') return { nombre: texteHM(Math.round(valeur)), unite: '' };
  if (unite === 'h') return { nombre: texteHM(Math.round(valeur * 60)), unite: '' };
  if (unite === 'km' || unite === 'km/h' || unite === 'N·m' || unite === 't') return { nombre: formatNum(valeur, 1), unite };
  // Un chrono (Hyrox) : la valeur est en secondes, écrite « 4:52 » ou « 1:13:42 »
  if (unite === 'chrono') return { nombre: ecrireTemps(valeur), unite: '' };
  // Un poids : sans décimale quand il est rond (100 kg), avec une sinon (102,5 kg)
  if (unite === 'kg') return { nombre: formatNum(valeur, Number.isInteger(valeur) ? 0 : 1), unite };
  // Une allure de natation : la valeur est une vitesse en km/h, écrite en minutes et secondes pour 100 m (3,4 km/h = 1'46"/100 m)
  if (unite === 'allure100') {
    const s = valeur > 0 ? Math.round(360 / valeur) : 0;
    return { nombre: `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`, unite: '/100 m' };
  }
  // Une allure de course : la valeur est une vitesse en km/h (la plus haute gagne, comme pour les autres records), écrite en minutes et secondes par km
  if (unite === 'allure') {
    const s = valeur > 0 ? Math.round(3600 / valeur) : 0;
    return { nombre: `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`, unite: '/km' };
  }
  if (unite === 'séances') return { nombre: formatNum(valeur, 0), unite: valeur > 1 ? 'séances' : 'séance' };
  if (unite === 'jours') return { nombre: formatNum(valeur, 0), unite: valeur > 1 ? 'jours' : 'jour' };
  return { nombre: formatNum(valeur, 0), unite };
}

/** La valeur et son unité sur une seule ligne (« 6h25 », « 122,4 km »). */
export const texteRecordSimple = (valeur: number, unite: string): string => {
  const t = texteValeurRecord(valeur, unite);
  return t.unite ? `${t.nombre} ${t.unite}` : t.nombre;
};

/** Le titre et la précision d'une entrée : le nom de la séance et sa date, ou la période (« Semaine du 11 mai »), ou la série (« Du 12 au 22 avril »). */
export function libelleEntree(record: RecordTop, e: EntreeRecord): { titre: string; sous: string } {
  if (record.cle === 'serie') return { titre: e.fin ? `Du ${jourMois(e.iso)} au ${jourMois(e.fin)}` : jourMois(e.iso), sous: `${e.iso.slice(0, 4)}` };
  if (record.periode === 'jour') return { titre: formatDateLongue(e.iso), sous: e.detail ?? '' };
  if (record.periode === 'semaine') return { titre: `Semaine du ${jourMois(e.iso)}`, sous: e.detail ?? e.iso.slice(0, 4) };
  if (record.periode === 'mois') return { titre: `${MOIS[Number(e.iso.slice(5, 7)) - 1][0].toUpperCase()}${MOIS[Number(e.iso.slice(5, 7)) - 1].slice(1)} ${e.iso.slice(0, 4)}`, sous: e.detail ?? '' };
  return { titre: e.nom || 'Sans titre', sous: formatDateLongue(e.iso) };
}

/** L'année dans une phrase : « cette année » pour l'année en cours, sinon « en 2025 » (« cette année » serait faux). */
export const enAnnee = (annee: number, maintenant: Date = new Date()): string => (annee === maintenant.getFullYear() ? 'cette année' : `en ${annee}`);
/** La même, au début d'une phrase : « Cette année » ou « En 2025 ». */
export const EnAnnee = (annee: number, maintenant: Date = new Date()): string => {
  const t = enAnnee(annee, maintenant);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
