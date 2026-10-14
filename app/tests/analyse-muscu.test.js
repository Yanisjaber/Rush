import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserTonnage, analyserGroupes, analyserRecords } from '../src/lib/analyse/muscu.js';
import { decalerJour } from '../src/lib/analyse/maths.js';
import { seriesForceDemo } from '../src/lib/data/demo.js';

const AUJ = new Date(2026, 9, 14, 12); // mercredi 14 octobre 2026
const ISO = '2026-10-14';

const serie = (date, cle, groupe, reps, poids) => ({ date, exercise_key: cle, exercise_name: cle, muscle_group: groupe, position: 0, set_no: 1, reps, weight_kg: poids });

/** 3 séances par semaine pendant `semaines` semaines, finissant `reculDe` jours avant ISO. Le squat monte de 2,5 kg par semaine. */
function histoire(semaines, reculDe = 0) {
  const lignes = [];
  for (let w = semaines - 1; w >= 0; w--) {
    for (const [j, cle, groupe] of [[0, 'squat', 'jambes'], [2, 'developpe-couche', 'pectoraux'], [4, 'rowing-barre', 'dos']]) {
      const date = decalerJour(ISO, -reculDe - w * 7 - 6 + j);
      for (let n = 0; n < 4; n++) lignes.push(serie(date, cle, groupe, 5, 60 + (semaines - w) * 2.5));
    }
  }
  return lignes;
}

const complet = (a) => {
  assert.equal(typeof a.verdict.titre, 'string');
  assert.ok(['ok', 'attention', 'danger', 'info'].includes(a.verdict.niveau));
  assert.ok(a.methode.length > 0);
  for (const c of a.chiffres) assert.equal(typeof c.valeur, 'string');
  for (const c of a.conseils) assert.ok(['haute', 'moyenne', 'faible', 'info'].includes(c.priorite));
  for (const g of a.graphiques) assert.ok(['lignes', 'tableau', 'repartition', 'exercices', 'chaleur', 'historique'].includes(g.type));
};

test('muscu : sans séries, chaque analyse répond « pas assez de données » sans planter', () => {
  for (const f of [analyserTonnage, analyserGroupes, analyserRecords]) {
    const a = f({ series: [], aujourdhui: AUJ });
    assert.equal(a.insuffisant, true);
    complet(a);
  }
});

test('muscu : les séries à 0 répétition ou dans le futur sont ignorées', () => {
  const a = analyserTonnage({ series: [serie('2027-01-01', 'squat', 'jambes', 5, 100), serie(ISO, 'squat', 'jambes', 0, 100)], aujourdhui: AUJ });
  assert.equal(a.insuffisant, true);
});

test('tonnage : 12 semaines régulières → volume qui monte, 3 séances par semaine, courbe et tableau', () => {
  const a = analyserTonnage({ series: histoire(12), aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.insuffisant, false);
  complet(a);
  assert.equal(a.brut.semaines.length, 12);
  assert.ok(a.brut.ecartPct > 0, `écart ${a.brut.ecartPct}`);
  assert.equal(a.brut.trous, 0);
  const seances = a.chiffres.find((c) => c.etiquette === 'Séances par semaine');
  assert.equal(seances.valeur, '3');
  assert.equal(a.graphiques[0].series[0].valeurs.length, 12);
});

test('tonnage : une semaine blanche est comptée et conseillée', () => {
  const s = histoire(10).filter((l) => l.date < decalerJour(ISO, -30) || l.date > decalerJour(ISO, -24));
  const a = analyserTonnage({ series: s, aujourdhui: AUJ, semaines: 12 });
  assert.ok(a.brut.trous >= 1);
});

test('tonnage : après une longue pause, la fenêtre finit toujours aujourd\'hui (rien dedans → pas assez de séances)', () => {
  const a = analyserTonnage({ series: histoire(10, 150), aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.insuffisant, true);
  // avec une fenêtre assez longue pour les contenir, les séances sont comptées et la semaine en cours reste vide
  const b = analyserTonnage({ series: histoire(10, 150), aujourdhui: AUJ, semaines: 52 });
  assert.equal(b.insuffisant, false);
  assert.equal(b.brut.semaines[51].tonnage, 0);
  assert.equal(b.chiffres[0].etiquette, 'Cette semaine');
});

test('groupes : rien sur le dos → groupe oublié signalé en priorité haute', () => {
  const s = histoire(6).filter((l) => l.muscle_group !== 'dos');
  const a = analyserGroupes({ series: s, aujourdhui: AUJ });
  assert.equal(a.insuffisant, false);
  complet(a);
  assert.equal(a.brut.groupes.find((g) => g.groupe === 'dos').etat, 'oublie');
  assert.equal(a.conseils[0].priorite, 'haute');
  assert.match(a.conseils[0].titre, /dos/i);
  assert.equal(a.graphiques[0].segments.reduce((t, x) => t + x.valeur, 0) >= 98, true); // parts ≈ 100 %
});

test('groupes : dos en retard sur les pectoraux → rapport sous 0,8 signalé', () => {
  const s = [];
  for (let w = 0; w < 4; w++) {
    const d = decalerJour(ISO, -w * 7 - 1);
    for (let n = 0; n < 6; n++) s.push(serie(d, 'developpe-couche', 'pectoraux', 8, 60), serie(decalerJour(d, -2), 'developpe-couche', 'pectoraux', 8, 60));
    for (let n = 0; n < 4; n++) s.push(serie(d, 'tirage-vertical', 'dos', 8, 50));
  }
  const a = analyserGroupes({ series: s, aujourdhui: AUJ });
  assert.ok(a.brut.rapportDos < 0.8);
  assert.ok(a.conseils.some((c) => /dos et pectoraux/i.test(c.titre)));
});

test('records : le squat qui monte chaque semaine → record récent ; tableau et courbe remplis', () => {
  const a = analyserRecords({ series: histoire(10), aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.insuffisant, false);
  complet(a);
  assert.ok(a.brut.records.some((e) => e.cle === 'squat'));
  assert.equal(a.verdict.niveau, 'ok');
  // UN seul bloc « Progression par exercice » : des onglets par groupe musculaire, et pour chacun les exercices du menu déroulant
  const blocs = a.graphiques.filter((g) => g.type === 'exercices');
  assert.equal(blocs.length, 1);
  const { groupes } = blocs[0];
  assert.ok(groupes.length >= 1);
  assert.ok(groupes.every((g) => g.exercices.length >= 1 && g.exercices.every((e) => e.etiquettes.length === e.valeurs.length && e.valeurs.length >= 3)));
  assert.ok(groupes.find((g) => g.nom === 'Jambes').exercices.some((e) => e.cle === 'squat'));
});

test('records : même charge depuis plus de 8 semaines malgré des séances régulières → plateau', () => {
  const s = [];
  s.push(serie(decalerJour(ISO, -90), 'squat', 'jambes', 5, 120)); // le record, il y a 3 mois
  for (let w = 0; w < 8; w++) s.push(serie(decalerJour(ISO, -w * 7 - 2), 'squat', 'jambes', 5, 100));
  const a = analyserRecords({ series: s, aujourdhui: AUJ, semaines: 26 });
  assert.equal(a.brut.plateaux.length, 1);
  assert.equal(a.verdict.niveau, 'attention');
  assert.equal(a.conseils[0].priorite, 'haute');
});

test('records : les séries à plus de 12 répétitions ne comptent pas (1RM non fiable)', () => {
  const s = [];
  for (let w = 0; w < 6; w++) s.push(serie(decalerJour(ISO, -w * 7 - 1), 'curl', 'bras', 20, 15));
  assert.equal(analyserRecords({ series: s, aujourdhui: AUJ }).insuffisant, true);
});

test('les trois analyses tournent sur les données de démo', () => {
  const series = seriesForceDemo(AUJ);
  for (const f of [analyserTonnage, analyserGroupes, analyserRecords]) {
    const a = f({ series, aujourdhui: AUJ });
    complet(a);
  }
});

test('records : deux exercices du même groupe → un seul onglet, le plus pratiqué en premier dans le menu', () => {
  const s = [];
  for (let w = 0; w < 6; w++) s.push(serie(decalerJour(ISO, -w * 7 - 1), 'developpe-couche', 'pectoraux', 5, 60 + w), serie(decalerJour(ISO, -w * 7 - 3), 'developpe-couche', 'pectoraux', 5, 60 + w));
  for (let w = 0; w < 3; w++) s.push(serie(decalerJour(ISO, -w * 7 - 2), 'ecartes', 'pectoraux', 10, 20));
  const a = analyserRecords({ series: s, aujourdhui: AUJ, semaines: 12 });
  const pecs = a.graphiques.find((g) => g.type === 'exercices').groupes.filter((g) => g.nom === 'Pectoraux');
  assert.equal(pecs.length, 1);
  assert.deepEqual(pecs[0].exercices.map((e) => e.cle), ['developpe-couche', 'ecartes']);
  // les points d'un exercice sont dans l'ordre chronologique
  const dates = pecs[0].exercices[0].etiquettes;
  assert.deepEqual(dates, [...dates].sort());
});

test('records : l\'historique d\'un exercice = toutes ses séances (récente d\'abord) avec toutes les séries, record signalé une seule fois', () => {
  const s = [];
  // 3 séances de squat : 60, 70 (record), 65 kg ; la 2e séance a 3 séries dans le désordre, la 3e une série sans charge
  s.push(serie('2026-10-01', 'squat', 'jambes', 5, 60), serie('2026-10-01', 'squat', 'jambes', 5, 60));
  s.push({ ...serie('2026-10-05', 'squat', 'jambes', 5, 70), set_no: 2 }, { ...serie('2026-10-05', 'squat', 'jambes', 8, 60), set_no: 1 }, { ...serie('2026-10-05', 'squat', 'jambes', 3, 70), set_no: 3 });
  s.push(serie('2026-10-10', 'squat', 'jambes', 5, 65), serie('2026-10-10', 'squat', 'jambes', 12, 0));
  const a = analyserRecords({ series: s, aujourdhui: AUJ });
  assert.ok(a.graphiques.some((g) => g.type === 'historique'));
  const squat = a.graphiques.find((g) => g.type === 'exercices').groupes.find((g) => g.nom === 'Jambes').exercices.find((e) => e.cle === 'squat');
  assert.deepEqual(squat.seances.map((x) => x.date), ['2026-10-10', '2026-10-05', '2026-10-01']);
  assert.deepEqual(squat.seances[1].series, [{ reps: 8, poids: 60 }, { reps: 5, poids: 70 }, { reps: 3, poids: 70 }]); // dans l'ordre des séries
  assert.equal(squat.seances[0].series.length, 2); // la série sans charge est gardée dans l'historique
  assert.equal(squat.seances[1].tonnage, 8 * 60 + 5 * 70 + 3 * 70);
  assert.equal(squat.seances.filter((x) => x.record).length, 1);
  assert.equal(squat.seances[1].record, true);
});
