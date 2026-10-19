// Bilan annuel : cumuls, comparaison avec l'an dernier, objectifs de l'année, records. Fonctions pures, sans réseau.
//
// Une « activité » de bilan est normalisée : { id, name, iso, sport, duree_min, distance_km, d_plus, tss }
// où `sport` est une famille de bilan : 'cyclisme' | 'course' | 'natation' | 'musculation' | 'autre'.
import { familleAffichage } from './familles.ts';
import type { Seance } from './types.ts';

export type SportBilan = 'cyclisme' | 'course' | 'natation' | 'musculation' | 'autre';

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
  ['autre', 'Autre'],
];
export const NOM_SPORT_BILAN: Record<string, string> = { ...Object.fromEntries(SPORTS_BILAN), tous: 'Tous sports' };

/** Famille de bilan d'un type de sport brut (Strava) : vélo → cyclisme, course et trail → course, etc. */
export function familleBilan(sportBrut: unknown): SportBilan {
  const f = familleAffichage(sportBrut);
  if (f === 'velo' || f === 'vtt') return 'cyclisme';
  if (f === 'course' || f === 'trail') return 'course';
  if (f === 'natation') return 'natation';
  if (f === 'muscu') return 'musculation';
  return 'autre';
}

/** Famille de bilan correspondant à un filtre global de sport (« velo » → cyclisme, « muscu » → musculation…), ou null pour « tout ». */
export function familleBilanDuFiltre(filtre: string | null | undefined): string | null {
  if (!filtre || filtre === 'tout') return null;
  if (filtre === 'velo' || filtre === 'vtt') return 'cyclisme';
  if (filtre === 'muscu') return 'musculation';
  if (filtre === 'course' || filtre === 'trail' || filtre === 'natation') return filtre;
  return 'autre';
}

/** Ligne de la table activities → activité de bilan. */
export function normaliser(l: Pick<Seance, 'id' | 'name' | 'sport' | 'start_date_local' | 'moving_time' | 'distance_km' | 'total_elevation_gain' | 'tss'>): ActiviteBilan {
  return {
    id: l.id,
    name: l.name || '',
    iso: String(l.start_date_local || '').slice(0, 10),
    sport: familleBilan(l.sport),
    famille: familleAffichage(l.sport) === 'vtt' ? 'velo' : familleAffichage(l.sport), // famille du filtre global de l'en-tête (le VTT compte avec le vélo)
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
const dateIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Activités de l'année : du 1er janvier à aujourd'hui pour l'année en cours, l'année entière sinon. */
export function activitesAnnee(acts: ActiviteBilan[], annee: number, maintenant: Date = new Date()): ActiviteBilan[] {
  const fin = annee === maintenant.getFullYear() ? dateIso(maintenant) : `${annee}-12-31`;
  return acts.filter((a) => a.iso >= debutAnnee(annee) && a.iso <= fin);
}

/** Activités de l'année précédente jusqu'au même jour de l'année (« à la même date »). */
export function activitesAnneePrecedente(acts: ActiviteBilan[], annee: number, maintenant: Date = new Date()): ActiviteBilan[] {
  const jours = annee === maintenant.getFullYear() ? jourDeLAnnee(maintenant) : 365;
  const fin = new Date(annee - 1, 0, 1 + jours, 12);
  return acts.filter((a) => a.iso >= debutAnnee(annee - 1) && a.iso <= dateIso(fin));
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
//      | 'avg_sess_week' | 'avg_hours_week' | 'manual' (saisie) | 'manual_lower' (saisie, plus bas = mieux)
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
    o('mus_dips', 'Dips max consécutifs', 'reps', 'manual'), o('mus_plank', 'Gainage durée max', 's', 'manual'), o('mus_bw', 'Poids corporel cible', 'kg', 'manual'),
  ],
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
export const estManuel = (m: ModeleObjectif | null | undefined): boolean => m?.calc === 'manual' || m?.calc === 'manual_lower';
const estCumul = (m: ModeleObjectif): boolean => m.calc.startsWith('sum_') || m.calc.startsWith('avg_');

const semainesEcoulees = (annee: number, maintenant: Date): number => (annee === maintenant.getFullYear() ? Math.max(1, Math.floor((maintenant.getTime() - new Date(annee, 0, 1).getTime()) / (7 * 86400000))) : 52);
const partAnnee = (annee: number, maintenant: Date): number => Math.min(1, (maintenant.getTime() - new Date(annee, 0, 1).getTime()) / (365 * 86400000));

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
    } else {
      pct = Math.min(100, (actuel / cible) * 100);
      enRythme = estCumul(m) ? actuel >= cible * partAnnee(annee, maintenant) : actuel >= cible;
    }
  }
  let projection: number | null = null;
  if (estCumul(m) && actuel != null && annee === maintenant.getFullYear() && partAnnee(annee, maintenant) > 0.02) {
    projection = actuel / partAnnee(annee, maintenant);
  }
  return { modele: m, actuel, cible, pct, enRythme, repere: estCumul(m) ? partAnnee(annee, maintenant) * 100 : null, projection, projectionPct: projection != null && cible > 0 ? Math.round((projection / cible) * 100) : null };
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

/**
 * Cumul jour par jour de la distance ou du dénivelé, pour plusieurs années : { etiquettes, series: [{ annee, valeurs }] }.
 * Les étiquettes sont des dates d'une année bissextile (jj/mm). Pour l'année en cours, le cumul s'arrête aujourd'hui (null après).
 */
export function cumulParAnnee(
  acts: ActiviteBilan[],
  annees: number[],
  metrique: 'distance_km' | 'd_plus' = 'distance_km',
  maintenant: Date = new Date(),
): { etiquettes: string[]; series: { annee: number; valeurs: (number | null)[] }[] } {
  const etiquettes = Array.from({ length: 366 }, (_, j) => dateIso(new Date(2024, 0, 1 + j, 12)));
  const series = annees.map((annee) => {
    const parJour = new Array(366).fill(0);
    for (const a of acts) {
      if (!a.iso.startsWith(`${annee}-`)) continue;
      const jour = jourDeLAnnee(dateDe(a.iso));
      if (jour >= 0 && jour < 366) parJour[jour] += metrique === 'd_plus' ? a.d_plus : a.distance_km;
    }
    const limite = annee === maintenant.getFullYear() ? jourDeLAnnee(maintenant) : 365;
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

/** Répartition par sport : [{ sport, heures, seances, part }] triée par heures décroissantes (part en % du temps total). */
export function repartitionSport(acts: ActiviteBilan[]): { sport: SportBilan; heures: number; seances: number; part: number }[] {
  const par: Record<string, { sport: SportBilan; heures: number; seances: number }> = {};
  for (const a of acts) {
    par[a.sport] = par[a.sport] || { sport: a.sport, heures: 0, seances: 0 };
    par[a.sport].heures += a.duree_min / 60;
    par[a.sport].seances += 1;
  }
  const liste = Object.values(par).sort((a, b) => b.heures - a.heures);
  const total = liste.reduce((s, x) => s + x.heures, 0);
  return liste.map((x) => ({ ...x, part: total ? Math.round((x.heures / total) * 100) : 0 }));
}

// --- Validation d'un objectif ---------------------------------------------------------------------------------------------

/** Vérifie le formulaire d'un objectif annuel. Renvoie { valeurs, erreurs } (valeurs = null s'il y a des erreurs). */
export function validerObjectif(f: { sport: string; template: string; cible: unknown; actuel: unknown }) {
  const erreurs: Record<string, string> = {};
  const m = modele(f.sport, f.template);
  if (!m) erreurs.template = 'Choisis un objectif.';
  const nombre = (v: unknown): number | null => {
    const s = String(v ?? '').trim().replace(',', '.');
    return s === '' ? null : Number(s);
  };
  const cible = nombre(f.cible);
  if (cible == null || !Number.isFinite(cible) || cible <= 0 || cible > 1e7) erreurs.cible = 'Entre une valeur positive.';
  const actuel = nombre(f.actuel);
  if (m && estManuel(m) && actuel != null && (!Number.isFinite(actuel) || actuel < 0 || actuel > 1e7)) erreurs.actuel = 'Valeur invalide.';
  if (Object.keys(erreurs).length) return { valeurs: null, erreurs };
  return { erreurs, valeurs: { sport: f.sport, template: f.template, target: cible, current_manual: m && estManuel(m) ? actuel : null } };
}
