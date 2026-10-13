import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserForme, chargesPrevues, simuler, tsbVise, meilleurAffutage } from '../src/lib/analyse/forme.js';
import { decalerJour } from '../src/lib/analyse/maths.js';

const AUJ = new Date(2026, 9, 14, 12);
const ISO = '2026-10-14';

function seances(plan, jours = 220) {
  const sortie = [];
  for (let i = jours; i >= 0; i--) {
    const tss = plan(i);
    if (tss) sortie.push({ id: `s${i}`, sport: 'Run', start_date_local: `${decalerJour(ISO, -i)}T18:00:00+00:00`, moving_time: 3600, tss });
  }
  return sortie;
}
const regulier = () => seances((i) => (i % 7 === 6 ? 0 : 60));

test('chargesPrevues : TSS indiqué, sinon estimé d\'après la durée, compétitions ignorées', () => {
  const m = chargesPrevues([
    { date: '2026-10-20', tss: 70, duration: 60 },
    { date: '2026-10-20', duration: 60, category: 'entrainement' }, // estimé (60 min, effort 5 par défaut)
    { date: '2026-10-25', duration: 100, category: 'competition', tss: 200 },
    { date: '', tss: 10 },
  ]);
  assert.equal(m.get('2026-10-20') > 70, true);
  assert.equal(m.has('2026-10-25'), false);
  assert.equal(chargesPrevues(null).size, 0);
});

test('simuler : charge constante → condition et fatigue convergent, tsb ≈ 0', () => {
  const s = simuler(60, 60, Array(30).fill(60));
  assert.ok(Math.abs(s[29].tsb) < 0.01);
  const repos = simuler(60, 60, Array(10).fill(0));
  assert.ok(repos[9].tsb > 20, `tsb ${repos[9].tsb}`); // dix jours de repos : la fatigue chute plus vite que la condition
  assert.ok(repos[9].ctl < 60 && repos[9].atl < repos[9].ctl);
});

test('tsbVise : plus la course est courte, plus on vise frais', () => {
  assert.ok(tsbVise(40).cible > tsbVise(150).cible);
  assert.ok(tsbVise(150).cible > tsbVise(400).cible);
  assert.deepEqual(tsbVise(0), tsbVise(undefined));
});

test('meilleurAffutage : un affûtage rapproche de la cible plus que ne rien faire', () => {
  const base = Array(21).fill(60);
  const sans = simuler(60, 60, [...base, 0]).at(-1);
  const a = meilleurAffutage({ ctl0: 60, atl0: 60, joursAvant: 21, base, cible: 14 });
  assert.ok(a);
  assert.ok(Math.abs(a.tsb - 14) < Math.abs(sans.tsb - 14));
  assert.ok([3, 5, 7, 10, 14].includes(a.jours));
  assert.equal(a.charges.length, 21);
  // course dans 2 jours : aucun plan de 3 jours ou plus n'est possible
  assert.equal(meilleurAffutage({ ctl0: 60, atl0: 60, joursAvant: 2, base: [60, 60], cible: 14 }), null);
});

test('analyserForme : pas assez de données', () => {
  assert.equal(analyserForme({ seances: [], aujourdhui: AUJ }).insuffisant, true);
});

test('analyserForme : entraînement régulier sans compétition → pas de projection, 3 graphiques', () => {
  const a = analyserForme({ seances: regulier(), aujourdhui: AUJ });
  assert.equal(a.insuffisant, false);
  assert.equal(a.brut.projection, null);
  assert.equal(a.graphiques.length, 3);
  assert.ok(['ok', 'info', 'danger'].includes(a.verdict.niveau));
  assert.ok(a.conseils.length >= 1);
  for (const g of a.graphiques.filter((x) => x.type === 'lignes')) for (const s of g.series) assert.equal(s.valeurs.length, g.etiquettes.length);
});

test('analyserForme : compétition dans 21 jours → projection et affûtage chiffrés', () => {
  const objectifs = [{ id: 'c1', name: 'Semi de Toulouse', date: decalerJour(ISO, 21), duration: 105, sport: 'Run' }];
  const a = analyserForme({ seances: regulier(), objectifs, aujourdhui: AUJ });
  const p = a.brut.projection;
  assert.ok(p);
  assert.equal(p.joursAvant, 21);
  assert.equal(p.aDesPrevues, false);
  assert.equal(p.mode, 'habituel');
  assert.ok(p.affutage);
  assert.ok(p.affutage.tsb > p.sansAffutage.tsb, 'l\'affûtage doit rendre plus frais');
  assert.ok(p.affutage.tsb >= p.vise.min - 6 && p.affutage.tsb <= p.vise.max + 6, `tsb ${p.affutage.tsb}`);
  const [g1, g2] = a.graphiques;
  for (const g of [g1, g2]) for (const s of g.series) assert.equal(s.valeurs.length, g.etiquettes.length);
  assert.ok(g1.series.some((s) => s.pointille));
  assert.ok(a.conseils.some((c) => /affûtage/i.test(c.titre)));
  assert.ok(a.chiffres.some((c) => /Semi de Toulouse/.test(c.etiquette)));
});

test('analyserForme : séances prévues prises en compte à la place de la charge habituelle', () => {
  const objectifs = [{ name: 'Course', date: decalerJour(ISO, 14), duration: 60 }];
  const prevues = Array.from({ length: 13 }, (_, i) => ({ date: decalerJour(ISO, i + 1), tss: 150, category: 'entrainement' }));
  const a = analyserForme({ seances: regulier(), objectifs, planifiees: prevues, aujourdhui: AUJ });
  assert.equal(a.brut.projection.aDesPrevues, true);
  assert.equal(a.brut.projection.mode, 'plan');
  assert.ok(a.brut.projection.sansAffutage.tsb < 0, 'une grosse charge prévue fatigue');
  assert.ok(a.conseils.some((c) => c.priorite === 'haute'));
});

test('analyserForme : compétition dans 1 jour ou passée → pas de plan impossible', () => {
  const demain = analyserForme({ seances: regulier(), objectifs: [{ name: 'Demain', date: decalerJour(ISO, 1), duration: 60 }], aujourdhui: AUJ });
  assert.equal(demain.brut.projection.affutage, null);
  const passee = analyserForme({ seances: regulier(), objectifs: [{ name: 'Hier', date: decalerJour(ISO, -3) }], aujourdhui: AUJ });
  assert.equal(passee.brut.projection, null);
});

test('analyserForme : gros bloc de charge → fatigue excessive, conseil de récupération', () => {
  const s = seances((i) => (i <= 20 ? 140 : i % 7 === 6 ? 0 : 40));
  const a = analyserForme({ seances: s, aujourdhui: AUJ });
  assert.ok(a.brut.tsb < -25);
  assert.ok(['danger', 'ok'].includes(a.verdict.niveau));
  assert.ok(a.conseils.some((c) => c.priorite === 'haute'));
});

test('analyserForme : longue pause → désentraînement', () => {
  const s = seances((i) => (i > 40 ? (i % 7 === 6 ? 0 : 60) : i === 3 ? 20 : 0));
  const a = analyserForme({ seances: s, aujourdhui: AUJ });
  assert.ok(a.brut.tsb > 15);
  assert.ok(a.brut.dansZone.detrain > 0);
  assert.ok(a.brut.partDuPic < 80);
  assert.equal(a.verdict.titre, 'Ta condition a baissé'); // frais mais pas en forme
  assert.ok(a.conseils.some((c) => /Reprends/.test(c.titre)));
});

test('analyserForme : fraîcheur le jour des compétitions passées', () => {
  const s = regulier();
  const courue = { id: 'x', sport: 'Run', name: 'Ronde', category: 'competition', start_date_local: `${decalerJour(ISO, -30)}T09:00:00`, moving_time: 3000, tss: 90 };
  const a = analyserForme({ seances: [...s, courue], courues: [courue], aujourdhui: AUJ });
  assert.equal(a.brut.tsbCourses.length, 1);
  assert.ok(a.lectures.some((l) => /compétitions/.test(l)));
});

test('profilHebdo : la charge moyenne de chaque jour de la semaine', async () => {
  const { profilHebdo } = await import('../src/lib/analyse/forme.js');
  // un lundi sur deux à 100, jamais le reste : 28 jours = 4 lundis
  const serie = [];
  for (let i = 27; i >= 0; i--) {
    const iso = decalerJour(ISO, -i);
    serie.push({ iso, charge: new Date(`${iso}T12:00:00`).getDay() === 1 ? 100 : 0 });
  }
  const p = profilHebdo(serie);
  assert.equal(p[1], 100);
  assert.equal(p[2], 0);
  assert.equal(p.length, 7);
});

test('analyserForme : un plan clairsemé est complété par la semaine habituelle (pas de chute irréaliste)', () => {
  const objectifs = [{ name: 'Course', date: decalerJour(ISO, 27), duration: 60 }];
  const peu = [{ date: decalerJour(ISO, 2), tss: 70 }, { date: decalerJour(ISO, 9), tss: 70 }, { date: decalerJour(ISO, 16), tss: 70 }];
  const a = analyserForme({ seances: regulier(), objectifs, planifiees: peu, aujourdhui: AUJ });
  const p = a.brut.projection;
  assert.equal(p.mode, 'mixte');
  // sans complément, la condition s'effondrerait vers ~20 ; avec la semaine habituelle elle reste proche de l'actuelle
  assert.ok(p.sansAffutage.ctl > a.brut.ctl * 0.75, `ctl projetée ${p.sansAffutage.ctl} vs ${a.brut.ctl}`);
  assert.ok(a.conseils.some((c) => /Planifie tes séances/.test(c.titre)));
});
