// Ce que montre la page Profil : les 4 zones du mannequin (avec leur note colorée) et les cartes de chaque onglet.
// Fonctions pures, sans React Native : testables avec node. Les notes viennent de `bilanAthlete` (indices d'entraînement,
// pas des mesures médicales) ; les chiffres affichés viennent du profil saisi.
import type { BilanAthlete } from '../reglages/bilan-athlete.ts';
import type { Profil } from '../types.ts';

export type ZoneProfil = 'coeur' | 'torse' | 'tete' | 'jambes';
export type OngletProfil = 'identite' | 'physio' | 'niveau' | 'forme';
export type NiveauNote = 'bon' | 'moyen' | 'bas' | 'inconnu';

export interface LigneCarte {
  label: string;
  valeur: string;
}
export interface CarteProfil {
  cle: string;
  titre: string;
  /** Grand chiffre de la carte (optionnel). */
  chiffre?: string;
  lignes: LigneCarte[];
}
export interface InfoZone {
  cle: ZoneProfil;
  label: string;
  /** 0 à 100, ou null quand on n'a pas de quoi la calculer. */
  note: number | null;
  niveau: NiveauNote;
  /** Courte valeur sous le nom (ex. « 3,9 W/kg »). */
  valeur: string;
  /** Onglet et carte qui s'ouvrent quand on touche la zone. */
  onglet: OngletProfil;
  carte: string;
}

/** Couleur de la note : 70 et plus = bon, 50 à 69 = moyen, en dessous = à travailler. */
export function niveauDeNote(note: number | null): NiveauNote {
  if (note === null || !Number.isFinite(note)) return 'inconnu';
  if (note >= 70) return 'bon';
  if (note >= 50) return 'moyen';
  return 'bas';
}

const virgule = (n: number, decimales = 0): string => n.toFixed(decimales).replace('.', ',');
const nombre = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const extrasDe = (p: Profil | null | undefined): Record<string, unknown> => (p?.extras && typeof p.extras === 'object' ? p.extras : {});

/** Âge en années pleines à la date donnée, ou null si la date de naissance manque ou est invalide. */
export function ageDepuis(naissance: unknown, aujourdhui: Date = new Date()): number | null {
  if (typeof naissance !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(naissance)) return null;
  const [a, m, j] = naissance.split('-').map(Number);
  const d = new Date(a, m - 1, j);
  if (Number.isNaN(d.getTime()) || d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== j) return null;
  let age = aujourdhui.getFullYear() - a;
  if (aujourdhui.getMonth() < m - 1 || (aujourdhui.getMonth() === m - 1 && aujourdhui.getDate() < j)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** W/kg de la FTP, ou null si l'un des deux manque. */
export function wattsParKilo(profil: Profil | null | undefined): number | null {
  const ftp = nombre(profil?.ftp);
  const poids = nombre(profil?.weight);
  return ftp > 0 && poids > 0 ? ftp / poids : null;
}

/** Les 4 zones du mannequin, avec leur note. Cœur = cardio, Torse = endurance, Jambes = force, Tête = forme du jour. */
export function zonesProfil(bilan: BilanAthlete, profil: Profil | null | undefined): InfoZone[] {
  const stat = (cle: string) => bilan.stats.find((s) => s.cle === cle);
  const avecDonnees = bilan.donneesDisponibles;
  const cardio = stat('cardio');
  const endurance = stat('endurance');
  const force = stat('force');
  const wkg = wattsParKilo(profil);
  const fraicheur = Math.max(0, Math.min(100, Math.round(60 + bilan.forme.tsb * 2))); // TSB 0 = 60, +20 = 100, −30 = 0
  const hrMax = nombre(profil?.hr_max);
  return [
    { cle: 'coeur', label: 'Cœur', note: avecDonnees && cardio ? cardio.valeur : null, niveau: niveauDeNote(avecDonnees && cardio ? cardio.valeur : null), valeur: hrMax > 0 ? `FC max ${Math.round(hrMax)}` : 'FC max à saisir', onglet: 'physio', carte: 'coeur' },
    { cle: 'torse', label: 'Endurance', note: avecDonnees && endurance ? endurance.valeur : null, niveau: niveauDeNote(avecDonnees && endurance ? endurance.valeur : null), valeur: endurance?.note ?? 'En construction', onglet: 'niveau', carte: 'niveau' },
    { cle: 'tete', label: 'Forme', note: avecDonnees ? fraicheur : null, niveau: niveauDeNote(avecDonnees ? fraicheur : null), valeur: avecDonnees ? bilan.forme.libelle : 'Pas de données', onglet: 'forme', carte: 'forme' },
    { cle: 'jambes', label: 'Jambes', note: avecDonnees && force ? force.valeur : null, niveau: niveauDeNote(avecDonnees && force ? force.valeur : null), valeur: wkg ? `${virgule(wkg, 2)} W/kg` : (force?.note ?? 'FTP à saisir'), onglet: 'physio', carte: 'velo' },
  ];
}

const ligne = (label: string, valeur: string): LigneCarte => ({ label, valeur });
const ou = (n: number, unite: string, decimales = 0): string => (n > 0 ? `${virgule(n, decimales)} ${unite}`.trim() : '—');

/** Cartes de l'onglet Identité. */
export function cartesIdentite(profil: Profil | null | undefined, aujourdhui: Date = new Date()): CarteProfil[] {
  const e = extrasDe(profil);
  const prenom = texte(e.first_name);
  const nom = texte(e.last_name);
  const age = ageDepuis(e.birth_date, aujourdhui);
  const sexe = ({ M: 'Homme', F: 'Femme', O: 'Autre' } as Record<string, string>)[texte(e.sex)] ?? '—';
  const lieu = [texte(e.city), texte(e.country)].filter(Boolean).join(', ');
  const taille = nombre(e.height);
  const poids = nombre(profil?.weight);
  const imc = taille > 0 && poids > 0 ? poids / ((taille / 100) * (taille / 100)) : 0;
  return [
    { cle: 'moi', titre: 'Moi', chiffre: [prenom, nom].filter(Boolean).join(' ') || 'Prénom à saisir', lignes: [ligne('Âge', age === null ? '—' : `${age} ans`), ligne('Sexe', sexe), ligne('Lieu', lieu || '—')] },
    { cle: 'corps', titre: 'Corps', chiffre: poids > 0 ? `${virgule(poids, 1)} kg` : '—', lignes: [ligne('Taille', ou(taille, 'cm')), ligne('IMC', imc > 0 ? virgule(imc, 1) : '—')] },
  ];
}

/** Cartes de l'onglet Physio : les repères saisis, par domaine. */
export function cartesPhysio(profil: Profil | null | undefined): CarteProfil[] {
  const e = extrasDe(profil);
  const wkg = wattsParKilo(profil);
  return [
    { cle: 'coeur', titre: 'Cœur', chiffre: ou(nombre(profil?.hr_max), 'bpm'), lignes: [ligne('FC max', ou(nombre(profil?.hr_max), 'bpm')), ligne('FC au repos', ou(nombre(e.rhr), 'bpm')), ligne('Seuil (LTHR)', ou(nombre(profil?.lthr), 'bpm')), ligne('HRV de référence', ou(nombre(e.hrv_baseline), 'ms'))] },
    { cle: 'velo', titre: 'Vélo', chiffre: ou(nombre(profil?.ftp), 'W'), lignes: [ligne('FTP', ou(nombre(profil?.ftp), 'W')), ligne('W/kg', wkg ? virgule(wkg, 2) : '—'), ligne('VO2max', ou(nombre(e.vo2max_bike), 'ml/kg/min', 1)), ligne('Puissance critique', ou(nombre(e.cp), 'W'))] },
    { cle: 'course', titre: 'Course', chiffre: ou(nombre(e.vma), 'km/h', 1), lignes: [ligne('VMA', ou(nombre(e.vma), 'km/h', 1)), ligne('Vitesse seuil', ou(nombre(e.threshold_speed), 'km/h', 1)), ligne('VO2max', ou(nombre(e.vo2max_run), 'ml/kg/min', 1))] },
  ];
}

/** Cartes de l'onglet Niveau : la note globale puis les 5 indices. */
export function cartesNiveau(bilan: BilanAthlete): CarteProfil[] {
  return [
    { cle: 'niveau', titre: 'Niveau global', chiffre: bilan.donneesDisponibles ? `${bilan.score} / 100` : '—', lignes: [ligne('Discipline', bilan.discipline), ligne('Point fort', bilan.pointsForts[0]?.label ?? '—'), ligne('À travailler', bilan.axeDeProgres?.label ?? '—')] },
    { cle: 'indices', titre: 'Indices', lignes: bilan.stats.map((s) => ligne(s.label, bilan.donneesDisponibles ? `${s.valeur} · ${s.note}` : '—')) },
  ];
}

/** Cartes de l'onglet Forme : l'état du moment et les 28 derniers jours. */
export function cartesForme(bilan: BilanAthlete): CarteProfil[] {
  const a = bilan.activite;
  return [
    { cle: 'forme', titre: 'Forme du jour', chiffre: bilan.donneesDisponibles ? bilan.forme.libelle : '—', lignes: [ligne('Condition (CTL)', String(bilan.forme.ctl)), ligne('Fatigue (ATL)', String(bilan.forme.atl)), ligne('Forme (TSB)', String(bilan.forme.tsb))] },
    { cle: 'activite', titre: '28 derniers jours', chiffre: `${a.seances} séance${a.seances > 1 ? 's' : ''}`, lignes: [ligne('Temps', `${virgule(a.heures, 1)} h`), ligne('Charge', String(a.charge)), ligne('Jours actifs', String(a.jours))] },
  ];
}

/** Contenu d'un onglet. */
export function cartesDe(onglet: OngletProfil, bilan: BilanAthlete, profil: Profil | null | undefined, aujourdhui: Date = new Date()): CarteProfil[] {
  if (onglet === 'identite') return cartesIdentite(profil, aujourdhui);
  if (onglet === 'physio') return cartesPhysio(profil);
  if (onglet === 'niveau') return cartesNiveau(bilan);
  return cartesForme(bilan);
}

/** Position (en cartes) d'une carte dans son onglet, pour y faire défiler quand on touche une zone du mannequin. */
export function indexCarte(onglet: OngletProfil, cle: string, bilan: BilanAthlete, profil: Profil | null | undefined): number {
  const i = cartesDe(onglet, bilan, profil).findIndex((c) => c.cle === cle);
  return i < 0 ? 0 : i;
}
