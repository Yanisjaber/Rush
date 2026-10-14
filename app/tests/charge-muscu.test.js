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
  assert.ok(a.chiffres.length >= 5 && a.graphiques.length >= 4 && a.methode.length >= 3);
  assert.ok(a.rush.accroche.length > 20 && a.rush.parties.length >= 2 && a.rush.plan.length >= 1 && a.rush.profil.length === 4);
  const vide = analyserChargeMuscu({ series: [], aujourdhui: AUJ });
  assert.equal(vide.insuffisant, true);
});

// ---------------------------------------------------------------------------------------------------------------------
// Fatigue musculaire par groupe
// ---------------------------------------------------------------------------------------------------------------------
import { arrondi5, fatigueMusculaire, fatigueBrute, referenceGrosse, zoneFatigue, heuresAvantPret, texteDelai, TAU_GROUPE } from '../src/lib/analyse/fatigue-musculaire.js';

const lancer = (date, cle, groupe, reps, kg) => chargeParSerie([serie(date, cle, groupe, reps, kg)])[0];

test('fatigue : elle retombe avec le temps (61 % le lendemain, 37 % après 2 jours, pour un gros groupe)', () => {
  const parJour = new Map([[ISO, 100]]);
  assert.equal(Math.round(fatigueBrute(parJour, ISO, 2)), 100);
  assert.equal(Math.round(fatigueBrute(parJour, decalerJour(ISO, 1), 2)), 61);
  assert.equal(Math.round(fatigueBrute(parJour, decalerJour(ISO, 2), 2)), 37);
  // un petit groupe récupère plus vite
  assert.ok(fatigueBrute(parJour, decalerJour(ISO, 1), TAU_GROUPE.bras) < fatigueBrute(parJour, decalerJour(ISO, 1), TAU_GROUPE.jambes));
});

test('fatigue : référence, zones et délai avant d\'être prêt', () => {
  const parJour = new Map();
  for (let i = 1; i <= 8; i++) parJour.set(decalerJour(ISO, -i * 3), 60 + i);
  const ref = referenceGrosse(parJour);
  assert.ok(ref > 60 && ref < 70);
  assert.equal(referenceGrosse(new Map([[ISO, 50]])), null); // pas assez de journées pour calibrer
  assert.equal(zoneFatigue(10).cle, 'frais');
  assert.equal(zoneFatigue(80).cle, 'forte');
  assert.equal(zoneFatigue(null).cle, 'inconnue');
  assert.equal(heuresAvantPret(15, 2), 0);
  // 100 % → 20 % avec une constante de 2 jours : 2 × ln(5) = 3,2 jours ≈ 77 h
  assert.equal(heuresAvantPret(100, 2), Math.round(2 * Math.log(5) * 24));
  assert.equal(texteDelai(0), 'prêt');
  assert.equal(texteDelai(4), 'prêt dans quelques heures');
  assert.equal(texteDelai(14), 'prêt dans ~12 h');
  assert.equal(texteDelai(30), 'prêt dans ~1,5 jours');
  assert.equal(texteDelai(77), 'prêt dans ~3 jours');
  assert.equal(arrondi5(37), 35);
  assert.equal(arrondi5(null), null);
});

test('fatigue : par groupe et par muscle d\'après les séries (un développé couché fatigue pectoraux, un peu les triceps)', () => {
  const s = [];
  // 6 séances de pectoraux, la dernière hier
  for (let i = 0; i < 6; i++) for (let n = 0; n < 5; n++) s.push(lancer(decalerJour(ISO, -1 - i * 3), 'developpe-couche', 'pectoraux', 8, 80));
  const f = fatigueMusculaire(s, ISO);
  const pec = f.groupes.find((g) => g.groupe === 'pectoraux');
  const jambes = f.groupes.find((g) => g.groupe === 'jambes');
  assert.ok(pec.pct > 30 && pec.pct < 90, `pectoraux ${pec.pct}`);
  assert.equal(jambes.pct, null); // jamais travaillées : pas de repère
  assert.ok(f.muscles.chest.pct >= f.muscles.triceps.pct || f.muscles.triceps.pct == null);
  assert.equal(f.groupes.length, 6);
});

// ---------------------------------------------------------------------------------------------------------------------
// Validation du modèle de fatigue sur tes séances
// ---------------------------------------------------------------------------------------------------------------------
import { validerFatigue, performances } from '../src/lib/analyse/validation-fatigue.js';

test('validation : pas assez de séances → null ; sinon détecte une vraie baisse après fatigue', () => {
  assert.equal(validerFatigue([], []), null);
  // Une pratique de pectoraux tous les 3 jours sur 120 jours, un squat deux jours sur trois ; le développé couché est plus faible le lendemain
  // d'une séance de pectoraux lourde (fatigue), plus fort s'il y a eu du repos.
  const s = [];
  for (let i = 120; i >= 1; i--) {
    const d = decalerJour(ISO, -i);
    if (i % 3 === 0) for (let n = 0; n < 6; n++) s.push(serie(d, 'developpe-couche', 'pectoraux', 8, 80));
    if (i % 3 === 1) s.push(serie(d, 'developpe-couche', 'pectoraux', 8, 80 * 0.92)); // le lendemain d'une grosse séance
    if (i % 3 === 2) s.push(serie(d, 'developpe-couche', 'pectoraux', 8, 80 * 1.0));
  }
  const sets = chargeParSerie(s);
  assert.ok(performances(s).length > 30);
  const v = validerFatigue(s, sets);
  assert.ok(v, 'assez de séances');
  assert.ok(v.n >= 25);
  assert.ok(v.global.delta == null || v.global.delta <= 0, `écart attendu négatif ou absent, obtenu ${v.global.delta}`);
});

// ---------------------------------------------------------------------------------------------------------------------
// RIR (répétitions en réserve)
// ---------------------------------------------------------------------------------------------------------------------
import { effortRir } from '../src/lib/analyse/charge-muscu.js';
import { validerSeance, serieVide } from '../src/lib/data/force.js';
import { lireExportHevy } from '../src/lib/data/hevy.js';

test('RIR : l\'effort réduit la charge d\'une série qui s\'arrête loin de l\'échec', () => {
  assert.equal(effortRir(null), 1); // pas noté : aucune correction
  assert.equal(effortRir(0), 1);
  assert.equal(effortRir(1), 1);
  assert.ok(Math.abs(effortRir(2) - 0.85) < 1e-9);
  assert.ok(Math.abs(effortRir(3) - 0.7) < 1e-9);
  assert.equal(effortRir(9), 0.4); // plancher
  const sans = chargeParSerie([serie(ISO, 'squat', 'jambes', 8, 100)])[0].charge;
  const avec = chargeParSerie([{ ...serie(ISO, 'squat', 'jambes', 8, 100), rir: 3 }])[0].charge;
  assert.ok(Math.abs(avec - sans * 0.7) < 1e-9);
  assert.equal(chargeParSerie([{ ...serie(ISO, 'squat', 'jambes', 8, 100), rir: '' }])[0].rir, null);
});

test('RIR : la saisie d\'une séance accepte un RIR facultatif et refuse un RIR absurde', () => {
  const b = { nom: 'Test', date: ISO, heure: '18:00', duree: '60', rpe: '', notes: '', exercices: [{ cle: 'squat', nom: 'Squat', groupe: 'jambes', series: [{ ...serieVide(5, 100, 2), fait: true }, { ...serieVide(5, 100), fait: true }] }] };
  const ok = validerSeance(b);
  assert.ok(ok.valeurs);
  assert.equal(ok.valeurs.series[0].rir, 2);
  assert.equal('rir' in ok.valeurs.series[1], false); // pas noté : pas de clé (la base reste intacte)
  b.exercices[0].series[0].rir = '15';
  assert.equal(validerSeance(b).valeurs, null);
});

test('RIR : l\'import Hevy convertit l\'effort (RPE) de chaque série en répétitions en réserve', () => {
  const csv = [
    'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
    '"Push","14 Oct 2026, 18:00","14 Oct 2026, 19:00","","Bench Press (Barbell)","","",0,normal,80,8,,,9',
    '"Push","14 Oct 2026, 18:00","14 Oct 2026, 19:00","","Bench Press (Barbell)","","",1,normal,80,7,,,10',
    '"Push","14 Oct 2026, 18:00","14 Oct 2026, 19:00","","Bench Press (Barbell)","","",2,normal,80,6,,,',
  ].join('\n');
  const r = lireExportHevy(csv);
  const s = r.seances[0].series;
  assert.equal(s[0].rir, 1); // RPE 9
  assert.equal(s[1].rir, 0); // RPE 10 = à l'échec
  assert.equal('rir' in s[2], false); // pas de RPE
});
