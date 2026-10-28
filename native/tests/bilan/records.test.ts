import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import { courbePuissance, recordsPeriodes, recordsRegularite, recordsSeance, recordsVelo, VITESSE_MAX_CREDIBLE, wattsParKg, type SortieVelo } from '../../src/data/bilan/records.ts';

const act = (iso: string, o: Partial<ActiviteBilan> = {}): ActiviteBilan => ({ id: `a-${iso}-${o.name ?? ''}`, name: `Sortie ${iso}`, iso, sport: 'cyclisme', famille: 'velo', duree_min: 60, distance_km: 30, d_plus: 100, tss: 50, ...o });

test('recordsPeriodes : meilleur jour, semaine et mois, avec le podium', () => {
  // 2026-03-02 = lundi. Semaine du 2 mars : 2 séances le lundi (120 min) + 1 le mercredi (60) ; semaine du 9 mars : 1 séance (90)
  const acts = [act('2026-03-02', { duree_min: 60, name: 'a' }), act('2026-03-02', { duree_min: 60, name: 'b' }), act('2026-03-04', { duree_min: 60 }), act('2026-03-10', { duree_min: 90 }), act('2026-04-01', { duree_min: 30 })];
  const g = recordsPeriodes(acts, 'heures');
  const jour = g.records.find((r) => r.cle === 'jour')!;
  assert.equal(jour.top[0].valeur, 2); // 2 h le lundi 2 mars
  assert.equal(jour.top[0].iso, '2026-03-02');
  assert.equal(jour.top[0].detail, '2 séances');
  assert.equal(jour.unite, 'h');
  const semaine = g.records.find((r) => r.cle === 'semaine')!;
  assert.deepEqual(semaine.top.map((e) => [e.iso, e.valeur]), [['2026-03-02', 3], ['2026-03-09', 1.5], ['2026-03-30', 0.5]]);
  const mois = g.records.find((r) => r.cle === 'mois')!;
  assert.deepEqual(mois.top.map((e) => [e.iso, e.valeur]), [['2026-03-01', 4.5], ['2026-04-01', 0.5]]);
  assert.equal(mois.periode, 'mois');
});

test('recordsPeriodes : une mesure à zéro (la distance en musculation) ne donne aucun record', () => {
  const g = recordsPeriodes([act('2026-03-02', { distance_km: 0 })], 'distance_km');
  assert.deepEqual(g.records, []);
});

test('recordsSeance : les quatre records et leur podium, sans les mesures à zéro', () => {
  const acts = [act('2026-03-01', { distance_km: 122, duree_min: 385, tss: 90, d_plus: 3000, name: 'Ski' }), act('2026-03-01', { distance_km: 10, d_plus: 5400, name: 'Vélo' }), act('2026-04-02', { distance_km: 70, duree_min: 200, tss: 120, d_plus: 800 })];
  const g = recordsSeance(acts);
  assert.deepEqual(g.records.map((r) => r.cle), ['distance', 'duree', 'tss', 'dplus']);
  assert.equal(g.records[0].top[0].valeur, 122);
  assert.equal(g.records[0].top[0].nom, 'Ski');
  assert.equal(g.records[0].top.length, 3);
  assert.equal(g.records[3].top[0].valeur, 8400); // 3000 + 5400 le même jour
  assert.equal(g.records[3].top[0].id, null); // un jour cumule plusieurs séances : rien à ouvrir
  // sans distance (musculation) : plus de record de distance
  const muscu = recordsSeance([act('2026-03-01', { distance_km: 0, d_plus: 0, tss: 40 })]);
  assert.deepEqual(muscu.records.map((r) => r.cle), ['duree', 'tss']);
});

test('recordsRegularite : la plus longue série de jours et le plus de séances en une semaine', () => {
  const acts = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-04', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-31', '2026-04-01'].map((iso, i) => act(iso, { name: `s${i}` }));
  const g = recordsRegularite(acts);
  const serie = g.records.find((r) => r.cle === 'serie')!;
  assert.deepEqual(serie.top.map((e) => [e.valeur, e.iso, e.fin]), [[4, '2026-03-10', '2026-03-13'], [3, '2026-03-02', '2026-03-04'], [2, '2026-03-31', '2026-04-01']]);
  const sem = g.records.find((r) => r.cle === 'seances_semaine')!;
  assert.deepEqual(sem.top[0], { valeur: 4, nom: '', iso: '2026-03-02', id: null }); // 4 séances (dont 2 le même jour) du 2 au 8 mars… et 4 la semaine du 9 : la plus ancienne devant
});

const sortie = (iso: string, o: Partial<SortieVelo> = {}): SortieVelo => ({ id: `v-${iso}`, name: `Vélo ${iso}`, iso, sport: 'Ride', distance_km: 60, duree_min: 120, d_plus: 500, kj: 1200, vitesse_max: 60, p5: null, p60: null, p300: null, p1200: null, p3600: null, ...o });

test('recordsVelo : la puissance par durée, la vitesse crédible, les sorties', () => {
  const sorties = [
    sortie('2026-01-10', { p5: 900, p1200: 250, p3600: 220, vitesse_max: 62, kj: 1500 }),
    sortie('2026-02-10', { p5: 1100, p1200: 280, vitesse_max: 113.8, sport: 'VirtualRide' }), // virtuel : vitesse écartée
    sortie('2026-03-10', { p1200: 270, vitesse_max: 96.5, distance_km: 6.7, duree_min: 30 }), // trop court et trop rapide : écartée
    sortie('2026-04-10', { vitesse_max: 78, distance_km: 110, duree_min: 200, d_plus: 1800 }),
  ];
  const g = recordsVelo(sorties);
  assert.deepEqual(g.map((x) => x.cle), ['puissance', 'vitesse', 'sorties']);
  const p = g[0].records;
  assert.deepEqual(p.map((r) => r.cle), ['p5', 'p1200', 'p3600']); // pas de record 1 min ni 5 min : aucune sortie n'a ces valeurs
  assert.deepEqual(p.find((r) => r.cle === 'p1200')!.top.map((e) => e.valeur), [280, 270, 250]);
  const vmax = g[1].records.find((r) => r.cle === 'vmax')!;
  assert.deepEqual(vmax.top.map((e) => e.valeur), [78, 62]); // le vélo virtuel et la sortie de 6,7 km à 96,5 km/h sont écartés
  assert.ok(VITESSE_MAX_CREDIBLE < 100);
  const vmoy = g[1].records.find((r) => r.cle === 'vmoy')!;
  assert.equal(vmoy.top[0].valeur, 33); // 110 km en 3 h 20 = 33 km/h ; les autres : 30 km/h ; la sortie de 6,7 km est écartée
  assert.equal(g[2].records.find((r) => r.cle === 'distance')!.top[0].valeur, 110);
  assert.equal(g[2].records.find((r) => r.cle === 'kj')!.top[0].valeur, 1500);
});

test('courbePuissance : la meilleure puissance de chaque durée, null si aucune', () => {
  const c = courbePuissance([sortie('2026-01-10', { p5: 900, p1200: 250 }), sortie('2026-02-10', { p5: 1000 })]);
  assert.deepEqual(c.map((x) => x.watts), [1000, null, null, 250, null]);
  assert.deepEqual(c.map((x) => x.secondes), [5, 60, 300, 1200, 3600]);
});

test('wattsParKg : une décimale, rien sans poids valable', () => {
  assert.equal(wattsParKg(259, 59), 4.4);
  assert.equal(wattsParKg(259, null), null);
  assert.equal(wattsParKg(259, 5), null);
});
