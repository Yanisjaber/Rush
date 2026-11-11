import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerProgression, niveauCoeur, recuperationCardiaque } from '../../../src/data/calendrier/analyse/physio.ts';
import type { SortieHistorique } from '../../../src/data/calendrier/analyse/physio.ts';
import { flux1Hz } from '../../../src/data/calendrier/analyse/flux.ts';

const jour = (j: number) => `2026-10-${String(j).padStart(2, '0')}T08:00:00`;
const sortie = (j: number, allureSKm: number, fc: number, extra: Partial<SortieHistorique> = {}): SortieHistorique => ({
  id: `s${j}`, sport: 'Run', type: 'footing', date: jour(j), dureeS: allureSKm * 6, distanceKm: 6, coeurMoyen: fc, deniveleM: 30, ...extra,
});
const courante = (allureSKm: number, fc: number) => ({ id: 'now', sport: 'Run', type: 'footing', date: '2026-11-02T08:00:00', dureeS: allureSKm * 6, distanceKm: 6, coeurMoyen: fc, deniveleM: 30 });

test('progression : à cœur égal, plus vite que d\'habitude = tu progresses', () => {
  const p = calculerProgression(courante(350, 150), [sortie(5, 370, 150), sortie(12, 372, 150), sortie(19, 368, 150)])!;
  assert.equal(p.comparable, true);
  assert.ok(p.ecartPct > 2.5 && p.secKm > 10, `${p.ecartPct} ${p.secKm}`);
});

test('progression : même niveau = stable ; plus lent à cœur égal = recul', () => {
  const refs = [sortie(5, 370, 150), sortie(12, 370, 150)];
  assert.ok(Math.abs(calculerProgression(courante(370, 150), refs)!.ecartPct) < 2.5);
  assert.ok(calculerProgression(courante(395, 150), refs)!.ecartPct < -2.5);
});

test('progression : cœur très différent = pas comparable ; une seule sortie, une autre type ou un autre sport = rien', () => {
  assert.equal(calculerProgression(courante(330, 172), [sortie(5, 370, 150), sortie(12, 370, 150)])!.comparable, false);
  assert.equal(calculerProgression(courante(350, 150), [sortie(5, 370, 150)]), null);
  assert.equal(calculerProgression(courante(350, 150), [sortie(5, 370, 150, { type: 'longue' }), sortie(12, 370, 150, { sport: 'Ride' })]), null);
  assert.equal(calculerProgression({ ...courante(350, 150), type: 'fractionne' }, [sortie(5, 370, 150), sortie(12, 370, 150)]), null);
});

test('progression : les sorties de plus de 90 jours, trop courtes ou à un autre relief ne comptent pas', () => {
  const refs = [sortie(5, 370, 150, { date: '2026-06-01T08:00:00' }), sortie(12, 370, 150, { dureeS: 600 }), sortie(19, 370, 150, { deniveleM: 400 })];
  assert.equal(calculerProgression(courante(350, 150), refs), null);
});

test('niveau du cœur : moyen et pic, rien sans cœur', () => {
  const n = 600;
  const f = flux1Hz({ temps: Array.from({ length: n }, (_, i) => i), vitesse: Array(n).fill(3), fc: Array.from({ length: n }, (_, i) => 140 + (i / n) * 20) })!;
  const r = niveauCoeur(f)!;
  assert.ok(r.moyen > 148 && r.moyen < 152 && r.pic <= 160);
  assert.equal(niveauCoeur(flux1Hz({ temps: Array.from({ length: n }, (_, i) => i), vitesse: Array(n).fill(3) })!), null);
});

test('récupération du cœur : 4 efforts de 30 s, la baisse en 1 min diminue d\'un effort à l\'autre', () => {
  // 30 s à 4 m/s puis 90 s à 2 m/s, 4 fois ; le cœur monte à 175 en fin d'effort puis redescend de 30, 25, 18, 12 bpm
  const n = 480 + 60;
  const v: number[] = [];
  const fc: number[] = [];
  const baisses = [30, 25, 18, 12];
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 30; i++) { v.push(4); fc.push(175); }
    for (let i = 0; i < 90; i++) { v.push(2); fc.push(i < 56 ? 175 - (baisses[r] * i) / 56 : 175 - baisses[r]); }
  }
  for (let i = 0; i < 60; i++) { v.push(2); fc.push(150); }
  const f = flux1Hz({ temps: v.map((_, i) => i), vitesse: v, fc })!;
  const rec = recuperationCardiaque(f, 30, null)!;
  assert.ok(rec.baisses.length >= 3, String(rec.baisses.length));
  assert.ok(rec.baisses[0] > rec.baisses[rec.baisses.length - 1] + 8, rec.baisses.join(','));
  void n;
});
