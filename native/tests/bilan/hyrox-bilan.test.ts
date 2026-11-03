import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classementTotaux, niveauGlobalHyrox, PILIERS_HYROX, recordsParSegment, recordTotal, testsDeLAnnee, testsExploitables } from '../../src/data/bilan/hyrox-bilan.ts';
import { texteRecordSimple } from '../../src/data/bilan/records-texte.ts';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import type { TestHyrox } from '../../src/data/types.ts';

const maintenant = new Date(2026, 5, 15, 12);
let n = 0;
/** Un test : un run de `run` secondes et une station de `station` secondes, huit fois ; `modif` change des segments (index → secondes). */
const test16 = (date: string, run: number, station: number, modif: Record<number, number> = {}, o: Partial<TestHyrox> = {}): TestHyrox => {
  const segments = Array.from({ length: 16 }, (_, i) => modif[i] ?? (i % 2 === 0 ? run : station));
  return { id: `t${n++}`, date, label: `Test ${date}`, kind: 'test', segments, total_s: segments.reduce((a, b) => a + b, 0), source: 'manuel', activity_id: null, notes: null, ...o };
};
const seance = (iso: string, min = 60): ActiviteBilan => ({ id: `h-${iso}`, name: 'Hyrox', iso, sport: 'hyrox', famille: 'hyrox', duree_min: min, distance_km: 0, d_plus: 0, tss: 50 });

test('testsExploitables : seulement les tests complets (16 segments positifs), du plus récent au plus ancien', () => {
  const a = test16('2026-01-10', 300, 200);
  const b = test16('2026-03-10', 290, 190);
  const incomplet: TestHyrox = { ...test16('2026-02-01', 300, 200), segments: [300, 200] };
  const zero = test16('2026-02-02', 300, 200, { 3: 0 });
  assert.deepEqual(testsExploitables([a, incomplet, b, zero]).map((t) => t.id), [b.id, a.id]);
  assert.equal(testsDeLAnnee([a, test16('2025-12-31', 300, 200)], 2026).length, 1);
});

test('recordTotal et classementTotaux : le plus petit temps gagne, le classement donne le lien vers la séance', () => {
  const lent = test16('2026-01-10', 300, 200, {}, { activity_id: 'act1' });
  const rapide = test16('2026-03-10', 280, 180, {}, { activity_id: null });
  const moyen = test16('2026-02-10', 290, 190, {}, { label: 'Course Paris', kind: 'course', activity_id: 'act3' });
  const r = recordTotal([lent, rapide, moyen])!;
  assert.equal(r.test.id, rapide.id);
  assert.equal(r.valeur, 8 * 280 + 8 * 180);
  const c = classementTotaux([lent, rapide, moyen]);
  assert.deepEqual(c.map((e) => e.valeur), [rapide.total_s, moyen.total_s, lent.total_s]);
  assert.deepEqual(c.map((e) => e.id), ['', 'act3', 'act1']);
  assert.equal(c[1].nom, 'Course Paris');
  assert.equal(classementTotaux([lent, rapide, moyen], 2).length, 2);
  assert.equal(recordTotal([]), null);
});

test('recordsParSegment : le meilleur temps de chaque segment (peut venir de tests différents), l\'écart du dernier test', () => {
  const ancien = test16('2026-01-10', 300, 200, { 0: 250, 1: 230 }); // run 1 à 250 (record), SkiErg lent (230)
  const dernier = test16('2026-03-10', 290, 190, { 1: 170 }); // SkiErg à 170 (record), run 1 à 290
  const r = recordsParSegment([ancien, dernier]);
  assert.equal(r.length, 16);
  assert.deepEqual(r.slice(0, 2).map((x) => x.segment.cle), ['run1', 'ski']);
  const run1 = r[0], ski = r[1], run2 = r[2];
  assert.equal(run1.meilleur, 250);
  assert.equal(run1.test.id, ancien.id);
  assert.equal(run1.dernier, 290);
  assert.equal(run1.ecart, 40); // le dernier test est 40 s plus lent que le record
  assert.equal(ski.meilleur, 170);
  assert.equal(ski.test.id, dernier.id);
  assert.equal(ski.ecart, null); // le dernier test est le record
  assert.equal(run2.meilleur, 290); // 290 contre 300
  assert.deepEqual(recordsParSegment([]), []);
});

test('niveauGlobalHyrox : 4 piliers, 100 pour ton meilleur de toujours, la preuve demande 2 tests dans l\'année', () => {
  const g = niveauGlobalHyrox(
    [
      test16('2025-03-01', 300, 200), test16('2025-09-01', 280, 190), // 2025 : meilleur total 8×280 + 8×190
      test16('2026-02-01', 350, 230), test16('2026-04-01', 360, 240), // 2026 : plus lent
    ],
    [],
    maintenant,
  )!;
  assert.deepEqual(g.piliers.map((p) => p.cle), PILIERS_HYROX.map((p) => p.cle));
  const a25 = g.annees[0], a26 = g.annees[1];
  assert.equal(a25.piliers.total, 100); // ton record (le test de septembre 2025)
  assert.equal(a25.piliers.runs, 100);
  assert.equal(a25.piliers.stations, 100);
  // 2026 : meilleur total = 8×350 + 8×230 = 4640 contre 3760 → rapport 0,8103 → (0,8103 − 0,75) ÷ 0,25 = 24,1
  assert.ok(Math.abs(a26.piliers.total - ((3760 / 4640 - 0.75) / 0.25) * 100) < 1e-6, `${a26.piliers.total}`);
  assert.ok(a26.piliers.runs < a25.piliers.runs && a26.piliers.stations < a25.piliers.stations);
  // Sans séance Hyrox, le volume se juge sur le nombre de tests (2 tests en 2025 comme en 2026) : 4 piliers prouvés
  assert.equal(a25.nbPiliers, 4);
  assert.ok(a25.piliers.volume > 0 && a25.preuves.volume === 1); // 2026 a plus de tests par an (2 en 166 jours) : la référence est plus haute que 2025
  assert.ok(a25.global !== null && a26.global !== null && a25.global > a26.global);
  assert.equal(g.meilleur.an, 2025);
});

test('niveauGlobalHyrox : un seul test dans l\'année réduit la note de moitié ; le volume se juge sur les séances Hyrox, annualisé', () => {
  const g = niveauGlobalHyrox([test16('2024-05-01', 300, 200), test16('2024-06-01', 300, 200), test16('2026-02-01', 300, 200)], [], maintenant)!;
  assert.equal(g.annees[0].piliers.total, 100);
  assert.equal(g.annees[1].piliers.total, 50); // 1 test sur 2 demandés : la moitié de la note
  assert.equal(g.annees[1].preuves.total, 0.5);
  const avecSeances: ActiviteBilan[] = [];
  for (let j = 0; j < 40; j++) avecSeances.push(seance(`2025-${String(1 + (j % 12)).padStart(2, '0')}-${String(1 + Math.floor(j / 12) * 7).padStart(2, '0')}`, 60));
  for (let j = 1; j <= 20; j++) avecSeances.push(seance(`2026-0${1 + Math.floor((j - 1) / 7)}-${String(1 + ((j - 1) % 7) * 3).padStart(2, '0')}`, 60));
  const v = niveauGlobalHyrox([], avecSeances, maintenant)!;
  assert.equal(v.annees.length, 2);
  // 2026 : 20 séances en 166 jours → annualisées : plus que 2025 : le volume ne s'effondre pas parce que l'année n'est pas finie
  assert.ok(v.annees[1].piliers.volume >= v.annees[0].piliers.volume, `${v.annees[1].piliers.volume} contre ${v.annees[0].piliers.volume}`);
  assert.equal(v.annees[0].global, null); // seul le volume est prouvé
  assert.equal(niveauGlobalHyrox([], [], maintenant), null);
});

test('chrono : un temps en secondes s\'écrit « 4:52 » ou « 1:13:42 » dans les records', () => {
  assert.equal(texteRecordSimple(292, 'chrono'), '4:52');
  assert.equal(texteRecordSimple(4422, 'chrono'), '1:13:42');
});
