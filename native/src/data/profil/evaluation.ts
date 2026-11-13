// L'évaluation physiologique : la valeur de chaque repère (séances, montre ou saisie), sa note sur 100, la note de chaque
// domaine et le niveau global. 100 = le meilleur mondial du même sexe, 0 = 0 : note = valeur ÷ référence × 100 (inversé quand
// plus bas est mieux), bornée à 0-100. Un repère sans valeur ne compte pas ; un domaine sans repère non plus.
// Fonctions pures, sans réseau : les données arrivent déjà chargées (voir hooks/useEvaluation.ts).
import { classementAllureNatation } from '../bilan/records-natation.ts';
import type { ActiviteBilan } from '../bilan/bilan.ts';
import type { PointCourbe } from '../bilan/records.ts';
import type { MesuresParJour } from '../sante/sante-catalogue.ts';
import type { Nuit, Profil, Seance, SerieForce } from '../types.ts';
import { DOMAINES, REPERES, type DefRepere, type Domaine } from './reperes.ts';

/** D'où vient la valeur affichée : calculée sur tes séances, mesurée par ta montre, saisie, ou estimée par une formule. */
export type Provenance = 'seances' | 'montre' | 'saisi' | 'estime';

export interface ValeurRepere {
  def: DefRepere;
  valeur: number | null;
  provenance: Provenance | null;
  note: number | null;
  /** Date de la mesure (AAAA-MM-JJ) quand on la connaît. */
  date?: string;
}

export interface NoteDomaine {
  domaine: Domaine;
  note: number | null;
  reperes: ValeurRepere[];
  /** Combien de repères ont une valeur. */
  mesures: number;
}

export interface Evaluation {
  /** Niveau global sur 100, ou null si aucun repère n'a de valeur. */
  niveau: number | null;
  domaines: NoteDomaine[];
  /** Repères avec une valeur, sur le total des repères calculables (sans ceux « bientôt »). */
  mesures: number;
  total: number;
  sexe: 'homme' | 'femme';
  /** Faux quand le sexe n'est pas renseigné : on compare alors aux références hommes. */
  sexeConnu: boolean;
}

export interface EntreeEvaluation {
  profil: Profil | null | undefined;
  /** Meilleure puissance (W) par durée (s), sur la période évaluée. */
  courbePuissance?: PointCourbe[] | null;
  /** Meilleure vitesse de course (km/h) par durée (s), sur la période évaluée. */
  courseParDuree?: PointCourbe[] | null;
  /** Activités (pour la natation : séances entières). */
  activites?: ActiviteBilan[] | null;
  seriesForce?: SerieForce[] | null;
  seances?: Seance[] | null;
  mesures?: MesuresParJour | null;
  nuits?: Nuit[] | null;
  aujourdhui?: Date;
}

const nombre = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const joursAvant = (d: Date, n: number): string => iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n));
const mediane = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};
const moyenne = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** La note d'une valeur face à la référence : règle de trois, bornée à 0-100 (null si la valeur n'a pas de sens). */
export function noteRepere(valeur: number | null, reference: number, sens: 'haut' | 'bas'): number | null {
  if (valeur === null || !Number.isFinite(valeur) || reference <= 0) return null;
  if (sens === 'bas' && valeur <= 0) return null;
  const brut = sens === 'haut' ? (valeur / reference) * 100 : (reference / valeur) * 100;
  return Math.max(0, Math.min(100, Math.round(brut)));
}

/** La meilleure valeur de la courbe à cette durée (tolérance de ±15 % sur la durée), ou null. */
export function valeurCourbe(courbe: readonly PointCourbe[] | null | undefined, secondes: number): number | null {
  let meilleur: PointCourbe | null = null;
  let ecart = Infinity;
  for (const p of courbe ?? []) {
    const e = Math.abs(Math.log(p.duree / secondes));
    if (e < ecart) {
      ecart = e;
      meilleur = p;
    }
  }
  const v = meilleur && ecart <= Math.log(1.15) ? nombre(meilleur.top[0]?.valeur) : 0;
  return v > 0 ? v : null;
}

/**
 * Puissance critique (W) et W' (J) par le modèle à deux paramètres : le travail (P × t) est une droite du temps,
 * pente = CP, ordonnée à l'origine = W'. Sur les meilleurs efforts de 3 à 20 min ; null s'il y a moins de 3 points ou un résultat absurde.
 */
export function puissanceCritique(courbe: readonly PointCourbe[] | null | undefined): { cp: number; wPrime: number } | null {
  const pts = (courbe ?? []).filter((p) => p.duree >= 180 && p.duree <= 1200 && nombre(p.top[0]?.valeur) > 0).map((p) => ({ t: p.duree, w: nombre(p.top[0].valeur) * p.duree }));
  if (pts.length < 3) return null;
  const mt = moyenne(pts.map((p) => p.t)) as number;
  const mw = moyenne(pts.map((p) => p.w)) as number;
  const sxx = pts.reduce((s, p) => s + (p.t - mt) ** 2, 0);
  if (sxx <= 0) return null;
  const cp = pts.reduce((s, p) => s + (p.t - mt) * (p.w - mw), 0) / sxx;
  const wPrime = mw - cp * mt;
  return cp > 0 && wPrime > 0 && wPrime < 100000 ? { cp, wPrime } : null;
}

/** La mesure la plus récente de `cle` dans les mesures de santé, avec sa date. */
export function derniereMesure(mesures: MesuresParJour | null | undefined, cle: string): { valeur: number; date: string } | null {
  const dates = Object.keys(mesures ?? {}).sort().reverse();
  for (const date of dates) {
    const v = mesures?.[date]?.[cle];
    if (typeof v === 'number' && Number.isFinite(v)) return { valeur: v, date };
  }
  return null;
}

/** « 1:32 » (min:s pour 100 m) → km/h ; null si illisible. */
function cssEnKmh(brut: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(brut ?? '').trim());
  if (!m) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return s > 0 ? 360 / s : null;
}

/** Meilleur 1RM estimé (Epley, 1 à 12 répétitions) d'un exercice du carnet depuis `depuis`. */
function rmCarnet(series: readonly SerieForce[], exercice: string, depuis: string): { valeur: number; date: string } | null {
  let best: { valeur: number; date: string } | null = null;
  for (const s of series) {
    const kg = nombre(s.weight_kg);
    const reps = nombre(s.reps);
    const date = String(s.date).slice(0, 10);
    if (s.exercise_key !== exercice || kg <= 0 || reps < 1 || reps > 12 || date < depuis) continue;
    const rm = kg * (1 + reps / 30);
    if (!best || rm > best.valeur) best = { valeur: rm, date };
  }
  return best;
}

/** Meilleur nombre de répétitions au poids du corps (sans lest) d'un exercice du carnet. */
function repsCarnet(series: readonly SerieForce[], exercice: string, depuis: string): { valeur: number; date: string } | null {
  let best: { valeur: number; date: string } | null = null;
  for (const s of series) {
    const date = String(s.date).slice(0, 10);
    if (s.exercise_key !== exercice || nombre(s.weight_kg) > 0 || date < depuis) continue;
    const reps = nombre(s.reps);
    if (reps > 0 && (!best || reps > best.valeur)) best = { valeur: reps, date };
  }
  return best;
}

type Trouvee = { valeur: number; provenance: Provenance; date?: string } | null;
const premier = (...candidats: Trouvee[]): Trouvee => candidats.find((c) => c && Number.isFinite(c.valeur) && c.valeur > 0) ?? null;
const de = (valeur: number | null | undefined, provenance: Provenance, date?: string): Trouvee => (valeur && valeur > 0 ? { valeur, provenance, date } : null);
const deMesure = (m: { valeur: number; date: string } | null, provenance: Provenance = 'saisi'): Trouvee => (m ? { valeur: m.valeur, provenance, date: m.date } : null);

export function evaluer(entree: EntreeEvaluation): Evaluation {
  const aujourdhui = entree.aujourdhui ?? new Date();
  const profil = entree.profil;
  const extras = (profil?.extras && typeof profil.extras === 'object' ? profil.extras : {}) as Record<string, unknown>;
  const sexeBrut = String(extras.sex ?? '');
  const sexe: 'homme' | 'femme' = sexeBrut === 'F' ? 'femme' : 'homme';
  const mesures = entree.mesures ?? {};
  const series = entree.seriesForce ?? [];
  const depuis2Ans = joursAvant(aujourdhui, 730);

  // Le poids : la dernière pesée de moins de 90 jours, sinon celui du profil
  const pesee = derniereMesure(mesures, 'poids_kg');
  const poids = pesee && pesee.date >= joursAvant(aujourdhui, 90) ? pesee.valeur : nombre(profil?.weight) || pesee?.valeur || 0;
  const parKg = (w: number | null): number | null => (w && poids > 0 ? w / poids : null);

  // Les nuits des 30 (et 60) derniers jours
  const nuits = (entree.nuits ?? []).filter((n) => n.date >= joursAvant(aujourdhui, 60));
  const nuits30 = nuits.filter((n) => n.date >= joursAvant(aujourdhui, 30));
  const fcNuits = mediane(nuits30.map((n) => nombre(n.resting_heart_rate)).filter((v) => v > 0));
  const hrvNuits = mediane(nuits30.map((n) => nombre(n.hrv_avg)).filter((v) => v > 0));
  const sommeil = moyenne(nuits30.map((n) => nombre(n.total_sec)).filter((v) => v > 0).map((v) => v / 3600));
  const hrv7 = moyenne(nuits.filter((n) => n.date >= joursAvant(aujourdhui, 7)).map((n) => nombre(n.hrv_avg)).filter((v) => v > 0));
  const hrv60 = moyenne(nuits.map((n) => nombre(n.hrv_avg)).filter((v) => v > 0));
  const nbHrv = nuits.filter((n) => nombre(n.hrv_avg) > 0).length;

  // Le vélo : courbe de puissance
  const courbe = entree.courbePuissance ?? [];
  const p20 = valeurCourbe(courbe, 1200);
  const p5min = valeurCourbe(courbe, 300);
  const cp = puissanceCritique(courbe);
  const pma = parKg(p5min);

  // La course : meilleure vitesse par durée
  const vma = valeurCourbe(entree.courseParDuree, 360);
  const v1h = valeurCourbe(entree.courseParDuree, 3600);
  const vmaRetenue = vma ?? (nombre(extras.vma) || null);

  // La natation : séance d'au moins 1 km la plus rapide
  const nat = classementAllureNatation(entree.activites ?? [], 1000, 1)[0];

  // La régularité : jours avec au moins une séance sur 28 jours
  const debut28 = joursAvant(aujourdhui, 27);
  const jours = new Set((entree.seances ?? []).map((s) => String(s.start_date_local).slice(0, 10)).filter((d) => d >= debut28 && d <= iso(aujourdhui))).size;

  const vo2Estimee = Math.max(pma ? 10.8 * pma + 7 : 0, vmaRetenue ? 3.5 * vmaRetenue : 0);
  const rm = (test: string, exercice: string): Trouvee => {
    const t = deMesure(derniereMesure(mesures, test));
    const c = rmCarnet(series, exercice, depuis2Ans);
    const choisi = t ?? (c ? { valeur: c.valeur, provenance: 'estime' as Provenance, date: c.date } : null);
    return choisi && poids > 0 ? { ...choisi, valeur: choisi.valeur / poids } : null;
  };
  const taille = nombre(extras.height);
  const tour = derniereMesure(mesures, 'tour_taille_cm');
  const muscle = derniereMesure(mesures, 'masse_musculaire_kg');
  const lthr = nombre(profil?.lthr);
  const fcMax = nombre(profil?.hr_max);

  const trouver: Record<string, () => Trouvee> = {
    vo2max: () => premier(deMesure(derniereMesure(mesures, 'test_vo2max')), de(Math.max(nombre(extras.vo2max_bike), nombre(extras.vo2max_run)), 'saisi'), de(vo2Estimee, 'estime')),
    fc_repos: () => premier(de(fcNuits, 'montre'), de(nombre(extras.rhr), 'saisi')),
    hrv: () => premier(de(hrvNuits, 'montre'), de(nombre(extras.hrv_baseline), 'saisi')),
    recup_fc: () => deMesure(derniereMesure(mesures, 'test_recup_fc')),
    sv1: () => deMesure(derniereMesure(mesures, 'test_sv1_pct')),
    sv2: () => deMesure(derniereMesure(mesures, 'test_sv2_pct')),
    ftp: () => premier(de(parKg(p20 ? p20 * 0.95 : null), 'seances'), de(parKg(nombre(profil?.ftp) || null), 'saisi')),
    cp: () => premier(de(parKg(cp?.cp ?? null), 'seances'), de(parKg(nombre(extras.cp) || null), 'saisi')),
    vitesse_seuil: () => premier(de(v1h, 'seances'), de(nombre(extras.threshold_speed), 'saisi')),
    seuil_fc: () => (lthr > 0 && fcMax > 0 ? { valeur: (lthr / fcMax) * 100, provenance: 'saisi' } : null),
    natation_seuil: () => premier(nat ? { valeur: nat.valeur, provenance: 'seances', date: nat.iso.slice(0, 10) } : null, de(cssEnKmh(extras.css), 'saisi')),
    durabilite: () => null,
    pma: () => de(pma, 'seances'),
    vma: () => premier(de(vma, 'seances'), de(nombre(extras.vma), 'saisi')),
    p5s: () => de(parKg(valeurCourbe(courbe, 5)), 'seances'),
    p1min: () => de(parKg(valeurCourbe(courbe, 60)), 'seances'),
    wprime: () => premier(de(cp ? cp.wPrime / 1000 : null, 'seances'), de(nombre(extras.wprime), 'saisi')),
    sprint30: () => deMesure(derniereMesure(mesures, 'test_sprint30_s')),
    nat100: () => deMesure(derniereMesure(mesures, 'test_nat100_s')),
    cmj: () => deMesure(derniereMesure(mesures, 'test_cmj_cm')),
    saut_longueur: () => deMesure(derniereMesure(mesures, 'test_saut_long_cm')),
    squat: () => rm('test_rm_squat_kg', 'squat'),
    developpe_couche: () => rm('test_rm_dc_kg', 'developpe-couche'),
    souleve_de_terre: () => rm('test_rm_sdt_kg', 'souleve-de-terre'),
    developpe_militaire: () => rm('test_rm_dm_kg', 'developpe-militaire'),
    tractions: () => premier(deMesure(derniereMesure(mesures, 'test_tractions')), deMesure(repsCarnet(series, 'tractions', depuis2Ans))),
    pompes: () => premier(deMesure(derniereMesure(mesures, 'test_pompes')), deMesure(repsCarnet(series, 'pompes', depuis2Ans))),
    prehension: () => deMesure(derniereMesure(mesures, 'test_prehension_kg')),
    gainage: () => deMesure(derniereMesure(mesures, 'test_gainage_s')),
    squats_1min: () => deMesure(derniereMesure(mesures, 'test_squats_1min')),
    masse_grasse: () => deMesure(derniereMesure(mesures, 'masse_grasse_pct')),
    tour_taille: () => (tour && taille > 0 ? { valeur: tour.valeur / taille, provenance: 'saisi', date: tour.date } : null),
    part_muscle: () => (muscle && poids > 0 ? { valeur: (muscle.valeur / poids) * 100, provenance: 'saisi', date: muscle.date } : null),
    sommeil: () => de(sommeil, 'montre'),
    hrv_tendance: () => (hrv7 && hrv60 && nbHrv >= 14 ? { valeur: (hrv7 / hrv60) * 100, provenance: 'montre' } : null),
    regularite: () => (entree.seances ? { valeur: jours, provenance: 'seances' } : null),
  };

  const valeurs: ValeurRepere[] = REPERES.map((def) => {
    const t = def.aVenir ? null : (trouver[def.cle]?.() ?? null);
    const reference = sexe === 'femme' ? def.ref.femme : def.ref.homme;
    return { def, valeur: t?.valeur ?? null, provenance: t?.provenance ?? null, date: t?.date, note: t ? noteRepere(t.valeur, reference, def.sens) : null };
  });

  const domaines: NoteDomaine[] = DOMAINES.map((domaine) => {
    const reperes = valeurs.filter((v) => v.def.domaine === domaine.cle);
    const notes = reperes.map((v) => v.note).filter((n): n is number => n !== null);
    const m = moyenne(notes);
    return { domaine, reperes, mesures: notes.length, note: m === null ? null : Math.round(m) };
  });

  const comptes = domaines.filter((d) => d.note !== null);
  const poidsTotal = comptes.reduce((s, d) => s + d.domaine.poids, 0);
  const niveau = poidsTotal > 0 ? Math.round(comptes.reduce((s, d) => s + (d.note as number) * d.domaine.poids, 0) / poidsTotal) : null;

  return {
    niveau,
    domaines,
    mesures: valeurs.filter((v) => v.note !== null).length,
    total: REPERES.filter((r) => !r.aVenir).length,
    sexe,
    sexeConnu: sexeBrut === 'M' || sexeBrut === 'F',
  };
}

/** Une valeur écrite à la française avec ses décimales : « 3,96 ». */
export function texteValeur(v: ValeurRepere): string {
  if (v.valeur === null) return '—';
  return v.valeur.toFixed(v.def.decimales).replace('.', ',');
}

export const LIBELLE_PROVENANCE: Record<Provenance, string> = { seances: 'tes séances', montre: 'ta montre', saisi: 'saisi', estime: 'estimé' };

/** Deux courbes de meilleurs efforts réunies : pour chaque durée, la meilleure des deux (l'année en cours et la précédente). */
export function fusionnerCourbes(a: readonly PointCourbe[] | null | undefined, b: readonly PointCourbe[] | null | undefined): PointCourbe[] {
  const parDuree = new Map<number, PointCourbe>();
  for (const p of [...(a ?? []), ...(b ?? [])]) {
    const avant = parDuree.get(p.duree);
    if (!avant || nombre(p.top[0]?.valeur) > nombre(avant.top[0]?.valeur)) parDuree.set(p.duree, p);
  }
  return [...parDuree.values()].sort((x, y) => x.duree - y.duree);
}
