// Banc d'essai vélo et natation : des cyclistes et des nageurs fictifs (graine fixe) passent dans le planificateur de période ; on cherche les plans faux.
// Lancer : node --experimental-strip-types supabase/tests/edge/simulation-velo-natation.mts [nombre]   (aucun réseau, aucune donnée réelle)
import { analyserSport, vieSportDepuisResume } from '../../functions/_shared/analyse-sport.ts';
import { habitudesDepuisResume } from '../../functions/_shared/semaine.ts';
import { planifierPeriode } from '../../functions/_shared/periode.ts';
import { ajouterJours, ecartJours } from '../../functions/_shared/dates-iso.ts';
import type { Operation } from '../../functions/_shared/planning.ts';

let graine = 777;
const alea = () => { graine = (graine * 1664525 + 1013904223) % 4294967296; return graine / 4294967296; };
const entre = (a: number, b: number) => a + alea() * (b - a);
const choix = <T,>(l: T[]): T => l[Math.floor(alea() * l.length)];
const AUJ = '2026-11-09';
const LIBRE = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' } as never;

type Sport = 'velo' | 'natation';
type Arch = 'debutant' | 'actif' | 'gros' | 'reprise' | 'reprise_longue';
interface Cas { sport: Sport; arch: Arch; resume: Record<string, unknown>; seances: number; semaines: number; pic: number; limiteAttendue: string | null; w300?: number; w1200?: number }

function fabriquer(sport: Sport, arch: Arch): Cas {
  const pic = Math.round(entre(sport === 'velo' ? 240 : 90, sport === 'velo' ? 720 : 280));
  const sortiesPic = sport === 'velo' ? Math.round(entre(3, 6)) : Math.round(entre(2, 5));
  const seances = Math.min(6, Math.max(1, Math.round(entre(1.5, 5))));
  const semaines = Math.round(entre(3, 20));
  const actif = arch === 'actif' || arch === 'gros';
  const sorties90 = arch === 'gros' ? Math.round(entre(30, 60)) : actif ? Math.round(entre(6, 25)) : 0;
  const minutes90 = actif ? sorties90 * Math.round(entre(sport === 'velo' ? 50 : 30, sport === 'velo' ? 130 : 60)) : 0;
  const w1200 = Math.round(entre(150, 330));
  const w300 = Math.round(w1200 * entre(1.0, 1.4));
  const vie = arch === 'debutant' ? null : {
    sport, premiere_sortie: '2019-04-01', derniere_sortie: actif ? '2026-11-02' : arch === 'reprise' ? '2026-04-01' : '2025-02-01',
    jours_depuis_derniere: actif ? 7 : arch === 'reprise' ? 222 : 647, sorties: 200, heures_total: 300,
    annees: [{ annee: 2023, sorties: 80, heures: 100, km: 3000, semaines_actives: 40 }],
    plus_grosse_semaine: { du: '2023-06-05', sorties: sortiesPic, minutes: pic }, plus_longue_sortie: { date: '2023-06-10', minutes: Math.round(pic * 0.45), km: 60 },
    arrets: [], recent_90_jours: { sorties: sorties90, minutes: minutes90, plus_longue_minutes: actif ? Math.round(minutes90 / Math.max(1, sorties90) * 1.6) : 0 },
    records: sport === 'velo' ? { par_annee: [], recent_24_mois: { w5: 800, w300, w1200, w3600: Math.round(w1200 * 0.92), courbes: Math.round(entre(0, 30)) } } : { par_annee: [], recent_24_mois: { court_s100: 105, long_s100: 120 } },
  };
  const courbes = vie && sport === 'velo' ? (vie.records as { recent_24_mois: { courbes: number } }).recent_24_mois.courbes : 0;
  const ratio = Math.round((w300 / w1200) * 100) / 100;
  const limiteAttendue = sport === 'velo' && vie && courbes >= 5 ? (ratio >= 1.22 ? 'endurance' : ratio <= 1.08 ? 'vitesse' : 'equilibre') : null;
  const vol28 = actif ? { seances_28_jours: Math.round(sorties90 / 3), minutes_28_jours: Math.round(minutes90 / 3), plus_longue_minutes_28_jours: Math.round(minutes90 / Math.max(1, sorties90) * 1.6) } : { seances_28_jours: 0, minutes_28_jours: 0 };
  return { sport, arch, seances, semaines, pic, limiteAttendue, w300, w1200, resume: { [`vie_${sport}`]: vie, volume_par_sport: { [sport]: vol28 } } };
}

const DURS = new Set(['seuil', 'vo2max', 'vitesse']);
function verifier(c: Cas): string[] {
  const f: string[] = [];
  const base = { aujourdhui: AUJ, ctl: 40, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [], gardeFou: LIBRE } as never;
  const h = habitudesDepuisResume(c.resume);
  const r = planifierPeriode({ sports: [{ sport: c.sport, seances: c.seances }], semaines: c.semaines }, [], base, h);
  const ops = r.operations.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter').sort((a, b) => a.proposition.date.localeCompare(b.proposition.date));
  if (!ops.length) return ['plan vide'];
  const debut = ajouterJours(AUJ, 1);
  const vol = (w: number) => ops.filter((o) => ecartJours(debut, o.proposition.date) >= w * 7 && ecartJours(debut, o.proposition.date) < (w + 1) * 7).reduce((t, o) => t + o.proposition.minutes, 0);
  const a = analyserSport(vieSportDepuisResume(c.resume, c.sport), c.sport);
  // 1. jamais deux séances dures collées, jamais plus d'une séance par jour
  const jours = ops.map((o) => o.proposition.date);
  if (new Set(jours).size !== jours.length) f.push('deux séances le même jour');
  for (let i = 1; i < ops.length; i++) if ((DURS.has(ops[i - 1].proposition.type) || ops[i - 1].proposition.type === 'sortie_longue') && (DURS.has(ops[i].proposition.type) || ops[i].proposition.type === 'sortie_longue') && ecartJours(ops[i - 1].proposition.date, ops[i].proposition.date) === 1) f.push('dures collées');
  // 2. reprise : que du facile tant que le volume est sous 75 % du pic, départ à 35 % du pic, volume croissant
  if (a.etat === 'reprise' && a.picSemaineMinutes) {
    const pic = a.picSemaineMinutes;
    if (vol(0) > 0.35 * pic * 1.15 + 15) f.push(`reprise : départ ${vol(0)} > 35 % de ${pic}`);
    for (const o of ops) { const w = Math.floor(ecartJours(debut, o.proposition.date) / 7); if ((DURS.has(o.proposition.type) || o.proposition.type === 'sortie_longue') && vol(w) < 0.7 * pic) f.push(`reprise : séance dure ou longue en semaine ${w} (${vol(w)} < 70 % de ${pic})`); }
    if (vol(0) > pic) f.push('reprise : plus que le pic dès la première semaine');
  }
  // 3. débutant : pas de séance dure, pas de longue
  if (a.etat === 'debutant' && ops.some((o) => DURS.has(o.proposition.type) || o.proposition.type === 'sortie_longue')) f.push('débutant : séance dure ou longue');
  // 4. actif : le plan ne dépasse pas de plus de 60 % ce qu'il fait déjà (sur ses séances habituelles), et n'est pas ridiculement plus bas
  if (a.etat === 'actif' && a.moyenne90Minutes) {
    const parSeance = ops.slice(0, c.seances).reduce((t, o) => t + o.proposition.minutes, 0) / Math.min(c.seances, ops.length);
    if (parSeance > a.moyenne90Minutes * 1.8 + 10) f.push(`actif : séances de ${Math.round(parSeance)} min pour une habitude de ${a.moyenne90Minutes}`);
  }
  // 5. le type de qualité suit la limite attendue (vélo)
  if (c.sport === 'velo') {
    const q = ops.filter((o) => ['tempo', 'seuil', 'vo2max'].includes(o.proposition.type)).map((o) => o.proposition.type);
    if (a.limite !== (c.limiteAttendue as never)) f.push(`limite lue ${a.limite} ≠ attendue ${c.limiteAttendue}`);
    if (a.limite === 'endurance' && q.some((t) => t !== 'seuil')) f.push('endurance : autre chose que du seuil');
    if (a.limite === 'vitesse' && q.length >= 2 && !q.includes('vo2max')) f.push('vitesse : aucune VO2max');
    if (a.limite === null && q.includes('vo2max')) f.push('limite inconnue : VO2max proposée sans savoir');
  } else if (ops.some((o) => o.proposition.type === 'vitesse')) f.push('natation : séance de vitesse proposée sans savoir ce qui limite');
  // 6. au moins un jour de repos par semaine
  for (let w = 0; w * 7 < c.semaines * 7; w++) if (ops.filter((o) => ecartJours(debut, o.proposition.date) >= w * 7 && ecartJours(debut, o.proposition.date) < (w + 1) * 7).length > 6) f.push('pas de jour de repos');
  return f;
}

const N = Number(process.argv[2] ?? 600);
const archs: Arch[] = ['debutant', 'actif', 'gros', 'reprise', 'reprise_longue'];
const compte = new Map<string, number>();
const ex = new Map<string, string>();
const parArch = new Map<string, { n: number; mauvais: number }>();
for (let i = 0; i < N; i++) {
  const sport: Sport = i % 2 === 0 ? 'velo' : 'natation';
  const arch = archs[Math.floor(i / 2) % archs.length];
  const c = fabriquer(sport, arch);
  let fautes: string[];
  try { fautes = verifier(c); } catch (e) { fautes = [`EXCEPTION ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`]; }
  const k = `${sport}/${arch}`;
  const p = parArch.get(k) ?? { n: 0, mauvais: 0 }; p.n++; if (fautes.length) p.mauvais++; parArch.set(k, p);
  for (const x of new Set(fautes.map((y) => y.replace(/[\d.]+/g, '#')))) { compte.set(x, (compte.get(x) ?? 0) + 1); if (!ex.has(x)) ex.set(x, `${k} séances=${c.seances} sem=${c.semaines} pic=${c.pic} → ${fautes[0]}`); }
}
console.log(`${N} sportifs simulés`);
for (const [a, p] of [...parArch].sort()) console.log(`  ${a.padEnd(22)} ${p.n} cas, ${p.mauvais} avec au moins une faute`);
for (const [x, n] of [...compte].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)} × ${x}\n       ex: ${ex.get(x)}`);
