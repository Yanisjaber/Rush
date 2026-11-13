// La courbe de forme du Progrès : la condition (CTL, ta charge d'entraînement lissée sur environ 6 semaines) semaine après semaine, sur toute l'histoire du compte.
// Un point par semaine = la condition du dernier jour connu de la semaine (lundi à dimanche). Le pic = la semaine où elle a été la plus haute. Fonctions pures, sans réseau.
import type { Metrique } from '../types.ts';

export interface PointCondition {
  /** Le lundi de la semaine (« 2025-05-05 ») */
  lundi: string;
  /** La condition (CTL) à la fin de la semaine, arrondie */
  ctl: number;
}

const dateDe = (iso: string): Date => new Date(`${iso}T12:00:00`);
const dateIso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lundiDe = (iso: string): string => {
  const d = dateDe(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateIso(d);
};

/**
 * La condition (CTL) de chaque jour calculée sur des séances (par exemple celles d'un seul sport), avec la même formule que la base (data/migrations daily_metrics) :
 * une moyenne glissante exponentielle de la charge (TSS) de chaque jour, CTL = CTL de la veille + (charge du jour - CTL de la veille) × 2 / 43, en partant de 0 le jour de la première séance
 * et en continuant jour après jour jusqu'à `jusqua` (les jours sans séance comptent pour une charge de 0).
 */
export function conditionDesSeances(seances: readonly { iso: string; tss: number }[], jusqua: Date): { iso_date: string; ctl: number }[] {
  const parJour = new Map<string, number>();
  for (const s of seances) {
    if (!s.iso || s.iso < '2000-01-01') continue; // les dates aberrantes (1970) sont ignorées, comme en base
    parJour.set(s.iso.slice(0, 10), (parJour.get(s.iso.slice(0, 10)) ?? 0) + (s.tss > 0 ? s.tss : 0));
  }
  if (!parJour.size) return [];
  const premier = [...parJour.keys()].sort()[0];
  const fin = dateIso(jusqua);
  const jours: { iso_date: string; ctl: number }[] = [];
  let ctl = 0;
  const d = dateDe(premier);
  for (let iso = premier; iso <= fin; ) {
    ctl = ctl + ((parJour.get(iso) ?? 0) - ctl) * (2 / 43);
    jours.push({ iso_date: iso, ctl });
    d.setDate(d.getDate() + 1);
    iso = dateIso(d);
  }
  return jours;
}

/** Une condition par semaine (la dernière de la semaine), de la première à la dernière semaine, sans trou : une semaine sans donnée reprend la valeur de la précédente. */
export function conditionParSemaine(metriques: readonly Pick<Metrique, 'iso_date' | 'ctl'>[]): PointCondition[] {
  const valides = metriques.filter((m) => Number.isFinite(Number(m.ctl)) && Number(m.ctl) >= 0).sort((a, b) => (a.iso_date < b.iso_date ? -1 : a.iso_date > b.iso_date ? 1 : 0));
  if (!valides.length) return [];
  const parSemaine = new Map<string, number>();
  for (const m of valides) parSemaine.set(lundiDe(m.iso_date), Number(m.ctl)); // le dernier jour de la semaine l'emporte (liste triée)
  const points: PointCondition[] = [];
  let lundi = lundiDe(valides[0].iso_date);
  const dernier = lundiDe(valides[valides.length - 1].iso_date);
  let precedent = 0;
  while (lundi <= dernier) {
    const v = parSemaine.get(lundi) ?? precedent;
    points.push({ lundi, ctl: Math.round(v) });
    precedent = v;
    const d = dateDe(lundi);
    d.setDate(d.getDate() + 7);
    lundi = dateIso(d);
  }
  return points;
}

/** Le point le plus haut (la première semaine à égalité), ou null sans donnée. */
export function picCondition(points: readonly PointCondition[]): PointCondition | null {
  let pic: PointCondition | null = null;
  for (const p of points) if (!pic || p.ctl > pic.ctl) pic = p;
  return pic && pic.ctl > 0 ? pic : null;
}
