import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserSport, vieSportDepuisResume } from '../../functions/_shared/analyse-sport.ts';
import { habitudesDepuisResume, planifierSemaine, typeQualite } from '../../functions/_shared/semaine.ts';
import { planifierPeriode } from '../../functions/_shared/periode.ts';
import type { ContexteValidation } from '../../functions/_shared/validateur.ts';
import type { Operation } from '../../functions/_shared/planning.ts';

const AUJ = '2026-11-09';
const LIBRE = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' } as never;
const ctx = (): ContexteValidation => ({ aujourdhui: AUJ, ctl: 40, joursPasses: [], prevues: [], indisponibilites: [], joursDeRepos: [], competitions: [], gardeFou: LIBRE });
const ajouts = (ops: Operation[]) => ops.filter((o): o is Extract<Operation, { op: 'ajouter' }> => o.op === 'ajouter');

const vieVelo = (sur: Record<string, unknown> = {}, w: { w5?: number; w300: number; w1200: number; w3600?: number; courbes?: number } = { w300: 300, w1200: 250, courbes: 20 }) => ({
  sport: 'velo', premiere_sortie: '2019-04-01', derniere_sortie: '2025-05-05', jours_depuis_derniere: 553, sorties: 300, heures_total: 600,
  annees: [{ annee: 2019, sorties: 100, heures: 250, km: 5000, semaines_actives: 40 }, { annee: 2025, sorties: 20, heures: 40, km: 800, semaines_actives: 8 }],
  plus_grosse_semaine: { du: '2019-07-01', sorties: 5, minutes: 600 }, plus_longue_sortie: { date: '2019-07-06', minutes: 300, km: 140 },
  arrets: [{ du: '2020-01-01', au: '2025-02-01', jours: 1000 }], recent_90_jours: { sorties: 0, minutes: 0, plus_longue_minutes: 0 },
  records: { par_annee: [{ annee: 2019, w5: 900, w300: 320, w1200: 270, w3600: 240 }, { annee: 2025, w5: 800, w300: 300, w1200: 250, w3600: 220 }], recent_24_mois: { w5: 800, w300: w.w300, w1200: w.w1200, w3600: w.w3600 ?? 220, courbes: w.courbes ?? 20 } },
  ...sur,
});

test('vélo : toute la vie lue du résumé ; un cycliste sans sortie depuis 553 jours reprend, il ne débute pas', () => {
  const v = vieSportDepuisResume({ vie_velo: vieVelo() }, 'velo')!;
  assert.equal(v.sorties, 300);
  assert.equal(v.velo!.recent24!.w300, 300);
  const a = analyserSport(v, 'velo');
  assert.equal(a.etat, 'reprise');
  assert.equal(a.picSemaineMinutes, 600);
  const t = a.phrases.join(' ');
  assert.match(t, /depuis 2019/);
  assert.match(t, /10 h 00/);
  assert.match(t, /moins basse|plus basse|progressé|stable/);
  assert.ok(a.inconnues.some((i) => /arrêté le vélo/.test(i.sujet)));
  assert.equal(analyserSport(null, 'velo').etat, 'debutant');
  assert.equal(vieSportDepuisResume({ vie_velo: { sport: 'natation' } }, 'velo'), null, 'une vie d\'un autre sport est ignorée');
});

test('vélo : ce qui limite se lit sur le rapport 5 min / 20 min (24 mois, 5 courbes au moins)', () => {
  const lim = (w300: number, w1200: number, courbes = 20) => analyserSport(vieSportDepuisResume({ vie_velo: vieVelo({}, { w300, w1200, courbes }) }, 'velo'), 'velo');
  assert.equal(lim(330, 250).limite, 'endurance');   // 1,32 : pointe haute, soutenu à construire
  assert.equal(lim(260, 250).limite, 'vitesse');     // 1,04 : tient l'effort long, pointe à travailler
  assert.equal(lim(290, 250).limite, 'equilibre');   // 1,16
  const peu = lim(330, 250, 3);
  assert.equal(peu.limite, null, 'trop peu de courbes : pas de conclusion');
  assert.ok(peu.inconnues.some((i) => /puissance de pointe ou ta puissance soutenue/.test(i.sujet)));
});

test('natation : jamais de conclusion sur ce qui limite, le coach demande un test', () => {
  const v = vieSportDepuisResume({ vie_natation: { sport: 'natation', premiere_sortie: '2022-01-01', derniere_sortie: '2026-11-01', jours_depuis_derniere: 8, sorties: 80, heures_total: 70, annees: [], plus_grosse_semaine: { du: '2024-05-06', sorties: 4, minutes: 200 }, plus_longue_sortie: { date: '2024-05-05', minutes: 75, km: 3 }, arrets: [], recent_90_jours: { sorties: 12, minutes: 600, plus_longue_minutes: 70 }, records: { par_annee: [], recent_24_mois: { court_s100: 110, long_s100: 125 } } } }, 'natation')!;
  const a = analyserSport(v, 'natation');
  assert.equal(a.etat, 'actif');
  assert.equal(a.limite, null);
  assert.equal(a.moyenne90Minutes, 50);
  assert.ok(a.inconnues.some((i) => /400 m et sur 200 m/.test(i.question)));
  assert.match(a.phrases.join(' '), /1:50 en séance courte/);
});

test('habitudes : sans séance sur 28 jours mais avec des séances sur 90 jours, ce sont elles qui font référence (plus de durée par défaut)', () => {
  const v = vieVelo({ jours_depuis_derniere: 40, derniere_sortie: '2026-09-30', recent_90_jours: { sorties: 6, minutes: 540, plus_longue_minutes: 150 } });
  const h = habitudesDepuisResume({ vie_velo: v, volume_par_sport: { velo: { seances_28_jours: 0, minutes_28_jours: 0 } } });
  assert.equal(h.velo.moyenneMinutes, 90);
  assert.equal(h.velo.plusLongueMinutes, 150);
  assert.equal(h.velo.analyse!.etat, 'actif');
});

test('reprise : 35 % de la plus grosse semaine passée, que du facile, monte de semaine en semaine, intensité seulement au-delà de 75 %', () => {
  const h = habitudesDepuisResume({ vie_velo: vieVelo() });
  assert.equal(h.velo.moyenneMinutes, null);
  const sem = (rang: number) => planifierSemaine({ sports: [{ sport: 'velo', seances: 3 }], rang }, [], ctx(), h);
  const s0 = sem(0);
  const o0 = ajouts(s0.operations);
  assert.equal(o0.length, 3);
  assert.ok(o0.every((o) => o.proposition.type === 'endurance'), 'que du facile');
  const total0 = o0.reduce((t, o) => t + o.proposition.minutes, 0);
  assert.ok(Math.abs(total0 - 0.35 * 600) <= 3, `volume ${total0} ≈ 35 % de 600`);
  assert.ok(s0.profilUtilise.some((u) => /reprise du vélo : 35 %/.test(u)));
  // plus tard (rang 12 : 0,35 × 1,07^12 ≈ 0,79 ≥ 0,75) : qualité et sortie longue de nouveau possibles
  const o12 = ajouts(sem(12).operations);
  assert.ok(o12.some((o) => o.proposition.type !== 'endurance'), 'la qualité revient au-delà de 75 %');
  const total12 = o12.reduce((t, o) => t + o.proposition.minutes, 0);
  assert.ok(total12 > total0 * 1.9, `${total12} > ${total0}`);
});

test('plan de période d\'un cycliste qui reprend : volume qui monte, pas de séance dure avant d\'être revenu à 75 %', () => {
  const h = habitudesDepuisResume({ vie_velo: vieVelo() });
  const r = planifierPeriode({ sports: [{ sport: 'velo', seances: 3 }], semaines: 8 }, [], ctx(), h);
  const o = ajouts(r.operations);
  assert.ok(o.length >= 20);
  assert.ok(o.every((x) => x.proposition.type === 'endurance'), 'huit semaines à 35 % → 60 % : que du facile');
  const parSem = (w: number) => o.filter((x) => x.proposition.date >= `2026-11-${String(10 + w * 7).padStart(2, '0')}`).slice(0, 3).reduce((t, x) => t + x.proposition.minutes, 0);
  assert.ok(parSem(0) < 260);
  assert.ok(r.profilUtilise.some((u) => /reprise du vélo/.test(u)));
});

test('type de qualité : il suit la limite du sportif (vélo) et la natation reste au seuil', () => {
  const an = (limite: 'endurance' | 'vitesse' | 'equilibre' | null) => ({ limite }) as never;
  assert.equal(typeQualite('velo', an('endurance'), 0), 'seuil');
  assert.equal(typeQualite('velo', an('endurance'), 5), 'seuil');
  assert.deepEqual([0, 1, 2, 3].map((r) => typeQualite('velo', an('vitesse'), r)), ['vo2max', 'vo2max', 'seuil', 'vo2max']);
  assert.deepEqual([0, 1, 2, 3].map((r) => typeQualite('velo', an(null), r)), ['tempo', 'seuil', 'tempo', 'seuil']);
  assert.equal(typeQualite('natation', null, 0), 'seuil');
});

test('reprise avec une petite plus grosse semaine : moins de séances plutôt que des séances ridicules, et le plan reste complet (pas d\'exception)', () => {
  const v = { sport: 'natation', premiere_sortie: '2023-01-01', derniere_sortie: '2025-01-01', jours_depuis_derniere: 678, sorties: 30, heures_total: 20, annees: [], plus_grosse_semaine: { du: '2023-01-02', sorties: 3, minutes: 90 }, plus_longue_sortie: { date: '2023-01-05', minutes: 45, km: 1.5 }, arrets: [], recent_90_jours: { sorties: 0, minutes: 0, plus_longue_minutes: 0 }, records: {} };
  const h = habitudesDepuisResume({ vie_natation: v });
  const r = planifierSemaine({ sports: [{ sport: 'natation', seances: 5 }] }, [], ctx(), h);
  const o = ajouts(r.operations);
  // 35 % de 90 min = 31 min : une seule séance de 20 min au moins
  assert.equal(o.length, 1);
  assert.ok(o[0].proposition.minutes >= 20 && o[0].proposition.minutes <= 35, String(o[0].proposition.minutes));
  assert.ok(r.abandons.some((a) => /je limite à 1 séance/.test(a)));
  const p = planifierPeriode({ sports: [{ sport: 'natation', seances: 5 }], semaines: 12 }, [], ctx(), h);
  assert.ok(ajouts(p.operations).length >= 12);
});
