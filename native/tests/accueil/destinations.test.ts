import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinationWidget } from '../../src/data/accueil/destinations.ts';
import type { Contexte, Prevue, Seance } from '../../src/data/types.ts';

const AUJOURDHUI = new Date(2026, 10, 10, 9, 0);
const prevue = (id: string, date: string, category = 'entrainement'): Prevue => ({ id, name: null, date, sport: 'Run', duration: 30, tss: null, category, km: null });
const seance = (id: string): Seance => ({
  id, name: null, sport: 'Run', start_date_local: '2026-11-07T07:30:00', moving_time: 3600, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss: null, category: 'workout',
});
const contexte = (reste: Partial<Contexte> = {}): Contexte => ({ seances: [], toutesSeances: [], dernieres: [], metriques: [], objectifs: [], planifiees: [], profil: null, hrMax: null, filtre: 'tout', puissance: [], force: { series: [], programmes: [] }, hyrox: { tests: [], objectif: null }, ...reste });

test('Dernière séance : ouvre la plus récente ; sans séance, rien', () => {
  assert.deepEqual(destinationWidget('dernieres', contexte({ dernieres: [seance('s1'), seance('s2')] })), { type: 'ecran', pathname: '/seance', params: { id: 's1' } });
  assert.equal(destinationWidget('dernieres', contexte()), null);
});

test('Séance du jour : ouvre la séance prévue d\'aujourd\'hui, rien si repos', () => {
  const c = contexte({ planifiees: [prevue('p1', '2026-11-10'), prevue('p2', '2026-11-12')] });
  assert.deepEqual(destinationWidget('aujourdhui', c, AUJOURDHUI), { type: 'ecran', pathname: '/prevue', params: { id: 'p1' } });
  assert.equal(destinationWidget('aujourdhui', contexte({ planifiees: [prevue('p2', '2026-11-12')] }), AUJOURDHUI), null);
});

test('Séance du jour : une compétition garde son indicateur', () => {
  const c = contexte({ planifiees: [prevue('c1', '2026-11-10', 'competition')] });
  assert.deepEqual(destinationWidget('seancedujour', c, AUJOURDHUI), { type: 'ecran', pathname: '/prevue', params: { id: 'c1', competition: '1' } });
});

test('Onglets : stats vers le Bilan, semaine vers le Calendrier ; widget inconnu : rien', () => {
  for (const id of ['charge', 'forme', 'regularite']) assert.deepEqual(destinationWidget(id, contexte()), { type: 'onglet', chemin: '/bilan' });
  for (const id of ['semaine', 'avenir']) assert.deepEqual(destinationWidget(id, contexte()), { type: 'onglet', chemin: '/calendrier' });
  assert.equal(destinationWidget('kmhebdo', contexte()), null);
});
