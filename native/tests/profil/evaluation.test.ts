import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluer, fusionnerCourbes, noteRepere, puissanceCritique, valeurCourbe } from '../../src/data/profil/evaluation.ts';
import { REPERES } from '../../src/data/profil/reperes.ts';
import type { PointCourbe } from '../../src/data/bilan/records.ts';

const point = (duree: number, valeur: number): PointCourbe => ({ duree, top: [{ valeur, id: 'a', nom: 'Sortie', iso: '2026-10-01' }] });
const jour = new Date(2026, 10, 13);
const profil = (extras: Record<string, unknown> = {}, autres: Record<string, unknown> = {}) => ({ weight: 70, extras: { sex: 'M', ...extras }, ...autres }) as never;

test('la note est une règle de trois bornée à 0-100, inversée quand plus bas est mieux', () => {
  assert.equal(noteRepere(3.5, 7, 'haut'), 50);
  assert.equal(noteRepere(9, 7, 'haut'), 100);
  assert.equal(noteRepere(0, 7, 'haut'), 0);
  assert.equal(noteRepere(56, 28, 'bas'), 50);
  assert.equal(noteRepere(20, 28, 'bas'), 100);
  assert.equal(noteRepere(0, 28, 'bas'), null);
  assert.equal(noteRepere(null, 7, 'haut'), null);
});

test('la courbe donne la valeur la plus proche de la durée, à 15 % près', () => {
  const c = [point(300, 350), point(1200, 300)];
  assert.equal(valeurCourbe(c, 300), 350);
  assert.equal(valeurCourbe(c, 1100), 300);
  assert.equal(valeurCourbe(c, 3600), null);
});

test('la puissance critique retrouve CP et W’ sur des efforts parfaits', () => {
  // P(t) = CP + W'/t avec CP = 280 W et W' = 20 kJ
  const c = [180, 300, 600, 1200].map((t) => point(t, 280 + 20000 / t));
  const r = puissanceCritique(c);
  assert.ok(r);
  assert.ok(Math.abs(r.cp - 280) < 0.5);
  assert.ok(Math.abs(r.wPrime - 20000) < 50);
  assert.equal(puissanceCritique(c.slice(0, 2)), null);
});

test('sans aucune donnée : pas de niveau, aucun repère mesuré', () => {
  const e = evaluer({ profil: null, aujourdhui: jour });
  assert.equal(e.niveau, null);
  assert.equal(e.mesures, 0);
  assert.equal(e.total, REPERES.filter((r) => !r.aVenir).length);
  assert.equal(e.sexeConnu, false);
  assert.ok(e.domaines.every((d) => d.note === null));
});

test('la FTP vient des séances (95 % des 20 min) avant la saisie', () => {
  const e = evaluer({ profil: profil({}, { ftp: 200 }), courbePuissance: [point(1200, 294.7)], aujourdhui: jour });
  const ftp = e.domaines.flatMap((d) => d.reperes).find((v) => v.def.cle === 'ftp')!;
  assert.equal(ftp.provenance, 'seances');
  assert.ok(Math.abs((ftp.valeur as number) - 4) < 0.01);
  assert.equal(ftp.note, Math.round((4 / 7) * 100));
  const saisie = evaluer({ profil: profil({}, { ftp: 280 }), aujourdhui: jour }).domaines.flatMap((d) => d.reperes).find((v) => v.def.cle === 'ftp')!;
  assert.equal(saisie.provenance, 'saisi');
  assert.equal(saisie.valeur, 4);
});

test('une femme est comparée aux références femmes', () => {
  const h = evaluer({ profil: profil({ vma: 18 }), aujourdhui: jour });
  const f = evaluer({ profil: profil({ vma: 18, sex: 'F' }), aujourdhui: jour });
  const vma = (e: typeof h) => e.domaines.flatMap((d) => d.reperes).find((v) => v.def.cle === 'vma')!.note as number;
  assert.equal(f.sexe, 'femme');
  assert.ok(vma(f) > vma(h));
});

test('le niveau est la moyenne des domaines pondérée (performance ×2, composition et récupération ×1)', () => {
  // VMA 12,35 km/h → 50 en puissance (poids 2) ; masse grasse 12 % → 50 en composition (poids 1)
  const e = evaluer({ profil: profil({ vma: 12.35 }), mesures: { '2026-11-01': { masse_grasse_pct: 12 } }, aujourdhui: jour });
  const puissance = e.domaines.find((d) => d.domaine.cle === 'puissance')!;
  const compo = e.domaines.find((d) => d.domaine.cle === 'composition')!;
  assert.equal(compo.note, 50);
  assert.equal(puissance.mesures >= 1, true);
  // La VMA donne aussi une VO2max estimée (cardio) : tous les domaines notés comptent
  const notes = e.domaines.filter((d) => d.note !== null);
  assert.ok(notes.some((d) => d.domaine.cle === 'cardio'));
  const attendu = Math.round(notes.reduce((s, d) => s + (d.note as number) * d.domaine.poids, 0) / notes.reduce((s, d) => s + d.domaine.poids, 0));
  assert.equal(e.niveau, attendu);
});

test('la force : test saisi avant le carnet, ramené au poids', () => {
  const series = [{ exercise_key: 'squat', weight_kg: 100, reps: 5, date: '2026-10-01' }] as never;
  const carnet = evaluer({ profil: profil(), seriesForce: series, aujourdhui: jour }).domaines.flatMap((d) => d.reperes).find((v) => v.def.cle === 'squat')!;
  assert.equal(carnet.provenance, 'estime');
  assert.ok(Math.abs((carnet.valeur as number) - (100 * (1 + 5 / 30)) / 70) < 1e-9);
  const teste = evaluer({ profil: profil(), seriesForce: series, mesures: { '2026-11-02': { test_rm_squat_kg: 140 } }, aujourdhui: jour })
    .domaines.flatMap((d) => d.reperes).find((v) => v.def.cle === 'squat')!;
  assert.equal(teste.provenance, 'saisi');
  assert.equal(teste.valeur, 2);
  assert.equal(teste.date, '2026-11-02');
});

test('la FC de repos vient des nuits des 30 derniers jours (médiane)', () => {
  const nuits = [50, 52, 48, 70].map((fc, i) => ({ date: `2026-11-0${i + 1}`, resting_heart_rate: fc, total_sec: 8 * 3600 })) as never;
  const e = evaluer({ profil: profil({ rhr: 60 }), nuits, aujourdhui: jour });
  const tous = e.domaines.flatMap((d) => d.reperes);
  const fc = tous.find((v) => v.def.cle === 'fc_repos')!;
  assert.equal(fc.provenance, 'montre');
  assert.equal(fc.valeur, 51);
  assert.equal(tous.find((v) => v.def.cle === 'sommeil')!.valeur, 8);
});

test('la régularité compte les jours avec séance sur 28 jours', () => {
  const seances = ['2026-11-13', '2026-11-13', '2026-11-01', '2026-10-17', '2026-10-01'].map((d) => ({ start_date_local: `${d}T08:00:00` })) as never;
  const reg = evaluer({ profil: profil(), seances, aujourdhui: jour }).domaines.flatMap((d) => d.reperes).find((v) => v.def.cle === 'regularite')!;
  assert.equal(reg.valeur, 3);
});

test('deux courbes fusionnées gardent le meilleur de chaque durée', () => {
  const f = fusionnerCourbes([point(60, 400), point(300, 300)], [point(60, 380), point(300, 320), point(1200, 260)]);
  assert.deepEqual(f.map((p) => [p.duree, p.top[0].valeur]), [[60, 400], [300, 320], [1200, 260]]);
});

test('chaque repère a une référence positive pour les deux sexes et un domaine connu', () => {
  for (const r of REPERES) {
    assert.ok(r.ref.homme > 0 && r.ref.femme > 0, r.cle);
  }
  assert.equal(new Set(REPERES.map((r) => r.cle)).size, REPERES.length);
});
