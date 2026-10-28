// Bilan annuel : cumuls, comparaison avec l'an dernier, objectifs de l'année, records. Fonctions pures, sans réseau.
//
// Une « activité » de bilan est normalisée : { id, name, iso, sport, duree_min, distance_km, d_plus, tss }
// où `sport` est une famille de bilan : 'cyclisme' | 'course' | 'natation' | 'musculation' | 'autre'.
import { familleAffichage } from '../sports/familles.ts';
import { intensiteDeCharge, type CaseRegularite } from './synthese.ts';
import type { Seance } from '../types.ts';

export type SportBilan = 'cyclisme' | 'course' | 'natation' | 'musculation' | 'hyrox' | 'triathlon' | 'duathlon' | 'autre';

/** Une activité de bilan : la ligne de la base ramenée à ce dont le bilan a besoin. */
export interface ActiviteBilan {
  id: string;
  name: string;
  iso: string;
  sport: SportBilan;
  famille: string;
  duree_min: number;
  distance_km: number;
  d_plus: number;
  tss: number;
}

export const SPORTS_BILAN: [SportBilan, string][] = [
  ['cyclisme', 'Cyclisme'],
  ['course', 'Course à pied'],
  ['natation', 'Natation'],
  ['musculation', 'Musculation'],
  ['hyrox', 'Hyrox'],
  ['triathlon', 'Triathlon'],
  ['duathlon', 'Duathlon'],
  ['autre', 'Autre'],
];
export const NOM_SPORT_BILAN: Record<string, string> = { ...Object.fromEntries(SPORTS_BILAN), tous: 'Tous sports' };

/** Famille de bilan d'un type de sport brut (Strava) : vélo → cyclisme, course → course, etc. */
export function familleBilan(sportBrut: unknown): SportBilan {
  const f = familleAffichage(sportBrut);
  if (f === 'velo') return 'cyclisme';
  if (f === 'course') return 'course';
  if (f === 'natation') return 'natation';
  if (f === 'muscu') return 'musculation';
  if (f === 'hyrox' || f === 'triathlon' || f === 'duathlon') return f;
  return 'autre';
}

/** Famille de bilan correspondant à un filtre global de sport (« velo » → cyclisme, « muscu » → musculation…), ou null pour « tout ». */
export function familleBilanDuFiltre(filtre: string | null | undefined): string | null {
  if (!filtre || filtre === 'tout') return null;
  if (filtre === 'velo') return 'cyclisme';
  if (filtre === 'muscu') return 'musculation';
  if (['course', 'natation', 'hyrox', 'triathlon', 'duathlon'].includes(filtre)) return filtre;
  return 'autre';
}

/** Ligne de la table activities → activité de bilan. */
export function normaliser(l: Pick<Seance, 'id' | 'name' | 'sport' | 'start_date_local' | 'moving_time' | 'distance_km' | 'total_elevation_gain' | 'tss'>): ActiviteBilan {
  return {
    id: l.id,
    name: l.name || '',
    iso: String(l.start_date_local || '').slice(0, 10),
    sport: familleBilan(l.sport),
    famille: familleAffichage(l.sport), // famille du filtre global de l'en-tête
    duree_min: (Number(l.moving_time) || 0) / 60,
    distance_km: Number(l.distance_km) || 0,
    d_plus: Number(l.total_elevation_gain) || 0,
    tss: Number(l.tss) || 0,
  };
}

// --- Périodes -------------------------------------------------------------------------------------------------------------

const dateDe = (iso: string) => new Date(`${iso}T12:00:00`);
const debutAnnee = (annee: number) => `${annee}-01-01`;
const jourDeLAnnee = (d: Date) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86400000); // 0 = 1er janvier
const estBissextile = (a: number): boolean => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
/** Place d'un jour dans la grille de 366 cases d'une année bissextile : le 29 février a sa case même les années ordinaires, pour que le 1er mars tombe toujours au même endroit. */
const indexGrille = (d: Date): number => {
  const j = jourDeLAnnee(d);
  return !estBissextile(d.getFullYear()) && j >= 59 ? j + 1 : j;
};
const dateIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Activités de l'année : du 1er janvier à aujourd'hui pour l'année en cours, l'année entière sinon. */
export function activitesAnnee(acts: ActiviteBilan[], annee: number, maintenant: Date = new Date()): ActiviteBilan[] {
  const fin = annee === maintenant.getFullYear() ? dateIso(maintenant) : `${annee}-12-31`;
  return acts.filter((a) => a.iso >= debutAnnee(annee) && a.iso <= fin);
}

/** Activités de l'année précédente jusqu'à la même date (année en cours : même jour et même mois) ou jusqu'à son 31 décembre. */
export function activitesAnneePrecedente(acts: ActiviteBilan[], annee: number, maintenant: Date = new Date()): ActiviteBilan[] {
  let fin = `${annee - 1}-12-31`;
  if (annee === maintenant.getFullYear()) {
    const mois = maintenant.getMonth();
    fin = dateIso(new Date(annee - 1, mois, Math.min(maintenant.getDate(), new Date(annee - 1, mois + 1, 0).getDate()), 12)); // le 29 février devient le 28
  }
  return acts.filter((a) => a.iso >= debutAnnee(annee - 1) && a.iso <= fin);
}

/** Totaux d'un groupe d'activités. */
export interface Totaux {
  distance: number;
  heures: number;
  seances: number;
  tss: number;
  d_plus: number;
}

export function sommer(acts: ActiviteBilan[]): Totaux {
  return acts.reduce(
    (t, a) => ({ distance: t.distance + a.distance_km, heures: t.heures + a.duree_min / 60, seances: t.seances + 1, tss: t.tss + a.tss, d_plus: t.d_plus + a.d_plus }),
    { distance: 0, heures: 0, seances: 0, tss: 0, d_plus: 0 },
  );
}

/** Écart en % entre deux valeurs (null si pas de référence). */
export const ecartPct = (courant: number, precedent: number): number | null => (precedent > 0 ? Math.round(((courant - precedent) / precedent) * 100) : null);

/** Années pour lesquelles il y a des activités, plus l'année en cours, de la plus récente à la plus ancienne. */
export function anneesDisponibles(acts: ActiviteBilan[], maintenant: Date = new Date()): number[] {
  const s = new Set(acts.map((a) => Number(a.iso.slice(0, 4))).filter((y) => y >= 2000));
  s.add(maintenant.getFullYear());
  return [...s].sort((a, b) => b - a);
}

// --- Catalogue des objectifs (identifiants stables : les lignes déjà enregistrées restent lisibles) -----------------
// calc : 'sum_dist' | 'sum_hours' | 'sum_sess' | 'sum_tss' | 'sum_elev' | 'max_dist' | 'max_dur' | 'max_elev_day'
//      | 'avg_sess_week' | 'avg_hours_week' | 'manual' (saisie) | 'manual_lower' (saisie, plus bas = mieux) | 'manual_proche' (saisie, le but est de s'approcher de la cible, par le haut ou par le bas : le poids)
export interface ModeleObjectif {
  id: string;
  label: string;
  unit: string;
  calc: string;
}
const o = (id: string, label: string, unit: string, calc: string): ModeleObjectif => ({ id, label, unit, calc });
export const CATALOGUE: Record<string, ModeleObjectif[]> = {
  cyclisme: [
    o('cyc_dist', 'Distance annuelle', 'km', 'sum_dist'), o('cyc_hours', 'Heures annuelles', 'h', 'sum_hours'), o('cyc_tss', 'Charge cumulée annuelle', 'TSS', 'sum_tss'),
    o('cyc_elev', 'Dénivelé cumulé annuel', 'm D+', 'sum_elev'), o('cyc_long', 'Plus longue sortie', 'km', 'max_dist'), o('cyc_bigday', 'Plus de D+ en 1 jour', 'm D+', 'max_elev_day'),
    o('cyc_sess_w', 'Séances par semaine', '/sem', 'avg_sess_week'), o('cyc_hours_w', 'Heures par semaine', 'h/sem', 'avg_hours_week'), o('cyc_ftp', 'FTP cible', 'W', 'manual'),
    o('cyc_ftp_kg', 'FTP / poids cible', 'W/kg', 'manual'), o('cyc_w20', 'Puissance 20 min cible', 'W', 'manual'), o('cyc_chrono40', '40 km CLM (chrono)', 'min', 'manual_lower'),
  ],
  course: [
    o('run_dist', 'Distance annuelle', 'km', 'sum_dist'), o('run_hours', 'Heures annuelles', 'h', 'sum_hours'), o('run_tss', 'Charge cumulée annuelle', 'TSS', 'sum_tss'),
    o('run_elev', 'Dénivelé cumulé annuel', 'm D+', 'sum_elev'), o('run_long', 'Plus longue sortie', 'km', 'max_dist'), o('run_sess_w', 'Séances par semaine', '/sem', 'avg_sess_week'),
    o('run_vma', 'VMA cible', 'km/h', 'manual'), o('run_5k', '5 km (chrono cible)', 'min', 'manual_lower'), o('run_10k', '10 km (chrono cible)', 'min', 'manual_lower'),
    o('run_semi', 'Semi-marathon cible', 'min', 'manual_lower'), o('run_mara', 'Marathon cible', 'min', 'manual_lower'), o('run_pace10', 'Allure 10 km cible', 's/km', 'manual_lower'),
  ],
  natation: [
    o('swim_dist', 'Distance annuelle', 'km', 'sum_dist'), o('swim_hours', 'Heures annuelles', 'h', 'sum_hours'), o('swim_sess_w', 'Séances par semaine', '/sem', 'avg_sess_week'),
    o('swim_100m', '100 m crawl (chrono)', 's', 'manual_lower'), o('swim_400m', '400 m crawl (chrono)', 'min', 'manual_lower'), o('swim_1500', '1500 m (chrono)', 'min', 'manual_lower'),
  ],
  musculation: [
    o('mus_sess_w', 'Séances par semaine', '/sem', 'avg_sess_week'), o('mus_hours', 'Heures annuelles', 'h', 'sum_hours'), o('mus_bench', 'Développé couché (1RM)', 'kg', 'manual'),
    o('mus_squat', 'Squat (1RM)', 'kg', 'manual'), o('mus_dead', 'Soulevé de terre (1RM)', 'kg', 'manual'), o('mus_ohp', 'Développé militaire (1RM)', 'kg', 'manual'),
    o('mus_clean', 'Épaulé (1RM)', 'kg', 'manual'), o('mus_pullup', 'Tractions max consécutives', 'reps', 'manual'), o('mus_pushup', 'Pompes max consécutives', 'reps', 'manual'),
    o('mus_dips', 'Dips max consécutifs', 'reps', 'manual'), o('mus_plank', 'Gainage durée max', 's', 'manual'), o('mus_bw', 'Poids corporel cible', 'kg', 'manual_proche'),
  ],
  hyrox: [o('hyrox_hours', 'Heures annuelles', 'h', 'sum_hours'), o('hyrox_sess_w', 'Séances par semaine', '/sem', 'avg_sess_week')],
  triathlon: [o('tri_hours', 'Heures annuelles', 'h', 'sum_hours'), o('tri_dist', 'Distance annuelle', 'km', 'sum_dist'), o('tri_sess_w', 'Séances par semaine', '/sem', 'avg_sess_week')],
  duathlon: [o('dua_hours', 'Heures annuelles', 'h', 'sum_hours'), o('dua_dist', 'Distance annuelle', 'km', 'sum_dist'), o('dua_sess_w', 'Séances par semaine', '/sem', 'avg_sess_week')],
  autre: [o('autre_hours', 'Heures annuelles', 'h', 'sum_hours'), o('autre_sess_w', 'Séances par semaine', '/sem', 'avg_sess_week'), o('autre_dist', 'Distance annuelle', 'km', 'sum_dist')],
  tous: [
    o('all_hours', 'Heures totales annuelles', 'h', 'sum_hours'), o('all_sess', 'Séances totales annuelles', '', 'sum_sess'), o('all_tss', 'Charge cumulée annuelle', 'TSS', 'sum_tss'),
    o('all_dist', 'Distance totale annuelle', 'km', 'sum_dist'), o('all_sess_w', 'Séances totales par semaine', '/sem', 'avg_sess_week'),
  ],
};
export const SPORTS_OBJECTIFS: [string, string][] = [['tous', 'Tous sports'], ...SPORTS_BILAN];

/** Modèle d'objectif (sport + identifiant), ou null s'il n'existe pas. */
export function modele(sport: string, id: string): ModeleObjectif | null {
  return Object.hasOwn(CATALOGUE, sport) ? CATALOGUE[sport].find((m) => m.id === id) || null : null;
}
/** Décimales à écrire pour la valeur d'un objectif selon son unité (heures, W/kg, rythmes par semaine, chronos : une ; km, m, TSS, séances : aucune). */
export const decimalesObjectif = (unite: string): number => (['h', 'h/sem', '/sem', 'W/kg', 'km/h', 'min', 's', 's/km'].includes(unite) ? 1 : 0);
export const estManuel = (m: ModeleObjectif | null | undefined): boolean => m?.calc === 'manual' || m?.calc === 'manual_lower' || m?.calc === 'manual_proche';
// Poids : on est « arrivé » à 2 % de la cible près
const TOLERANCE_PROCHE = 0.02;
// Un cumul grandit au fil de l'année (on peut lui tracer un rythme attendu et une projection) ; une moyenne par semaine se compare directement à sa cible
const estCumul = (m: ModeleObjectif): boolean => m.calc.startsWith('sum_');

// Avant ce moment de l'année (un peu plus d'un mois), un seul gros week-end ferait une projection absurde : on n'en montre pas
const PART_MIN_PROJECTION = 0.1;
const joursDansAnnee = (annee: number): number => (estBissextile(annee) ? 366 : 365);
const semainesEcoulees = (annee: number, maintenant: Date): number => (annee === maintenant.getFullYear() ? Math.max(1, (maintenant.getTime() - new Date(annee, 0, 1).getTime()) / (7 * 86400000)) : joursDansAnnee(annee) / 7);
const partAnnee = (annee: number, maintenant: Date): number => Math.max(0, Math.min(1, (maintenant.getTime() - new Date(annee, 0, 1).getTime()) / (joursDansAnnee(annee) * 86400000)));

/** Valeur actuelle d'un objectif, calculée sur les activités de l'année (ou la saisie pour un objectif manuel). */
/** Un objectif annuel (table yearly_goals, après versObjectif). */
export interface ObjectifAnnuel {
  id: string;
  annee: number;
  sport: string;
  template: string;
  target: number;
  currentManual?: number | null;
}

export function valeurActuelle(objectif: ObjectifAnnuel, acts: ActiviteBilan[], annee: number, maintenant: Date = new Date()): number | null {
  const m = modele(objectif.sport, objectif.template);
  if (!m) return null;
  if (estManuel(m)) return objectif.currentManual != null ? Number(objectif.currentManual) : null;
  const ciblees = activitesAnnee(objectif.sport === 'tous' ? acts : acts.filter((a) => a.sport === objectif.sport), annee, maintenant);
  const s = sommer(ciblees);
  switch (m.calc) {
    case 'sum_dist': return s.distance;
    case 'sum_hours': return s.heures;
    case 'sum_sess': return s.seances;
    case 'sum_tss': return s.tss;
    case 'sum_elev': return s.d_plus;
    case 'max_dist': return Math.max(0, ...ciblees.map((a) => a.distance_km));
    case 'max_dur': return Math.max(0, ...ciblees.map((a) => a.duree_min));
    case 'max_elev_day': {
      const parJour: Record<string, number> = {};
      for (const a of ciblees) parJour[a.iso] = (parJour[a.iso] || 0) + a.d_plus;
      return Math.max(0, ...Object.values(parJour));
    }
    case 'avg_sess_week': return s.seances / semainesEcoulees(annee, maintenant);
    case 'avg_hours_week': return s.heures / semainesEcoulees(annee, maintenant);
    default: return null;
  }
}

/**
 * Avancement d'un objectif : { actuel, cible, pct (0 à 100), enRythme, repere (% attendu à cette date, cumuls seulement), projection }.
 * Objectif « plus bas = mieux » : on progresse quand la valeur descend vers la cible.
 */
export interface Avancement {
  modele: ModeleObjectif;
  actuel: number | null;
  cible: number;
  pct: number;
  enRythme: boolean;
  repere: number | null;
  projection: number | null;
  projectionPct: number | null;
}

export function avancement(objectif: ObjectifAnnuel, acts: ActiviteBilan[], annee: number, maintenant: Date = new Date()): Avancement | null {
  const m = modele(objectif.sport, objectif.template);
  if (!m) return null;
  const actuel = valeurActuelle(objectif, acts, annee, maintenant);
  const cible = Number(objectif.target);
  let pct = 0;
  let enRythme = false;
  if (actuel != null && cible > 0) {
    if (m.calc === 'manual_lower') {
      pct = actuel > 0 ? Math.min(100, Math.max(0, (cible / actuel) * 100)) : 0;
      enRythme = actuel <= cible;
    } else if (m.calc === 'manual_proche') {
      // Sans poids de départ, la proximité dit où on en est : 85 kg pour une cible de 75 kg = 88 %, dans les deux sens
      pct = actuel > 0 ? (Math.min(actuel, cible) / Math.max(actuel, cible)) * 100 : 0;
      enRythme = Math.abs(actuel - cible) <= cible * TOLERANCE_PROCHE;
    } else {
      pct = Math.min(100, (actuel / cible) * 100);
      enRythme = estCumul(m) ? actuel >= cible * partAnnee(annee, maintenant) : actuel >= cible;
    }
  }
  let projection: number | null = null;
  if (estCumul(m) && actuel != null && annee === maintenant.getFullYear() && partAnnee(annee, maintenant) > PART_MIN_PROJECTION) {
    projection = actuel / partAnnee(annee, maintenant);
  }
  return { modele: m, actuel, cible, pct, enRythme, repere: estCumul(m) ? partAnnee(annee, maintenant) * 100 : null, projection, projectionPct: projection != null && cible > 0 ? Math.round((projection / cible) * 100) : null };
}

/** Ce qu'il faut dire d'un objectif en une phrase : où il va finir, ce qu'il manque, et si c'est bon ou à rattraper. */
export interface VerdictObjectif {
  ton: 'ok' | 'alerte' | 'neutre';
  /** Objectif déjà atteint (valeur actuelle au niveau de la cible). */
  atteint: boolean;
  /** Fin d'année prévue au rythme actuel (objectifs cumulés de l'année en cours). */
  projection: number | null;
  /** Écart positif : ce qui manque à la cible (ou ce qui la dépasse, si la projection est au-dessus). */
  ecart: number | null;
  /** Où tu devrais en être aujourd'hui (la cible × la part d'année écoulée), pour le repère. */
  attendu: number | null;
}

export function verdictObjectif(av: Avancement): VerdictObjectif {
  const attendu = av.repere != null && av.repere < 100 ? (av.cible * av.repere) / 100 : null; // pas de repère pour une année terminée
  if (av.actuel == null) return { ton: 'neutre', atteint: false, projection: null, ecart: null, attendu };
  if (av.modele.calc === 'manual_lower') return { ton: av.enRythme ? 'ok' : 'alerte', atteint: av.enRythme, projection: null, ecart: av.enRythme ? 0 : av.actuel - av.cible, attendu };
  if (av.modele.calc === 'manual_proche') return { ton: av.enRythme ? 'ok' : 'alerte', atteint: av.enRythme, projection: null, ecart: av.enRythme ? 0 : Math.abs(av.actuel - av.cible), attendu };
  const atteint = av.actuel >= av.cible;
  if (av.projection != null && !atteint) {
    return { ton: av.projection >= av.cible ? 'ok' : 'alerte', atteint, projection: av.projection, ecart: Math.abs(av.cible - av.projection), attendu };
  }
  return { ton: atteint ? 'ok' : 'alerte', atteint, projection: null, ecart: atteint ? 0 : av.cible - av.actuel, attendu };
}

/** La phrase écrite sous un objectif : où il va finir, ce qu'il manque, ou « atteint ». `fmt` écrit un nombre (décimales selon l'unité). Vide quand on n'a pas de valeur. */
export function phraseVerdict(av: Avancement, fmt: (v: number) => string): { texte: string; ton: VerdictObjectif['ton'] } {
  const v = verdictObjectif(av);
  const unite = av.modele.unit ? ` ${av.modele.unit}` : '';
  if (av.actuel == null) return { texte: '', ton: 'neutre' };
  if (v.atteint) return { texte: 'Objectif atteint', ton: 'ok' };
  if (av.modele.calc === 'manual_lower') return { texte: `Encore ${fmt(v.ecart ?? 0)}${unite} à gagner`, ton: v.ton };
  if (av.modele.calc === 'manual_proche') return { texte: `Encore ${fmt(v.ecart ?? 0)}${unite} d'écart`, ton: v.ton };
  if (v.projection != null) {
    return v.ton === 'ok'
      ? { texte: `Fin d'année prévue : ${fmt(v.projection)}${unite}, cible dépassée`, ton: 'ok' }
      : { texte: `Fin d'année prévue : ${fmt(v.projection)}${unite}, il manquerait ${fmt(v.ecart ?? 0)}${unite}`, ton: 'alerte' };
  }
  return { texte: `Il manque ${fmt(v.ecart ?? 0)}${unite}`, ton: v.ton };
}

// --- Records --------------------------------------------------------------------------------------------------------------

/** Records de volume : plus longue sortie, plus longue durée, plus grosse charge, plus de D+ en un jour. */
export interface RecordVolume {
  cle: string;
  libelle: string;
  valeur: number;
  unite: string;
  nom: string;
  iso: string;
  id: string | null;
}

export function recordsVolume(acts: ActiviteBilan[]): RecordVolume[] {
  const meilleur = (cle: 'distance_km' | 'duree_min' | 'tss') => acts.reduce<ActiviteBilan | null>((b, a) => (a[cle] > (b ? b[cle] : 0) ? a : b), null);
  const parJour: Record<string, number> = {};
  for (const a of acts) parJour[a.iso] = (parJour[a.iso] || 0) + a.d_plus;
  const [jourDplus, dplus] = Object.entries(parJour).reduce((b, e) => (e[1] > b[1] ? e : b), ['', 0]);
  const longue = meilleur('distance_km');
  const duree = meilleur('duree_min');
  const charge = meilleur('tss');
  const liste: (RecordVolume | false | null)[] = [
    longue && { cle: 'distance', libelle: 'Plus longue sortie', valeur: longue.distance_km, unite: 'km', nom: longue.name, iso: longue.iso, id: longue.id },
    duree && { cle: 'duree', libelle: 'Plus longue durée', valeur: duree.duree_min, unite: 'min', nom: duree.name, iso: duree.iso, id: duree.id },
    charge && { cle: 'tss', libelle: 'Plus grosse charge', valeur: charge.tss, unite: 'TSS', nom: charge.name, iso: charge.iso, id: charge.id },
    dplus > 0 && { cle: 'dplus', libelle: 'Plus de D+ en 1 jour', valeur: dplus, unite: 'm', nom: 'Cumul des activités du jour', iso: jourDplus, id: null },
  ];
  return liste.filter((r): r is RecordVolume => !!r);
}

/** Un record est « nouveau » s'il date de moins de 30 jours. */
export const recordRecent = (iso: string, maintenant: Date = new Date()): boolean => !!iso && maintenant.getTime() - dateDe(iso).getTime() < 30 * 86400000 && maintenant >= dateDe(iso);

// --- Séries pour les graphiques ------------------------------------------------------------------------------------------

/** Ce qu'on peut cumuler dans le graphique « Cumul sur 3 ans ». */
export type MetriqueCumul = 'distance_km' | 'd_plus' | 'seances' | 'tss' | 'heures';

/** Les mesures proposées dans le menu : le nom, l'unité écrite à côté des valeurs et la phrase lue par VoiceOver. */
export const MESURES_CUMUL: { cle: MetriqueCumul; nom: string; unite: string; phrase: string }[] = [
  { cle: 'distance_km', nom: 'Distance', unite: 'km', phrase: 'de la distance' },
  { cle: 'd_plus', nom: 'Dénivelé', unite: 'm', phrase: 'du dénivelé' },
  { cle: 'seances', nom: 'Séances', unite: 'séances', phrase: 'du nombre de séances' },
  { cle: 'tss', nom: 'Charge', unite: 'TSS', phrase: 'de la charge' },
  { cle: 'heures', nom: 'Temps', unite: 'h', phrase: 'du temps' },
];

/** Ce que vaut une activité pour la mesure choisie. */
const valeurCumul = (a: ActiviteBilan, m: MetriqueCumul): number => (m === 'd_plus' ? a.d_plus : m === 'seances' ? 1 : m === 'tss' ? a.tss : m === 'heures' ? a.duree_min / 60 : a.distance_km);

/**
 * Cumul jour par jour de la mesure choisie (distance, dénivelé, séances, charge ou temps), pour plusieurs années : { etiquettes, series: [{ annee, valeurs }] }.
 * Les étiquettes sont des dates d'une année bissextile (jj/mm). Pour l'année en cours, le cumul s'arrête aujourd'hui (null après).
 */
export function cumulParAnnee(
  acts: ActiviteBilan[],
  annees: number[],
  metrique: MetriqueCumul = 'distance_km',
  maintenant: Date = new Date(),
): { etiquettes: string[]; series: { annee: number; valeurs: (number | null)[] }[] } {
  const etiquettes = Array.from({ length: 366 }, (_, j) => dateIso(new Date(2024, 0, 1 + j, 12)));
  const series = annees.map((annee) => {
    const parJour = new Array(366).fill(0);
    for (const a of acts) {
      if (!a.iso.startsWith(`${annee}-`)) continue;
      const jour = indexGrille(dateDe(a.iso));
      if (jour >= 0 && jour < 366) parJour[jour] += valeurCumul(a, metrique);
    }
    const limite = annee === maintenant.getFullYear() ? indexGrille(maintenant) : 365;
    let cumul = 0;
    const valeurs = parJour.map((v, j) => (j > limite ? null : (cumul += v)));
    return { annee, valeurs };
  });
  return { etiquettes, series };
}

/** Heures par mois (12 valeurs) pour une année. */
export function volumeMensuel(acts: ActiviteBilan[], annee: number): number[] {
  const mois = new Array(12).fill(0);
  for (const a of acts) if (a.iso.startsWith(`${annee}-`)) mois[Number(a.iso.slice(5, 7)) - 1] += a.duree_min / 60;
  return mois;
}

// --- Rythme : km par mois, charge par semaine, régularité -------------------------------------------------------------

/** Distance (km) par mois : 12 valeurs pour une année. */
export function kmParMois(acts: ActiviteBilan[], annee: number): number[] {
  const mois = new Array(12).fill(0);
  for (const a of acts) if (a.iso.startsWith(`${annee}-`)) mois[Number(a.iso.slice(5, 7)) - 1] += a.distance_km;
  return mois;
}

const midi = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
const lundiDe = (d: Date) => {
  const x = midi(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // lundi = 0
  return x;
};
const joursEntre = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
/** Dernier jour pris en compte d'une année : aujourd'hui pour l'année en cours, le 31 décembre sinon. */
const finDeAnnee = (annee: number, maintenant: Date) => (annee === maintenant.getFullYear() ? midi(maintenant) : new Date(annee, 11, 31, 12));

/** Charge (TSS) des `nb` dernières semaines (lundi → dimanche) de l'année : la dernière valeur est la semaine en cours (ou la dernière de l'année). */
export function chargeParSemaine(acts: ActiviteBilan[], annee: number, maintenant: Date = new Date(), nb = 12): number[] {
  const fin = finDeAnnee(annee, maintenant);
  const debut = lundiDe(fin);
  debut.setDate(debut.getDate() - (nb - 1) * 7);
  const finIso = dateIso(fin);
  const semaines = new Array(nb).fill(0);
  for (const a of acts) {
    if (a.iso > finIso) continue;
    const idx = Math.floor(joursEntre(debut, dateDe(a.iso)) / 7);
    if (idx >= 0 && idx < nb) semaines[idx] += a.tss;
  }
  return semaines;
}

export interface RegulariteAnnee {
  /** Une case par jour, rangée par rangée (lundi → dimanche), semaine par semaine ; les jours hors de l'année ou à venir sont `vide`. */
  cases: CaseRegularite[];
  colonnes: number;
  /** Jours écoulés de l'année (1er janvier → aujourd'hui, ou 365/366). */
  jours: number;
  joursActifs: number;
  /** Jours d'affilée jusqu'à aujourd'hui (hier compris si rien n'est encore fait aujourd'hui). */
  serieEnCours: number;
  serieRecord: number;
}

/** Régularité d'une année : la carte des jours (sport dominant et intensité), les jours actifs et les séries. */
export function regulariteAnnee(acts: ActiviteBilan[], annee: number, maintenant: Date = new Date()): RegulariteAnnee {
  const debut = new Date(annee, 0, 1, 12);
  const fin = finDeAnnee(annee, maintenant);
  const debutIso = dateIso(debut);
  const finIso = dateIso(fin);
  const parJour = new Map<string, Map<string, number>>(); // date ISO → Map(famille → charge)
  for (const a of acts) {
    if (a.iso < debutIso || a.iso > finIso) continue;
    const m = parJour.get(a.iso) ?? new Map<string, number>();
    m.set(a.famille, (m.get(a.famille) ?? 0) + (a.tss > 0 ? a.tss : Math.round((a.duree_min / 60) * 35))); // sans TSS : estimation par la durée
    parJour.set(a.iso, m);
  }

  const lundi0 = lundiDe(debut);
  const colonnes = Math.floor(joursEntre(lundi0, lundiDe(fin)) / 7) + 1;
  const cases: CaseRegularite[] = [];
  for (let rangee = 0; rangee < 7; rangee++) {
    for (let col = 0; col < colonnes; col++) {
      const d = new Date(lundi0);
      d.setDate(lundi0.getDate() + col * 7 + rangee);
      const iso = dateIso(d);
      const m = parJour.get(iso);
      if (iso < debutIso || iso > finIso) cases.push({ famille: null, intensite: 0, vide: true });
      else if (!m) cases.push({ famille: null, intensite: 0, vide: false });
      else {
        const [famille] = [...m.entries()].sort((x, y) => y[1] - x[1])[0];
        cases.push({ famille, intensite: intensiteDeCharge([...m.values()].reduce((x, y) => x + y, 0)), vide: false });
      }
    }
  }

  const jours = joursEntre(debut, fin) + 1;
  let serieRecord = 0;
  let courante = 0;
  const d = new Date(debut);
  for (let i = 0; i < jours; i++, d.setDate(d.getDate() + 1)) {
    courante = parJour.has(dateIso(d)) ? courante + 1 : 0;
    serieRecord = Math.max(serieRecord, courante);
  }
  const f = new Date(fin);
  if (!parJour.has(dateIso(f))) f.setDate(f.getDate() - 1); // rien aujourd'hui : la série tient encore si hier était actif
  let serieEnCours = 0;
  while (parJour.has(dateIso(f))) {
    serieEnCours++;
    f.setDate(f.getDate() - 1);
  }
  return { cases, colonnes, jours, joursActifs: parJour.size, serieEnCours, serieRecord };
}

/**
 * Répartition par sport : [{ sport, heures, seances, valeur, part }] triée par la mesure choisie, décroissante (le temps par défaut ; mêmes mesures que le cumul sur 3 ans).
 * `valeur` est la somme de la mesure pour le sport, `part` sa part en % du total. Un sport à zéro pour la mesure (la muscu en distance) n'apparaît pas.
 */
export function repartitionSport(acts: ActiviteBilan[], mesure: MetriqueCumul = 'heures'): { sport: SportBilan; heures: number; seances: number; valeur: number; part: number }[] {
  const par: Record<string, { sport: SportBilan; heures: number; seances: number; valeur: number }> = {};
  for (const a of acts) {
    par[a.sport] = par[a.sport] || { sport: a.sport, heures: 0, seances: 0, valeur: 0 };
    par[a.sport].heures += a.duree_min / 60;
    par[a.sport].seances += 1;
    par[a.sport].valeur += valeurCumul(a, mesure);
  }
  const liste = Object.values(par).filter((x) => x.valeur > 0).sort((a, b) => b.valeur - a.valeur);
  const total = liste.reduce((s, x) => s + x.valeur, 0);
  return liste.map((x) => ({ ...x, part: total ? Math.round((x.valeur / total) * 100) : 0 }));
}

// --- Chargement : fusionner un résultat avec ce qui est déjà affiché ------------------------------------------------------

/** Ce que le Bilan garde en mémoire : les activités brutes, les objectifs, le message d'erreur éventuel et « a-t-on de quoi afficher ». */
export interface ChargementBilan<S> {
  brutes: S[];
  objectifs: ObjectifAnnuel[];
  erreur: string;
  pret: boolean;
}

/**
 * Résultat d'un chargement (activités + objectifs) fusionné avec ce qui était déjà affiché (`avant`, du même utilisateur, ou null).
 * Un échec garde les données précédentes au lieu de vider l'écran ; `pret` dit si on a au moins des activités à montrer.
 */
export function fusionnerChargement<S>(
  avant: Pick<ChargementBilan<S>, 'brutes' | 'objectifs'> | null,
  acts: { data: S[] | null; erreur: string },
  obj: { data: ObjectifAnnuel[] | null; erreur: string },
): ChargementBilan<S> {
  const brutes = acts.data ?? avant?.brutes ?? null;
  return { brutes: brutes ?? [], objectifs: obj.data ?? avant?.objectifs ?? [], erreur: acts.erreur || obj.erreur || '', pret: brutes != null };
}

/** Au bout de combien de temps les données du Bilan sont « vieilles » : revenir sur l'onglet les recharge alors. */
export const DELAI_DONNEES_BILAN_MS = 5 * 60 * 1000;

/** Les données chargées à `chargeA` (millisecondes, null si jamais) sont-elles à recharger à `maintenant` ? */
export const donneesPerimees = (chargeA: number | null, maintenant: number, delai: number = DELAI_DONNEES_BILAN_MS): boolean =>
  chargeA == null || maintenant < chargeA || maintenant - chargeA >= delai;

// --- Validation d'un objectif ---------------------------------------------------------------------------------------------

// Ce qu'on dit quand la cible est refusée : l'unité attendue, et pour un chrono comment l'écrire (un seul nombre)
const EXEMPLES_CHRONO: Record<string, string> = { min: ' (ex. 210 pour 3 h 30)', s: ' (ex. 75 pour 1 min 15)', 's/km': ' (ex. 255 pour 4 min 15 par km)' };
const messageCible = (m: ModeleObjectif | null): string => (m?.unit ? `Entre un nombre positif en ${m.unit}${EXEMPLES_CHRONO[m.unit] || ''}.` : 'Entre une valeur positive.');

/** Vérifie le formulaire d'un objectif annuel. Renvoie { valeurs, erreurs } (valeurs = null s'il y a des erreurs). */
export function validerObjectif(f: { sport: string; template: string; cible: unknown; actuel: unknown }) {
  const erreurs: Record<string, string> = {};
  const m = modele(f.sport, f.template);
  if (!m) erreurs.template = 'Choisis un objectif.';
  // Un nombre écrit en chiffres seulement (virgule ou point) : ni « 3:30 », ni « 1e3 », ni « 0x10 »
  const nombre = (v: unknown): number | null => {
    const s = String(v ?? '').trim().replace(',', '.');
    if (s === '') return null;
    return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  };
  const cible = nombre(f.cible);
  if (cible == null || !Number.isFinite(cible) || cible <= 0 || cible > 1e7) erreurs.cible = messageCible(m);
  const actuel = nombre(f.actuel);
  if (m && estManuel(m) && actuel != null && (!Number.isFinite(actuel) || actuel < 0 || actuel > 1e7)) erreurs.actuel = 'Valeur invalide.';
  if (Object.keys(erreurs).length || cible == null) return { valeurs: null, erreurs };
  return { erreurs, valeurs: { sport: f.sport, template: f.template, target: cible, current_manual: m && estManuel(m) ? actuel : null } };
}
