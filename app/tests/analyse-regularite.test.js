import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserRegularite } from '../src/lib/analyse/regularite.js';
import { decalerJour } from '../src/lib/analyse/maths.js';

const AUJ = new Date(2026, 9, 14, 12); // mercredi 14 octobre 2026
const ISO = '2026-10-14';
const seance = (iso) => ({ start_date_local: `${iso}T08:00:00`, sport: 'Run', moving_time: 3600 }); // une heure : sans durée ni TSS, la charge (donc la case colorée) serait nulle

/** `parSemaine` séances (lundi, mercredi, vendredi… dans cet ordre) pendant `semaines` semaines complètes avant la semaine en cours. */
function rythme(semaines, parSemaine, saut = 0) {
  const lundiCourant = '2026-10-12';
  const out = [];
  for (let w = 1 + saut; w <= semaines + saut; w++) {
    for (let j = 0; j < parSemaine; j++) out.push(seance(decalerJour(lundiCourant, -w * 7 + j * 2)));
  }
  return out;
}

test('régularité : aucune séance → « aucune séance sur la période », sans planter', () => {
  const a = analyserRegularite({ seances: [], aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.insuffisant, true);
  assert.equal(a.verdict.titre, 'Aucune séance sur la période');
});

test('régularité : moins de 4 jours → pas assez de séances', () => {
  const a = analyserRegularite({ seances: [seance('2026-10-12'), seance('2026-10-10')], aujourdhui: AUJ });
  assert.equal(a.insuffisant, true);
  assert.equal(a.verdict.titre, 'Pas encore assez de séances');
});

test('régularité : 3 séances chaque semaine pendant 11 semaines → très régulier, 100 % de semaines tenues', () => {
  const a = analyserRegularite({ seances: rythme(11, 3), aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.insuffisant, false);
  assert.equal(a.verdict, null); // pas de phrase de jugement : seulement des chiffres
  assert.equal(a.chiffres.find((c) => c.etiquette === 'Semaines tenues').valeur, '100');
  assert.equal(a.brut.pct, 100);
  assert.equal(a.brut.vides, 0);
  assert.equal(a.brut.enCours, 11);
  assert.equal(a.graphiques[1].series[0].valeurs.length, 11); // la semaine en cours n'est pas comptée
  assert.equal(a.conseils[0].priorite, 'info');
});

test('régularité : deux séances le même jour comptent pour un seul jour actif', () => {
  const s = [...rythme(6, 3), seance('2026-10-05'), seance('2026-10-05')];
  const doublon = analyserRegularite({ seances: s, aujourdhui: AUJ, semaines: 12 });
  const simple = analyserRegularite({ seances: rythme(6, 3), aujourdhui: AUJ, semaines: 12 });
  assert.equal(doublon.chiffres[0].valeur, simple.chiffres[0].valeur);
});

test('régularité : 1 séance par semaine → peu régulier avec conseil de viser 3 jours', () => {
  const a = analyserRegularite({ seances: rythme(10, 1), aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.brut.pct, 0);
  assert.ok(a.conseils.some((c) => /Vise 3 jours/.test(c.titre)));
});

test('régularité : pas de séance depuis plus de 14 jours → aucune phrase « décroché / reprends », juste les chiffres', () => {
  const a = analyserRegularite({ seances: rythme(8, 3, 3), aujourdhui: AUJ, semaines: 12 }); // dernière séance il y a ~3 semaines
  assert.equal(a.verdict, null);
  assert.ok(a.brut.pauseEnCours >= 14);
  assert.equal(a.conseils.some((c) => /reprend/i.test(c.titre + c.texte)), false);
});

test('régularité : la plus longue pause est trouvée, et des semaines sans repos sont signalées', () => {
  const s = [];
  for (let w = 1; w <= 5; w++) for (let j = 0; j < 7; j++) s.push(seance(decalerJour('2026-10-12', -w * 7 + j))); // 7 jours sur 7
  const a = analyserRegularite({ seances: s, aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.brut.sansRepos, 5);
  assert.ok(a.conseils.some((c) => /repos/i.test(c.titre)));
  const b = analyserRegularite({ seances: [seance('2026-09-01'), seance('2026-09-02'), seance('2026-09-20'), seance('2026-09-22'), seance('2026-10-12')], aujourdhui: AUJ, semaines: 12 });
  assert.equal(b.brut.pauseMax, 19); // du 23 septembre au 11 octobre (plus longue que celle du 3 au 19 septembre, 17 jours)
});

test('régularité : le tableau des jours a 7 lignes et les parts font environ 100 %', () => {
  const a = analyserRegularite({ seances: rythme(8, 3), aujourdhui: AUJ, semaines: 12 });
  const t = a.graphiques[2];
  assert.equal(t.lignes.length, 7);
  const total = t.lignes.reduce((s, l) => s + parseInt(l[2], 10), 0);
  assert.ok(total >= 98 && total <= 102);
});

test('régularité : le calendrier est la carte de chaleur du widget (7 rangées × N semaines) avec la légende des sports', () => {
  for (const semaines of [12, 26, 52]) {
    const a = analyserRegularite({ seances: rythme(8, 3), aujourdhui: AUJ, semaines });
    const g = a.graphiques[0];
    assert.equal(g.type, 'chaleur');
    assert.equal(g.colonnes, semaines);
    assert.equal(g.cases.length, 7 * semaines);
    assert.ok(g.cases.some((c) => c.intensite > 0));
    assert.deepEqual(g.sports.map((x) => x.nom), ['Course']);
  }
});
