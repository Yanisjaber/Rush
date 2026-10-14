import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeParSerie, chargeMuscuRecente, analyserChargeMuscu, zoneRatio } from '../src/lib/analyse/charge-muscu.js';
import { decalerJour } from '../src/lib/analyse/maths.js';

const AUJ = new Date(2026, 9, 14, 12); // mercredi 14 octobre 2026
const ISO = '2026-10-14';
const serie = (date, cle, groupe, reps, kg) => ({ date, exercise_key: cle, exercise_name: cle, muscle_group: groupe, reps, weight_kg: kg, set_no: 1 });

test('charge muscu : une série pèse répétitions × (poids ÷ 1RM estimé de l\'exercice)', () => {
  // Meilleure série : 100 kg × 5 → 1RM estimé 116,7 kg. Une série de 10 × 70 kg → intensité 0,6 → charge 6.
  const d = decalerJour(ISO, -3);
  const r = chargeParSerie([serie(d, 'squat', 'jambes', 5, 100), serie(d, 'squat', 'jambes', 10, 70)]);
  const lourde = r.find((x) => x.reps === 5);
  const legere = r.find((x) => x.reps === 10);
  assert.ok(Math.abs(lourde.intensite - 100 / (100 * (1 + 5 / 30))) < 1e-9);
  assert.ok(Math.abs(legere.charge - 10 * (70 / (100 * (1 + 5 / 30)))) < 1e-9);
});

test('charge muscu : deux exercices à la même intensité pèsent pareil, quel que soit le poids', () => {
  const d = decalerJour(ISO, -2);
  const r = chargeParSerie([
    serie(d, 'squat', 'jambes', 5, 150),
    serie(d, 'curl-barre', 'bras', 5, 30),
  ]);
  const a = r.find((x) => x.cle === 'squat').charge;
  const b = r.find((x) => x.cle === 'curl-barre').charge;
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('charge muscu : sans charge notée, intensité supposée et signalée', () => {
  const r = chargeParSerie([serie(ISO, 'tractions', 'dos', 8, 0)]);
  assert.equal(r[0].estimee, true);
  assert.ok(Math.abs(r[0].charge - 8 * 0.6) < 1e-9);
});

test('charge muscu : le ratio récent / habituel et ses zones', () => {
  // 4 semaines d\'avant à 10 séries identiques, cette semaine à 20 → ratio 2
  const s = [];
  for (let w = 1; w <= 4; w++) for (let i = 0; i < 10; i++) s.push(serie(decalerJour(ISO, -w * 7 - 1), 'squat', 'jambes', 5, 100));
  for (let i = 0; i < 20; i++) s.push(serie(decalerJour(ISO, -1), 'squat', 'jambes', 5, 100));
  const c = chargeMuscuRecente(s, 12, AUJ);
  assert.equal(c.parSemaine.length, 12);
  assert.ok(Math.abs(c.ratio - 2) < 0.01);
  assert.equal(c.zone.cle, 'danger');
  assert.equal(zoneRatio(1).cle, 'ok');
  assert.equal(zoneRatio(0.5).cle, 'basse');
  assert.equal(zoneRatio(null).cle, 'inconnu');
});

test('charge muscu : analyse complète, forme habituelle et Rush', () => {
  const s = [];
  for (let w = 0; w < 8; w++) for (const j of [1, 3, 5]) for (let i = 0; i < 6; i++) s.push(serie(decalerJour(ISO, -w * 7 - j), i % 2 ? 'squat' : 'developpe-couche', i % 2 ? 'jambes' : 'pectoraux', 8, 60 + i));
  const a = analyserChargeMuscu({ series: s, aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.insuffisant, false);
  assert.equal(a.id, 'chargemuscu');
  assert.ok(a.chiffres.length >= 5 && a.graphiques.length === 3 && a.methode.length >= 3);
  assert.ok(a.rush.accroche.length > 20 && a.rush.parties.length >= 2 && a.rush.plan.length >= 1 && a.rush.profil.length === 4);
  const vide = analyserChargeMuscu({ series: [], aujourdhui: AUJ });
  assert.equal(vide.insuffisant, true);
});
