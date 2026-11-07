// L'aperçu d'un plan de modifications : ce que le calendrier et la frise montrent, calculé à partir des lignes du plan (fonctions pures).
// Deux vues : « avant » (les séances touchées à leur jour d'origine) et « après » (les retirées en pointillé, les nouvelles pleines, la période hachurée).
// On ne dessine que ce que le plan touche : les séances qu'il laisse en place ne sont pas dans la carte (voir docs/ia/REPLANIFICATION.md).
import type { LignePlan, TypePeriode } from './types.ts';

export type VueApercu = 'avant' | 'apres';
export type EtatMarque = 'prevue' | 'retiree' | 'nouvelle';

export interface Marque {
  sport: string;
  etat: EtatMarque;
}

export interface JourCalendrier {
  iso: string;
  /** Le numéro du jour dans le mois */
  numero: number;
  marques: Marque[];
  /** Pendant une période déclarée (vue « après » seulement) */
  periode: TypePeriode | null;
  aujourdhui: boolean;
  passe: boolean;
}

const JOUR_MS = 86_400_000;
const ENTETES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const LETTRES_JOUR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;
const SPORTS_ORDRE = ['course', 'velo', 'natation', 'muscu'];
const FRISE_JOURS = 14;

function enMs(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
}
const enIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Le jour AAAA-MM-JJ décalé de n jours (calcul en UTC : jamais de décalage d'heure d'été) */
export function ajouterJours(iso: string, n: number): string {
  return enIso(enMs(iso) + n * JOUR_MS);
}

/** Le lundi de la semaine qui contient ce jour */
export function lundiDe(iso: string): string {
  const jour = new Date(enMs(iso)).getUTCDay(); // 0 = dimanche
  return ajouterJours(iso, -((jour + 6) % 7));
}

const entre = (iso: string, du: string, au: string) => iso >= du && iso <= au;

/** Les périodes (maladie, blessure…) que le plan déclare */
export function periodesDuPlan(lignes: LignePlan[]): { type: TypePeriode; du: string; au: string }[] {
  return lignes.filter((l) => l.op === 'indisponibilite' && l.type && l.du && l.au).map((l) => ({ type: l.type as TypePeriode, du: l.du as string, au: l.au as string }));
}

/** Les séances touchées par le plan, jour par jour, selon la vue */
export function marquesDuPlan(lignes: LignePlan[], vue: VueApercu): Map<string, Marque[]> {
  const carte = new Map<string, Marque[]>();
  const poser = (iso: string | undefined, sport: string | null | undefined, etat: EtatMarque) => {
    if (!iso || !sport) return;
    carte.set(iso, [...(carte.get(iso) ?? []), { sport, etat }]);
  };
  for (const l of lignes) {
    if (l.op === 'supprimer') poser(l.de, l.sport, vue === 'avant' ? 'prevue' : 'retiree');
    if (l.op === 'deplacer') {
      poser(l.de, l.sport, vue === 'avant' ? 'prevue' : 'retiree');
      if (vue === 'apres') poser(l.vers, l.sport, 'nouvelle');
    }
    if (l.op === 'ajouter' && vue === 'apres') poser(l.vers, l.sport, 'nouvelle');
  }
  return carte;
}

/** Tous les jours que le plan touche (séances et périodes), pour cadrer l'aperçu */
function joursDuPlan(lignes: LignePlan[]): string[] {
  const jours: string[] = [];
  for (const l of lignes) for (const j of [l.de, l.vers, l.du, l.au]) if (j && Number.isFinite(enMs(j))) jours.push(j);
  return jours.sort();
}

/**
 * Le calendrier : des semaines entières (lundi → dimanche) depuis la semaine d'aujourd'hui, trois au moins, quatre au plus.
 * Les jours passés sont signalés (grisés), le jour d'aujourd'hui aussi (cadre).
 */
export function calendrierApercu(lignes: LignePlan[], vue: VueApercu, aujourdhui: string): { entetes: readonly string[]; semaines: JourCalendrier[][] } {
  const debut = lundiDe(aujourdhui);
  const plusLoin = joursDuPlan(lignes).filter((j) => j >= debut).pop() ?? aujourdhui;
  const nbSemaines = Math.min(4, Math.max(3, Math.floor((enMs(plusLoin) - enMs(debut)) / JOUR_MS / 7) + 1));
  const marques = marquesDuPlan(lignes, vue);
  const periodes = vue === 'apres' ? periodesDuPlan(lignes) : [];
  const semaines: JourCalendrier[][] = [];
  for (let s = 0; s < nbSemaines; s++) {
    const semaine: JourCalendrier[] = [];
    for (let j = 0; j < 7; j++) {
      const iso = ajouterJours(debut, s * 7 + j);
      semaine.push({
        iso,
        numero: Number(iso.slice(8, 10)),
        marques: marques.get(iso) ?? [],
        periode: periodes.find((p) => entre(iso, p.du, p.au))?.type ?? null,
        aujourdhui: iso === aujourdhui,
        passe: iso < aujourdhui,
      });
    }
    semaines.push(semaine);
  }
  return { entetes: ENTETES, semaines };
}

export interface CaseFrise {
  iso: string;
  etat: 'vide' | EtatMarque;
}

export interface RangeeFrise {
  sport: string;
  cases: CaseFrise[];
}

export interface JourFrise {
  iso: string;
  lettre: string;
  numero: number;
  periode: TypePeriode | null;
}

/**
 * La frise : 14 jours d'affilée à partir du premier jour que le plan touche, une rangée par sport touché.
 * Une période déclarée traverse toutes les rangées (hachures) ; les jours sans séance sont « vide ».
 */
export function friseApercu(lignes: LignePlan[], vue: VueApercu, aujourdhui: string): { jours: JourFrise[]; rangees: RangeeFrise[] } {
  const touches = joursDuPlan(lignes);
  const debut = touches[0] ?? ajouterJours(aujourdhui, 1);
  const periodes = vue === 'apres' ? periodesDuPlan(lignes) : [];
  const marques = marquesDuPlan(lignes, vue);
  const jours: JourFrise[] = [];
  for (let i = 0; i < FRISE_JOURS; i++) {
    const iso = ajouterJours(debut, i);
    jours.push({ iso, lettre: LETTRES_JOUR[new Date(enMs(iso)).getUTCDay()], numero: Number(iso.slice(8, 10)), periode: periodes.find((p) => entre(iso, p.du, p.au))?.type ?? null });
  }
  const sports = [...new Set([...marquesDuPlan(lignes, 'avant').values(), ...marquesDuPlan(lignes, 'apres').values()].flat().map((m) => m.sport))];
  sports.sort((a, b) => {
    const ia = SPORTS_ORDRE.indexOf(a);
    const ib = SPORTS_ORDRE.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const rangees = sports.map((sport) => ({
    sport,
    cases: jours.map((j): CaseFrise => ({ iso: j.iso, etat: (marques.get(j.iso) ?? []).find((m) => m.sport === sport)?.etat ?? 'vide' })),
  }));
  return { jours, rangees };
}
