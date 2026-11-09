// Structure des séances du coach : jamais vide, somme exacte des durées, métrique par sport.
// Lancer : node --experimental-strip-types --test supabase/tests/edge/structure-seance.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { dureeStructure, resumeStructure, structureSeance, structureSurMesure } from '../../functions/_shared/structure-seance.ts';
import { MENU } from '../../functions/_shared/menu-seances.ts';
import type { FamilleCoach } from '../../functions/_shared/menu-seances.ts';

test('toute séance, tout type, toute durée : au moins un bloc, somme EXACTE des durées, blocs valides', () => {
  for (let m = 1; m <= 600; m++) {
    for (const sport of Object.keys(MENU) as FamilleCoach[]) {
      for (const t of MENU[sport]) {
        const s = structureSeance(sport, t.cle, m);
        assert.ok(s.length >= 1 && s.length <= 40);
        assert.equal(dureeStructure(s), m, `${sport}/${t.cle} ${m} min`);
        for (const b of s) {
          assert.ok(b.work.min >= 1, `${sport}/${t.cle} ${m} : bloc ${b.type} de ${b.work.min} min`);
          assert.ok(b.reps >= 1 && Number.isInteger(b.reps));
          assert.equal(b.metric, sport === 'velo' ? 'power' : 'pace');
        }
      }
    }
  }
});
test('67 minutes de seuil à vélo : échauffement, intervalles de 10 min, retour au calme', () => {
  const s = structureSeance('velo', 'seuil', 67);
  assert.deepEqual(s.map((b) => b.type), ['warmup', 'interval', 'cooldown']);
  assert.equal(s[1].work.min, 10);
  assert.equal(s[1].rec?.min, 3);
  assert.equal(dureeStructure(s), 67);
});
test('endurance : échauffement, corps continu en zone 2, retour au calme', () => {
  const s = structureSeance('course', 'footing_facile', 60);
  assert.deepEqual(s.map((b) => b.type), ['warmup', 'steady', 'cooldown']);
  assert.equal(s[1].work.int, 75);
  assert.match(resumeStructure(s), /échauffement.*continues.*retour au calme/);
});
test('séance très courte : un seul bloc', () => {
  assert.equal(structureSeance('natation', 'technique', 7).length, 1);
});

test('sur mesure : « 4 × 8 min au seuil, 3 min de récup » donne échauffement, intervalles, retour au calme, et la durée totale est la somme exacte', () => {
  const r = structureSurMesure('velo', { genre: 'intervalles', zone: 4, reps: 4, minutesTravail: 8, minutesRecup: 3 });
  assert.deepEqual(r.structure.map((b) => b.type), ['warmup', 'interval', 'cooldown']);
  assert.equal(r.structure[1].reps, 4);
  assert.equal(r.structure[1].work.min, 8);
  assert.equal(r.structure[1].rec?.min, 3);
  assert.equal(r.type, 'seuil');
  assert.equal(r.nom, '4 × 8 min en zone 4');
  assert.equal(r.minutes, dureeStructure(r.structure), 'durée annoncée = somme des blocs');
  assert.equal(r.minutes, 13 + 44 + 9, 'échauffement 13 (30 % de 44), 4 × 11 min, retour 9');
});
test('sur mesure : effort continu, le type du menu suit la zone, la durée est exacte, natation comprise', () => {
  const v = structureSurMesure('velo', { genre: 'continu', zone: 2, minutes: 60 });
  assert.equal(v.type, 'endurance');
  assert.equal(v.minutes, dureeStructure(v.structure));
  assert.equal(v.structure[1].work.min, 60);
  const n = structureSurMesure('natation', { genre: 'intervalles', zone: 5, reps: 8, minutesTravail: 2, minutesRecup: 1 });
  assert.equal(n.type, 'vitesse');
  assert.equal(n.minutes, dureeStructure(n.structure));
  assert.equal(structureSurMesure('velo', { genre: 'continu', zone: 1, minutes: 30 }).type, 'recuperation');
  assert.equal(structureSurMesure('velo', { genre: 'continu', zone: 9, minutes: 30 }).type, 'vo2max', 'une zone hors bornes est ramenée à 5');
});
