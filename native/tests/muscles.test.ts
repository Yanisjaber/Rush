import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeMuscuRecente, chargeParSerie, effortRir, zoneRatio } from '../src/data/sports/charge-muscu.ts';
import { musclesSurPeriode } from '../src/data/sports/muscu.ts';
import { MUSCLES, repartirPortions, repartirSerie } from '../src/data/sports/muscles.ts';
import { BIBLIOTHEQUE, chercherExercices, GROUPES, groupeValide, ORDRE_GROUPES } from '../src/data/sports/exercices.ts';
import { melange } from '../src/theme/couleurs.ts';
import type { SerieForce } from '../src/data/types.ts';

const aujourdhui = new Date(2026, 9, 19);
const jourAvant = (n: number) => {
  const d = new Date(2026, 9, 19 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const serie = (n: number, exo: string, nom: string, groupe: string, poids: number, reps: number, rir?: number): SerieForce => ({
  id: `${n}-${exo}-${poids}-${reps}-${rir}`, activity_id: 's', date: jourAvant(n), exercise_key: exo, exercise_name: nom,
  muscle_group: groupe, position: 0, set_no: 1, reps, weight_kg: poids, ...(rir != null ? { rir } : {}),
});

// --- exercices ------------------------------------------------------------

test('exercices : 6 groupes dans l\'ordre, groupeValide refuse les propriétés héritées', () => {
  assert.deepEqual(ORDRE_GROUPES, ['pectoraux', 'dos', 'jambes', 'epaules', 'bras', 'tronc']);
  assert.equal(Object.keys(GROUPES).length, 6);
  assert.equal(groupeValide('dos'), true);
  assert.equal(groupeValide('constructor'), false);
  assert.equal(groupeValide(null), false);
});

test('exercices : la bibliothèque a des clés uniques et des groupes valides', () => {
  const cles = new Set(BIBLIOTHEQUE.map((e) => e.cle));
  assert.equal(cles.size, BIBLIOTHEQUE.length);
  assert.ok(BIBLIOTHEQUE.every((e) => groupeValide(e.groupe)));
});

test('chercherExercices : insensible aux accents et filtre par groupe', () => {
  assert.ok(chercherExercices([], { texte: 'developpe' }).some((e) => e.cle === 'developpe-couche'));
  assert.ok(chercherExercices([], { groupe: 'bras' }).every((e) => e.groupe === 'bras'));
  assert.deepEqual(chercherExercices([], { texte: 'zzzz' }), []);
});

// --- muscles --------------------------------------------------------------

test('repartirSerie : un exercice connu donne 1 par muscle principal et 0,5 par muscle secondaire', () => {
  assert.deepEqual(repartirSerie('developpe-couche', 'Développé couché', 'pectoraux'), [
    { muscle: 'chest', poids: 1 }, { muscle: 'triceps', poids: 0.5 }, { muscle: 'deltoids', poids: 0.5 },
  ]);
});

test('repartirSerie : un exercice inconnu est deviné d\'après son nom, en anglais ou en français', () => {
  assert.equal(repartirSerie('perso-1', 'Hip thrust machine', 'jambes')[0].muscle, 'gluteal');
  assert.equal(repartirSerie('perso-2', 'Preacher curl', 'bras')[0].muscle, 'biceps');
  assert.equal(repartirSerie('perso-3', 'Relevé de jambes suspendu', 'tronc')[0].muscle, 'abs');
});

test('repartirSerie : sans indice, la série est partagée à parts égales dans le groupe', () => {
  const r = repartirSerie('perso-9', 'Machin bizarre', 'tronc');
  assert.deepEqual(r.map((x) => x.muscle), ['abs', 'obliques']);
  assert.ok(r.every((x) => x.poids === 0.5));
});

test('repartirPortions : seuls épaules, trapèzes et triceps ont des portions', () => {
  assert.deepEqual(repartirPortions('elevations-laterales', 'Élévations latérales', 'deltoids'), [{ portion: 'lateral', part: 1 }]);
  assert.deepEqual(repartirPortions('squat', 'Squat', 'quadriceps'), []);
  const somme = repartirPortions('perso', 'inconnu', 'triceps').reduce((s, x) => s + x.part, 0);
  assert.ok(Math.abs(somme - 1) < 1e-9);
});

test('MUSCLES : 15 muscles, chacun avec une zone visée croissante', () => {
  assert.equal(Object.keys(MUSCLES).length, 15);
  for (const m of Object.values(MUSCLES)) assert.ok(m.cible[0] < m.cible[1]);
});

test('musclesSurPeriode : 15 muscles ; sans séries tout est « oublié », avec des séries le muscle principal monte', () => {
  const vide = musclesSurPeriode([], aujourdhui);
  assert.equal(Object.keys(vide).length, 15);
  assert.ok(Object.values(vide).every((m) => m.etat === 'oublie' && m.pct === 0));
  const series = Array.from({ length: 6 }, (_, i) => serie(i, 'developpe-couche', 'Développé couché', 'pectoraux', 80, 8));
  const r = musclesSurPeriode(series, aujourdhui);
  assert.equal(r.chest.series, 6);
  assert.equal(r.chest.pct, Math.round((6 / 15) * 100));
  assert.equal(r.triceps.series, 3); // secondaire : 0,5 par série
  assert.equal(r.chest.exercices[0].role, 'principal');
});

test('musclesSurPeriode : les séries de plus de 7 jours ne comptent pas', () => {
  assert.equal(musclesSurPeriode([serie(10, 'squat', 'Squat', 'jambes', 100, 5)], aujourdhui).quadriceps.series, 0);
});

// --- charge de musculation ------------------------------------------------

test('effortRir : 100 % à RIR 0 ou 1, −15 % par répétition en réserve ensuite, plancher 40 %', () => {
  assert.equal(effortRir(null), 1);
  assert.equal(effortRir(0), 1);
  assert.equal(effortRir(1), 1);
  assert.equal(effortRir(2), 0.85);
  assert.equal(effortRir(10), 0.4);
});

test('zoneRatio : zones de progression (0,8 à 1,3 = sûre, au-delà de 1,5 = danger)', () => {
  assert.equal(zoneRatio(null).cle, 'inconnu');
  assert.equal(zoneRatio(0.79).cle, 'basse');
  assert.equal(zoneRatio(0.8).cle, 'ok');
  assert.equal(zoneRatio(1.3).cle, 'ok');
  assert.equal(zoneRatio(1.31).cle, 'attention');
  assert.equal(zoneRatio(1.5).cle, 'attention');
  assert.equal(zoneRatio(1.51).cle, 'danger');
});

test('chargeParSerie : l\'intensité est le poids sur le meilleur 1RM estimé (Epley) ; sans charge, 60 % estimé', () => {
  const r = chargeParSerie([serie(10, 'squat', 'Squat', 'jambes', 100, 5), serie(2, 'squat', 'Squat', 'jambes', 80, 5), serie(2, 'pompes', 'Pompes', 'pectoraux', 0, 20)]);
  const squat = r.filter((x) => x.cle === 'squat').sort((a, b) => a.date.localeCompare(b.date));
  const rm = 100 * (1 + 5 / 30); // 1RM estimé de la meilleure série : 116,67 kg
  assert.ok(Math.abs(squat[0].intensite - 100 / rm) < 1e-9); // la série de 100 kg × 5 : 85,7 % de son 1RM
  assert.ok(Math.abs(squat[1].intensite - 80 / rm) < 1e-9); // 80 kg × 5, 8 jours plus tard : toujours rapportée au meilleur 1RM des 90 jours
  assert.ok(Math.abs(squat[0].charge - 5 * (100 / rm)) < 1e-9); // charge = répétitions × intensité
  const pompes = r.find((x) => x.cle === 'pompes');
  assert.equal(pompes?.intensite, 0.6);
  assert.equal(pompes?.estimee, true);
});

test('chargeParSerie : le RIR réduit la charge d\'une série facile', () => {
  const [dur] = chargeParSerie([serie(1, 'squat', 'Squat', 'jambes', 100, 10, 0)]);
  const [facile] = chargeParSerie([serie(1, 'squat', 'Squat', 'jambes', 100, 10, 3)]);
  assert.ok(facile.charge < dur.charge);
  assert.equal(Math.round((facile.charge / dur.charge) * 100), 70);
});

test('chargeMuscuRecente : 12 semaines, ratio contre les 4 semaines d\'avant', () => {
  const series = [serie(2, 'squat', 'Squat', 'jambes', 100, 10), serie(9, 'squat', 'Squat', 'jambes', 100, 5), serie(16, 'squat', 'Squat', 'jambes', 100, 5)];
  const c = chargeMuscuRecente(series, 12, aujourdhui);
  assert.equal(c.parSemaine.length, 12);
  assert.equal(c.derniere, 8); // 10 reps × (100 kg sur un 1RM estimé de 133,3 kg) = 7,5 → 8
  assert.deepEqual(c.parSemaine.slice(-4), [0, 4, 4, 8]); // 5 reps × (100 / 116,67) = 4,3 → 4, deux semaines de suite
  assert.equal(c.habituelle, 2); // (0 + 0 + 4 + 4) / 4
  assert.equal(c.ratio, 4);
  assert.equal(c.zone.cle, 'danger');
});

test('chargeMuscuRecente : sans séries, ratio inconnu', () => {
  const c = chargeMuscuRecente([], 12, aujourdhui);
  assert.equal(c.ratio, null);
  assert.equal(c.zone.cle, 'inconnu');
});

// --- mélange de couleurs --------------------------------------------------

test('melange : comme color-mix(in srgb) en CSS', () => {
  assert.equal(melange('#ff0000', '#000000', 100), '#ff0000');
  assert.equal(melange('#ff0000', '#000000', 0), '#000000');
  assert.equal(melange('#ff0000', '#0000ff', 50), '#800080');
  assert.equal(melange('#ffffff', '#000000', 25), '#404040');
  assert.equal(melange('#ffffff', '#000000', 250), '#ffffff'); // borné
});
