import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserCharge, repartitionIntensite, intensiteSeance } from '../src/lib/analyse/charge.js';
import { serieCharge, zoneAcwr, zoneTsb, chargesQuotidiennes } from '../src/lib/analyse/moteur-charge.js';
import { moyenne, ecartType, regression, ewma, decalerJour, lundiDe, ecartJours, joursEntre } from '../src/lib/analyse/maths.js';

const AUJ = new Date(2026, 9, 14, 12); // 14 octobre 2026 (mercredi)
const ISO = '2026-10-14';

/** Fabrique des séances : plan(i) donne la charge (TSS) du jour qui est à i jours d'aujourd'hui (0 = aujourd'hui), ou 0 pour rien. */
function seances(plan, jours = 200, sport = 'Run', minutes = 60) {
  const sortie = [];
  for (let i = jours; i >= 0; i--) {
    const tss = plan(i);
    if (!tss) continue;
    sortie.push({ id: `s${i}`, sport, start_date_local: `${decalerJour(ISO, -i)}T18:00:00+00:00`, moving_time: minutes * 60, tss, avg_heartrate: 145 });
  }
  return sortie;
}

test('maths : moyenne, écart type, régression, ewma, dates', () => {
  assert.equal(moyenne([2, 4, 6]), 4);
  assert.equal(moyenne([]), 0);
  assert.ok(Math.abs(ecartType([2, 4, 4, 4, 5, 5, 7, 9]) - 2) < 1e-9);
  assert.equal(ecartType([5]), 0);
  const r = regression([1, 3, 5, 7]);
  assert.ok(Math.abs(r.pente - 2) < 1e-9 && Math.abs(r.r2 - 1) < 1e-9);
  assert.equal(regression([4, 4, 4]).pente, 0);
  const e = ewma([10, 10, 10], 1, 0); // tau 1 : la valeur suit tout de suite
  assert.deepEqual(e, [10, 10, 10]);
  assert.equal(decalerJour('2026-10-31', 1), '2026-11-01');
  assert.equal(decalerJour('2026-03-01', -1), '2026-02-28');
  assert.equal(lundiDe('2026-10-14'), '2026-10-12');
  assert.equal(lundiDe('2026-10-18'), '2026-10-12');
  assert.equal(ecartJours('2026-10-01', '2026-10-14'), 13);
  assert.equal(joursEntre('2026-10-30', '2026-11-02').length, 4);
});

test('zones ACWR et TSB', () => {
  assert.equal(zoneAcwr(null).cle, 'inconnu');
  assert.equal(zoneAcwr(0.7).cle, 'bas');
  assert.equal(zoneAcwr(1.0).cle, 'optimal');
  assert.equal(zoneAcwr(1.3).cle, 'optimal');
  assert.equal(zoneAcwr(1.4).cle, 'vigilance');
  assert.equal(zoneAcwr(1.6).cle, 'danger');
  assert.equal(zoneTsb(30).cle, 'detrain');
  assert.equal(zoneTsb(10).cle, 'frais');
  assert.equal(zoneTsb(0).cle, 'transition');
  assert.equal(zoneTsb(-20).cle, 'optimal');
  assert.equal(zoneTsb(-35).cle, 'risque');
});

test('moteur : une charge constante donne CTL ≈ ATL ≈ charge, TSB ≈ 0, ACWR ≈ 1', () => {
  const s = seances(() => 60, 220); // 60 points tous les jours
  const serie = serieCharge(s, '2026-09-14', ISO);
  const d = serie[serie.length - 1];
  assert.ok(Math.abs(d.ctl - 60) < 1, `ctl ${d.ctl}`);
  assert.ok(Math.abs(d.atl - 60) < 1);
  assert.ok(Math.abs(d.tsb) < 1);
  assert.ok(Math.abs(d.acwr - 1) < 0.02);
});

test('moteur : un pic de charge fait monter l\'ATL plus vite que la CTL (fraîcheur négative)', () => {
  const s = seances((i) => (i <= 6 ? 150 : i % 2 ? 50 : 0), 220);
  const serie = serieCharge(s, '2026-09-14', ISO);
  const d = serie[serie.length - 1];
  assert.ok(d.atl > d.ctl + 15);
  assert.ok(d.tsb < -10);
  assert.ok(d.acwr > 1.4);
});

test('moteur : les jours sans séance valent 0 et les séances hors fenêtre sont ignorées', () => {
  const m = chargesQuotidiennes(seances((i) => (i === 3 ? 80 : 0), 10), '2026-10-10', ISO);
  assert.equal(m.get('2026-10-11'), 80);
  assert.equal(m.get('2026-10-12'), 0);
  assert.equal(m.size, 5);
  assert.equal(serieCharge([], '2026-10-01', ISO)[0].acwr, null); // aucune charge : pas de ratio
});

test('analyserCharge : trop peu de données → insuffisant', () => {
  const a = analyserCharge({ seances: seances((i) => (i % 3 === 0 ? 60 : 0), 8), aujourdhui: AUJ });
  assert.equal(a.insuffisant, true);
  assert.equal(a.verdict.niveau, 'info');
  assert.deepEqual(a.chiffres, []);
  const vide = analyserCharge({ seances: [], aujourdhui: AUJ });
  assert.equal(vide.insuffisant, true);
});

test('analyserCharge : entraînement régulier → verdict ok, conseil « continue », ratio ≈ 1', () => {
  const s = seances((i) => (i % 7 === 6 ? 0 : i % 7 === 3 ? 80 : 50), 200);
  const a = analyserCharge({ seances: s, aujourdhui: AUJ, semaines: 12 });
  assert.equal(a.insuffisant, false);
  assert.equal(a.verdict.niveau, 'ok');
  assert.ok(Math.abs(a.brut.acwr - 1) < 0.12, `acwr ${a.brut.acwr}`);
  assert.equal(a.conseils[0].priorite, 'info');
  assert.ok(a.graphiques.length >= 3);
  assert.equal(a.graphiques[0].type, 'barres');
  assert.equal(a.graphiques[0].etiquettes.length, a.graphiques[0].series[0].valeurs.length);
  assert.equal(a.graphiques[0].ligne.length, a.graphiques[0].etiquettes.length);
});

test('analyserCharge : semaine très au-dessus de l\'habitude → danger et charge cible chiffrée', () => {
  const s = seances((i) => (i <= 6 ? 130 : i % 7 === 6 ? 0 : 45), 200);
  const a = analyserCharge({ seances: s, aujourdhui: AUJ });
  assert.equal(a.verdict.niveau, 'danger');
  assert.ok(a.brut.acwr > 1.5);
  const c = a.conseils[0];
  assert.equal(c.priorite, 'haute');
  assert.match(c.texte, /Vise environ \d+ points/);
  assert.ok(a.brut.variation > 50);
});

test('analyserCharge : arrêt brutal → sous-charge, conseil de remonter doucement', () => {
  const s = seances((i) => (i >= 6 ? (i % 7 === 6 ? 0 : 55) : i === 1 ? 20 : 0), 200);
  const a = analyserCharge({ seances: s, aujourdhui: AUJ });
  assert.ok(a.brut.acwr < 0.8);
  assert.equal(a.verdict.niveau, 'info');
  assert.ok(a.conseils.some((c) => /remonter/.test(c.titre)));
});

test('analyserCharge : sept jours identiques → monotonie élevée détectée', () => {
  const s = seances((i) => (i <= 6 ? 60 : i % 7 === 6 ? 0 : 60), 200);
  const a = analyserCharge({ seances: s, aujourdhui: AUJ });
  assert.ok(a.brut.monotonie > 2.5);
  assert.ok(a.conseils.some((c) => /monotonie/i.test(c.titre)));
  assert.equal(a.brut.joursActifs, 7);
});

test('analyserCharge : semaines sans séance repérées', () => {
  const s = seances((i) => (i > 21 && i < 36 ? 0 : i % 2 ? 50 : 0), 200);
  const a = analyserCharge({ seances: s, aujourdhui: AUJ });
  assert.ok(a.brut.vides >= 1);
});

test('intensité : IF, répartition pondérée et profils', () => {
  assert.equal(intensiteSeance({ tss: 50, moving_time: 3600 }).toFixed(3), '0.707');
  assert.equal(intensiteSeance({ moving_time: 3600 }), null);
  assert.equal(intensiteSeance({ tss: 50, moving_time: 0 }), null);
  const polarise = [
    ...Array.from({ length: 8 }, () => ({ tss: 40, moving_time: 3600 })), // IF 0,63 : facile
    ...Array.from({ length: 2 }, () => ({ tss: 100, moving_time: 3600 })), // IF 1,0 : intense
  ];
  const p = repartitionIntensite(polarise);
  assert.equal(p.profil, 'polarise');
  assert.equal(p.facile + p.modere + p.intense >= 99, true);
  const grise = Array.from({ length: 6 }, () => ({ tss: 70, moving_time: 3600 })); // IF 0,84 : modéré
  assert.equal(repartitionIntensite(grise).profil, 'zone_grise');
  assert.equal(repartitionIntensite([{ moving_time: 1 }]), null);
});

test('analyserCharge : répartition par sport et séries cohérentes', () => {
  const s = [...seances((i) => (i % 2 ? 50 : 0), 150, 'Run'), ...seances((i) => (i % 3 === 0 ? 60 : 0), 150, 'Ride', 90)];
  const a = analyserCharge({ seances: s, aujourdhui: AUJ, semaines: 26 });
  const noms = a.graphiques[0].series.map((x) => x.nom).sort();
  assert.deepEqual(noms, ['course', 'velo']);
  assert.equal(a.brut.sports.reduce((t, x) => t + x.part, 0) >= 99, true);
  for (const g of a.graphiques) assert.ok(g.titre && g.description);
});
