import test from 'node:test';
import assert from 'node:assert/strict';
import { lundiDe, bornesPlan, construirePlan, jourVide, JOURS } from '../src/lib/data/plan.js';

const AUJ = new Date(2026, 9, 14, 12); // mercredi 14 octobre 2026

test('lundi de la semaine : un dimanche appartient à la semaine qui finit', () => {
  assert.equal(lundiDe(new Date(2026, 9, 14)).getDate(), 12);
  assert.equal(lundiDe(new Date(2026, 9, 18)).getDate(), 12); // dimanche
  assert.equal(lundiDe(new Date(2026, 9, 12)).getDate(), 12); // lundi
  assert.equal(lundiDe(new Date(2026, 10, 1)).getDate(), 26); // dimanche 1er novembre -> lundi 26 octobre
});

test('bornes : quatre semaines = 28 jours', () => {
  const b = bornesPlan(lundiDe(AUJ), 4);
  assert.deepEqual(b, { debut: '2026-10-12', fin: '2026-11-08' });
});

test('plan : 4 semaines de 7 jours, passé / aujourd\'hui, titres', () => {
  const p = construirePlan(lundiDe(AUJ), {}, AUJ);
  assert.equal(p.length, 4);
  assert.ok(p.every((s) => s.jours.length === 7));
  assert.equal(p[0].titre, 'Semaine du 12 oct. au 18 oct.');
  assert.equal(p[0].jours[0].passe, true); // lundi 12 : passé
  assert.equal(p[0].jours[2].aujourdhui, true); // mercredi 14
  assert.equal(p[0].jours[3].passe, false);
  assert.deepEqual(p[0].jours.map((j) => j.nom), JOURS);
});

test('totaux : seulement aujourd\'hui et le futur, hors repos, compétition sans durée = 120 de charge', () => {
  const donnees = {
    planifiees: [
      { id: 1, date: '2026-10-12', duration: 60, tss: 50, km: 10 }, // passé : ignoré
      { id: 2, date: '2026-10-14', duration: 90, tss: 60, km: 40 }, // aujourd'hui
      { id: 3, date: '2026-10-16', duration: 45, tss: 30, km: null },
      { id: 4, date: '2026-10-20', duration: 120, tss: 90, km: 55.5 }, // semaine suivante
    ],
    objectifs: [{ id: 9, date: '2026-10-18', duration: null, km: 10.15 }],
    repos: ['2026-10-15'],
  };
  const p = construirePlan(lundiDe(AUJ), donnees, AUJ);
  assert.deepEqual(p[0].totaux, { seances: 3, dureeMin: 135, tss: 210, km: 50.2 });
  assert.deepEqual(p[1].totaux, { seances: 1, dureeMin: 120, tss: 90, km: 55.5 });
  assert.deepEqual(p[2].totaux, { seances: 0, dureeMin: 0, tss: 0, km: 0 });
});

test('jours : séances, notes sur plusieurs jours, repos, sorties réalisées, jour vide', () => {
  const donnees = {
    planifiees: [{ id: 1, date: '2026-10-15', duration: 30, tss: 20 }],
    notes: [{ id: 5, type: 'blessure', from_date: '2026-10-13', to_date: '2026-10-15' }],
    seances: [{ id: 's1', start_date_local: '2026-10-13T18:00:00+00:00' }],
    repos: [{ iso_date: '2026-10-17' }],
  };
  const p = construirePlan(lundiDe(AUJ), donnees, AUJ);
  const j = (i) => p[0].jours[i];
  assert.equal(j(3).prevues.length, 1);
  assert.deepEqual([1, 2, 3].map((i) => j(i).notes.length), [1, 1, 1]);
  assert.equal(j(1).realisees.length, 1);
  assert.equal(j(5).repos, true);
  assert.equal(jourVide(j(0)), true);
  assert.equal(jourVide(j(5)), false);
});
