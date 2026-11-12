// Banc d'essai « préparer une course de vélo ou de natation » : des sportifs fictifs (graine fixe) préparent une épreuve ; on cherche les plans faux.
// Lancer : node --experimental-strip-types supabase/tests/edge/simulation-course-endurance.mts [nombre]   (aucun réseau, aucune donnée réelle)
import { planifierEndurance } from '../../functions/_shared/plan-endurance.ts';
import { habitudesDepuisResume } from '../../functions/_shared/semaine.ts';
import { vieSportDepuisResume } from '../../functions/_shared/analyse-sport.ts';
import { evaluerPlan } from '../../functions/_shared/planning.ts';
import { ajouterJours } from '../../functions/_shared/dates-iso.ts';
import type { Operation } from '../../functions/_shared/planning.ts';

let graine = 4242;
const alea = () => { graine = (graine * 1664525 + 1013904223) % 4294967296; return graine / 4294967296; };
const entre = (a: number, b: number) => a + alea() * (b - a);
const choix = <T,>(l: T[]): T => l[Math.floor(alea() * l.length)];
const AUJ = '2026-11-09';
const LIBRE = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' } as never;
const ORDRE: Record<string, number> = { Base: 0, Développement: 1, Spécifique: 2, Affûtage: 3 };
type Sport = 'velo' | 'natation';

function cas(sport: Sport) {
  const arch = choix(['debutant', 'actif', 'gros', 'reprise']);
  const actif = arch === 'actif' || arch === 'gros';
  const pic = Math.round(entre(sport === 'velo' ? 240 : 90, sport === 'velo' ? 720 : 280));
  const s90 = arch === 'gros' ? Math.round(entre(30, 60)) : actif ? Math.round(entre(6, 25)) : 0;
  const m90 = actif ? s90 * Math.round(entre(sport === 'velo' ? 50 : 30, sport === 'velo' ? 130 : 60)) : 0;
  const w1200 = Math.round(entre(150, 330));
  const vie = arch === 'debutant' ? null : {
    sport, premiere_sortie: '2019-04-01', derniere_sortie: actif ? '2026-11-02' : '2026-04-01', jours_depuis_derniere: actif ? 7 : 222, sorties: 200, heures_total: 300,
    annees: [{ annee: 2023, sorties: 80, heures: 100, km: 3000, semaines_actives: 40 }],
    plus_grosse_semaine: { du: '2023-06-05', sorties: 4, minutes: pic }, plus_longue_sortie: { date: '2023-06-10', minutes: Math.round(pic * 0.45), km: 60 }, arrets: [],
    recent_90_jours: { sorties: s90, minutes: m90, plus_longue_minutes: actif ? Math.round((m90 / Math.max(1, s90)) * 1.6) : 0 },
    records: sport === 'velo' ? { par_annee: [], recent_24_mois: { w5: 800, w300: Math.round(w1200 * entre(1, 1.4)), w1200, w3600: Math.round(w1200 * 0.92), courbes: Math.round(entre(0, 30)) } } : { par_annee: [], recent_24_mois: { court_s100: 105, long_s100: 120 } },
  };
  const vol = actif ? { seances_28_jours: Math.round(s90 / 3), minutes_28_jours: Math.round(m90 / 3), plus_longue_minutes_28_jours: Math.round((m90 / Math.max(1, s90)) * 1.6) } : { seances_28_jours: 0, minutes_28_jours: 0 };
  const resume = { [`vie_${sport}`]: vie, volume_par_sport: { [sport]: vol } };
  const semaines = Math.round(entre(2, 40));
  return {
    arch, sport, resume,
    d: { sport, date: ajouterJours(AUJ, semaines * 7 + 3), seancesParSemaine: Math.round(entre(2, 6)), distanceKm: choix([undefined, sport === 'velo' ? 40 : 0.75, sport === 'velo' ? 160 : 3.8]), ...(alea() < 0.3 ? { sansTest: true } : {}), ...(sport === 'velo' && alea() < 0.3 ? { ftp: Math.round(entre(120, 380)) } : {}), ...(sport === 'natation' && alea() < 0.3 ? { test: { t400: 420, t200: 200 } } : {}) },
  };
}

const N = Number(process.argv[2] ?? 1000);
const fautes = new Map<string, number>();
let exemple: string | null = null;
for (let i = 0; i < N; i++) {
  const c = cas(choix<Sport>(['velo', 'natation']));
  const base = { aujourdhui: AUJ, ctl: 40, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [], gardeFou: LIBRE } as never;
  const f: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = planifierEndurance(c.d as any, [], base, habitudesDepuisResume(c.resume), null, vieSportDepuisResume(c.resume, c.sport));
  const ops = r.operations.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter').sort((a, b) => a.proposition.date.localeCompare(b.proposition.date));
  if (!ops.length) f.push('plan vide');
  const ev = evaluerPlan(r.operations, [], base);
  if (!ev.ok) f.push(`refusé par le validateur : ${ev.erreurs[0]}`);
  let phaseMax = 0;
  for (const o of ops) {
    const nom = o.detail?.nom ?? '';
    if (!o.detail || !o.phase) { f.push('séance sans détail ou sans phase'); continue; }
    if (/NaN|undefined|Infinity/.test(nom + o.detail.resume)) f.push(`texte cassé : ${nom}`);
    const somme = o.detail.structure.reduce((t, b) => t + b.reps * b.work.min + (b.type === 'interval' && b.rec ? b.reps * b.rec.min : 0), 0);
    if (Math.abs(somme - o.proposition.minutes) > 0.6) f.push(`somme des blocs ${somme} ≠ ${o.proposition.minutes} (${nom})`);
    if (o.detail.structure.some((b) => !(b.work.min > 0))) f.push(`bloc de durée nulle (${nom})`);
    if (o.proposition.date >= c.d.date) f.push('séance le jour J ou après');
    if (o.phase !== 'Récupération') { const k = ORDRE[o.phase]; if (k < phaseMax) f.push('phases dans le désordre'); phaseMax = Math.max(phaseMax, k); }
    if (o.phase === 'Affûtage' && o.detail.structure.some((b) => b.type === 'interval' && b.reps > 3 && c.sport === 'velo')) f.push('affûtage : trop de répétitions');
  }
  if (ops.filter((o) => /Test/.test(o.detail?.nom ?? '')).length > 1) f.push('plus d\'un test');
  if (c.d.sansTest && ops.some((o) => /Test/.test(o.detail?.nom ?? ''))) f.push('test malgré sans_test');
  const mesure = c.sport === 'velo' ? !!(c.d as { ftp?: number }).ftp : !!(c.d as { test?: unknown }).test;
  if (mesure && ops.some((o) => /Test/.test(o.detail?.nom ?? ''))) f.push('test alors que tout est mesuré');
  if (/ftp/i.test(JSON.stringify((c.d as { ftp?: number }).ftp ?? '')) === false && c.sport === 'velo' && (c.d as { ftp?: number }).ftp && !ops.some((o) => / W/.test(o.detail?.nom ?? '')) && ops.some((o) => o.proposition.type === 'seuil')) f.push('FTP connue mais pas de watts');
  for (const x of f) { fautes.set(x.replace(/[\d.]+/g, 'N'), (fautes.get(x.replace(/[\d.]+/g, 'N')) ?? 0) + 1); exemple ??= `${c.sport} ${c.arch} : ${x}`; }
}
console.log(`${N} sportifs simulés`);
if (!fautes.size) console.log('0 faute détectée');
else { for (const [k, n] of [...fautes].sort((a, b) => b[1] - a[1])) console.log(`${n} × ${k}`); console.log('exemple :', exemple); }
