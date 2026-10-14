import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeParSerie, chargeMuscuRecente, analyserChargeMuscu, zoneRatio } from '../src/lib/analyse/charge-muscu.js';
import { decalerJour } from '../src/lib/analyse/maths.js';
import { chargeJambesParJour, fatigueBrute, referenceJambes, zoneJambes, sortiesAVenir, effetSurDiscipline } from '../src/lib/analyse/fatigue-jambes.js';

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
  assert.ok(a.chiffres.length >= 5 && a.graphiques.length >= 4 && a.methode.length >= 3);
  assert.ok(a.rush.accroche.length > 20 && a.rush.parties.length >= 2 && a.rush.plan.length >= 1 && a.rush.profil.length === 4);
  const vide = analyserChargeMuscu({ series: [], aujourdhui: AUJ });
  assert.equal(vide.insuffisant, true);
});

// ---------------------------------------------------------------------------------------------------------------------
// Fatigue des jambes et effet sur l'endurance
// ---------------------------------------------------------------------------------------------------------------------
const lancer = (date, cle, groupe, reps, kg) => chargeParSerie([serie(date, cle, groupe, reps, kg)])[0];

test('fatigue des jambes : un squat compte presque en entier, un développé couché pas du tout', () => {
  const j = chargeJambesParJour([lancer(ISO, 'squat', 'jambes', 5, 100), lancer(ISO, 'developpe-couche', 'pectoraux', 5, 100)]);
  const squat = lancer(ISO, 'squat', 'jambes', 5, 100).charge;
  // Squat : quadriceps et fessiers (1 chacun), ischios, adducteurs et lombaires (0,5 chacun) : les lombaires ne sont pas des jambes
  assert.ok(Math.abs(j.get(ISO) - squat * (3 / 3.5)) < 1e-9);
  assert.equal(chargeJambesParJour([lancer(ISO, 'developpe-couche', 'pectoraux', 5, 100)]).size, 0);
});

test('fatigue des jambes : elle retombe avec le temps (60 % le lendemain, 37 % après 2 jours)', () => {
  const parJour = new Map([[ISO, 100]]);
  assert.equal(Math.round(fatigueBrute(parJour, ISO, true)), 100);
  assert.equal(Math.round(fatigueBrute(parJour, decalerJour(ISO, 1), false)), 61);
  assert.equal(Math.round(fatigueBrute(parJour, decalerJour(ISO, 2), false)), 37);
  assert.equal(fatigueBrute(parJour, ISO, false), 0); // le matin même, la séance du jour n'a pas encore eu lieu
});

test('fatigue des jambes : référence, zones et sorties à venir', () => {
  const parJour = new Map();
  for (let i = 1; i <= 8; i++) parJour.set(decalerJour(ISO, -i * 3), 60 + i); // 8 séances de jambes
  const ref = referenceJambes(parJour);
  assert.ok(ref > 60 && ref < 70);
  assert.equal(referenceJambes(new Map([[ISO, 50]])), null); // pas assez de séances pour calibrer
  assert.equal(zoneJambes(10).cle, 'fraiches');
  assert.equal(zoneJambes(80).cle, 'forte');
  // Une séance de jambes hier, une sortie vélo dure prévue demain
  const j = new Map([[decalerJour(ISO, -1), 100]]);
  const prevues = [{ id: 'p1', date: decalerJour(ISO, 1), sport: 'Ride', name: 'Sorties seuil', duration: 90, rpe: 8, category: 'entrainement' }];
  const [x] = sortiesAVenir(prevues, j, 100, ISO, 7);
  assert.equal(x.famille, 'velo');
  assert.equal(x.dure, true);
  assert.ok(x.pct >= 20 && x.pct < 45); // 37 % des 61 % restants → environ 37 %
});

test('effet sur l\'endurance : détecte une baisse d\'efficacité quand les jambes sont fatiguées', () => {
  const parJour = new Map();
  const seances = [];
  // 6 mois de vélo, 1 sortie tous les 2 jours ; une séance de jambes lourde tous les 9 jours, la sortie suivante (lendemain) est 8 % moins efficace
  for (let i = 90; i >= 1; i -= 1) {
    if (i % 9 === 0) parJour.set(decalerJour(ISO, -i), 100);
  }
  for (let i = 90; i >= 1; i -= 2) {
    const iso = decalerJour(ISO, -i);
    const apresJambes = parJour.has(decalerJour(iso, -1));
    const w = apresJambes ? 184 : 200;
    seances.push({ sport: 'Ride', start_date_local: `${iso}T08:00:00`, moving_time: 5400, avg_heartrate: 140, avg_watts: w, np: w, category: 'entrainement' });
  }
  const e = effetSurDiscipline(seances, parJour, 100, 'velo');
  assert.ok(e && e.delta != null, 'assez de sorties');
  assert.ok(e.delta < -3, `écart attendu négatif, obtenu ${e.delta}`);
  assert.equal(effetSurDiscipline(seances.slice(0, 5), parJour, 100, 'velo'), null); // trop peu de sorties
});
