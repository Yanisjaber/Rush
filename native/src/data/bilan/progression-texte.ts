// Les mots de la Progression, partagés par le widget de l'accueil et l'onglet du Bilan : un seul endroit pour que les deux disent la même chose.
import { formatAllure, formatAllure100m, formatNum } from '../outils/format.ts';
import type { Progression, Statut } from './progression.ts';

export const FLECHE: Record<Statut, string> = { hausse: '↗', stable: '→', baisse: '↘', insuffisant: '' };
export const MOT: Record<Statut, string> = { hausse: 'Tu progresses', stable: 'Stable', baisse: 'En retrait', insuffisant: 'Pas assez de données' };

/** « +8,3 % », « -2 % ». */
export const formatPct = (v: number): string => `${v > 0 ? '+' : ''}${v.toString().replace('.', ',')} %`;

/** « ↗ +8,3 % », ou « — » sans mesure. */
export const variationTexte = (prog: Progression): string => (prog.statut === 'insuffisant' ? '—' : `${FLECHE[prog.statut]} ${formatPct(prog.variationPct!)}`);

/** Une valeur de l'indicateur d'un sport, dans son unité : « 5'42"/km », « 1'48"/100 m », « 152 W », « 95 kg ». */
export function formatValeurProgression(prog: Progression, v: number | null): string {
  if (v == null) return '—';
  if (prog.unite === 'allure') return formatAllure(v);
  if (prog.unite === 'allure100') return formatAllure100m(v);
  return `${formatNum(v)} ${prog.unite === 'watts' ? 'W' : 'kg'}`;
}
