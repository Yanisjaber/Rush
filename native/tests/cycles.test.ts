import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COULEURS_CYCLE, cycleVisible, joursDuCycle, SPORTS_CYCLE, validerCycle, type FormulaireCycle, avancementCycle, toucherJourPeriode } from '../src/data/calendrier/cycles.ts';
import { cyclesDuJour, grilleMois } from '../src/data/calendrier/calendrier.ts';
import type { Cycle } from '../src/data/types.ts';

const cycle = (id: string, de: string, a: string, couleur = '#e0a458'): Cycle => ({ id, name: id, from_date: de, to_date: a, color: couleur });
const form = (extra: Partial<FormulaireCycle> = {}): FormulaireCycle => ({ name: 'Bloc force', from_date: '2026-10-05', to_date: '2026-10-25', color: '#e0a458', ...extra });

test('COULEURS_CYCLE : huit couleurs #rrggbb, toutes différentes', () => {
  assert.equal(COULEURS_CYCLE.length, 8);
  assert.equal(new Set(COULEURS_CYCLE.map((c) => c.hex)).size, 8);
  for (const c of COULEURS_CYCLE) assert.match(c.hex, /^#[0-9a-f]{6}$/);
});

test('joursDuCycle : bornes incluses', () => {
  assert.equal(joursDuCycle(cycle('a', '2026-10-05', '2026-10-05')), 1);
  assert.equal(joursDuCycle(cycle('a', '2026-10-05', '2026-10-25')), 21);
  assert.equal(joursDuCycle(cycle('a', '2026-12-30', '2027-01-02')), 4); // à cheval sur deux années
});

test('validerCycle : un cycle valide est nettoyé (espaces)', () => {
  const r = validerCycle(form({ name: '  Bloc   force  ' }), []);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.valeur.name, 'Bloc force');
});

test('validerCycle : nom, dates et couleur', () => {
  const erreur = (f: FormulaireCycle) => { const r = validerCycle(f, []); return r.ok ? '' : r.erreur; };
  assert.match(erreur(form({ name: '   ' })), /nom/);
  assert.match(erreur(form({ name: 'x'.repeat(61) })), /trop long/);
  assert.match(erreur(form({ from_date: '' })), /début/);
  assert.match(erreur(form({ to_date: '2026-13-40' })), /début/); // une date qui n'existe pas
  assert.match(erreur(form({ from_date: '2026-10-10', to_date: '2026-10-09' })), /avant le début/);
  assert.match(erreur(form({ from_date: '2026-01-01', to_date: '2027-01-02' })), /366 jours/);
  assert.equal(validerCycle(form({ from_date: '2026-01-01', to_date: '2027-01-01' }), []).ok, true); // 366 jours pile
  assert.match(erreur(form({ color: 'rouge' })), /couleur/);
  assert.match(erreur(form({ color: '#ff5a4f; drop' })), /couleur/);
});

test('validerCycle : deux cycles le même jour sont permis, un troisième est refusé avec les noms des deux autres', () => {
  const deux = [cycle('Force', '2026-10-05', '2026-10-25'), cycle('Hyrox', '2026-10-15', '2026-11-18')];
  assert.equal(validerCycle(form({ from_date: '2026-10-01', to_date: '2026-10-14' }), deux).ok, true); // ne touche que « Force »
  assert.equal(validerCycle(form({ from_date: '2026-11-19', to_date: '2026-12-01' }), deux).ok, true); // après les deux
  const r = validerCycle(form({ from_date: '2026-10-20', to_date: '2026-10-22' }), deux);
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.erreur, /20 octobre.*« Force » et « Hyrox »/);
  // Un seul jour de chevauchement suffit à refuser
  assert.equal(validerCycle(form({ from_date: '2026-10-25', to_date: '2026-10-30' }), deux).ok, false);
});

test('validerCycle : en modifiant un cycle, il ne se compte pas lui-même', () => {
  const trois = [cycle('A', '2026-10-05', '2026-10-25'), cycle('B', '2026-10-15', '2026-11-18')];
  assert.equal(validerCycle(form({ from_date: '2026-10-05', to_date: '2026-10-24' }), trois, 'A').ok, true); // raccourcir A
  assert.equal(validerCycle(form({ from_date: '2026-10-05', to_date: '2026-10-24' }), trois).ok, false); // les mêmes dates, mais comme NOUVEAU cycle : un 3e du 15 au 24, refusé
  assert.equal(validerCycle(form({ from_date: '2026-10-16', to_date: '2026-10-24' }), [...trois, cycle('C', '2026-10-10', '2026-10-30')], 'A').ok, false); // B et C couvrent déjà ces jours
});

test('cyclesDuJour : dates incluses, le plus ancien d\'abord, deux au plus', () => {
  const liste = [cycle('B', '2026-10-15', '2026-11-18'), cycle('A', '2026-10-05', '2026-10-25'), cycle('C', '2026-10-01', '2026-10-31')];
  assert.deepEqual(cyclesDuJour(liste, '2026-10-20').map((c) => c.id), ['C', 'A']); // trois couvrent le jour : on n'en garde que deux
  assert.deepEqual(cyclesDuJour(liste, '2026-10-05').map((c) => c.id), ['C', 'A']);
  assert.deepEqual(cyclesDuJour(liste, '2026-11-18').map((c) => c.id), ['B']);
  assert.deepEqual(cyclesDuJour(liste, '2026-11-19'), []);
});

test('grilleMois : chaque jour reçoit ses cycles', () => {
  const g = grilleMois(2026, 9, { cycles: [cycle('A', '2026-10-05', '2026-10-25'), cycle('B', '2026-10-15', '2026-11-18')] }, new Date(2026, 9, 19));
  const jour = (iso: string) => g.semaines.flat().find((j) => j.iso === iso)!;
  assert.equal(jour('2026-10-04').cycles.length, 0);
  assert.deepEqual(jour('2026-10-10').cycles.map((c) => c.id), ['A']);
  assert.deepEqual(jour('2026-10-20').cycles.map((c) => c.id), ['A', 'B']);
  assert.deepEqual(jour('2026-10-31').cycles.map((c) => c.id), ['B']);
});

test('avancementCycle : « jour 22 sur 23 », ramené dans les bornes du cycle', () => {
  const c = { from_date: '2026-10-02', to_date: '2026-10-24' };
  assert.deepEqual(avancementCycle(c, '2026-10-02'), { jour: 1, total: 23, part: 1 / 23 });
  assert.deepEqual(avancementCycle(c, '2026-10-23'), { jour: 22, total: 23, part: 22 / 23 });
  assert.equal(avancementCycle(c, '2026-10-24').part, 1);
  assert.equal(avancementCycle(c, '2026-09-01').jour, 1); // avant le début
  assert.equal(avancementCycle(c, '2026-12-01').jour, 23); // après la fin
  assert.equal(avancementCycle({ from_date: '2026-10-05', to_date: '2026-10-05' }, '2026-10-05').total, 1); // un cycle d'un jour
});

test('toucherJourPeriode : un premier toucher pose le début, le suivant la fin ; avant le début, on recommence', () => {
  const premier = toucherJourPeriode({ debut: '2026-10-03', fin: '2026-10-25', attenteFin: false }, '2026-11-02');
  assert.deepEqual(premier, { debut: '2026-11-02', fin: '2026-11-02', attenteFin: true });
  const second = toucherJourPeriode(premier, '2026-11-20');
  assert.deepEqual(second, { debut: '2026-11-02', fin: '2026-11-20', attenteFin: false });
  // en attente de la fin, un jour avant le début devient le nouveau début
  assert.deepEqual(toucherJourPeriode(premier, '2026-10-30'), { debut: '2026-10-30', fin: '2026-10-30', attenteFin: true });
  // le même jour : un cycle d'un jour
  assert.deepEqual(toucherJourPeriode(premier, '2026-11-02'), { debut: '2026-11-02', fin: '2026-11-02', attenteFin: false });
  // une fois la période posée, un toucher recommence
  assert.deepEqual(toucherJourPeriode(second, '2026-12-01'), { debut: '2026-12-01', fin: '2026-12-01', attenteFin: true });
});

test('cycle et sport : un sport de la liste ou aucun, rien d\'autre', () => {
  const base = { name: 'Bloc', from_date: '2026-10-01', to_date: '2026-10-10', color: '#9b6b9e' };
  const ok = validerCycle({ ...base, sport: 'muscu' }, []);
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.valeur.sport, 'muscu');
  const sans = validerCycle({ ...base, sport: null }, []);
  assert.ok(sans.ok);
  if (sans.ok) assert.equal(sans.valeur.sport, null);
  assert.equal(validerCycle({ ...base, sport: 'tennis' }, []).ok, false);
  assert.equal(validerCycle({ ...base, sport: '' }, []).ok, false);
  assert.ok(SPORTS_CYCLE.includes('hyrox') && SPORTS_CYCLE.includes('autre'));
});

test('cycleVisible : « Tous » les voit tous, un sport voit les siens et ceux sans sport, Triathlon voit ses disciplines', () => {
  assert.equal(cycleVisible({ sport: 'muscu' }, 'tout'), true);
  assert.equal(cycleVisible({ sport: 'muscu' }, 'muscu'), true);
  assert.equal(cycleVisible({ sport: 'muscu' }, 'course'), false);
  assert.equal(cycleVisible({ sport: null }, 'course'), true);
  assert.equal(cycleVisible({}, 'hyrox'), true);
  assert.equal(cycleVisible({ sport: 'natation' }, 'triathlon'), true);
  assert.equal(cycleVisible({ sport: 'natation' }, 'duathlon'), false);
  assert.equal(cycleVisible({ sport: 'velo' }, 'duathlon'), true);
});
