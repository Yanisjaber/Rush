// ============================================================
// Plan de COURSE À PIED vers une course visée : « prépare-moi mon 10 km du 13 décembre, objectif 40 minutes ».
//
// L'IA ne devine rien : le CODE lit le profil du coureur (rpc_coach_resume → profil_course : meilleur effort, allure facile, volume des 8 dernières
// semaines, jours habituels) et construit, comme un entraîneur qui ouvre le dossier :
//   1. son NIVEAU ACTUEL (meilleur effort converti sur la distance, vieilli selon son ancienneté, croisé avec son allure facile) ;
//   2. un objectif RÉALISTE pour le temps qu'il reste (gain de 0,6 % par semaine, 8 % au plus) : un objectif trop ambitieux est dit franchement,
//      le plan est calé sur ce qui est jouable ;
//   3. ses ALLURES chiffrées (allure course, 5 km, VMA, seuil, tempo, facile, sortie longue) tirées de l'objectif ;
//   4. des PHASES (base, développement, spécifique, affûtage) selon le nombre de semaines ;
//   5. des séances qui ont un BUT et un contenu précis (« 5 × 1000 m à 4:41/km, récup 1:30 »), avec leurs blocs et leurs allures,
//      un volume qui monte de 10 % par semaine (récupération toutes les 4 semaines), une sortie longue qui progresse.
// Tout passe par le validateur (jours indisponibles, repos, compétition) ; une séance refusée est essayée sur un autre jour, sinon abandonnée avec la raison.
// Ces règles sont les HABITUDES d'un bon plan, pas des refus : l'utilisateur peut tout modifier ensuite.
// ============================================================
import { ajouterJours, ecartJours, entre, nomDuJour } from './dates-iso.ts';
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
const RIEGEL = 1.06;
/** Un temps converti d'une distance à une autre (formule de Riegel) */
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

/** Un effort récent n'est presque jamais maximal : on le convertit puis on le prend pour 7 % plus lent qu'un vrai effort de course */
const EFFORT_RECENT_FACTEUR = 0.93;
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

/** Le temps jouable pour la course : le niveau actuel, amélioré de 0,6 % par semaine d'entraînement (8 % au plus) */
export const objectifRealiste = (niveauSecondes: number, semaines: number): number => Math.round(niveauSecondes * (1 - Math.min(0.08, 0.006 * Math.max(0, semaines))));

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

/** La phase de chaque semaine pour un plan de n semaines (la dernière est la semaine de la course) */
export function phases(n: number): Phase[] {
  const affutage = n >= 8 ? 2 : n >= 3 ? 1 : n;
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
  if (lignesDroites && minutes >= 30) {
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

export function sortieLongue(minutes: number, a: Allures, progressive: boolean): SeanceCourse {
  if (progressive && minutes >= 50) {
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
  /** Les allures que l'utilisateur a imposées */
  imposees: (keyof Allures)[];
}

export interface ResultatCourse {
  operations: Operation[];
  abandons: string[];
  semaines: string[];
  bilan: Bilan | null;
  /** Les phrases à dire à l'utilisateur sur son niveau et son objectif, écrites par le code */
  message: string;
}

const MAX_HEBDO = 360;
/** Durée mini d'un footing et d'une sortie longue (minutes) : en dessous, ce n'est plus une séance d'endurance */
const FOOTING_MINI = 30;
const LONGUE_MINI = 45;

/** Le jour de la semaine d'une date (1 = lundi … 7 = dimanche) */
const jourSemaine = (date: string): number => { const j = new Date(`${date}T00:00:00Z`).getUTCDay(); return j === 0 ? 7 : j; };

export function planifierCourse(d: DemandeCourse, seances: SeancePrevue[], base: ContexteValidation, profil: ProfilCourse | null): ResultatCourse {
  const aujourdhui = base.aujourdhui;
  const vide = (msg: string): ResultatCourse => ({ operations: [], abandons: [msg], semaines: [], bilan: null, message: msg });
  const km = d.km && d.km > 0 ? d.km : 10;
  const debut = d.debut && d.debut > aujourdhui ? d.debut : d.debut === aujourdhui ? aujourdhui : ajouterJours(aujourdhui, 1);
  if (d.date <= debut) return vide('La course est avant le début du plan : vérifie les dates.');
  const jours = ecartJours(debut, d.date);
  // Les semaines vont du lundi au dimanche (la sortie longue tombe le week-end, deux séances dures ne se touchent pas d'une semaine à l'autre) :
  // la première commence au début du plan, la dernière s'arrête la veille de la course
  const fenetres: { du: string; fin: string }[] = [];
  for (let du = debut; du < d.date; du = ajouterJours(du, 8 - jourSemaine(du))) {
    const dimanche = ajouterJours(du, 7 - jourSemaine(du));
    fenetres.push({ du, fin: dimanche >= d.date ? ajouterJours(d.date, -1) : dimanche });
  }
  const nSemaines = Math.min(60, fenetres.length);
  if (jours > 60 * 7) return vide('Cette course est à plus de 60 semaines : fais un premier plan plus tard, quand elle sera plus proche.');

  // 1. niveau, objectif, allures
  const { niveau, realiste, cible, objectifPlan, verdict } = calibrer(km, d.tempsCibleMinutes, nSemaines, profil, aujourdhui, d.chrono);
  if (objectifPlan === null) {
    return vide("Je n'ai ni tes sorties de course ni un temps visé pour calibrer les allures : donne-moi le temps que tu vises, ou fais d'abord quelques sorties.");
  }
  const calculees = plafonnerFacile(alluresDepuisCourse(objectifPlan, km), profil);
  // Le niveau n'est pas mesuré (pas de chrono) : la première sortie est un test, sauf si l'utilisateur n'en veut pas ou si le plan est trop court pour s'en servir
  const avecTest = !d.chrono && !d.sansTest && nSemaines >= 2;
  const imposees = ALLURES_CLES.filter((c) => d.allures?.[c] !== undefined);
  const a: Allures = { ...calculees, ...Object.fromEntries(imposees.map((c) => [c, d.allures![c]!])) };

  // 2. rythme : séances par semaine et volume
  const frequence = profil && profil.recent.sorties > 0 ? profil.recent.sorties / 8 : 0;
  const k = Math.min(6, Math.max(2, Math.round(d.seancesParSemaine ?? Math.min(5, Math.max(3, Math.round(frequence) + 1)))));
  const quatreDernieres = profil ? profil.semaines.slice(-4) : [];
  const moyenne4 = quatreDernieres.length ? quatreDernieres.reduce((t, s) => t + s.minutes, 0) / quatreDernieres.length : 0;
  // Le volume de départ : un peu plus que ce qu'il fait en ce moment, jamais moins de 38 min par séance
  const volumeDepart = Math.min(MAX_HEBDO, Math.max(k * 38, Math.round(moyenne4 * 1.1)));
  const longueMax = Math.min(110, Math.max(60, Math.round((objectifPlan / 60) * 1.6)));
  let longuePrecedente = Math.max(LONGUE_MINI, Math.min(longueMax, profil?.recent.plusLongueMinutes || LONGUE_MINI));

  const liste = phases(nSemaines);
  const compteurs: Record<Phase, number> = { base: 0, developpement: 0, specifique: 0, affutage: 0 };
  const operations: Operation[] = [];
  const lignesSemaines: string[] = [];
  const abandons: string[] = [];
  let toutes: SeancePrevue[] = seances.map((s) => ({ ...s }));
  const interdits = new Set(d.joursLibres ?? []);
  const noms = new Set<string>();

  for (let w = 0; w < nSemaines; w++) {
    const { du, fin: finSemaine } = fenetres[w];
    const phase = liste[w];
    const rang = compteurs[phase]++;
    const derniere = w === nSemaines - 1;
    const recuperation = phase !== 'affutage' && w % 4 === 3 && nSemaines - w > 2;
    const facteur = phase === 'affutage' ? (w === nSemaines - 1 ? 0.55 : 0.75) : recuperation ? 0.8 : Math.pow(1.1, w - Math.floor(w / 4));
    const partielle = Math.min(1, Math.max(0.5, (ecartJours(du, finSemaine) + 1) / 7));
    const volume = Math.min(MAX_HEBDO, Math.round(volumeDepart * facteur * (w === 0 ? partielle : 1)));

    // les jours possibles de la semaine
    const pris = new Set(toutes.map((s) => s.date));
    const libres: string[] = [];
    for (let j = du; j <= finSemaine; j = ajouterJours(j, 1)) {
      if (j < debut || interdits.has(j) || pris.has(j) || base.joursDeRepos.includes(j) || base.competitions.some((c) => c.date === j)) continue;
      if (base.indisponibilites.some((i) => entre(j, i.du, i.au))) continue;
      libres.push(j);
    }
    const duree = ecartJours(du, finSemaine) + 1;
    const kSemaine = Math.max(1, Math.min(libres.length, phase === 'affutage' ? Math.min(k, w === nSemaines - 1 ? 3 : 4) : k, duree - 1 || 1));
    if (!libres.length) { abandons.push(`Semaine ${w + 1} : aucun jour libre.`); lignesSemaines.push(`Semaine ${w + 1} (${du}) : ${NOM_PHASE[phase]}, aucun jour libre`); continue; }

    // les rôles : une qualité, une sortie longue, le reste facile ; une seconde qualité à partir de 4 séances, hors base et affûtage
    // L'ordre des rôles suit les jours : un footing d'abord pour que la qualité ne tombe pas le lendemain de la sortie longue de la semaine d'avant
    const roles: Role[] = [];
    const deuxQualites = kSemaine >= 4 && (phase === 'developpement' || phase === 'specifique');
    if (deuxQualites) roles.push('qualite1', 'facile', 'qualite2');
    else if (kSemaine >= 3) roles.push('facile', 'qualite1');
    else roles.push('qualite1');
    while (roles.length < kSemaine - 1) roles.push('facile');
    // la semaine de la course n'a pas de sortie longue : un dernier footing léger à la place
    if (derniere) { if (kSemaine >= 3) roles.push('facile'); } else if (kSemaine >= 2) roles.push('longue');
    while (roles.length > kSemaine) roles.splice(roles.indexOf('facile'), 1);
    const choisis = choisirJours(libres, roles.length);
    // la sortie longue va le week-end quand il y en a un
    const wk = (j: string) => nomDuJour(j) === 'samedi' || nomDuJour(j) === 'dimanche';
    const iLongue = roles.indexOf('longue');
    if (iLongue >= 0 && !wk(choisis[iLongue])) {
      const cible2 = choisis.map((j, i) => (wk(j) && roles[i] !== 'longue' ? i : -1)).filter((i) => i >= 0).pop();
      if (cible2 !== undefined) [roles[iLongue], roles[cible2]] = [roles[cible2], roles[iLongue]];
    }

    // les durées
    const seancesQualite = roles.map((r) => (r === 'qualite1' ? (w === 0 && avecTest ? seanceTest(a) : qualite(phase, rang, a, false)) : r === 'qualite2' ? qualite(phase, rang, a, true) : null));
    const minutesQualite = seancesQualite.reduce((t, s) => t + (s?.minutes ?? 0), 0);
    const nLongue = roles.filter((r) => r === 'longue').length;
    const nFaciles = roles.filter((r) => r === 'facile').length;
    const restant = Math.max(0, volume - minutesQualite);
    let longue = 0;
    if (nLongue) {
      longue = Math.round(Math.min(longueMax, Math.max(LONGUE_MINI, Math.min(longuePrecedente + (w === 0 ? 0 : 6), volume * 0.42))));
      if (phase === 'affutage') longue = Math.max(FOOTING_MINI, Math.round(longue * 0.75));
      if (recuperation) longue = Math.max(LONGUE_MINI - 5, Math.round(longue * 0.85));
    }
    const facile = nFaciles ? Math.max(derniere ? 20 : FOOTING_MINI, Math.round((restant - longue) / nFaciles)) : 0;
    if (nLongue && !recuperation && phase !== 'affutage') longuePrecedente = longue;

    // poser chaque séance (essai du jour choisi, puis des autres jours libres de la semaine)
    let totalSemaine = 0;
    let posees = 0;
    roles.forEach((role, i) => {
      const s: SeanceCourse =
        role === 'qualite1' || role === 'qualite2' ? seancesQualite[i]! :
        role === 'longue' ? sortieLongue(longue, a, phase === 'specifique' && longue >= 60) :
        footing(facile, a, (phase === 'base' || phase === 'developpement') && facile >= FOOTING_MINI);
      const essais = [choisis[i], ...libres.filter((j) => !choisis.includes(j) && !operations.some((o) => o.op === 'ajouter' && o.proposition.date === j))];
      let raisonRefus = '';
      for (const jour of essais) {
        const p: Proposition = { date: jour, sport: 'course', type: s.type, minutes: s.minutes };
        const v = validerSeance(p, ctxAvec(base, toutes, base.indisponibilites));
        if (v.ok) {
          operations.push({ op: 'ajouter', proposition: p, justification: s.but, detail: s.detail });
          const t = typeSeance('course', s.type);
          toutes = [...toutes, { id: `course-${operations.length}`, date: jour, sport: 'course', minutes: s.minutes, tss: t ? tssEstime(t, s.minutes) : null, creeeParIa: true }];
          totalSemaine += s.minutes;
          posees++;
          noms.add(jour);
          return;
        }
        if (!raisonRefus) raisonRefus = v.erreurs[0]?.message ?? '';
      }
      if (abandons.length < 12) abandons.push(`Semaine ${w + 1}, ${etiquetteDate(choisis[i])} : je n'ai pas pu placer « ${s.detail.nom} » (${raisonRefus.replace(/\.$/, '')}).`);
    });
    lignesSemaines.push(`Semaine ${w + 1} (${du}) : ${NOM_PHASE[phase]}${recuperation ? ', récupération' : ''}, ${posees} séance${posees > 1 ? 's' : ''}, ${totalSemaine} min`);
  }

  const bilan: Bilan = { km, jours, semaines: nSemaines, niveau, realiste, cible, objectifPlan, verdict, allures: a, seancesParSemaine: k, imposees, test: avecTest, niveauFiabilite: niveau?.fiabilite ?? null };
  return { operations, abandons, semaines: lignesSemaines, bilan, message: messageBilan(bilan) };
}

/** Les phrases honnêtes sur le niveau, l'objectif et les allures, écrites par le code (le modèle les reprend, il ne les invente pas) */
export function messageBilan(b: Bilan): string {
  const parts: string[] = [];
  if (b.niveau) parts.push(`Niveau estimé aujourd'hui sur ${b.km} km : ${formaterTemps(b.niveau.secondes)} (d'après ${b.niveau.source}).`);
  if (b.niveauFiabilite === 'ancienne') parts.push("Attention : je n'ai AUCUNE sortie récente, cette estimation est très fragile (on a pu perdre beaucoup de niveau).");
  else if (b.niveauFiabilite === 'recente') parts.push("Cette estimation vient de tes sorties récentes, qui ne sont pas des efforts maximaux : elle reste à confirmer.");
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
  parts.push(`Plan à ${b.seancesParSemaine} séances par semaine (à garder identique si tu refais le plan, sauf demande de l'utilisateur).`);
  if (b.allures) {
    parts.push(`Allures (par km) : ${ALLURES_CLES.map((c) => `${NOM_ALLURE[c]} ${formaterAllure(b.allures![c])}`).join(', ')}.`);
    if (b.imposees.length) parts.push(`Allures imposées par l'utilisateur : ${b.imposees.map((c) => NOM_ALLURE[c]).join(', ')}.`);
  }
  return parts.join(' ');
}
