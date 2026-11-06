// ============================================================
// Garde-fou santé du coach IA (docs/ia/CADRAGE_IA.md) : « repos / voir un pro » AVANT tout appel au modèle.
//
// C'est du coaching, pas du médical. Si les données sont anormales (malade, blessé, charge qui explose, fréquence
// cardiaque de repos qui monte, HRV qui s'effondre), le CODE décide : l'IA n'improvise pas.
//
// Ce module est une fonction pure : il reçoit des chiffres, il rend une décision. Il lit TOUTES les données de santé de
// l'utilisateur, même celles qu'il n'a pas autorisé à envoyer à l'IA : elles restent dans nos serveurs, et seul un
// message générique (écrit ici) en sort. Il ne pose aucun diagnostic.
//
// Niveaux (du plus léger au plus fort) :
//   normal   : rien à signaler.
//   prudence : le coach peut parler et proposer des séances FACILES seulement (zones 1-2).
//   repos    : aucune séance proposée ; le coach peut quand même discuter.
//   pro      : mesures hors de l'ordinaire ; on ne propose rien et on N'APPELLE PAS le modèle : message fixe « repos / voir un pro ».
//
// Seuils : valeurs de départ prudentes, ajustables ici (un seul endroit), testées dans supabase/tests/edge/garde-fou.test.mts.
// ============================================================
import { ajouterJours, entre } from './dates-iso.ts';

export type NiveauGardeFou = 'normal' | 'prudence' | 'repos' | 'pro';
export type IntensiteMax = 'repos' | 'facile' | 'normale';

export interface DonneesGardeFou {
  /** Le jour évalué, « AAAA-MM-JJ » */
  date: string;
  /** Forme du jour (CTL - ATL), null si inconnue */
  tsb: number | null;
  tss7: number | null;
  tss7Prec: number | null;
  /** Périodes déclarées dans le calendrier (day_notes) */
  indisponibilites: { type: 'maladie' | 'blessure' | 'indisponible'; du: string; au: string }[];
  /** Cases « Malade » et « Blessé » cochées (health_metrics : evt_malade, evt_blesse), une ligne par jour */
  evenements: { date: string; malade: boolean; blesse: boolean }[];
  /** FC de repos du matin, en bpm (35 derniers jours) */
  fcRepos: { date: string; bpm: number }[];
  /** HRV de nuit (35 derniers jours) */
  hrv: { date: string; valeur: number }[];
  /** Fatigue ressentie du matin, de 1 (frais) à 5 (épuisé) */
  fatigue: { date: string; valeur: number }[];
}

export interface DecisionGardeFou {
  niveau: NiveauGardeFou;
  /** Codes stables (pour les journaux et les tests) : jamais de donnée de santé dedans */
  raisons: string[];
  /** Message à montrer à l'utilisateur, null si rien à dire */
  message: string | null;
  /** false = on n'appelle pas le modèle, on répond avec `message` */
  autoriserModele: boolean;
  /** false = aucune carte de séance proposée */
  autoriserCartes: boolean;
  intensiteMax: IntensiteMax;
}

/** Seuils (un seul endroit). */
export const SEUILS = {
  /** Fatigue extrême (TSB) : repos / forte prudence */
  tsbRepos: -40,
  tsbPrudence: -30,
  /** Hausse brutale de la charge d'une semaine à l'autre (si la semaine d'avant a au moins tssSemainePrecMin) */
  hausseBrutale: 1.5,
  tssSemainePrecMin: 100,
  /** FC de repos : écart (bpm) des 3 derniers jours par rapport aux 4 semaines d'avant */
  fcReposPrudence: 7,
  fcReposPro: 12,
  /** HRV : rapport des 3 derniers jours aux 4 semaines d'avant */
  hrvPrudence: 0.7,
  hrvPro: 0.5,
  /** Nombre de mesures minimal pour fiabiliser la comparaison */
  mesuresBase: 10,
  mesuresRecentes: 2,
  /** Fatigue ressentie : ≥ 4 trois jours de suite = prudence ; 5 deux jours de suite = repos */
  fatigueHaute: 4,
  fatigueMax: 5,
} as const;

const ORDRE: Record<NiveauGardeFou, number> = { normal: 0, prudence: 1, repos: 2, pro: 3 };

const MESSAGES: Record<Exclude<NiveauGardeFou, 'normal'>, string> = {
  prudence:
    "Je préfère y aller doucement : je ne te propose que des séances faciles pour l'instant. Si une douleur dure ou augmente, vois un professionnel de santé.",
  repos:
    "Aujourd'hui, c'est repos : je ne te propose pas de séance. Si tu es malade, repose-toi, et si les symptômes durent ou que la fièvre monte, vois un médecin.",
  pro:
    "Certaines de tes mesures sortent de l'ordinaire. Je ne te propose pas d'entraînement : repose-toi, et si ça dure ou si tu as des symptômes (fièvre, douleur, essoufflement inhabituel), vois un professionnel de santé.",
};

function moyenne(valeurs: number[]): number | null {
  return valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;
}

/** Mesures du jour `date` à `date - nJours + 1` (nJours jours, aujourd'hui compris) */
function fenetre<T extends { date: string }>(lignes: T[], date: string, nJours: number): T[] {
  const debut = ajouterJours(date, -(nJours - 1));
  return lignes.filter((l) => entre(l.date, debut, date));
}

/** Écart entre les 3 derniers jours et les 4 semaines d'avant (null si pas assez de mesures) */
function compare(lignes: { date: string; v: number }[], date: string): { recent: number; base: number } | null {
  const recentes = fenetre(lignes, date, 3).map((l) => l.v);
  const debutBase = ajouterJours(date, -34);
  const finBase = ajouterJours(date, -3);
  const base = lignes.filter((l) => entre(l.date, debutBase, finBase)).map((l) => l.v);
  if (recentes.length < SEUILS.mesuresRecentes || base.length < SEUILS.mesuresBase) return null;
  const r = moyenne(recentes);
  const b = moyenne(base);
  return r === null || b === null ? null : { recent: r, base: b };
}

/** Les `n` derniers jours consécutifs (date, date-1, …) ont-ils tous une mesure ≥ seuil ? */
function jourDeSuiteAuMoins(lignes: { date: string; valeur: number }[], date: string, n: number, seuil: number): boolean {
  for (let i = 0; i < n; i++) {
    const jour = ajouterJours(date, -i);
    const duJour = lignes.filter((l) => l.date === jour && Number.isFinite(l.valeur));
    if (!duJour.length || Math.max(...duJour.map((l) => l.valeur)) < seuil) return false;
  }
  return true;
}

export function evaluerGardeFou(d: DonneesGardeFou): DecisionGardeFou {
  const raisons: string[] = [];
  let niveau: NiveauGardeFou = 'normal';
  const monter = (n: NiveauGardeFou, raison: string) => {
    raisons.push(raison);
    if (ORDRE[n] > ORDRE[niveau]) niveau = n;
  };

  const deuxJoursAvant = ajouterJours(d.date, -2);
  const recents = d.evenements.filter((e) => entre(e.date, deuxJoursAvant, d.date));

  // Malade : case cochée ces 3 derniers jours, ou période « maladie » qui couvre aujourd'hui
  if (recents.some((e) => e.malade) || d.indisponibilites.some((i) => i.type === 'maladie' && entre(d.date, i.du, i.au))) {
    monter('repos', 'malade');
  }
  // Blessé : on adapte (séances faciles), on ne diagnostique pas. Les jours déclarés « blessure » restent interdits de séance (validateur).
  if (recents.some((e) => e.blesse) || d.indisponibilites.some((i) => i.type === 'blessure' && entre(d.date, i.du, i.au))) {
    monter('prudence', 'blessure');
  }

  // Charge et fatigue
  if (d.tsb !== null && Number.isFinite(d.tsb)) {
    if (d.tsb <= SEUILS.tsbRepos) monter('repos', 'fatigue_extreme');
    else if (d.tsb <= SEUILS.tsbPrudence) monter('prudence', 'fatigue_elevee');
  }
  if (
    d.tss7 !== null && d.tss7Prec !== null && d.tss7Prec >= SEUILS.tssSemainePrecMin &&
    d.tss7 > d.tss7Prec * SEUILS.hausseBrutale
  ) {
    monter('prudence', 'hausse_brutale');
  }

  // FC de repos (valeurs plausibles seulement : 30-130 bpm)
  const fc = compare(d.fcRepos.filter((x) => x.bpm >= 30 && x.bpm <= 130).map((x) => ({ date: x.date, v: x.bpm })), d.date);
  if (fc) {
    const ecart = fc.recent - fc.base;
    if (ecart >= SEUILS.fcReposPro) monter('pro', 'fc_repos_tres_haute');
    else if (ecart >= SEUILS.fcReposPrudence) monter('prudence', 'fc_repos_haute');
  }

  // HRV
  const hrv = compare(d.hrv.filter((x) => x.valeur > 0).map((x) => ({ date: x.date, v: x.valeur })), d.date);
  if (hrv && hrv.base > 0) {
    const rapport = hrv.recent / hrv.base;
    if (rapport <= SEUILS.hrvPro) monter('pro', 'hrv_effondree');
    else if (rapport <= SEUILS.hrvPrudence) monter('prudence', 'hrv_basse');
  }

  // Fatigue ressentie
  if (jourDeSuiteAuMoins(d.fatigue, d.date, 2, SEUILS.fatigueMax)) monter('repos', 'fatigue_ressentie_extreme');
  else if (jourDeSuiteAuMoins(d.fatigue, d.date, 3, SEUILS.fatigueHaute)) monter('prudence', 'fatigue_ressentie_haute');

  if (niveau === 'normal') {
    return { niveau, raisons, message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' };
  }
  return {
    niveau,
    raisons,
    message: MESSAGES[niveau],
    autoriserModele: niveau !== 'pro',
    autoriserCartes: niveau === 'prudence',
    intensiteMax: niveau === 'prudence' ? 'facile' : 'repos',
  };
}
