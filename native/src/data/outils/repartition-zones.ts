import { calculerZones, texteAllure, type ZonesPerso } from '../reglages/profil.ts';
import type { FluxBruts } from './courbes-sortie.ts';

// Le temps passé dans chaque zone (cœur, puissance, allure) pendant UNE sortie, calculé sur les flux point par point.
// Les zones sont recalculées depuis le profil (jamais stockées). Fonctions pures : aucun écran, aucun réseau.

/**
 * Secondes passées dans chaque zone. `bornes` = le début de chaque zone, du plus bas au plus haut ; une valeur sous la première borne va dans la première zone.
 * Chaque point compte pour le temps qui le sépare du suivant (au plus 3 fois l'écart habituel : une pause ne compte pas) ; sans temps, la durée totale est répartie en parts égales.
 * Null sans point valide ou sans aucune durée.
 */
export function tempsParZone(valeurs: number[], temps: number[] | null | undefined, bornes: number[], dureeTotaleS?: number | null): number[] | null {
  const n = valeurs.length;
  if (n < 2 || !bornes.length) return null;
  const duree: number[] = new Array(n).fill(0);
  if (temps && temps.length === n && temps.every((t) => Number.isFinite(t))) {
    const ecarts = temps.slice(1).map((t, i) => t - temps[i]).filter((e) => e > 0);
    if (ecarts.length) {
      const mediane = [...ecarts].sort((a, b) => a - b)[Math.floor(ecarts.length / 2)];
      for (let i = 0; i < n - 1; i++) duree[i] = Math.min(Math.max(0, temps[i + 1] - temps[i]), mediane * 3);
      duree[n - 1] = duree[n - 2];
    }
  } else if (dureeTotaleS && dureeTotaleS > 0) {
    duree.fill(dureeTotaleS / n);
  }
  const secondes: number[] = new Array(bornes.length).fill(0);
  valeurs.forEach((v, i) => {
    if (!Number.isFinite(v) || duree[i] <= 0) return;
    let z = 0;
    for (let k = 0; k < bornes.length; k++) if (v >= bornes[k]) z = k;
    secondes[z] += duree[i];
  });
  return secondes.reduce((a, b) => a + b, 0) > 0 ? secondes : null;
}

export interface ZoneSortie {
  /** « Z1 », « Z5a »… */
  court: string;
  /** Le nom complet (« Z4 Sous le seuil »). */
  nom: string;
  /** La plage de la zone sous la colonne (« 141–156 », « 6:12–5:40 » ; la première : « <141 », la dernière : « 186+ »). */
  borne: string;
  secondes: number;
}

export interface MesureZones {
  cle: 'fc' | 'watts' | 'allure';
  titre: string;
  /** La référence des zones (« seuil 172 bpm »). */
  reference: string;
  /** L'unité des bornes (« bpm », « W », « min/km »). */
  unite: string;
  /** La référence est estimée (FC au seuil déduite de la FC max). */
  estimee: boolean;
  zones: ZoneSortie[];
  /** La référence manque dans le profil : pas de zones, ce message dit quoi renseigner. */
  manque?: string;
}

export interface RefsZones {
  /** FC au seuil (bpm), saisie ou estimée. */
  lthr?: { bpm: number; estimee: boolean } | null;
  ftp?: number | null;
  /** Vitesse seuil (km/h), pour les zones d'allure en course. */
  seuilKmh?: number | null;
  /** Les zones personnalisées du profil (début de chaque zone en % de la référence), si l'utilisateur en a réglé. */
  perso?: ZonesPerso;
}

const MANQUE = {
  fc: 'Renseigne ta FC au seuil ou ta FC max dans Paramètres › Profil pour voir le temps passé dans chaque zone de cœur.',
  watts: 'Renseigne ta FTP dans Paramètres › Profil pour voir le temps passé dans chaque zone de puissance.',
  allure: 'Renseigne ta vitesse seuil dans Paramètres › Profil pour voir le temps passé dans chaque zone d’allure.',
} as const;

/** La plage lisible d'une zone. En allure, les zones vont du plus lent au plus rapide : la première est « >6:12 », la dernière « <5:10 ». */
function plage(modele: 'cardio' | 'puissance' | 'allure', i: number, n: number, de: (k: number) => number, borne: (v: number) => string): string {
  const allure = modele === 'allure';
  if (i === 0) return `${allure ? '>' : '<'}${borne(de(1))}`;
  if (i === n - 1) return allure ? `<${borne(de(i))}` : `${borne(de(i))}+`;
  // Les bornes entières ne se chevauchent pas : une zone finit un point avant le début de la suivante
  const haut = allure ? borne(de(i + 1)) : String(Math.round(de(i + 1)) - 1);
  return `${borne(de(i))}–${haut}`;
}

const sansUnite = (kmh: number) => texteAllure(kmh).replace('/km', '');

/** Les répartitions de cette sortie : une par mesure dont on a les flux. Sans la référence dans le profil, la mesure est là quand même, avec un message (`manque`) au lieu des zones. */
export function repartitionsSortie(brut: FluxBruts | null | undefined, refs: RefsZones, course: boolean, dureeS: number | null | undefined): MesureZones[] {
  if (!brut) return [];
  const sortie: MesureZones[] = [];
  const ajouter = (cle: MesureZones['cle'], titre: string, reference: string, estimee: boolean, valeurs: number[] | undefined, modele: 'cardio' | 'puissance' | 'allure', ref: number, borne: (de: number) => string, unite: string) => {
    const zones = calculerZones(modele, ref, refs.perso?.[modele === 'cardio' ? 'cardio' : modele]);
    if (!valeurs || valeurs.every((v) => !Number.isFinite(v))) return;
    if (!zones) return void sortie.push({ cle, titre, reference: '', unite, estimee: false, zones: [], manque: MANQUE[cle] });
    const brutes = tempsParZone(valeurs, brut.temps, zones.map((z) => z.de), dureeS);
    if (!brutes) return;
    const s = brutes;
    sortie.push({
      cle,
      titre,
      reference,
      unite,
      estimee,
      zones: zones.map((z, i) => ({
        court: z.nom.split(' ')[0],
        nom: z.nom,
        borne: plage(modele, i, zones.length, (k) => zones[k].de, borne),
        secondes: s[i],
      })),
    });
  };
  const ftp = refs.ftp && refs.ftp > 0 ? refs.ftp : 0;
  const seuil = refs.seuilKmh && refs.seuilKmh > 0 ? refs.seuilKmh : 0;
  ajouter('fc', 'Cœur', refs.lthr ? `seuil ${refs.lthr.bpm} bpm` : '', !!refs.lthr?.estimee, brut.fc, 'cardio', refs.lthr?.bpm ?? 0, (d) => String(Math.round(d)), 'bpm');
  ajouter('watts', 'Puissance', ftp ? `FTP ${Math.round(ftp)} W` : '', false, brut.watts, 'puissance', ftp, (d) => String(Math.round(d)), 'W');
  if (course) ajouter('allure', 'Allure', seuil ? `seuil ${sansUnite(seuil)}/km` : '', false, brut.vitesse?.map((v) => v * 3.6), 'allure', seuil, sansUnite, 'min/km');
  return sortie;
}
