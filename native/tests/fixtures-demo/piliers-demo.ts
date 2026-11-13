// Les mesures annuelles du niveau global du vélo en démo, CALCULÉES sur les streams des sorties (rien n'est inventé) : mêmes règles que la fonction SQL rpc_piliers_annuels
// (supabase/migrations/2026-11-03_rpc_piliers_nettoyage.sql) et que les modules du serveur repetabilite.ts et derive.ts (copiés ici : l'app mobile ne peut pas importer le dossier Deno).
//  - puissances de pointe (5 s, 5, 20 et 60 min) : les courbes de puissance des sorties (courbes-demo.ts) ;
//  - répétabilité : les 3 meilleurs efforts de 5 minutes de chaque sortie, médiane des 10 meilleures sorties de l'année ;
//  - endurance : découplage cardiaque et cardio des sorties de plus de 2 h tenues à ±10 % de la puissance de référence ;
//  - charge : CTL (forme de fond) calculé jour par jour sur la charge de toutes les séances, heures et jours actifs.
import type { MesuresAnnee } from '../../src/data/bilan/piliers-niveau.ts';
import type { Seance } from '../../src/data/types.ts';
import { genererFlux } from './flux-demo.ts';
import { activitesBilanDemo, recordsVeloDemo } from './demo.ts';
import { courbesVelo } from './courbes-demo.ts';

// --- Copie de repetabilite.ts ----------------------------------------------------------------------------------------------

const DUREE_EFFORT_S = 300;
const ECART_EFFORTS_S = 300;
const NOMBRE_EFFORTS = 3;

/** Les puissances moyennes des `nombre` meilleurs efforts de `duree` s sans chevauchement ni moins de `ecart` s entre eux, du plus fort au plus faible (1 point par seconde). */
export function meilleursEfforts(watts: readonly number[], duree = DUREE_EFFORT_S, nombre = NOMBRE_EFFORTS, ecart = ECART_EFFORTS_S): number[] {
  const n = watts.length;
  if (n < duree) return [];
  const cum = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + (watts[i] != null && watts[i] > 0 ? watts[i] : 0);
  const moyennes: number[] = [];
  for (let i = 0; i + duree <= n; i++) moyennes.push((cum[i + duree] - cum[i]) / duree);
  const ordre = moyennes.map((_, i) => i).sort((a, b) => moyennes[b] - moyennes[a]);
  const choisis: number[] = [];
  for (const i of ordre) {
    if (choisis.every((j) => Math.abs(i - j) >= duree + ecart)) {
      choisis.push(i);
      if (choisis.length === nombre) break;
    }
  }
  return choisis.map((i) => moyennes[i]).sort((a, b) => b - a);
}

/** rep_1, rep_2, rep_3 (watts arrondis) ; rien si la sortie n'a pas trois efforts. */
export function clesRepetabilite(watts: readonly number[]): Record<string, number> {
  const efforts = meilleursEfforts(watts);
  if (efforts.length < NOMBRE_EFFORTS || efforts[NOMBRE_EFFORTS - 1] <= 0) return {};
  return Object.fromEntries(efforts.map((w, i) => [`rep_${i + 1}`, Math.round(w)]));
}

// --- Copie de derive.ts ----------------------------------------------------------------------------------------------------

const DERIVE_DUREE_MINI_S = 2 * 3600;
const ECHAUFFEMENT_S = 600;
const SECONDES_MINI_MOITIE = 1200;
const WATTS_MOYENS_MINI = 60;
const LISSAGE_NP_S = 30;

/** La puissance normalisée d'une suite de watts (1 point par seconde). */
export function puissanceNormalisee(watts: readonly number[]): number {
  const n = watts.length;
  if (n < LISSAGE_NP_S) return 0;
  let somme = 0;
  let quatrieme = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    somme += watts[i];
    if (i >= LISSAGE_NP_S) somme -= watts[i - LISSAGE_NP_S];
    if (i >= LISSAGE_NP_S - 1) {
      const m = somme / LISSAGE_NP_S;
      quatrieme += m * m * m * m;
      k++;
    }
  }
  return k ? Math.pow(quatrieme / k, 0.25) : 0;
}

/** Le découplage d'une sortie (`{ drift }`), ou rien si elle est trop courte, sans cardio ou trop peu appuyée. */
export function cleDerive(watts: readonly number[], fc: readonly number[]): Record<string, number> {
  const n = Math.min(watts.length, fc.length);
  if (n < DERIVE_DUREE_MINI_S) return {};
  const milieu = Math.floor((ECHAUFFEMENT_S + n) / 2);
  const moitie = (debut: number, fin: number) => {
    const w: number[] = [];
    let c = 0;
    for (let i = debut; i < fin; i++) {
      const f = Number(fc[i]);
      if (!(f > 0)) continue;
      const p = Number(watts[i]);
      w.push(p > 0 ? p : 0);
      c += f;
    }
    const k = w.length;
    return { np: puissanceNormalisee(w), moy: k ? w.reduce((s, x) => s + x, 0) / k : 0, c: k ? c / k : 0, k };
  };
  const a = moitie(ECHAUFFEMENT_S, milieu);
  const b = moitie(milieu, n);
  if (a.k < SECONDES_MINI_MOITIE || b.k < SECONDES_MINI_MOITIE) return {};
  if ((a.moy + b.moy) / 2 < WATTS_MOYENS_MINI) return {};
  const ef1 = a.np / a.c;
  const ef2 = b.np / b.c;
  if (!(ef1 > 0)) return {};
  return { drift: Math.round(((ef1 - ef2) / ef1) * 1000) / 10 };
}

// --- Les clés d'une sortie, calculées sur son stream à 1 point par seconde --------------------------------------------------

interface ClesSortie {
  rep1?: number;
  rep3?: number;
  drift?: number;
}
const memoCles = new Map<string, ClesSortie>();
function clesDeLaSortie(s: Seance): ClesSortie {
  const cle = `${s.id}|${s.moving_time}|${s.distance_km}|${s.avg_watts}|${s.avg_heartrate}`;
  let c = memoCles.get(cle);
  if (!c) {
    const f = genererFlux(s, 1);
    const w = f.watts ?? [];
    const rep = clesRepetabilite(w);
    c = { rep1: rep.rep_1, rep3: rep.rep_3, drift: cleDerive(w, f.heartrate).drift };
    memoCles.set(cle, c);
  }
  return c;
}

const mediane = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};
const arrondi = (x: number, d: number): number => Math.round(x * 10 ** d) / 10 ** d;

/** Les mesures annuelles du niveau global du vélo, d'après les streams des sorties de la démo. */
export function piliersAnnuelsDemo(maintenant: Date = new Date()): MesuresAnnee[] {
  const toutes = activitesBilanDemo(maintenant);
  const sorties = toutes.filter((s) => s.sport === 'Ride');
  const records = recordsVeloDemo(maintenant);
  const annees = [...new Set(toutes.map((s) => Number(s.start_date_local.slice(0, 4))))].sort((a, b) => a - b);
  const an = (s: Seance): number => Number(s.start_date_local.slice(0, 4));

  // Les puissances de pointe de l'année et le nombre de sorties avec une courbe de puissance
  const pointes = new Map<number, { w5: number | null; w300: number | null; w1200: number | null; w3600: number | null; n: number }>();
  for (const a of annees) {
    const c = records.courbe(a, 1);
    const w = (d: number): number | null => c.find((p) => p.duree === d)?.top[0]?.valeur ?? null;
    pointes.set(a, { w5: w(5), w300: w(300), w1200: w(1200), w3600: w(3600), n: sorties.filter((s) => an(s) === a && Object.keys(courbesVelo(s).puissance).length > 0).length });
  }
  const fiables = [...pointes.values()].filter((p) => p.n >= 3);
  const meilleur5min = Math.max(0, ...fiables.map((p) => p.w300 ?? 0));
  const meilleur20 = Math.max(0, ...(fiables.length ? fiables : [...pointes.values()].filter((p) => p.n > 0)).map((p) => p.w1200 ?? 0));
  const pRef = 0.7 * 0.95 * meilleur20;

  // La charge : le CTL jour par jour sur la charge (TSS) de toutes les séances, depuis la première
  const parJour = new Map<string, { tss: number; min: number; n: number }>();
  for (const s of toutes) {
    const j = s.start_date_local.slice(0, 10);
    const e = parJour.get(j) ?? { tss: 0, min: 0, n: 0 };
    e.tss += s.tss ?? 0;
    e.min += s.moving_time / 60;
    e.n++;
    parJour.set(j, e);
  }
  const charge = new Map<number, { ctlMax: number; somme: number; jours: number; heures: number; actifs: number }>();
  const premier = toutes.reduce((m, s) => (s.start_date_local < m ? s.start_date_local : m), toutes[0].start_date_local).slice(0, 10);
  let ctl = 0;
  for (let t = new Date(`${premier}T12:00:00`); t <= maintenant; t.setDate(t.getDate() + 1)) {
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const e = parJour.get(iso);
    ctl += ((e?.tss ?? 0) - ctl) / 42;
    const c = charge.get(t.getFullYear()) ?? { ctlMax: 0, somme: 0, jours: 0, heures: 0, actifs: 0 };
    c.ctlMax = Math.max(c.ctlMax, ctl);
    c.somme += ctl;
    c.jours++;
    c.heures += (e?.min ?? 0) / 60;
    if (e) c.actifs++;
    charge.set(t.getFullYear(), c);
  }

  return annees.map((a) => {
    const p = pointes.get(a)!;
    const ch = charge.get(a);
    const deAn = sorties.filter((s) => an(s) === a);
    // Répétabilité : les sorties valides (3e effort d'au moins 50 % du meilleur 5 min), les 10 où il est le plus fort
    const rep = deAn
      .map((s) => ({ s, k: clesDeLaSortie(s) }))
      .filter(({ k }) => k.rep1 != null && k.rep3 != null && k.rep1 > 0 && k.rep3 >= 0.5 * meilleur5min)
      .sort((x, y) => (y.k.rep3 as number) - (x.k.rep3 as number) || (x.s.start_date_local < y.s.start_date_local ? 1 : -1))
      .slice(0, 10);
    // Endurance : les sorties de plus de 2 h à ±10 % de la puissance de référence, les 10 plus récentes
    const longues = deAn
      .filter((s) => s.moving_time >= 7200 && pRef > 0 && (s.np ?? s.avg_watts ?? 0) >= 0.9 * pRef && (s.np ?? s.avg_watts ?? 0) <= 1.1 * pRef)
      .sort((x, y) => (x.start_date_local < y.start_date_local ? 1 : -1));
    const fcs = longues.filter((s) => s.avg_heartrate).slice(0, 10).map((s) => s.avg_heartrate as number);
    const derives = longues.map((s) => clesDeLaSortie(s).drift).filter((d): d is number => d != null).slice(0, 10);
    return {
      an: a, w5: p.w5, w300: p.w300, w1200: p.w1200, w3600: p.w3600,
      repRatio: rep.length ? arrondi(mediane(rep.map(({ k }) => (k.rep3 as number) / (k.rep1 as number))), 3) : null,
      repW3: rep.length ? Math.round(mediane(rep.map(({ k }) => k.rep3 as number))) : null,
      repN: rep.length,
      ctlMax: ch ? arrondi(ch.ctlMax, 1) : null,
      ctlMoy: ch ? arrondi(ch.somme / ch.jours, 1) : null,
      heures: ch ? arrondi(ch.heures, 1) : null,
      joursActifs: ch?.actifs ?? 0,
      joursCouverts: ch?.jours ?? 0,
      nCourbes: p.n,
      pRef: pRef > 0 ? Math.round(pRef) : null,
      fcRef: fcs.length ? Math.round(mediane(fcs)) : null,
      nFc: fcs.length,
      driftMed: derives.length ? arrondi(mediane(derives), 1) : null,
      nDrift: derives.length,
    };
  });
}
