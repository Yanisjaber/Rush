// ============================================================
// Préparer une COURSE de vélo ou de natation : « prépare-moi ma cyclosportive du 14 juin », « mon 1500 m en eau libre le 20 septembre ».
//
// Même idée que preparer_course (course à pied) : le modèle ne donne que ce que dit l'utilisateur, le CODE construit tout.
//   - les jours, les durées, la reprise après un arrêt, la montée de charge et l'affûtage viennent de planifierPeriode (periode.ts) ;
//   - ici on ajoute ce qui fait un VRAI plan : les phases (base, développement, spécifique, affûtage), le contenu CHIFFRÉ de chaque séance
//     (« 3 × 10 min à 262-285 W, récup 4 min », « 8 × 100 m à 1:32/100 m, repos 15 s ») et son but, calibré sur la personne.
//
// Calibrage, jamais inventé :
//   - vélo : la FTP vient de la courbe de puissance (95 % de la meilleure puissance sur 20 min sur 24 mois, convention de Coggan), ou de la valeur donnée.
//     Sans l'une ni l'autre, la première séance du plan est un TEST de 20 minutes et les blocs restent en % de FTP (l'app les traduit en watts dès qu'elle la connaît) ;
//   - natation : l'allure critique (CSS) vient d'un test 400 m / 200 m : CSS = (t400 − t200) / 2 par 100 m. Sans test, la première séance du plan EN EST UN.
//     Les séances d'avant test utilisent l'allure moyenne de ses séances courtes comme repère, signalée comme estimée.
//   Quand la personne donne son résultat, on rappelle l'outil : tout le plan est recalibré (comme pour la course à pied).
//
// LES RÉPARTITIONS ET LES DURÉES DE BLOCS CI-DESSOUS SONT DES CONVENTIONS À NOUS (repères d'entraîneurs, pas des résultats d'étude) : elles sont
// regroupées dans les tables en haut du fichier pour être relues et changées d'un seul endroit.
// ============================================================
import { ajouterJours, ecartJours } from './dates-iso.ts';
import type { Operation, SeancePrevue, DetailSeance } from './planning.ts';
import { planifierPeriode } from './periode.ts';
import type { habitudesDepuisResume } from './semaine.ts';
import type { ContexteValidation } from './validateur.ts';
import type { ProfilCoureur } from './profil-coureur.ts';
import type { BlocStructure } from './structure-seance.ts';
import type { VieSport } from './analyse-sport.ts';
import { formaterAllure, NOM_PHASE } from './plan-course.ts';
import type { Phase } from './plan-course.ts';

export type SportEndurance = 'velo' | 'natation';

export interface DemandeEndurance {
  sport: SportEndurance;
  /** Le jour de la course (le plan s'arrête la veille) */
  date: string;
  seancesParSemaine: number;
  debut?: string;
  joursLibres?: string[];
  /** Distance de la course : vélo en km, natation en km aussi (1,5 = 1 500 m) */
  distanceKm?: number;
  tempsCibleMinutes?: number;
  /** FTP donnée par la personne, en watts (vélo) */
  ftp?: number;
  /** Test 400 m / 200 m, en secondes (natation) */
  test?: { t400: number; t200: number };
  sansTest?: boolean;
}

export interface ResultatEndurance {
  operations: Operation[];
  abandons: string[];
  semaines: string[];
  profilUtilise: string[];
  /** Ce que le code dit du niveau, des phases et du test : le coach le répète tel quel */
  message: string;
}

// ---------- Conventions (à nous) ----------
/** Vélo : % de la FTP par type de séance (bas, haut) */
const PCT_VELO: Record<string, [number, number]> = {
  recuperation: [40, 55], endurance: [56, 75], sortie_longue: [56, 75], tempo: [80, 88], seuil: [95, 105], vo2max: [110, 120],
};
/** Natation : % de la vitesse critique (100 % = allure CSS) */
const PCT_NAGE: Record<string, [number, number]> = { technique: [80, 85], endurance: [90, 95], seuil: [100, 103], vitesse: [106, 110] };
/** Une épreuve est « courte » (travail de VO2max, seuil de 10 à 12 min) en dessous de ce temps visé, en minutes (vélo) */
const EPREUVE_COURTE_MIN = 75;
/** En natation : une épreuve de cette distance ou plus (km) est une épreuve de fond (séries longues à l'allure de course) */
const EPREUVE_FOND_KM = 1.5;
const TEST_VELO_MIN = 20;
const REPOS_TEST_NAGE_MIN = 5;

const arrondi1 = (x: number) => Math.round(x * 10) / 10;
const borner = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** La phase d'une semaine : les deux dernières sont l'affûtage (comme periode.ts), le reste se partage en base, développement et spécifique */
export function phaseDeLaSemaine(w: number, n: number): Phase {
  if (n - w <= 2) return 'affutage';
  const m = n - 2;
  const specifique = m >= 8 ? 3 : m >= 5 ? 2 : m >= 3 ? 1 : 0;
  const base = Math.floor((m - specifique) / 3);
  if (w < base) return 'base';
  return w < m - specifique ? 'developpement' : 'specifique';
}

interface Calibrage {
  ftp: number | null;
  ftpSource: 'donnee' | 'courbe' | null;
  css: number | null;
  cssSource: 'test' | 'seances' | null;
  /** Vrai si la valeur est mesurée (donnée, courbe de puissance ou test) : sinon la première séance est un test */
  mesure: boolean;
}

export function calibrerEndurance(d: DemandeEndurance, vie: VieSport | null): Calibrage {
  if (d.sport === 'velo') {
    if (d.ftp) return { ftp: Math.round(d.ftp), ftpSource: 'donnee', css: null, cssSource: null, mesure: true };
    const r = vie?.velo?.recent24;
    // 95 % de la puissance sur 20 min ; au moins 5 courbes sur 24 mois pour qu'elle ait un sens (même seuil que l'analyse)
    if (r?.w1200 && r.courbes >= 5) return { ftp: Math.round(0.95 * r.w1200), ftpSource: 'courbe', css: null, cssSource: null, mesure: true };
    return { ftp: null, ftpSource: null, css: null, cssSource: null, mesure: false };
  }
  if (d.test && d.test.t400 > 2 * d.test.t200 && d.test.t200 > 0) {
    const css = (d.test.t400 - d.test.t200) / 2;
    if (css >= 50 && css <= 240) return { ftp: null, ftpSource: null, css, cssSource: 'test', mesure: true };
  }
  const court = vie?.natation?.recent24?.court100 ?? null;
  return { ftp: null, ftpSource: null, css: court, cssSource: court ? 'seances' : null, mesure: false };
}

const bloc = (type: BlocStructure['type'], name: string, metric: 'power' | 'pace', min: number, lo: number, hi: number | null): BlocStructure =>
  ({ type, name, reps: 1, metric, unit: 'pct', work: { min: arrondi1(min), int: lo, intHi: hi } });

interface ContexteSeance {
  sport: SportEndurance;
  phase: Phase;
  /** Rang de la semaine DANS sa phase (0 = la première) : les blocs s'allongent d'une semaine à l'autre */
  rang: number;
  epreuveCourte: boolean;
  cal: Calibrage;
}

interface Sortie { detail: DetailSeance; but: string }

const watts = (ftp: number | null, lo: number, hi: number | null): string => (ftp ? `${Math.round((ftp * lo) / 100)}${hi ? `–${Math.round((ftp * hi) / 100)}` : ''} W` : `${lo}${hi ? `–${hi}` : ''} % de ta FTP`);
const allureNage = (css: number | null, pct: number): string => (css ? `${formaterAllure(Math.round((css * 100) / pct))}/100 m` : `${pct} % de ta vitesse critique`);

/** Échauffement et retour au calme (minutes) pour une séance de cette durée */
const echauffement = (m: number) => (m < 20 ? Math.max(2, Math.round(m * 0.2)) : Math.min(15, Math.round(m * 0.15)));
const retourAuCalme = (m: number) => (m < 20 ? Math.max(2, Math.round(m * 0.15)) : Math.min(10, Math.round(m * 0.1)));

/** Le résumé d'une séance : les noms des blocs, les intervalles avec leurs chiffres */
function resume(blocs: BlocStructure[]): string {
  return blocs.map((b) => (b.type === 'interval' ? b.name : `${Math.round(b.work.min)} min ${b.type === 'warmup' ? "d'échauffement" : b.type === 'cooldown' ? 'de retour au calme' : b.name.toLowerCase().startsWith('test') ? b.name : 'continues'}`)).join(' · ');
}

/** Durée du travail d'une répétition (minutes) pour un type de séance de vélo, selon la phase et la semaine dans la phase */
export function dureeRepVelo(type: string, c: Pick<ContexteSeance, 'phase' | 'rang' | 'epreuveCourte'>): number {
  const p = c.phase;
  if (type === 'tempo') return p === 'base' ? 12 + 2 * Math.min(c.rang, 3) : p === 'developpement' ? 15 + 2 * Math.min(c.rang, 2) : 20;
  if (type === 'seuil') {
    if (p === 'affutage') return 5;
    if (p === 'specifique') return c.epreuveCourte ? 10 + Math.min(c.rang, 2) : 15 + 2 * Math.min(c.rang, 2);
    return 8 + 2 * Math.min(c.rang, 2);
  }
  // vo2max
  return p === 'affutage' ? 3 : p === 'specifique' ? 4 : 3 + (c.rang >= 2 ? 1 : 0);
}

function seanceVelo(type: string, minutes: number, c: ContexteSeance): Sortie {
  const ftp = c.cal.ftp;
  const [lo, hi] = PCT_VELO[type] ?? PCT_VELO.endurance;
  const echauf = echauffement(minutes);
  const retour = retourAuCalme(minutes);
  const corps = minutes - echauf - retour;
  const [elo, ehi] = PCT_VELO.recuperation;
  const debut = bloc('warmup', 'Échauffement', 'power', echauf, elo + 10, 75);
  const intervalle = type === 'tempo' || type === 'seuil' || type === 'vo2max';
  if (intervalle && corps >= 2 * dureeRepVelo(type, c) + 3) {
    const t = dureeRepVelo(type, c);
    const rec = type === 'vo2max' ? t : type === 'tempo' ? 5 : Math.max(3, Math.round(t * 0.4));
    const maxReps = c.phase === 'affutage' ? 3 : 6;
    const reps = borner(Math.floor((corps + retour - 5) / (t + rec)), 1, maxReps);
    if (reps >= 2) {
      const retourFinal = minutes - echauf - reps * (t + rec);
      const nom = `${reps} × ${t} min à ${watts(ftp, lo, hi)}, récup ${rec} min`;
      const blocs: BlocStructure[] = [
        debut,
        { type: 'interval', name: nom, reps, metric: 'power', unit: 'pct', work: { min: t, int: lo, intHi: hi }, rec: { min: rec, int: elo, intHi: ehi } },
        bloc('cooldown', 'Retour au calme', 'power', retourFinal, elo, ehi),
      ];
      return { detail: { nom, structure: blocs, resume: resume(blocs) }, but: butVelo(type, c) };
    }
  }
  const nom = type === 'sortie_longue' ? `Sortie longue ${minutes} min à ${watts(ftp, lo, hi)}` : `${corps} min à ${watts(ftp, lo, hi)}`;
  // Sortie longue de la phase spécifique : des blocs à l'allure de l'épreuve dans la sortie, si elle est assez longue
  if (type === 'sortie_longue' && c.phase === 'specifique' && corps >= 110) {
    const [slo, shi] = PCT_VELO.tempo;
    const t = 20;
    const nomS = `Sortie longue ${minutes} min dont 2 × ${t} min à ${watts(ftp, slo, shi)}`;
    const avant = Math.round((corps - 2 * t - 10) / 2);
    const blocs: BlocStructure[] = [
      debut,
      bloc('steady', `${avant} min en endurance`, 'power', avant, lo, hi),
      { type: 'interval', name: `2 × ${t} min à ${watts(ftp, slo, shi)}, récup 10 min`, reps: 2, metric: 'power', unit: 'pct', work: { min: t, int: slo, intHi: shi }, rec: { min: 10, int: lo, intHi: hi } },
      bloc('steady', 'Fin en endurance', 'power', corps - avant - 2 * (t + 10), lo, hi),
      bloc('cooldown', 'Retour au calme', 'power', retour, elo, ehi),
    ];
    return { detail: { nom: nomS, structure: blocs, resume: resume(blocs) }, but: butVelo(type, c) };
  }
  const blocs: BlocStructure[] = [debut, bloc('steady', nom, 'power', corps, lo, hi), bloc('cooldown', 'Retour au calme', 'power', retour, elo, ehi)];
  return { detail: { nom, structure: blocs, resume: resume(blocs) }, but: butVelo(type, c) };
}

function butVelo(type: string, c: ContexteSeance): string {
  const ph = NOM_PHASE[c.phase];
  if (type === 'tempo') return `Phase ${ph} : du tempo en blocs longs, juste sous ton seuil, pour que tenir une allure soutenue devienne facile.`;
  if (type === 'seuil') return c.phase === 'specifique' ? `Phase ${ph} : des blocs à ta puissance de seuil, la puissance que tu tiendras le jour de l'épreuve.` : c.phase === 'affutage' ? 'Affûtage : peu de volume mais de la qualité, pour garder les jambes vives sans les fatiguer.' : `Phase ${ph} : des blocs à ta puissance de seuil, qui s'allongent d'une semaine à l'autre.`;
  if (type === 'vo2max') return `Phase ${ph} : des efforts courts très intenses pour élever ta puissance maximale aérobie.`;
  if (type === 'sortie_longue') return c.phase === 'specifique' ? `Phase ${ph} : longue sortie avec des blocs à l'allure de l'épreuve pour répéter l'effort sur des jambes déjà fatiguées.` : `Phase ${ph} : ta sortie longue, en endurance, pour bâtir le fond.`;
  return `Phase ${ph} : de l'endurance facile, pour ajouter du volume sans te fatiguer.`;
}

/** Séance de vélo test : 20 minutes à fond régulier ; la FTP = 95 % de la puissance moyenne (convention de Coggan) */
function testVelo(): Sortie {
  const [elo] = PCT_VELO.recuperation;
  const blocs: BlocStructure[] = [
    bloc('warmup', 'Échauffement progressif', 'power', 15, elo + 10, 85),
    bloc('steady', 'Test : 20 minutes aussi fort que tu peux tenir, régulier', 'power', TEST_VELO_MIN, 95, 105),
    bloc('cooldown', 'Retour au calme', 'power', 10, elo, 55),
  ];
  return {
    detail: { nom: 'Test de puissance : 20 minutes à fond régulier', structure: blocs, resume: "15 min d'échauffement · 20 min à fond mais régulier (note ta puissance moyenne) · 10 min de retour au calme" },
    but: "Ta première sortie : elle mesure ta FTP. Roule 20 minutes aussi fort que tu peux tenir, en restant régulier (pars prudent), et donne-moi ta puissance moyenne : ta FTP vaut 95 % de ce chiffre, je recalibre tout le plan dessus.",
  };
}

/** Une série de natation : distance (m), repos (s), % de la vitesse critique */
interface SerieNage { dist: number; repos: number; pct: [number, number] }

function serieNage(type: string, c: ContexteSeance): SerieNage {
  const [lo, hi] = PCT_NAGE[type] ?? PCT_NAGE.seuil;
  if (type === 'vitesse') return { dist: 50, repos: 30, pct: [lo, hi] };
  const fond = !c.epreuveCourte;
  if (c.phase === 'specifique' && fond) return { dist: 400, repos: 30, pct: [lo, hi] };
  if (c.phase === 'affutage') return { dist: 100, repos: 30, pct: [lo, hi] };
  if (c.phase === 'developpement' || c.phase === 'specifique') return { dist: fond ? 200 : 100, repos: fond ? 20 : 15, pct: [lo, hi] };
  return { dist: 100, repos: 15, pct: [lo, hi] };
}

function seanceNatation(type: string, minutes: number, c: ContexteSeance): Sortie {
  const css = c.cal.css;
  const [lo, hi] = PCT_NAGE[type] ?? PCT_NAGE.endurance;
  const echauf = echauffement(minutes);
  const retour = retourAuCalme(minutes);
  const corps = minutes - echauf - retour;
  const [tlo, thi] = PCT_NAGE.technique;
  const debut = bloc('warmup', 'Échauffement souple', 'pace', echauf, tlo, thi);
  if (type === 'seuil' || type === 'vitesse') {
    const s = serieNage(type, c);
    // Sans allure connue, 2:00/100 m sert seulement à donner une durée aux séries (les chiffres affichés restent en % de la vitesse critique)
    const allure = ((css ?? 120) * 100) / s.pct[0]; // s / 100 m
    const tour = (s.dist / 100) * allure / 60 + s.repos / 60;
    const reps = borner(Math.floor((corps + retour - 3) / tour), 1, 20);
    if (reps >= 2) {
      const travail = arrondi1((s.dist / 100) * allure / 60);
      const rec = arrondi1(s.repos / 60);
      const retourFinal = arrondi1(minutes - echauf - reps * (travail + rec));
      const nom = `${reps} × ${s.dist} m à ${allureNage(css, s.pct[0])}, repos ${s.repos} s`;
      const blocs: BlocStructure[] = [
        debut,
        { type: 'interval', name: nom, reps, metric: 'pace', unit: 'pct', work: { min: travail, int: s.pct[0], intHi: s.pct[1] }, rec: { min: rec, int: tlo, intHi: thi } },
        bloc('cooldown', 'Retour au calme', 'pace', retourFinal, tlo, thi),
      ];
      return { detail: { nom, structure: blocs, resume: resume(blocs) }, but: butNage(type, c) };
    }
  }
  const nom = type === 'technique' ? `${corps} min de technique (éducatifs, nage lente)` : `${corps} min en continu à ${allureNage(css, lo)}`;
  const blocs: BlocStructure[] = [debut, bloc('steady', nom, 'pace', corps, lo, hi), bloc('cooldown', 'Retour au calme', 'pace', retour, tlo, thi)];
  return { detail: { nom, structure: blocs, resume: resume(blocs) }, but: butNage(type, c) };
}

function butNage(type: string, c: ContexteSeance): string {
  const ph = NOM_PHASE[c.phase];
  if (type === 'seuil') return c.phase === 'specifique' ? `Phase ${ph} : des séries à ton allure critique, celle que tu tiendras en course.` : c.phase === 'affutage' ? 'Affûtage : peu de volume, de la qualité, pour arriver frais.' : `Phase ${ph} : des séries à ton allure critique, avec peu de repos, pour la tenir plus longtemps.`;
  if (type === 'vitesse') return `Phase ${ph} : des 50 m rapides avec beaucoup de repos pour travailler la vitesse sans s'épuiser.`;
  if (type === 'technique') return `Phase ${ph} : de la technique, nager mieux coûte moins d'énergie.`;
  return `Phase ${ph} : de l'endurance en continu, pour bâtir le fond.`;
}

/** Séance test de natation : 400 m puis 200 m à fond régulier, avec un repos entre les deux. CSS = (t400 − t200) / 2 par 100 m */
function testNatation(css: number | null): Sortie {
  // Durées estimées pour que la séance ait une durée : à 2:00/100 m si on ne sait rien
  const p = css ?? 120;
  const m400 = arrondi1((4 * p) / 60);
  const m200 = arrondi1((2 * p) / 60);
  const [tlo, thi] = PCT_NAGE.technique;
  const blocs: BlocStructure[] = [
    bloc('warmup', 'Échauffement : 400 m souple + 4 × 50 m progressifs', 'pace', 12, tlo, thi),
    bloc('steady', 'Test 400 m : aussi vite que tu peux, régulier (note ton temps)', 'pace', m400, 100, 110),
    bloc('recovery', 'Repos : 5 min de nage très lente ou de pause', 'pace', REPOS_TEST_NAGE_MIN, tlo, thi),
    bloc('steady', 'Test 200 m : aussi vite que tu peux, régulier (note ton temps)', 'pace', m200, 100, 110),
    bloc('cooldown', 'Retour au calme', 'pace', 5, tlo, thi),
  ];
  return {
    detail: { nom: 'Test 400 m / 200 m', structure: blocs, resume: '400 m souple + 4 × 50 m progressifs · 400 m chrono · 5 min de repos · 200 m chrono · 5 min de retour au calme' },
    but: "Ta première séance : elle mesure ton allure critique. Nage le 400 m puis, après 5 minutes de repos, le 200 m, chacun aussi vite que tu peux tenir en restant régulier. Donne-moi les deux temps : ton allure critique vaut (temps du 400 − temps du 200) / 2 par 100 m, et je recalibre tout le plan dessus.",
  };
}

const dureeBlocs = (b: BlocStructure[]) => b.reduce((t, x) => t + x.reps * x.work.min + (x.type === 'interval' && x.rec ? x.reps * x.rec.min : 0), 0);

/** La fenêtre de planification : premier jour réel du plan (comme periode.ts) */
const premierJour = (d: DemandeEndurance, aujourdhui: string) => (d.debut && d.debut > aujourdhui ? d.debut : d.debut === aujourdhui ? aujourdhui : ajouterJours(aujourdhui, 1));

export function planifierEndurance(
  d: DemandeEndurance, seances: SeancePrevue[], base: ContexteValidation,
  habitudes: ReturnType<typeof habitudesDepuisResume>, coureur: ProfilCoureur | null, vie: VieSport | null,
): ResultatEndurance {
  const nom = d.sport === 'velo' ? 'vélo' : 'natation';
  const periode = planifierPeriode(
    { sports: [{ sport: d.sport, seances: d.seancesParSemaine }], objectif: d.date, ...(d.debut ? { debut: d.debut } : {}), ...(d.joursLibres ? { joursLibres: d.joursLibres } : {}) },
    seances, base, habitudes, coureur,
  );
  if (!periode.operations.length) return { ...periode, message: periode.abandons.join(' ') };

  const debut = premierJour(d, base.aujourdhui);
  const nSemaines = Math.ceil(ecartJours(debut, d.date) / 7);
  const cal = calibrerEndurance(d, vie);
  const etat = habitudes[d.sport].analyse?.etat ?? null;
  const epreuveCourte = d.sport === 'velo' ? (d.tempsCibleMinutes ?? (d.distanceKm ? (d.distanceKm / 30) * 60 : 999)) <= EPREUVE_COURTE_MIN : (d.distanceKm ?? 0) < EPREUVE_FOND_KM;

  // Le rang de la semaine dans sa phase (0 = première semaine de la phase)
  const premiere = new Map<Phase, number>();
  for (let w = 0; w < nSemaines; w++) { const p = phaseDeLaSemaine(w, nSemaines); if (!premiere.has(p)) premiere.set(p, w); }
  const semaineDe = (date: string) => Math.floor(ecartJours(debut, date) / 7);

  // Test en première séance, si rien n'est mesuré (jamais pendant une reprise après arrêt : pas de test à fond sur un corps qui reprend)
  const testAFaire = !cal.mesure && !d.sansTest && etat !== 'reprise' && nSemaines >= 2;
  const ajouts = periode.operations.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter').sort((a, b) => a.proposition.date.localeCompare(b.proposition.date));
  let testPose = false;
  for (const o of ajouts) {
    const w = borner(semaineDe(o.proposition.date), 0, nSemaines - 1);
    const phase = phaseDeLaSemaine(w, nSemaines);
    const c: ContexteSeance = { sport: d.sport, phase, rang: w - (premiere.get(phase) ?? w), epreuveCourte, cal };
    const recup = o.phase === 'Récupération';
    let s: Sortie;
    if (testAFaire && !testPose) {
      s = d.sport === 'velo' ? testVelo() : testNatation(cal.css);
      o.proposition.type = 'seuil';
      o.proposition.minutes = Math.round(dureeBlocs(s.detail.structure));
      testPose = true;
    } else {
      s = d.sport === 'velo' ? seanceVelo(o.proposition.type, o.proposition.minutes, c) : seanceNatation(o.proposition.type, o.proposition.minutes, c);
    }
    o.detail = s.detail;
    o.justification = s.but;
    o.phase = recup ? 'Récupération' : NOM_PHASE[phase].charAt(0).toUpperCase() + NOM_PHASE[phase].slice(1);
  }

  const semaines = periode.semaines.map((l, w) => `${l} — phase ${NOM_PHASE[phaseDeLaSemaine(w, nSemaines)]}`);
  const comptePhases = new Map<Phase, number>();
  for (let w = 0; w < nSemaines; w++) comptePhases.set(phaseDeLaSemaine(w, nSemaines), (comptePhases.get(phaseDeLaSemaine(w, nSemaines)) ?? 0) + 1);
  const phrasePhases = [...comptePhases].map(([p, n]) => `${n} semaine${n > 1 ? 's' : ''} ${p === 'affutage' ? "d'" : 'de '}${NOM_PHASE[p]}`).join(', ');

  const lignes: string[] = [`Plan de ${nSemaines} semaine${nSemaines > 1 ? 's' : ''} en ${nom} : ${phrasePhases}.`];
  if (d.sport === 'velo') {
    if (cal.ftp) lignes.push(`Ta FTP de départ : ${cal.ftp} W (${cal.ftpSource === 'donnee' ? 'celle que tu m\'as donnée' : '95 % de ta meilleure puissance sur 20 min ces 24 derniers mois'}). Les puissances des séances s'en déduisent.`);
    else if (testPose) lignes.push('Je ne connais pas ta FTP : ta première séance est un test de 20 minutes. Donne-moi ta puissance moyenne dessus (FTP = 95 % de ce chiffre) et je recalibre tout le plan en watts. En attendant, les blocs sont en % de FTP.');
    else lignes.push('Je ne connais pas ta FTP : les blocs sont en % de FTP (l\'app les traduit en watts dès qu\'elle la connaît).');
  } else {
    if (cal.cssSource === 'test') lignes.push(`Ton allure critique : ${formaterAllure(Math.round(cal.css as number))}/100 m (calculée sur ton test 400 m / 200 m).`);
    else if (testPose) lignes.push(`Je ne connais pas ton allure critique${cal.css ? ` (je pars de ${formaterAllure(Math.round(cal.css))}/100 m, l'allure moyenne de tes séances courtes : une estimation)` : ''} : ta première séance est un test 400 m puis 200 m. Donne-moi les deux temps (allure critique = (temps du 400 − temps du 200) / 2 par 100 m) et je recalibre tout le plan.`);
    else lignes.push('Je ne connais pas ton allure critique : les séries sont en % de ta vitesse critique, à recalibrer avec un test 400 m / 200 m.');
  }
  if (etat === 'reprise') lignes.push(`Tu reprends le ${nom} après un arrêt : le plan démarre bas, sans intensité, et monte par paliers (les blocs durs ne viennent que plus tard).`);
  if (d.sport === 'natation' && !d.distanceKm) lignes.push("Je n'ai pas la distance de l'épreuve : j'ai prévu une épreuve courte ; dis-la-moi si c'est du fond (1,5 km et plus).");
  return { operations: periode.operations, abandons: periode.abandons, semaines, profilUtilise: periode.profilUtilise, message: lignes.join(' ') };
}
