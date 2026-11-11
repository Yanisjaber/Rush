// Banc d'essai : des centaines de coureurs fictifs (graine fixe) passent dans le moteur de plan de course ; on cherche les plans FAUX ou GÉNÉRIQUES.
// Lancer : node --experimental-strip-types supabase/tests/edge/simulation-coureurs.mts [nombre]   (aucun appel réseau, aucune donnée réelle)
import { equivalent, planifierCourse } from '../../functions/_shared/plan-course.ts';
import type { ProfilCourse } from '../../functions/_shared/plan-course.ts';
import { ajouterJours, ecartJours } from '../../functions/_shared/dates-iso.ts';
import type { Operation } from '../../functions/_shared/planning.ts';

let graine = 12345;
const alea = () => { graine = (graine * 1664525 + 1013904223) % 4294967296; return graine / 4294967296; };
const entre = (a: number, b: number) => a + alea() * (b - a);
const choix = <T,>(l: T[]): T => l[Math.floor(alea() * l.length)];
const AUJ = '2026-11-09';
const LIBRE = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' } as never;

type Arch = 'debutant' | 'loisir' | 'regulier' | 'gros' | 'reprise' | 'irregulier' | 'baisse';
export interface Cas { arch: Arch; profil: ProfilCourse | null; km: number; cible: number | undefined; semaines: number; k: number | undefined; niveau10: number }

function fabriquer(arch: Arch): Cas {
  const km = choix([5, 10, 10, 21.1]);
  const niveau10 = entre(2400, 4200); // secondes au 10 km
  const semMin: Record<Arch, [number, number]> = { debutant: [0, 0], loisir: [60, 120], regulier: [150, 260], gros: [320, 520], reprise: [0, 0], irregulier: [40, 200], baisse: [80, 200] };
  const [lo, hi] = semMin[arch];
  const sorties = (m: number) => (m === 0 ? 0 : Math.min(7, Math.max(1, Math.round(m / entre(45, 80)))));
  let semaines = Array.from({ length: 8 }, () => { const m = lo === hi ? 0 : Math.round(entre(lo, hi)); return { km: Math.round(m / 6), minutes: m, sorties: sorties(m) }; });
  if (arch === 'irregulier') semaines = semaines.map((s) => (alea() < 0.5 ? { km: 0, minutes: 0, sorties: 0 } : s));
  if (arch === 'baisse') semaines = semaines.map((s, i) => { const f = i < 4 ? 1 : 0.55; return { km: Math.round(s.km * f), minutes: Math.round(s.minutes * f), sorties: Math.max(1, Math.round(s.sorties * f)) }; });
  const total = semaines.reduce((t, s) => t + s.sorties, 0);
  const mins = semaines.reduce((t, s) => t + s.minutes, 0);
  const actif = total > 0;
  // la plus longue sortie reste cohérente avec ses semaines : entre 30 et 55 % de sa plus grosse semaine
  const plusLongue = Math.min(150, Math.max(25, Math.round(Math.max(...semaines.map((x) => x.minutes), 0) * entre(0.3, 0.55))));
  const profil: ProfilCourse | null = arch === 'debutant' ? null : {
    meilleurEffort: arch === 'reprise' || actif ? { date: '2025-09-01', km: 10, secondes: Math.round(niveau10), equiv10Secondes: Math.round(niveau10) } : null,
    effortRecent: actif && alea() < 0.7 ? { date: '2026-10-20', km: 8, secondes: Math.round(equivalent(niveau10, 10, 8) * 1.02), equiv10Secondes: Math.round(niveau10 * 1.02) } : null,
    sorties90: actif ? total + Math.round(total * 0.4) : 0,
    recent: { sorties: total, km: Math.round(mins / 6), minutes: mins, plusLongueMinutes: actif ? plusLongue : 0, allureMedianeSParKm: Math.round((niveau10 / 10) * 1.27), plusLongue30Minutes: actif ? Math.round(plusLongue * entre(0.8, 1)) : null },
    semaines, jours: { 1: 2, 3: 2, 6: 2 },
    vie: arch === 'reprise' ? { premiereSortie: '2020-01-01', derniereSortie: '2025-06-01', joursDepuisDerniere: 526, sorties: 400, kmTotal: 3000, heuresTotal: 280, annees: [], plusGrosseSemaine: { du: '2023-05-01', sorties: 5, km: 60, minutes: Math.round(entre(250, 420)) }, plusLongueSortie: null, arrets: [], meilleurEffortVie: null, meilleurParAnnee: [], ctlMax: null, vo2maxCourse: null, poidsParAnnee: null, sommeilParAnnee: null } : null,
  };
  const semainesPlan = Math.floor(entre(4, 20));
  const cibleOk = alea() < 0.6;
  const base10 = niveau10 * Math.pow(km / 10, 1.06);
  return { arch, profil, km, semaines: semainesPlan, niveau10, cible: cibleOk ? Math.round((base10 * entre(0.88, 1.02)) / 60) : undefined, k: alea() < 0.4 ? choix([3, 4, 5]) : undefined };
}

const DUR = (t: string) => !/footing|longue|recuperation/.test(t);
export function verifier(c: Cas): { ops: Extract<Operation, { op: 'ajouter' }>[]; fautes: string[]; r: ReturnType<typeof planifierCourse> } {
  const course = ajouterJours(AUJ, c.semaines * 7 + 3);
  const base = { aujourdhui: AUJ, ctl: 40, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [{ date: course }], gardeFou: LIBRE } as never;
  const r = planifierCourse({ date: course, km: c.km, tempsCibleMinutes: c.cible, seancesParSemaine: c.k, sansTest: false }, [], base, c.profil);
  const ops = r.operations.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter').sort((a, b) => a.proposition.date.localeCompare(b.proposition.date));
  const f: string[] = [];
  if (!ops.length) { f.push('plan vide'); return { ops, fautes: f, r }; }
  // 1. jamais deux séances dures collées
  const durs = ops.filter((o) => DUR(o.proposition.type)).map((o) => o.proposition.date);
  for (let i = 1; i < ops.length; i++) {
    const a = ops[i - 1].proposition, b = ops[i].proposition;
    if ((DUR(a.type) || a.type === 'sortie_longue') && (DUR(b.type) || b.type === 'sortie_longue') && ecartJours(a.date, b.date) === 1) f.push(`dures collées ${a.date} ${a.type} / ${b.type}`);
  }
  // 2. rien le jour de la course, rien de dur la veille
  if (ops.some((o) => o.proposition.date === course)) f.push('séance le jour de la course');
  if (ops.some((o) => o.proposition.date === ajouterJours(course, -1) && o.proposition.type !== 'footing_facile' && o.proposition.minutes > 30)) f.push('séance longue ou dure la veille');
  // 3. semaines de 7 jours glissants : montée raisonnable (hors récupération), jamais >35 % d'un coup
  const debut = ops[0].proposition.date;
  const nSem = Math.ceil((ecartJours(debut, course) + 1) / 7);
  const vol = Array.from({ length: nSem }, (_, w) => ops.filter((o) => ecartJours(debut, o.proposition.date) >= w * 7 && ecartJours(debut, o.proposition.date) < (w + 1) * 7).reduce((t, o) => t + o.proposition.minutes, 0));
  for (let w = 1; w < vol.length - 2; w++) { const ref = Math.max(...vol.slice(Math.max(0, w - 3), w)); if (ref > 60 && vol[w] > ref * 1.2) f.push(`saut de volume sem ${w}: ${ref}→${vol[w]}`); }
  // 4. sortie longue : jamais +25 % d'une semaine à l'autre ; jamais plus longue que 2 h 30
  const longues = ops.filter((o) => o.proposition.type === 'sortie_longue').map((o) => o.proposition.minutes);
  for (let i = 1; i < longues.length; i++) if (longues[i] > longues[i - 1] * 1.25 + 3) f.push(`longue ${longues[i - 1]}→${longues[i]}`);
  if (longues.some((m) => m > 150)) f.push('longue > 2 h 30');
  // 5. débutant sans donnée : aucune intensité hors sortie test
  if (c.arch === 'debutant' && ops.some((o) => DUR(o.proposition.type) && !/test/i.test(o.detail?.nom ?? '') && ecartJours(debut, o.proposition.date) < 42)) f.push('intensité pour un débutant dans les 6 premières semaines');
  // 6. départ : pas plus de 40 % au-dessus de sa semaine habituelle, sauf reprise (35 % du pic)
  if (c.profil && c.arch !== 'reprise' && c.arch !== 'debutant') {
    const hab = Math.max(...c.profil.semaines.slice(-4).map((s) => s.minutes), 1);
    if (vol[0] > hab * 1.6 + 30) f.push(`départ ${vol[0]} min pour une semaine habituelle de ${hab}`);
  }
  if (c.arch === 'reprise' && c.profil?.vie?.plusGrosseSemaine && vol[0] > 0.6 * c.profil.vie.plusGrosseSemaine.minutes) f.push(`reprise trop forte: ${vol[0]} vs pic ${c.profil.vie.plusGrosseSemaine.minutes}`);
  // 6b. reprise après un long arrêt : aucune séance dure tant que la semaine est sous 75 % de sa plus grosse semaine passée (fiche reprise-apres-arret)
  if (c.arch === 'reprise' && c.profil?.vie?.plusGrosseSemaine) {
    const pic = c.profil.vie.plusGrosseSemaine.minutes;
    for (const o of ops) { const w = Math.floor(ecartJours(debut, o.proposition.date) / 7); if (DUR(o.proposition.type) && vol[w] < 0.75 * pic) f.push(`intensité en reprise sem ${w} (${vol[w]} < 75 % de ${pic})`); }
  }
  // 7. séance trop courte ou structure absente
  for (const o of ops) { if (o.proposition.minutes < 15) f.push(`séance de ${o.proposition.minutes} min`); if (!o.detail?.structure?.length) f.push('séance sans structure'); }
  void durs;
  return { ops, fautes: f, r };
}

const N = Number(process.argv[2] ?? 600);
const MOTIF = process.env.MOTIF; // affiche le premier plan qui contient cette faute (expression régulière)
const archs: Arch[] = ['debutant', 'loisir', 'regulier', 'gros', 'reprise', 'irregulier', 'baisse'];
const compte = new Map<string, number>();
const exemples = new Map<string, string>();
const parArch = new Map<string, { n: number; mauvais: number }>();
for (let i = 0; i < N; i++) {
  const arch = archs[i % archs.length];
  const c = fabriquer(arch);
  let res;
  try { res = verifier(c); } catch (e) { const m = `EXCEPTION ${(e as Error).message}`; compte.set(m, (compte.get(m) ?? 0) + 1); continue; }
  if (MOTIF && res.fautes.some((x) => new RegExp(MOTIF).test(x))) {
    console.log(`CAS ${i} ${arch} km=${c.km} sem=${c.semaines} k=${c.k} cible=${c.cible} niveau10=${Math.round(c.niveau10)}\n  fautes: ${res.fautes.join(' | ')}\n  profil.semaines=${JSON.stringify(c.profil?.semaines.map((s) => s.minutes))}`);
    for (const o of res.ops) console.log(`  ${o.proposition.date} ${o.proposition.type.padEnd(16)} ${String(o.proposition.minutes).padStart(3)} ${o.detail?.nom}`);
    console.log(res.r.semaines.join('\n')); process.exit(0);
  }
  const p = parArch.get(arch) ?? { n: 0, mauvais: 0 }; p.n++; if (res.fautes.length) p.mauvais++; parArch.set(arch, p);
  for (const f of new Set(res.fautes.map((x) => x.replace(/[\d:.-]+/g, '#')))) { compte.set(f, (compte.get(f) ?? 0) + 1); if (!exemples.has(f)) exemples.set(f, `${arch} km=${c.km} sem=${c.semaines} k=${c.k} cible=${c.cible} → ${res.fautes[0]}`); }
}
console.log(`${N} coureurs simulés`);
for (const [a, p] of parArch) console.log(`  ${a.padEnd(10)} ${p.n} cas, ${p.mauvais} avec au moins une faute`);
for (const [f, n] of [...compte].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)} × ${f}\n       ex: ${exemples.get(f)}`);
