import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elementsDuJour, faitePour, infosDuJour, lignesDeLaBande, seancesDuJour } from '../src/data/aujourdhui.ts';
import type { Prevue, Seance } from '../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 9, 21, 9, 0); // mercredi 21 octobre 2026
const prevue = (id: string, date: string, sport: string, category = 'entrainement'): Prevue => ({ id, name: null, date, sport, duration: 54, tss: null, category, km: null });
const faite = (id: string, date: string, sport: string): Seance => ({
  id, name: null, sport, start_date_local: `${date}T07:30:00`, moving_time: 3000, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});

test('seancesDuJour : seules les séances d\'aujourd\'hui, quel que soit le sport', () => {
  const r = seancesDuJour([prevue('a', '2026-10-21', 'WeightTraining'), prevue('b', '2026-10-22', 'Run'), prevue('c', '2026-10-20', 'Swim')], [faite('x', '2026-10-21', 'Run'), faite('y', '2026-10-20', 'Run')], AUJOURDHUI);
  assert.deepEqual(r.prevues.map((p) => p.id), ['a']);
  assert.deepEqual(r.faites.map((s) => s.id), ['x']);
});

test('seancesDuJour : la compétition passe avant l\'entraînement', () => {
  const r = seancesDuJour([prevue('a', '2026-10-21', 'Run'), prevue('b', '2026-10-21', 'Run', 'competition')], [], AUJOURDHUI);
  assert.deepEqual(r.prevues.map((p) => p.id), ['b', 'a']);
});

test('seancesDuJour : sans données, des listes vides', () => {
  assert.deepEqual(seancesDuJour(null, undefined, AUJOURDHUI), { prevues: [], faites: [] });
});

test('faitePour : une séance faite du même sport rend la prévue « faite », un autre sport non', () => {
  const p = prevue('a', '2026-10-21', 'Ride');
  assert.equal(faitePour(p, [faite('x', '2026-10-21', 'VirtualRide')])?.id, 'x'); // vélo virtuel = vélo
  assert.equal(faitePour(p, [faite('y', '2026-10-21', 'Run')]), null);
  assert.equal(faitePour(p, []), null);
});

test('elementsDuJour : plusieurs séances, ce qui reste à faire passe avant ce qui est fait', () => {
  const jour = seancesDuJour([prevue('a', '2026-10-21', 'Run'), prevue('b', '2026-10-21', 'WeightTraining')], [faite('x', '2026-10-21', 'Run')], AUJOURDHUI);
  const e = elementsDuJour(jour);
  assert.deepEqual(e.map((z) => [z.sport, z.fait, z.prevue]), [['WeightTraining', false, true], ['Run', true, true]]);
  assert.equal(e[1].faiteSecondes, 3000);
});

test('elementsDuJour : une séance faite ne valide qu\'une séance prévue (deux courses prévues, une faite)', () => {
  const jour = seancesDuJour([prevue('a', '2026-10-21', 'Run'), prevue('b', '2026-10-21', 'Run')], [faite('x', '2026-10-21', 'Run')], AUJOURDHUI);
  assert.deepEqual(elementsDuJour(jour).map((z) => z.fait), [false, true]);
});

test('elementsDuJour : une séance faite non prévue s\'ajoute, un jour vide donne une liste vide', () => {
  const e = elementsDuJour(seancesDuJour([], [faite('x', '2026-10-21', 'Swim')], AUJOURDHUI));
  assert.deepEqual(e.map((z) => [z.sport, z.fait, z.prevue, z.prevueMinutes]), [['Swim', true, false, null]]);
  assert.deepEqual(elementsDuJour(seancesDuJour([], [], AUJOURDHUI)), []);
});

test('infosDuJour : durée, distance et exercices sur une ligne, ce qui manque est absent', () => {
  assert.equal(infosDuJour({ prevueMinutes: 150, km: 70 }), '2h30 · 70 km');
  assert.equal(infosDuJour({ prevueMinutes: 60, km: null }, 5), '1h00 · 5 exos');
  assert.equal(infosDuJour({ prevueMinutes: 40, km: 1.5 }), '40 min · 1,5 km');
  assert.equal(infosDuJour({ prevueMinutes: null, km: null }, 1), '1 exo');
  assert.equal(infosDuJour({ prevueMinutes: null, km: null }), '');
});

test('lignesDeLaBande : jusqu\'à 2 séances toutes montrées, au-delà la plus longue et le nombre des autres', () => {
  const s = (id: string, prevueMinutes: number | null) => ({ id, prevueMinutes });
  assert.deepEqual(lignesDeLaBande([s('a', 60)]), { lignes: [s('a', 60)], autres: 0 });
  assert.deepEqual(lignesDeLaBande([s('a', 60), s('b', 150)]), { lignes: [s('a', 60), s('b', 150)], autres: 0 });
  assert.deepEqual(lignesDeLaBande([s('a', 54), s('b', 150), s('c', 45)]), { lignes: [s('b', 150)], autres: 2 });
  assert.deepEqual(lignesDeLaBande([s('a', 54), s('b', 90), s('c', 45), s('d', 30)]), { lignes: [s('b', 90)], autres: 3 });
  // durées inconnues : la première reste
  assert.deepEqual(lignesDeLaBande([s('a', null), s('b', null), s('c', null)]), { lignes: [s('a', null)], autres: 2 });
});
