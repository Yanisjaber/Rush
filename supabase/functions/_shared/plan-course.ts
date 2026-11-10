// ============================================================
// Plan de COURSE À PIED vers une course visée : « prépare-moi mon 10 km du 13 décembre, objectif 40 minutes ».
//
// L'IA ne devine rien : le CODE lit le profil du coureur (rpc_coach_resume → profil_course : meilleur effort, allure facile, volume des 8 dernières
// semaines, jours habituels) et construit, comme un entraîneur qui ouvre le dossier :
//   1. son NIVEAU ACTUEL (meilleur effort converti sur la distance, vieilli selon son ancienneté, croisé avec son allure facile) ;
//   2. un objectif RÉALISTE pour le temps qu'il reste (gain de 0,4 % par semaine, 6 % au plus, d'après les études) : un objectif trop ambitieux est dit franchement,
//      le plan est calé sur ce qui est jouable ;
//   3. ses ALLURES chiffrées (allure course, 5 km, VMA, seuil, tempo, facile, sortie longue) tirées de l'objectif ;
//   4. des PHASES (base, développement, spécifique, affûtage) selon le nombre de semaines ;
//   5. des séances qui ont un BUT et un contenu précis (« 5 × 1000 m à 4:41/km, récup 1:30 »), avec leurs blocs et leurs allures,
//      un volume qui monte de 10 % par semaine (récupération toutes les 4 semaines), une sortie longue qui progresse.
// Tout passe par le validateur (jours indisponibles, repos, compétition) ; une séance refusée est essayée sur un autre jour, sinon abandonnée avec la raison.
// Ces règles sont les HABITUDES d'un bon plan, pas des refus : l'utilisateur peut tout modifier ensuite.
// ============================================================
import { ajouterJours, ecartJours, entre, nomDuJour } from './dates-iso.ts';
import { JOURS_SEMAINE } from './profil-coureur.ts';
import type { ProfilCoureur } from './profil-coureur.ts';
import { tssEstime, typeSeance } from './menu-seances.ts';
import { ctxAvec, etiquetteDate } from './planning.ts';
import type { DetailSeance, Operation, SeancePrevue } from './planning.ts';
import { choisirJours } from './semaine.ts';
import type { BlocStructure } from './structure-seance.ts';
import { validerSeance } from './validateur.ts';
import type { ContexteValidation, Proposition } from './validateur.ts';

// ---------- Le profil du coureur ----------
export interface ProfilCourse {
  /** Le meilleur effort des 24 derniers mois : ANCIEN, dernier recours seulement */
  meilleurEffort: { date: string; km: number; secondes: number; equiv10Secondes: number } | null;
  /** Le meilleur effort des 90 derniers jours (sorties d'au moins 3 km) : il fixe le niveau d'aujourd'hui */
  effortRecent: { date: string; km: number; secondes: number; equiv10Secondes: number } | null;
  sorties90: number;
  recent: { sorties: number; km: number; minutes: number; plusLongueMinutes: number; allureMedianeSParKm: number | null };
  /** Les 8 dernières semaines, de la plus ancienne à la plus récente */
  semaines: { km: number; minutes: number; sorties: number }[];
  /** Sorties par jour de la semaine (1 = lundi) sur 90 jours */
  jours: Record<number, number>;
}

const nb = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : null);

/** Le profil lu dans le résumé ; tout champ absent ou bizarre tombe sur une valeur neutre. Null si le résumé n'en a pas. */
// deno-lint-ignore no-explicit-any
export function profilCourseDepuisResume(resume: any): ProfilCourse | null {
  const p = resume?.profil_course;
  if (!p || typeof p !== 'object') return null;
  const m = p.meilleur_effort;
  const eq = nb(m?.equiv_10km_secondes);
  const meilleurEffort = m && typeof m.date === 'string' && eq !== null && eq > 0
    ? { date: m.date, km: nb(m.km) ?? 0, secondes: nb(m.secondes) ?? 0, equiv10Secondes: eq }
    : null;
  const mr = p.meilleur_effort_recent;
  const eqr = nb(mr?.equiv_10km_secondes);
  const effortRecent = mr && typeof mr.date === 'string' && eqr !== null && eqr > 0
    ? { date: mr.date, km: nb(mr.km) ?? 0, secondes: nb(mr.secondes) ?? 0, equiv10Secondes: eqr }
    : null;
  const r = p.recent ?? {};
  const semaines = Array.isArray(p.semaines)
    ? p.semaines.slice(-8).map((s: Record<string, unknown>) => ({ km: nb(s?.km) ?? 0, minutes: nb(s?.minutes) ?? 0, sorties: nb(s?.sorties) ?? 0 }))
    : [];
  const jours: Record<number, number> = {};
  if (p.jours && typeof p.jours === 'object') for (const [k, v] of Object.entries(p.jours)) { const j = Number(k); const n = nb(v); if (j >= 1 && j <= 7 && n !== null && n > 0) jours[j] = n; }
  return {
    meilleurEffort,
    effortRecent,
    sorties90: nb(p.sorties_90_jours) ?? 0,
    recent: { sorties: nb(r.sorties) ?? 0, km: nb(r.km) ?? 0, minutes: nb(r.minutes) ?? 0, plusLongueMinutes: nb(r.plus_longue_minutes) ?? 0, allureMedianeSParKm: nb(r.allure_mediane_s_par_km) },
    semaines,
    jours,
  };
}

// ---------- Niveau, objectif réaliste, allures ----------
/**
 * Exposant de la loi de puissance entre distances : 1,06 (Riegel, ajusté sur les records du monde). SOURCES QUI SE CONTREDISENT, donc on ne change pas sans preuve sur 5-10 km :
 * Blythe et Király (2016, arXiv 1505.01147) trouvent des exposants individuels de médiane 1,12 (5e-95e percentile 1,10-1,15), mais sur TOUTES les distances de 100 m au marathon ;
 * les tables de Daniels semblent donner ~1,06 entre 5 et 10 km (calculé de mémoire, à vérifier dans le livre). Avec 1,12, un 3 km en 15:00 donnerait un 10 km en 58:45 (trop lent).
 * Voir docs/ia/FONDEMENTS_PLAN_COURSE.md.
 */
const RIEGEL = 1.06;
/** Un temps converti d'une distance à une autre (loi de puissance, exposant ci-dessus) */
export const equivalent = (secondes: number, kmDe: number, kmA: number): number => secondes * Math.pow(kmA / kmDe, RIEGEL);
/** Rapport entre l'allure facile et l'allure 10 km chez un coureur loisir (≈ 1,27) */
const FACILE_SUR_10K = 1.27;

export type Fiabilite = 'chrono' | 'recente' | 'ancienne';

export interface Niveau {
  /** Son temps estimé AUJOURD'HUI sur la distance de la course */
  secondes: number;
  /** Une phrase qui dit d'où vient l'estimation */
  source: string;
  /** chrono : un temps donné par l'utilisateur (test) · recente : ses sorties des 90 derniers jours · ancienne : un vieux record, très vieilli (estimation fragile) */
  fiabilite: Fiabilite;
}

/** Un effort récent converti tel quel : sans correction optimiste (un test réel de Yanis a montré qu'enlever 7 % était trop beau) */
const EFFORT_RECENT_FACTEUR = 1;
/** Un vieux record vieillit de 1,5 % par mois d'ancienneté, 30 % au plus (on a perdu beaucoup de niveau) */
const VIEILLISSEMENT_MENSUEL = 0.015;
const VIEILLISSEMENT_MAX = 0.3;

/**
 * Son niveau d'aujourd'hui sur `km`, du plus fiable au moins fiable :
 *   1. un CHRONO donné par l'utilisateur (une sortie test) : pris tel quel ;
 *   2. ses SORTIES DES 90 DERNIERS JOURS (au moins 3 sorties sur 8 semaines) : le meilleur effort converti, jamais un vieux record ;
 *   3. sinon un VIEUX record, très vieilli : on part du principe qu'il a beaucoup perdu.
 * Null sans aucune donnée.
 */
export function niveauActuel(p: ProfilCourse | null, km: number, aujourdhui: string, chrono?: { km: number; secondes: number } | null): Niveau | null {
  if (chrono && chrono.km > 0 && chrono.secondes > 0) {
    return { secondes: Math.round(equivalent(chrono.secondes, chrono.km, km)), source: `ton chrono de test (${chrono.km} km en ${formaterTemps(chrono.secondes)})`, fiabilite: 'chrono' };
  }
  if (!p) return null;
  if (p.effortRecent && p.recent.sorties >= 3) {
    const e = p.effortRecent;
    return { secondes: Math.round(equivalent(e.equiv10Secondes, 10, km) * EFFORT_RECENT_FACTEUR), source: `tes sorties récentes (ta meilleure : ${e.km} km en ${formaterTemps(e.secondes)} le ${e.date})`, fiabilite: 'recente' };
  }
  const ref = p.meilleurEffort;
  if (ref) {
    const mois = Math.max(0, ecartJours(ref.date, aujourdhui) / 30.4);
    const vieillissement = 1 + Math.min(VIEILLISSEMENT_MAX, VIEILLISSEMENT_MENSUEL * mois);
    return { secondes: Math.round(equivalent(ref.equiv10Secondes, 10, km) * vieillissement), source: `un ancien effort (${ref.km} km le ${ref.date}), vieilli de ${Math.round((vieillissement - 1) * 100)} % faute de sorties récentes`, fiabilite: 'ancienne' };
  }
  return null;
}

/**
 * Le temps jouable pour la course : le niveau actuel, amélioré de 0,4 % par semaine d'entraînement, 6 % au plus.
 * Source : sur 10 à 15 semaines, des coureurs loisir améliorent leur 10 km d'environ 3 à 6 % (Muñoz 2014 : 3,6-5,0 % en 10 semaines ; Nuuttila 2022 : 2,9-6,2 % en 12-15 semaines).
 * 0,4 %/semaine ≈ milieu de cette fourchette ; 6 % = le haut, atteint seulement avec un plan bien adapté. Voir docs/ia/FONDEMENTS_PLAN_COURSE.md.
 */
export const objectifRealiste = (niveauSecondes: number, semaines: number): number => Math.round(niveauSecondes * (1 - Math.min(0.06, 0.004 * Math.max(0, semaines))));

export interface Allures {
  /** Toutes en secondes par km */
  course: number; cinqK: number; vma: number; seuil: number; tempo: number; facile: number; longue: number;
}
export function alluresDepuisCourse(secondesCourse: number, km: number): Allures {
  const p = secondesCourse / km;
  return { course: p, cinqK: p * 0.97, vma: p * 0.935, seuil: p * 1.04, tempo: p * 1.07, facile: p * 1.27, longue: p * 1.3 };
}

export const formaterAllure = (s: number): string => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
export const formaterTemps = (s: number): string => {
  const t = Math.round(s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

// ---------- Phases ----------
export type Phase = 'base' | 'developpement' | 'specifique' | 'affutage';
export const NOM_PHASE: Record<Phase, string> = { base: 'base', developpement: 'développement', specifique: 'spécifique', affutage: 'affûtage' };

/** Le but de la semaine, tel que l'écran l'affiche en titre : « Base », « Développement »… ou « Récupération » pour une semaine allégée */
export const butDeLaSemaine = (phase: Phase, recuperation: boolean): string => (recuperation ? 'Récupération' : NOM_PHASE[phase].charAt(0).toUpperCase() + NOM_PHASE[phase].slice(1));

/** La phase de chaque semaine pour un plan de n semaines (la dernière est la semaine de la course) */
export function phases(n: number): Phase[] {
  // Affûtage de 2 semaines : c'est la durée optimale de la méta-analyse de Bosquet et coll. (2007, 27 études) ; en dessous de 6 semaines de plan, 1 semaine
  const affutage = n >= 6 ? 2 : n >= 3 ? 1 : n;
  const specifique = n >= 10 ? 3 : n >= 6 ? 2 : n >= 4 ? 1 : 0;
  const reste = Math.max(0, n - affutage - specifique);
  const base = Math.floor(reste / 3);
  const sortie: Phase[] = [];
  for (let i = 0; i < base; i++) sortie.push('base');
  for (let i = 0; i < reste - base; i++) sortie.push('developpement');
  for (let i = 0; i < specifique; i++) sortie.push('specifique');
  for (let i = 0; i < affutage; i++) sortie.push('affutage');
  return sortie;
}

// ---------- Les séances ----------
type Role = 'facile' | 'longue' | 'qualite1' | 'qualite2';

const arrondi1 = (x: number) => Math.round(x * 10) / 10;

/** Un bloc continu à une allure donnée ; `int` = % de l'allure seuil (100 % = allure seuil), pour que l'app le replace dans ses zones */
function bloc(type: BlocStructure['type'], nom: string, minutes: number, allure: number, a: Allures): BlocStructure {
  return { type, name: nom, reps: 1, metric: 'pace', unit: 'pct', work: { min: arrondi1(minutes), int: Math.round((100 * a.seuil) / allure), intHi: null } };
}
function intervalles(nom: string, reps: number, minutesTravail: number, allureTravail: number, recupSecondes: number, a: Allures): BlocStructure {
  return {
    type: 'interval', name: nom, reps, metric: 'pace', unit: 'pct',
    work: { min: arrondi1(minutesTravail), int: Math.round((100 * a.seuil) / allureTravail), intHi: null },
    rec: { min: arrondi1(recupSecondes / 60), int: Math.round((100 * a.seuil) / a.facile), intHi: null },
  };
}
const dureeBlocs = (b: BlocStructure[]) => b.reduce((t, x) => t + x.reps * x.work.min + (x.type === 'interval' && x.rec ? x.reps * x.rec.min : 0), 0);

/** Ajuste le dernier bloc pour que la somme des blocs fasse un nombre entier de minutes ; renvoie ce nombre */
function arrondirSeance(blocs: BlocStructure[]): number {
  const total = dureeBlocs(blocs);
  const minutes = Math.max(1, Math.round(total));
  // on ajuste un bloc continu (jamais un bloc répété : l'écart serait multiplié par les répétitions) ; le dernier de préférence
  const continus = blocs.filter((b) => b.reps === 1);
  const cible = continus[continus.length - 1];
  if (cible) cible.work.min = arrondi1(cible.work.min + (minutes - total));
  return minutes;
}

const tempsAllure = (metres: number, allure: number) => (metres / 1000) * allure / 60;
const ms = (s: number) => formaterAllure(s);
const recup = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export interface SeanceCourse {
  type: string;
  minutes: number;
  detail: DetailSeance;
  but: string;
}

function assembler(nom: string, type: string, blocs: BlocStructure[], resume: string, but: string): SeanceCourse {
  const minutes = arrondirSeance(blocs);
  return { type, minutes, detail: { nom, structure: blocs, resume }, but };
}

/** Footing facile : un seul bloc à l'allure facile, avec des lignes droites en phase de base */
export function footing(minutes: number, a: Allures, lignesDroites: boolean): SeanceCourse {
  // Les lignes droites se font après un vrai échauffement : il faut au moins 15 min de footing avant (pas de durée fixe pour le footing entier)
  if (lignesDroites && minutes - 6 * (20 / 60 + 1) >= 15) {
    const reste = minutes - 6 * (20 / 60 + 1);
    return assembler(
      `Footing ${minutes} min + 6 lignes droites`, 'footing_facile',
      [bloc('steady', `Footing à ${ms(a.facile)}/km`, reste, a.facile, a), intervalles(`6 lignes droites de 20 s à ${ms(a.vma)}/km`, 6, 20 / 60, a.vma, 60, a)],
      `${Math.round(reste)} min de footing à ${ms(a.facile)}/km · 6 lignes droites de 20 s (récup 1 min)`,
      'Allure facile pour construire ta base, et des lignes droites pour garder de la vivacité sans fatiguer.',
    );
  }
  return assembler(`Footing ${minutes} min`, 'footing_facile', [bloc('steady', `Footing à ${ms(a.facile)}/km`, minutes, a.facile, a)], `${minutes} min à ${ms(a.facile)}/km`, "Allure facile : tu peux parler. C'est ici que se construit l'endurance.");
}

/** Footing progressif : les 8 dernières minutes un peu plus vite (entre l'allure facile et l'allure tempo), sans jamais forcer */
export function footingProgressif(minutes: number, a: Allures): SeanceCourse {
  const fin = 8;
  const milieu = (a.facile + a.tempo) / 2;
  return assembler(
    `Footing progressif ${minutes} min`, 'footing_facile',
    [bloc('steady', `Footing à ${ms(a.facile)}/km`, minutes - fin, a.facile, a), bloc('steady', `8 dernières minutes à ${ms(milieu)}/km`, fin, milieu, a)],
    `${minutes - fin} min à ${ms(a.facile)}/km · 8 min à ${ms(milieu)}/km`,
    "Un footing qui finit un peu plus vite : tu varies l'allure sans fatiguer, et tu apprends à relancer en fin de séance.",
  );
}

export function sortieLongue(minutes: number, a: Allures, progressive: boolean): SeanceCourse {
  // Une fin plus rapide (20 % de la durée) demande au moins 6 min : la décision « progressive ou non » est prise par l'appelant selon la longue de la personne
  if (progressive && minutes >= 30) {
    const fin = Math.round(minutes * 0.2);
    return assembler(
      `Sortie longue ${minutes} min, fin à allure tempo`, 'sortie_longue',
      [bloc('steady', `Sortie longue à ${ms(a.longue)}/km`, minutes - fin, a.longue, a), bloc('steady', `Fin de sortie à ${ms(a.tempo)}/km`, fin, a.tempo, a)],
      `${minutes - fin} min à ${ms(a.longue)}/km · ${fin} min à ${ms(a.tempo)}/km`,
      "Sortie longue qui finit plus vite : tu apprends à relancer quand les jambes sont fatiguées, comme sur la fin d'un 10 km.",
    );
  }
  return assembler(`Sortie longue ${minutes} min`, 'sortie_longue', [bloc('steady', `Sortie longue à ${ms(a.longue)}/km`, minutes, a.longue, a)], `${minutes} min à ${ms(a.longue)}/km`, "Ta sortie longue de la semaine, tranquille : elle développe l'endurance et la solidité.");
}

/** Le footing change d'une semaine à l'autre (avec lignes droites, simple, progressif) pour ne pas répéter la même séance ; seulement simple en phase spécifique et à l'affûtage */
function varianteFooting(minutes: number, a: Allures, phase: Phase, semaine: number, footingMini: number): SeanceCourse {
  if (phase === 'specifique' || phase === 'affutage' || minutes < footingMini) return footing(minutes, a, false);
  const v = semaine % 3;
  if (v === 0) return footing(minutes, a, true);
  if (v === 1) return footing(minutes, a, false);
  return footingProgressif(minutes, a);
}

/**
 * Pose les rôles (facile, qualité, longue) sur les jours libres d'une fenêtre. Toutes les façons de placer les séances sont essayées (au plus 7 jours, 6 séances :
 * quelques milliers de cas) ; on garde la moins coûteuse. Coûts : 1000 par paire de séances dures collées (y compris à une séance dure déjà posée dans la fenêtre précédente),
 * 300 si la sortie longue n'est pas un jour de week-end alors qu'un week-end est libre, 30 si un rôle retombe sur le même jour de la semaine que dans la fenêtre précédente, 4 par jour de décalage par rapport au premier choix.
 */
export function meilleurPlacement(libres: string[], roles: Role[], initial: string[], joursDurs: Set<string>, weekend: (j: string) => boolean, precedent: Map<Role, Set<string>> = new Map()): string[] | null {
  const n = roles.length;
  if (n === 0 || n > libres.length || libres.length > 9) return null;
  const durs = roles.map((r) => r !== 'facile');
  const weekendLibre = libres.some(weekend);
  let meilleur: string[] | null = null;
  let coutMin = Infinity;
  const pris: string[] = [];
  const utilise = new Array(libres.length).fill(false);
  const evaluer = () => {
    let cout = 0;
    for (let a = 0; a < n; a++) {
      if (durs[a]) {
        if (joursDurs.has(ajouterJours(pris[a], -1)) || joursDurs.has(ajouterJours(pris[a], 1))) cout += 1000;
        for (let b = a + 1; b < n; b++) if (durs[b] && Math.abs(ecartJours(pris[a], pris[b])) === 1) cout += 1000;
      }
      if (roles[a] === 'longue' && weekendLibre && !weekend(pris[a])) cout += 300;
      cout += 4 * Math.abs(ecartJours(pris[a], initial[a]));
      // Variété : on évite de remettre un rôle sur le même jour de la semaine que la fenêtre précédente (30 par séance qui se répète)
      if (precedent.get(roles[a])?.has(nomDuJour(pris[a]))) cout += 30;
    }
    if (cout < coutMin) { coutMin = cout; meilleur = [...pris]; }
  };
  const rec = (a: number) => {
    if (a === n) { evaluer(); return; }
    for (let k = 0; k < libres.length; k++) {
      if (utilise[k]) continue;
      utilise[k] = true; pris[a] = libres[k];
      rec(a + 1);
      utilise[k] = false;
    }
  };
  rec(0);
  return meilleur;
}

const ECHAUF = 12;
const RETOUR = 10;

/** Séance de qualité : le contenu dépend de la phase et de la position dans la phase (la difficulté monte) */
function qualite(phase: Phase, rang: number, a: Allures, second: boolean): SeanceCourse {
  const avec = (nom: string, type: string, principal: BlocStructure, resume: string, but: string) =>
    assembler(nom, type, [bloc('warmup', `Échauffement à ${ms(a.facile)}/km`, ECHAUF, a.facile, a), principal, bloc('cooldown', `Retour au calme à ${ms(a.facile)}/km`, RETOUR, a.facile, a)], `${ECHAUF} min d'échauffement · ${resume} · ${RETOUR} min de retour au calme`, but);
  const pick = <T,>(liste: T[]): T => liste[Math.min(rang, liste.length - 1)];

  if (phase === 'base') {
    const n = pick([6, 8, 10]);
    return avec(`Fartlek ${n} × 1 min`, 'fractionne', intervalles(`${n} × 1 min à ${ms(a.cinqK)}/km, récup 1:00 trot`, n, 1, a.cinqK, 60, a), `${n} × 1 min à ${ms(a.cinqK)}/km (récup 1:00)`, "Du rythme sans pression : tu réveilles les jambes à ton allure 5 km, avec autant de récupération que d'effort.");
  }
  if (phase === 'developpement') {
    if (!second) {
      const [reps, m, r] = pick<[number, number, number]>([[6, 400, 75], [8, 400, 75], [5, 600, 90], [6, 600, 90], [4, 800, 120], [5, 800, 120]]);
      return avec(`${reps} × ${m} m à ${ms(a.vma)}/km`, 'fractionne', intervalles(`${reps} × ${m} m à ${ms(a.vma)}/km, récup ${recup(r)} trot`, reps, tempsAllure(m, a.vma), a.vma, r, a), `${reps} × ${m} m à ${ms(a.vma)}/km (récup ${recup(r)})`, 'Du travail à vitesse maximale aérobie : il relève ton plafond, donc ton allure de course te paraîtra plus facile.');
    }
    const [reps, mins] = pick<[number, number]>([[2, 8], [2, 10], [3, 8], [3, 10], [2, 15]]);
    return avec(`Tempo ${reps} × ${mins} min`, 'tempo', intervalles(`${reps} × ${mins} min à ${ms(a.tempo)}/km, récup 2:00 trot`, reps, mins, a.tempo, 120, a), `${reps} × ${mins} min à ${ms(a.tempo)}/km (récup 2:00)`, "Du tempo : un effort soutenu juste en dessous de ton seuil, il repousse le moment où tu t'essouffles.");
  }
  if (phase === 'specifique') {
    if (!second) {
      const [reps, m, r] = pick<[number, number, number]>([[4, 1000, 90], [5, 1000, 90], [3, 1600, 120], [4, 1600, 120], [3, 2000, 120]]);
      return avec(`${reps} × ${m} m à ${ms(a.course)}/km (allure course)`, 'seuil', intervalles(`${reps} × ${m} m à ${ms(a.course)}/km, récup ${recup(r)} trot`, reps, tempsAllure(m, a.course), a.course, r, a), `${reps} × ${m} m à ${ms(a.course)}/km (récup ${recup(r)})`, "L'allure de ta course, par morceaux : ton corps et ta tête apprennent le rythme du jour J.");
    }
    const mins = pick([15, 20, 25]);
    return avec(`Tempo continu ${mins} min`, 'tempo', bloc('steady', `${mins} min à ${ms(a.tempo)}/km`, mins, a.tempo, a), `${mins} min continues à ${ms(a.tempo)}/km`, "Un tempo d'une seule traite : tu apprends à tenir un effort soutenu sans te griser.");
  }
  // affûtage : un rappel d'allure court, on garde la vivacité sans fatiguer
  const [reps, m] = pick<[number, number]>([[3, 1000], [3, 800], [4, 400]]);
  const allure = m >= 800 ? a.course : a.cinqK;
  return avec(`Rappel d'allure ${reps} × ${m} m`, 'seuil', intervalles(`${reps} × ${m} m à ${ms(allure)}/km, récup 2:00 trot`, reps, tempsAllure(m, allure), allure, 120, a), `${reps} × ${m} m à ${ms(allure)}/km (récup 2:00)`, "Un rappel d'allure court : les jambes gardent le rythme, mais tu arrives frais à la course.");
}

/** Un temps écrit « 15:10 » (minutes:secondes) ou « 1:05:30 » (heures:minutes:secondes) → secondes ; null si le format est faux ou le temps absurde (moins de 1 min ou plus de 24 h) */
export function lireTemps(x: unknown): number | null {
  if (typeof x !== 'string') return null;
  const m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(x);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), m[3] === undefined ? null : Number(m[3])];
  if (b > 59 || (c !== null && c > 59)) return null;
  const s = c === null ? a * 60 + b : a * 3600 + b * 60 + c;
  return s >= 60 && s <= 86400 ? s : null;
}

/**
 * Le footing ne peut pas être bien plus LENT que ce que le coureur court vraiment (sinon le plan lui demande de ralentir sans raison) :
 * on plafonne les allures facile et longue à son allure médiane récente (+3 % et +6 %). Sans sorties récentes, rien ne change.
 */
export function plafonnerFacile(a: Allures, profil: ProfilCourse | null): Allures {
  const m = profil && profil.recent.sorties >= 3 ? profil.recent.allureMedianeSParKm : null;
  if (!m) return a;
  return { ...a, facile: Math.min(a.facile, m * 1.03), longue: Math.min(a.longue, m * 1.06) };
}

/** La sortie test : un 3 km chrono, la première séance quand le niveau n'est pas sûr. Son résultat sert à recalibrer tout le plan. */
export function seanceTest(a: Allures): SeanceCourse {
  const minutes = tempsAllure(3000, a.cinqK);
  return assembler(
    'Sortie test : 3 km chrono', 'seuil',
    [
      bloc('warmup', `Échauffement à ${ms(a.facile)}/km`, ECHAUF, a.facile, a),
      bloc('steady', '3 km chrono : aussi vite que tu peux, allure régulière', minutes, a.cinqK, a),
      bloc('cooldown', `Retour au calme à ${ms(a.facile)}/km`, RETOUR, a.facile, a),
    ],
    `${ECHAUF} min d'échauffement · 3 km chrono, aussi vite que tu peux tenir, allure régulière · ${RETOUR} min de retour au calme`,
    "Ta première sortie : elle mesure où tu en es vraiment. Cours les 3 km le plus vite possible en gardant une allure régulière (pars prudent), puis donne-moi ton temps : je recalibre toutes les allures du plan dessus.",
  );
}

/** Une allure écrite « 4:30 » ou « 4'30 » → secondes par km ; null si elle n'a pas ce format ou sort de 2:30 à 15:00 /km */
export function lireAllure(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x >= 150 && x <= 900 ? Math.round(x) : null;
  if (typeof x !== 'string') return null;
  const m = /^\s*(\d{1,2})\s*[:'’h]\s*(\d{1,2})\s*(?:\/\s*km)?\s*$/.exec(x);
  if (!m || Number(m[2]) > 59) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return s >= 150 && s <= 900 ? s : null;
}

/** Une séance d'intervalles construite à la demande : « 5 × 600 m à 4:30/km, récup 1:30 » */
export function seanceIntervalles(o: { reps: number; metres: number; allure: number; recupSecondes: number }, a: Allures): SeanceCourse {
  const { reps, metres, allure, recupSecondes } = o;
  const nom = `${reps} × ${metres} m à ${ms(allure)}/km`;
  const but = allure <= a.cinqK * 1.02
    ? 'Du travail rapide en séries courtes : il relève ta vitesse et rend ton allure de course plus facile à tenir.'
    : allure <= a.seuil * 1.02 ? "Des répétitions à ton allure de course ou de seuil : ton corps apprend à tenir le rythme du jour J."
    : "Des répétitions à allure modérée : un effort soutenu avec de la récupération.";
  return assembler(
    nom, allure <= a.cinqK * 1.02 ? 'fractionne' : 'seuil',
    [bloc('warmup', `Échauffement à ${ms(a.facile)}/km`, ECHAUF, a.facile, a), intervalles(`${reps} × ${metres} m à ${ms(allure)}/km, récup ${recup(recupSecondes)} trot`, reps, tempsAllure(metres, allure), allure, recupSecondes, a), bloc('cooldown', `Retour au calme à ${ms(a.facile)}/km`, RETOUR, a.facile, a)],
    `${ECHAUF} min d'échauffement · ${reps} × ${metres} m à ${ms(allure)}/km (récup ${recup(recupSecondes)}) · ${RETOUR} min de retour au calme`, but,
  );
}

/** Un tempo continu construit à la demande : « 25 min à 4:56/km » */
export function seanceTempoContinu(o: { minutes: number; allure: number }, a: Allures): SeanceCourse {
  return assembler(
    `Tempo continu ${o.minutes} min`, 'tempo',
    [bloc('warmup', `Échauffement à ${ms(a.facile)}/km`, ECHAUF, a.facile, a), bloc('steady', `${o.minutes} min à ${ms(o.allure)}/km`, o.minutes, o.allure, a), bloc('cooldown', `Retour au calme à ${ms(a.facile)}/km`, RETOUR, a.facile, a)],
    `${ECHAUF} min d'échauffement · ${o.minutes} min continues à ${ms(o.allure)}/km · ${RETOUR} min de retour au calme`,
    "Un tempo d'une seule traite : tu apprends à tenir un effort soutenu sans te griser.",
  );
}

// ---------- Calibrage : niveau, objectif jouable, allures ----------
export interface Calibrage {
  niveau: Niveau | null;
  realiste: number | null;
  cible: number | null;
  objectifPlan: number | null;
  verdict: 'realiste' | 'ambitieux' | 'sans_cible' | 'sans_donnees';
}
export function calibrer(km: number, tempsCibleMinutes: number | undefined, semaines: number, profil: ProfilCourse | null, aujourdhui: string, chrono?: { km: number; secondes: number } | null): Calibrage {
  const niveau = niveauActuel(profil, km, aujourdhui, chrono);
  const cible = tempsCibleMinutes ? tempsCibleMinutes * 60 : null;
  const realiste = niveau ? objectifRealiste(niveau.secondes, semaines) : null;
  if (realiste !== null) {
    return { niveau, realiste, cible, objectifPlan: cible !== null ? Math.max(cible, realiste) : realiste, verdict: cible === null ? 'sans_cible' : cible < realiste * 0.985 ? 'ambitieux' : 'realiste' };
  }
  return { niveau, realiste: null, cible, objectifPlan: cible, verdict: 'sans_donnees' };
}

/** Les noms des allures, pour que le coach sache à quoi correspond « 4:19 » quand l'utilisateur le dit */
export const NOM_ALLURE: Record<keyof Allures, string> = {
  vma: 'VMA (fractionné court, 400-800 m)', cinqK: 'allure 5 km', course: 'allure course', seuil: 'seuil', tempo: 'tempo', facile: 'footing facile', longue: 'sortie longue',
};
export const ALLURES_CLES = Object.keys(NOM_ALLURE) as (keyof Allures)[];

/**
 * Les allures d'un coureur à une date : calées sur la prochaine course à pied du calendrier (distance, temps visé, objectif jouable), sinon sur son niveau actuel ;
 * sans aucune donnée, sur son allure facile récente (ou 6:00/km). Sert à adapter une séance sans refaire tout le plan.
 */
// deno-lint-ignore no-explicit-any
export function alluresCoureur(resume: any, aujourdhui: string): Allures {
  const profil = profilCourseDepuisResume(resume);
  const courses = (Array.isArray(resume?.competitions) ? resume.competitions : []).filter((c: { sport?: string; date?: string }) => c?.sport === 'course' && typeof c.date === 'string' && c.date > aujourdhui);
  const c = courses[0];
  const km = typeof c?.km === 'number' && c.km > 0 ? c.km : 10;
  const semaines = c ? Math.max(1, Math.ceil(ecartJours(aujourdhui, c.date) / 7)) : 6;
  const cal = calibrer(km, typeof c?.temps_cible_min === 'number' ? c.temps_cible_min : undefined, semaines, profil, aujourdhui);
  if (cal.objectifPlan !== null) return plafonnerFacile(alluresDepuisCourse(cal.objectifPlan, km), profil);
  const facile = profil?.recent.allureMedianeSParKm ?? 360;
  return alluresDepuisCourse((facile / FACILE_SUR_10K) * 10, 10);
}

// ---------- Le plan ----------
export interface DemandeCourse {
  /** Jour de la course */
  date: string;
  /** Distance en km (défaut 10) */
  km?: number;
  /** Temps visé en minutes (peut être absent) */
  tempsCibleMinutes?: number;
  /** Premier jour du plan (défaut : demain) */
  debut?: string;
  /** Séances par semaine (défaut : d'après son rythme, entre 3 et 5) */
  seancesParSemaine?: number;
  joursLibres?: string[];
  /** Un chrono réel (par exemple la sortie test : 3 km en 15:10) : il fixe le niveau, et le plan est recalibré dessus */
  chrono?: { km: number; secondes: number };
  /** Pas de sortie test en première séance (par défaut il y en a une quand le niveau n'est pas mesuré) */
  sansTest?: boolean;
  /** Allures imposées par l'utilisateur (« 4:19 c'est trop vite, mets 4:30 ») : elles remplacent celles du calcul */
  allures?: Partial<Allures>;
}

export interface Bilan {
  km: number;
  jours: number;
  semaines: number;
  niveau: { secondes: number; source: string } | null;
  realiste: number | null;
  cible: number | null;
  objectifPlan: number | null;
  verdict: 'realiste' | 'ambitieux' | 'sans_cible' | 'sans_donnees';
  allures: Allures | null;
  /** Y a-t-il une sortie test en première séance ? */
  test: boolean;
  seancesParSemaine: number;
  /** Fiabilité du niveau : chrono (mesuré), recente (sorties des 90 jours), ancienne (vieux record vieilli), null (aucune donnée) */
  niveauFiabilite: Fiabilite | null;
  /** Volume de la première semaine (minutes) et ce qu'il a couru ses 7 derniers jours glissants */
  volumeDepart: number;
  derniers7: number;
  /** Les allures que l'utilisateur a imposées */
  imposees: (keyof Allures)[];
  /** Ce que le profil du coureur a changé dans le plan (vide si le profil est inconnu ou n'a rien changé) */
  profilUtilise: string[];
}

export interface ResultatCourse {
  operations: Operation[];
  abandons: string[];
  semaines: string[];
  bilan: Bilan | null;
  /** Les phrases à dire à l'utilisateur sur son niveau et son objectif, écrites par le code */
  message: string;
}

/**
 * Valeurs par défaut quand on n'a AUCUN historique (à remplacer plus tard par un départ prudent de débutant, voir docs/ia/FONDEMENTS_PLAN_COURSE.md).
 * Avec un historique, `reperesPersonnels` les remplace par des valeurs tirées des sorties de la personne : pas de durée fixe pour un débutant comme pour un pro.
 */
const MAX_HEBDO_DEFAUT = 360;
const FOOTING_MINI_DEFAUT = 30;
const LONGUE_MINI_DEFAUT = 45;
const SEANCE_MINI_DEFAUT = 38;

export interface Reperes {
  /** Durée mini d'un footing (minutes) : en dessous, ce n'est plus une séance d'endurance POUR LUI */
  footingMini: number;
  /** Durée mini d'une sortie longue */
  longueMini: number;
  /** Durée plancher d'une séance pour calculer le volume de départ */
  seanceMini: number;
  /** Plafond du volume d'une semaine */
  volumeMax: number;
  /** Plafond d'un footing : jamais une 2e sortie longue */
  footingMax: number;
  /** true : tiré de ses sorties ; false : valeurs par défaut (aucun historique) */
  personnels: boolean;
}
const arrondi5 = (x: number): number => Math.max(10, Math.round(x / 5) * 5);

/**
 * Les repères de durée de LA personne, d'après ses 8 dernières semaines (au moins 3 sorties) :
 *   - durée moyenne d'une sortie H = minutes / sorties ;
 *   - footing mini = 75 % de H ; séance mini = 90 % de H ; sortie longue mini = 85 % de sa plus longue sortie récente (et au moins footing mini + 10) ;
 *   - footing maxi = 130 % de H ; volume hebdo maxi = 130 % de sa semaine la plus chargée.
 * ATTENTION : ces coefficients (75, 90, 85, 130 %) sont des CONVENTIONS d'échelle (la durée suit la personne), pas des résultats d'études. À valider.
 */
export function reperesPersonnels(profil: ProfilCourse | null): Reperes {
  const defaut: Reperes = { footingMini: FOOTING_MINI_DEFAUT, longueMini: LONGUE_MINI_DEFAUT, seanceMini: SEANCE_MINI_DEFAUT, volumeMax: MAX_HEBDO_DEFAUT, footingMax: Infinity, personnels: false };
  const r = profil?.recent;
  if (!profil || !r || r.sorties < 3 || !(r.minutes > 0)) return defaut;
  const h = r.minutes / r.sorties;
  const footingMini = arrondi5(0.75 * h);
  const semaineMax = Math.max(0, ...profil.semaines.map((x) => x.minutes));
  return {
    footingMini,
    longueMini: Math.max(footingMini + 10, arrondi5(0.85 * (r.plusLongueMinutes || h))),
    seanceMini: arrondi5(0.9 * h),
    volumeMax: Math.max(Math.round(1.3 * semaineMax), footingMini * 3),
    footingMax: Math.max(footingMini, Math.round(1.3 * h)),
    personnels: true,
  };
}

/**
 * Ce que le profil que la personne a donné au coach change dans le plan (table coach_profil, voir profil-coureur.ts). Rien n'est inventé : chaque règle vient soit de la personne, soit de la fiche
 * course-blessures-progression (docs/ia/connaissances) : « avoir déjà été blessé » est un des facteurs les mieux liés à une nouvelle blessure (≈ ×7,6 chez des débutants), un programme improvisé
 * blesse plus qu'un programme structuré ; la fiche conseille alors de réduire la montée (fourchette 5-10 % par semaine → le bas), de garder plus de jours faciles, et de ne jamais courir à travers une douleur.
 *   - jour pas disponible → aucune séance ce jour-là ; durée max d'un jour → aucune séance plus longue ce jour-là ;
 *   - plus grosse semaine déjà faite → le volume d'une semaine ne dépasse pas le plus haut entre elle et sa plus grosse semaine récente ;
 *   - blessure encore là → AUCUNE séance d'intensité, pas de sortie test ; blessure des 12 derniers mois ou moins d'un an de pratique → prudence : une seule séance dure par semaine, montée de 5 % ;
 *   - elle évite le fractionné → une seule séance dure par semaine.
 * Le moment de la journée (matin, soir) n'a pas d'effet : le plan donne des jours, pas des heures.
 */
export interface ReglesProfil {
  joursInterdits: Set<string>;
  minutesMax: Record<string, number>;
  picHebdo: number | null;
  prudent: boolean;
  blessureActive: boolean;
  maxQualites: number;
  croissance: number;
  /** Ce que le plan a vraiment pris en compte, en phrases pour le bilan */
  utilise: string[];
}
export function reglesDuProfil(c: ProfilCoureur | null): ReglesProfil {
  const r: ReglesProfil = { joursInterdits: new Set(), minutesMax: {}, picHebdo: null, prudent: false, blessureActive: false, maxQualites: 2, croissance: 1.1, utilise: [] };
  if (!c) return r;
  for (const j of JOURS_SEMAINE) {
    const d = c.disponibilites[j];
    if (d?.libre === false) r.joursInterdits.add(j);
    else if (d?.minutesMax !== undefined) r.minutesMax[j] = d.minutesMax;
  }
  if (r.joursInterdits.size) r.utilise.push(`aucune séance ${[...r.joursInterdits].join(', ')}`);
  const limites = Object.entries(r.minutesMax);
  if (limites.length) r.utilise.push(`durée limitée ${limites.map(([j, m]) => `${j} ${m} min`).join(', ')}`);
  if (c.picHebdoMinutes !== null && c.picHebdoMinutes > 0) { r.picHebdo = c.picHebdoMinutes; r.utilise.push(`volume jamais au-dessus de ta plus grosse semaine (${c.picHebdoMinutes} min) ou de ta plus grosse semaine récente`); }
  r.blessureActive = c.blessures.some((b) => b.actif);
  const recente = c.blessures.some((b) => b.actif || b.quand !== 'plus_1_an');
  const debutant = c.anneesPratique === 0;
  r.prudent = recente || debutant;
  if (r.blessureActive) r.utilise.push('blessure encore là : aucune séance d\'intensité, pas de sortie test');
  else if (recente) r.utilise.push('blessure dans les 12 derniers mois : une seule séance dure par semaine, montée plus douce (5 %)');
  else if (debutant) r.utilise.push('moins d\'un an de pratique : une seule séance dure par semaine, montée plus douce (5 %)');
  if (c.fractionne === 'evite') { r.maxQualites = 1; r.utilise.push('tu évites le fractionné : une seule séance dure par semaine'); }
  if (r.prudent) { r.maxQualites = 1; r.croissance = 1.05; }
  return r;
}

/** Le jour de la semaine d'une date (1 = lundi … 7 = dimanche) */
const jourSemaine = (date: string): number => { const j = new Date(`${date}T00:00:00Z`).getUTCDay(); return j === 0 ? 7 : j; };

export function planifierCourse(d: DemandeCourse, seances: SeancePrevue[], base: ContexteValidation, profil: ProfilCourse | null, coureur: ProfilCoureur | null = null): ResultatCourse {
  const aujourdhui = base.aujourdhui;
  const regles = reglesDuProfil(coureur);
  const vide = (msg: string): ResultatCourse => ({ operations: [], abandons: [msg], semaines: [], bilan: null, message: msg });
  const km = d.km && d.km > 0 ? d.km : 10;
  const debut = d.debut && d.debut > aujourdhui ? d.debut : d.debut === aujourdhui ? aujourdhui : ajouterJours(aujourdhui, 1);
  if (d.date <= debut) return vide('La course est avant le début du plan : vérifie les dates.');
  const jours = ecartJours(debut, d.date);
  // Les semaines sont des fenêtres de 7 JOURS GLISSANTS ancrées sur le premier jour du plan (le jour 1 est le début du plan, pas un lundi) ;
  // la dernière s'arrête la veille de la course. Les jours choisis varient d'une semaine à l'autre et une séance dure n'est jamais collée à une autre,
  // même d'une fenêtre à la suivante.
  const fenetres: { du: string; fin: string }[] = [];
  for (let du = debut; du < d.date; du = ajouterJours(du, 7)) {
    const fin = ajouterJours(du, 6);
    fenetres.push({ du, fin: fin >= d.date ? ajouterJours(d.date, -1) : fin });
  }
  const nSemaines = Math.min(60, fenetres.length);
  if (jours > 60 * 7) return vide('Cette course est à plus de 60 semaines : fais un premier plan plus tard, quand elle sera plus proche.');

  // 1. niveau, objectif, allures
  const { niveau, realiste, cible, objectifPlan, verdict } = calibrer(km, d.tempsCibleMinutes, nSemaines, profil, aujourdhui, d.chrono);
  if (objectifPlan === null) {
    return vide("Je n'ai ni tes sorties de course ni un temps visé pour calibrer les allures : donne-moi le temps que tu vises, ou fais d'abord quelques sorties.");
  }
  const calculees = plafonnerFacile(alluresDepuisCourse(objectifPlan, km), profil);
  // Sortie test SEULEMENT sans donnée récente (ni chrono, ni sorties des 90 derniers jours) : avec des sorties récentes, le niveau est déjà connu.
  // Pas de test non plus si l'utilisateur n'en veut pas ou si le plan est trop court pour s'en servir.
  const avecTest = !d.chrono && !d.sansTest && !regles.blessureActive && nSemaines >= 2 && niveau?.fiabilite !== 'recente';
  const imposees = ALLURES_CLES.filter((c) => d.allures?.[c] !== undefined);
  const a: Allures = { ...calculees, ...Object.fromEntries(imposees.map((c) => [c, d.allures![c]!])) };

  // 2. rythme : séances par semaine et volume
  const frequence = profil && profil.recent.sorties > 0 ? profil.recent.sorties / 8 : 0;
  const k = Math.min(6, Math.max(2, Math.round(d.seancesParSemaine ?? Math.min(5, Math.max(3, Math.round(frequence) + (Math.round(frequence) < 4 ? 1 : 0))))));
  const quatreDernieres = profil ? profil.semaines.slice(-4) : [];
  const moyenne4 = quatreDernieres.length ? quatreDernieres.reduce((t, s) => t + s.minutes, 0) / quatreDernieres.length : 0;
  // Le volume de départ part de ce que la personne fait VRAIMENT : ses 7 derniers jours glissants (la dernière case des semaines du profil, qui se terminent aujourd'hui) ou sa moyenne
  // sur 4 fenêtres de 7 jours, si elle est plus haute ; un peu plus (+10 %), jamais moins de 38 min par séance. Ainsi, un plan refait en cours de route repart de la charge réelle.
  const derniers7 = profil && profil.semaines.length ? profil.semaines[profil.semaines.length - 1].minutes : 0;
  const rp = reperesPersonnels(profil);
  // Sa plus grosse semaine déjà faite (profil) plafonne le volume : jamais plus que le plus haut entre elle et sa plus grosse semaine récente
  const semaineMaxRecente = Math.max(0, ...(profil?.semaines ?? []).map((x) => x.minutes));
  const volumeMax = regles.picHebdo !== null ? Math.max(Math.min(rp.volumeMax, Math.max(regles.picHebdo, semaineMaxRecente)), k * rp.footingMini) : rp.volumeMax;
  const volumeDepart = Math.min(volumeMax, Math.max(k * rp.seanceMini, Math.round(Math.max(moyenne4, derniers7) * 1.1)));
  const longueMax = Math.min(110, Math.max(60, Math.round((objectifPlan / 60) * 1.6)));
  let longuePrecedente = Math.max(rp.longueMini, Math.min(longueMax, profil?.recent.plusLongueMinutes || rp.longueMini));

  const liste = phases(nSemaines);
  const compteurs: Record<Phase, number> = { base: 0, developpement: 0, specifique: 0, affutage: 0 };
  const operations: Operation[] = [];
  const lignesSemaines: string[] = [];
  const abandons: string[] = [];
  let toutes: SeancePrevue[] = seances.map((s) => ({ ...s }));
  const interdits = new Set(d.joursLibres ?? []);
  const noms = new Set<string>();
  /** Les jours des séances dures déjà posées (qualité et sortie longue) */
  const joursDurs = new Set<string>();
  /** Les jours de la semaine (« lundi »…) utilisés par chaque rôle dans la fenêtre précédente : on évite de les répéter */
  let joursParRole = new Map<Role, Set<string>>();

  for (let w = 0; w < nSemaines; w++) {
    const { du, fin: finSemaine } = fenetres[w];
    const phase = liste[w];
    const rang = compteurs[phase]++;
    const derniere = w === nSemaines - 1;
    const recuperation = phase !== 'affutage' && w % 4 === 3 && nSemaines - w > 2;
    const facteur = phase === 'affutage' ? (w === nSemaines - 1 ? 0.55 : 0.75) : recuperation ? 0.8 : Math.pow(regles.croissance, w - Math.floor(w / 4));
    const volume = Math.min(volumeMax, Math.round(volumeDepart * facteur));

    // les jours possibles de la semaine
    const pris = new Set(toutes.map((s) => s.date));
    const libres: string[] = [];
    for (let j = du; j <= finSemaine; j = ajouterJours(j, 1)) {
      if (j < debut || interdits.has(j) || regles.joursInterdits.has(nomDuJour(j)) || pris.has(j) || base.joursDeRepos.includes(j) || base.competitions.some((c) => c.date === j)) continue;
      if (base.indisponibilites.some((i) => entre(j, i.du, i.au))) continue;
      libres.push(j);
    }
    const duree = ecartJours(du, finSemaine) + 1;
    // Le nombre de séances varie : une séance de moins en semaine de récupération (à partir de 4 séances par semaine), moins à l'affûtage
    const kBase = recuperation && k >= 4 ? k - 1 : k;
    const kSemaine = Math.max(1, Math.min(libres.length, phase === 'affutage' ? Math.min(k, w === nSemaines - 1 ? 3 : 4) : kBase, duree - 1 || 1));
    if (!libres.length) { abandons.push(`Semaine ${w + 1} : aucun jour libre.`); lignesSemaines.push(`Semaine ${w + 1} (${du}) : ${NOM_PHASE[phase]}, aucun jour libre`); continue; }

    // les rôles : une qualité, une sortie longue, le reste facile ; une seconde qualité à partir de 4 séances, hors base et affûtage
    // L'ordre des rôles suit les jours : un footing d'abord pour que la qualité ne tombe pas le lendemain de la sortie longue de la semaine d'avant
    const roles: Role[] = [];
    const deuxQualites = regles.maxQualites >= 2 && kSemaine >= 4 && (phase === 'developpement' || phase === 'specifique');
    if (deuxQualites) roles.push('qualite1', 'facile', 'qualite2');
    else if (kSemaine >= 3) roles.push('facile', 'qualite1');
    else roles.push('qualite1');
    while (roles.length < kSemaine - 1) roles.push('facile');
    // la semaine de la course n'a pas de sortie longue : un dernier footing léger à la place
    if (derniere) { if (kSemaine >= 3) roles.push('facile'); } else if (kSemaine >= 2) roles.push('longue');
    while (roles.length > kSemaine) roles.splice(roles.indexOf('facile'), 1);
    // Blessure encore là : aucune séance d'intensité, que du facile et la sortie longue
    if (regles.blessureActive) roles.forEach((r, i) => { if (r === 'qualite1' || r === 'qualite2') roles[i] = 'facile'; });
    // La sortie longue va sur un jour de week-end libre quand il y en a un (samedi une semaine, dimanche la suivante) ; les autres séances se répartissent autour,
    // sans coller la qualité à la sortie longue quand c'est possible
    const wk = (j: string) => nomDuJour(j) === 'samedi' || nomDuJour(j) === 'dimanche';
    const iLongue = roles.indexOf('longue');
    const weekends = libres.filter(wk);
    let choisis: string[];
    if (iLongue >= 0 && weekends.length) {
      const jourLong = weekends[w % weekends.length];
      const reste = libres.filter((j) => j !== jourLong);
      const loinDeLaLongue = reste.filter((j) => Math.abs(ecartJours(j, jourLong)) > 1);
      const candidats = loinDeLaLongue.length >= roles.length - 1 ? loinDeLaLongue : reste;
      const autresJours = choisirJours(candidats, roles.length - 1);
      choisis = [];
      let k2 = 0;
      roles.forEach((r) => choisis.push(r === 'longue' ? jourLong : autresJours[k2++]));
    } else {
      choisis = choisirJours(libres, roles.length);
    }

    // Les jours ne sont pas les mêmes chaque semaine : on décale les séances qui ne sont pas la sortie longue d'un jour (0, +1, −1, 0…) quand le jour est libre
    const decalage = [0, 1, -1][w % 3];
    if (decalage !== 0) {
      roles.forEach((r, i) => {
        if (r === 'longue') return;
        const cand = ajouterJours(choisis[i], decalage);
        if (libres.includes(cand) && !choisis.includes(cand)) choisis[i] = cand;
      });
    }
    // Le meilleur placement des jours : on essaie toutes les façons de poser les séances sur les jours libres et on garde la moins coûteuse :
    // jamais deux séances dures collées (la qualité et la sortie longue), même avec la fenêtre précédente ; la sortie longue au week-end ; le moins de décalage possible
    const placement = meilleurPlacement(libres, roles, choisis, joursDurs, wk, joursParRole);
    if (placement) choisis = placement;

    // les durées
    // Le contenu alterne : en développement avec 3 séances, une semaine de VMA puis une semaine de tempo ; la semaine de récupération a une qualité légère (fartlek)
    const qualiteAlternee = phase === 'developpement' && kSemaine < 4 && rang % 2 === 1;
    const qualiteDeLaSemaine = (): SeanceCourse => (recuperation ? qualite('base', 0, a, false) : qualite(phase, rang, a, qualiteAlternee));
    const seancesQualite = roles.map((r) => (r === 'qualite1' ? (w === 0 && avecTest ? seanceTest(a) : qualiteDeLaSemaine()) : r === 'qualite2' ? qualite(phase, rang, a, true) : null));
    const minutesQualite = seancesQualite.reduce((t, s) => t + (s?.minutes ?? 0), 0);
    const nLongue = roles.filter((r) => r === 'longue').length;
    const nFaciles = roles.filter((r) => r === 'facile').length;
    const restant = Math.max(0, volume - minutesQualite);
    let longue = 0;
    if (nLongue) {
      longue = Math.round(Math.min(longueMax, Math.max(rp.longueMini, Math.min(longuePrecedente + (w === 0 ? 0 : 6), volume * 0.42))));
      if (phase === 'affutage') longue = Math.max(rp.footingMini, Math.round(longue * 0.75));
      if (recuperation) longue = Math.max(rp.longueMini - 5, Math.round(longue * 0.85));
    }
    // Un footing reste un footing : jamais plus long que ses footings habituels (130 %), sinon il devient une 2e sortie longue à côté de la vraie. Sans historique : jamais plus de 65 % de la longue.
    const plafondFacile = nLongue ? Math.min(rp.footingMax, rp.personnels ? Infinity : Math.max(rp.footingMini, Math.round(longue * 0.65))) : Infinity;
    let facile = nFaciles ? Math.min(plafondFacile, Math.max(derniere ? Math.max(15, Math.round(rp.footingMini * 0.65)) : rp.footingMini, Math.round((restant - longue) / nFaciles))) : 0;
    if (nLongue && !recuperation && phase !== 'affutage') longuePrecedente = longue;

    // Durée max par jour (profil) : la sortie longue et les footings ne dépassent pas le jour le plus long de la semaine ; chaque séance est ensuite posée sur un jour assez long
    const maxDuJour = (j: string): number => regles.minutesMax[nomDuJour(j)] ?? Infinity;
    const plafondJour = libres.length ? Math.max(...libres.map(maxDuJour)) : Infinity;
    if (plafondJour < Infinity) {
      longue = Math.min(longue, plafondJour);
      facile = Math.min(facile, plafondJour);
    }

    // poser chaque séance (essai du jour choisi, puis des autres jours libres de la semaine)
    const joursCetteFenetre = new Map<Role, Set<string>>();
    let totalSemaine = 0;
    let posees = 0;
    roles.forEach((role, i) => {
      const s: SeanceCourse =
        role === 'qualite1' || role === 'qualite2' ? seancesQualite[i]! :
        role === 'longue' ? sortieLongue(longue, a, longue > rp.longueMini && ((phase === 'specifique') || (phase === 'developpement' && w % 2 === 1))) :
        varianteFooting(facile, a, phase, w + roles.slice(0, i).filter((r) => r === 'facile').length, rp.footingMini);
      const essais = [choisis[i], ...libres.filter((j) => !choisis.includes(j) && !operations.some((o) => o.op === 'ajouter' && o.proposition.date === j))].filter((j) => maxDuJour(j) >= s.minutes);
      let raisonRefus = essais.length ? '' : `aucun jour libre assez long, ${s.minutes} min dépassent la durée que tu m'as donnée`;
      for (const jour of essais) {
        const p: Proposition = { date: jour, sport: 'course', type: s.type, minutes: s.minutes };
        const v = validerSeance(p, ctxAvec(base, toutes, base.indisponibilites));
        if (v.ok) {
          operations.push({ op: 'ajouter', proposition: p, justification: s.but, detail: s.detail, phase: butDeLaSemaine(phase, recuperation) });
          const t = typeSeance('course', s.type);
          toutes = [...toutes, { id: `course-${operations.length}`, date: jour, sport: 'course', minutes: s.minutes, tss: t ? tssEstime(t, s.minutes) : null, creeeParIa: true }];
          totalSemaine += s.minutes;
          posees++;
          noms.add(jour);
          if (p.type !== 'footing_facile' && p.type !== 'footing_recuperation') joursDurs.add(jour);
          joursCetteFenetre.set(role, (joursCetteFenetre.get(role) ?? new Set<string>()).add(nomDuJour(jour)));
          return;
        }
        if (!raisonRefus) raisonRefus = v.erreurs[0]?.message ?? '';
      }
      if (abandons.length < 12) abandons.push(`Semaine ${w + 1}, ${etiquetteDate(choisis[i])} : je n'ai pas pu placer « ${s.detail.nom} » (${raisonRefus.replace(/\.$/, '')}).`);
    });
    joursParRole = joursCetteFenetre;
    lignesSemaines.push(`Semaine ${w + 1} (${du}) : ${NOM_PHASE[phase]}${recuperation ? ', récupération' : ''}, ${posees} séance${posees > 1 ? 's' : ''}, ${totalSemaine} min`);
  }

  const bilan: Bilan = { km, jours, semaines: nSemaines, niveau, realiste, cible, objectifPlan, verdict, allures: a, seancesParSemaine: k, imposees, test: avecTest, niveauFiabilite: niveau?.fiabilite ?? null, volumeDepart, derniers7, profilUtilise: regles.utilise };
  return { operations, abandons, semaines: lignesSemaines, bilan, message: messageBilan(bilan) };
}

/** Les phrases honnêtes sur le niveau, l'objectif et les allures, écrites par le code (le modèle les reprend, il ne les invente pas) */
export function messageBilan(b: Bilan): string {
  const parts: string[] = [];
  if (b.niveau) parts.push(`Niveau estimé aujourd'hui sur ${b.km} km : ${formaterTemps(b.niveau.secondes)} (d'après ${b.niveau.source}).`);
  if (b.niveauFiabilite === 'ancienne') parts.push("Attention : je n'ai AUCUNE sortie récente, cette estimation est très fragile (on a pu perdre beaucoup de niveau).");
  else if (b.niveauFiabilite === 'recente') parts.push("Cette estimation vient de tes sorties récentes : pas de sortie test nécessaire. Si tu trouves les allures trop rapides ou trop lentes, dis-le-moi et je les ajuste.");
  if (b.test) parts.push("La première sortie du plan est un TEST (3 km chrono) : dès que l'utilisateur donne son temps, rappelle preparer_course avec chrono_km et chrono_temps pour recalibrer toutes les allures. Dis-lui de la faire dès que possible.");
  if (b.realiste !== null) parts.push(`En ${b.semaines} semaine${b.semaines > 1 ? 's' : ''} d'entraînement, un temps jouable est d'environ ${formaterTemps(b.realiste)}.`);
  if (b.verdict === 'ambitieux' && b.cible !== null && b.realiste !== null) {
    parts.push(`L'objectif de ${formaterTemps(b.cible)} est très ambitieux : il faudrait gagner ${formaterTemps(b.realiste - b.cible)} en ${b.semaines} semaines. Le plan est calé sur ${formaterTemps(b.objectifPlan ?? b.realiste)} (${formaterAllure((b.objectifPlan ?? b.realiste) / b.km)}/km). Si les séances passent facilement, on remontera les allures.`);
  } else if (b.verdict === 'realiste' && b.cible !== null) {
    parts.push(`L'objectif de ${formaterTemps(b.cible)} est réaliste : le plan est calé dessus (${formaterAllure(b.cible / b.km)}/km).`);
  } else if (b.verdict === 'sans_cible') {
    parts.push(`Pas de temps visé : le plan est calé sur ${formaterTemps(b.objectifPlan ?? 0)}.`);
  } else if (b.verdict === 'sans_donnees') {
    parts.push("Je n'ai pas assez de sorties de course pour estimer ton niveau : le plan est calé sur le temps que tu vises, à vérifier après les premières séances.");
  }
  parts.push(`Volume de départ : ${b.volumeDepart} min la première semaine, calé sur tes 7 derniers jours glissants (${b.derniers7} min) et ta moyenne des 4 dernières fenêtres de 7 jours ; les semaines du plan sont des fenêtres de 7 jours glissants à partir du premier jour du plan.`);
  if (b.profilUtilise.length) parts.push(`Ton profil a changé le plan : ${b.profilUtilise.join(' ; ')}.`);
  parts.push(`Plan à ${b.seancesParSemaine} séances par semaine (à garder identique si tu refais le plan, sauf demande de l'utilisateur).`);
  if (b.allures) {
    parts.push(`Allures (par km) : ${ALLURES_CLES.map((c) => `${NOM_ALLURE[c]} ${formaterAllure(b.allures![c])}`).join(', ')}.`);
    if (b.imposees.length) parts.push(`Allures imposées par l'utilisateur : ${b.imposees.map((c) => NOM_ALLURE[c]).join(', ')}.`);
  }
  return parts.join(' ');
}
