// Un plan découpé par semaine (lundi → dimanche) : de quoi dessiner « une ligne par semaine » (ses 7 jours en points, son volume) et lister ses séances.
// Fonctions pures. Les séances retirées n'y figurent pas : la carte les regroupe à part. Un plan d'un an donne une soixantaine de semaines.
import { ajouterJours, lundiDe } from './apercu-plan.ts';
import { jourCarte } from './libelles.ts';
import type { LignePlan } from './types.ts';

export interface JourSemaine {
  iso: string;
  /** Les sports des séances ajoutées ou déplacées ce jour-là (dans l'ordre du plan) */
  sports: string[];
  /** Jour couvert par une période déclarée (blessure, maladie, indisponibilité) */
  periode: boolean;
  /** Jour de repos posé par le plan */
  repos: boolean;
}

export interface SemainePlan {
  /** 1 pour la première semaine touchée par le plan, puis le décalage réel en semaines (une semaine sans changement garde sa place dans la numérotation) */
  numero: number;
  /** Le lundi, et le dimanche */
  debut: string;
  fin: string;
  jours: JourSemaine[];
  /** Le but de la semaine (« Base », « Développement »…) quand le plan le dit : celui de ses séances ajoutées, le plus fréquent si elles diffèrent */
  phase?: string;
  /** Volume des séances ajoutées, en minutes */
  minutes: number;
  /** Séances ajoutées ou déplacées */
  seances: number;
  lignes: LignePlan[];
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const PERIODE_MAX_JOURS = 400;

/** Le jour que concerne une ligne : où la séance arrive, où le repos est posé, où commence la période */
function jourDe(l: LignePlan): string | undefined {
  const j = l.op === 'supprimer' ? l.de : l.op === 'indisponibilite' ? l.du : l.vers;
  return j && DATE_ISO.test(j) ? j : undefined;
}

/** Les lignes (hors séances retirées) rangées par semaine, de la plus proche à la plus lointaine */
export function semainesDuPlan(lignes: LignePlan[]): SemainePlan[] {
  const utiles = lignes.filter((l) => l.op !== 'supprimer');
  const parSemaine = new Map<string, { lignes: LignePlan[]; jours: Map<string, JourSemaine> }>();
  const semaine = (lundi: string) => {
    let s = parSemaine.get(lundi);
    if (!s) parSemaine.set(lundi, (s = { lignes: [], jours: new Map() }));
    return s;
  };
  const jour = (iso: string): JourSemaine => {
    const s = semaine(lundiDe(iso));
    let j = s.jours.get(iso);
    if (!j) s.jours.set(iso, (j = { iso, sports: [], periode: false, repos: false }));
    return j;
  };

  const sansDate: LignePlan[] = [];
  for (const l of utiles) {
    const iso = jourDe(l);
    if (!iso) {
      sansDate.push(l);
      continue;
    }
    semaine(lundiDe(iso)).lignes.push(l);
    if ((l.op === 'ajouter' || l.op === 'deplacer') && l.sport) jour(iso).sports.push(l.sport);
    if (l.op === 'repos' && l.poser !== false) jour(iso).repos = true;
    if (l.op === 'indisponibilite' && l.du && l.au && DATE_ISO.test(l.au)) {
      for (let n = 0; n < PERIODE_MAX_JOURS; n++) {
        const j = ajouterJours(l.du, n);
        if (j > l.au) break;
        jour(j).periode = true;
      }
    }
  }

  const lundis = [...parSemaine.keys()].sort();
  if (!lundis.length) return [];
  // Les lignes sans date vont dans la première semaine : on ne perd jamais une ligne du plan
  semaine(lundis[0]).lignes.unshift(...sansDate);
  const premier = lundis[0];

  return lundis.map((lundi) => {
    const s = parSemaine.get(lundi)!;
    const ajoutees = s.lignes.filter((l) => l.op === 'ajouter');
    const compte = new Map<string, number>();
    for (const l of ajoutees) if (l.phase) compte.set(l.phase, (compte.get(l.phase) ?? 0) + 1);
    const phase = [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      ...(phase ? { phase } : {}),
      numero: Math.round((Date.parse(`${lundi}T00:00:00Z`) - Date.parse(`${premier}T00:00:00Z`)) / (7 * 86_400_000)) + 1,
      debut: lundi,
      fin: ajouterJours(lundi, 6),
      jours: Array.from({ length: 7 }, (_, i) => {
        const iso = ajouterJours(lundi, i);
        return s.jours.get(iso) ?? { iso, sports: [], periode: false, repos: false };
      }),
      minutes: ajoutees.reduce((t, l) => t + (l.minutes ?? 0), 0),
      seances: s.lignes.filter((l) => l.op === 'ajouter' || l.op === 'deplacer').length,
      lignes: s.lignes,
    };
  });
}

/** « 9–15 nov. » ou « 30 nov.–6 déc. » */
export function plageSemaine(debut: string, fin: string): string {
  const sansJourSemaine = (iso: string) => jourCarte(iso).split(' ').slice(1);
  const [jd, md] = sansJourSemaine(debut);
  const [jf, mf] = sansJourSemaine(fin);
  return md === mf ? `${jd}–${jf} ${mf}` : `${jd} ${md}–${jf} ${mf}`;
}
