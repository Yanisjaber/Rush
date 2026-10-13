import test from 'node:test';
import assert from 'node:assert/strict';
import { familleBilan, normaliser, activitesAnnee, activitesAnneePrecedente, sommer, ecartPct, anneesDisponibles, modele, valeurActuelle, avancement, recordsVolume, recordRecent, cumulParAnnee, volumeMensuel, repartitionSport, validerObjectif, CATALOGUE } from '../src/lib/data/bilan.js';

const a = (iso, sport, distance = 0, minutes = 60, dplus = 0, tss = 50, name = 'x') => ({ id: iso + sport, name, iso, sport, duree_min: minutes, distance_km: distance, d_plus: dplus, tss });
const MAINTENANT = new Date(2026, 9, 12, 12); // 12 octobre 2026

test('famille de bilan et normalisation', () => {
  assert.equal(familleBilan('Ride'), 'cyclisme');
  assert.equal(familleBilan('MountainBikeRide'), 'cyclisme');
  assert.equal(familleBilan('TrailRun'), 'course');
  assert.equal(familleBilan('Swim'), 'natation');
  assert.equal(familleBilan('WeightTraining'), 'musculation');
  assert.equal(familleBilan('Soccer'), 'autre');
  assert.equal(familleBilan('Workout'), 'musculation'); // séance en salle
  const n = normaliser({ id: '1', name: 'Sortie', sport: 'Ride', start_date_local: '2026-10-01T08:00:00+00:00', moving_time: 3600, distance_km: '40.5', total_elevation_gain: null, tss: 55 });
  assert.deepEqual(n, { id: '1', name: 'Sortie', iso: '2026-10-01', sport: 'cyclisme', famille: 'velo', duree_min: 60, distance_km: 40.5, d_plus: 0, tss: 55 });
  assert.equal(normaliser({ sport: 'MountainBikeRide' }).famille, 'velo'); // le VTT compte avec le vélo pour le filtre
  assert.equal(normaliser({ sport: 'WeightTraining' }).famille, 'muscu');
});

test('année en cours = jusqu\'à aujourd\'hui ; année précédente = jusqu\'au même jour', () => {
  const acts = [a('2026-01-05', 'course'), a('2026-10-12', 'course'), a('2026-10-20', 'course'), a('2025-10-12', 'course'), a('2025-10-14', 'course'), a('2025-03-01', 'course')];
  assert.deepEqual(activitesAnnee(acts, 2026, MAINTENANT).map((x) => x.iso), ['2026-01-05', '2026-10-12']);
  const prec = activitesAnneePrecedente(acts, 2026, MAINTENANT).map((x) => x.iso);
  assert.ok(prec.includes('2025-10-12') && prec.includes('2025-03-01') && !prec.includes('2025-10-14'));
  assert.equal(activitesAnnee(acts, 2025, MAINTENANT).length, 3); // année passée : entière
});

test('sommer, écart, années', () => {
  const s = sommer([a('2026-01-01', 'course', 10, 60, 100, 50), a('2026-01-02', 'course', 5, 30, 50, 20)]);
  assert.deepEqual(s, { distance: 15, heures: 1.5, seances: 2, tss: 70, d_plus: 150 });
  assert.equal(ecartPct(120, 100), 20);
  assert.equal(ecartPct(5, 0), null);
  assert.deepEqual(anneesDisponibles([a('2024-05-01', 'course')], MAINTENANT), [2026, 2024]);
});

test('catalogue : ids uniques, modèles retrouvés, sport inconnu = null', () => {
  const ids = Object.values(CATALOGUE).flat().map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(modele('cyclisme', 'cyc_dist').calc, 'sum_dist');
  assert.equal(modele('cyclisme', 'nexiste_pas'), null);
  assert.equal(modele('__proto__', 'x'), null);
});

test('valeur actuelle : somme, maximum, séances par semaine, saisie manuelle', () => {
  const acts = [a('2026-02-01', 'cyclisme', 100, 180, 800), a('2026-02-01', 'cyclisme', 20, 30, 200), a('2026-05-01', 'course', 10, 50, 0)];
  assert.equal(valeurActuelle({ sport: 'cyclisme', template: 'cyc_dist' }, acts, 2026, MAINTENANT), 120);
  assert.equal(valeurActuelle({ sport: 'tous', template: 'all_sess' }, acts, 2026, MAINTENANT), 3);
  assert.equal(valeurActuelle({ sport: 'cyclisme', template: 'cyc_long' }, acts, 2026, MAINTENANT), 100);
  assert.equal(valeurActuelle({ sport: 'cyclisme', template: 'cyc_bigday' }, acts, 2026, MAINTENANT), 1000); // 800 + 200 le même jour
  assert.equal(valeurActuelle({ sport: 'cyclisme', template: 'cyc_ftp', currentManual: 255 }, acts, 2026, MAINTENANT), 255);
  assert.equal(valeurActuelle({ sport: 'cyclisme', template: 'cyc_ftp' }, acts, 2026, MAINTENANT), null);
  assert.ok(Math.abs(valeurActuelle({ sport: 'tous', template: 'all_sess_w' }, acts, 2026, MAINTENANT) - 3 / 41) < 0.01);
});

test('avancement : rythme attendu, projection, objectif « plus bas = mieux »', () => {
  const acts = Array.from({ length: 10 }, (_, i) => a(`2026-0${(i % 9) + 1}-10`, 'cyclisme', 100));
  const av = avancement({ sport: 'cyclisme', template: 'cyc_dist', target: 2000 }, acts, 2026, MAINTENANT);
  assert.equal(av.actuel, 1000);
  assert.equal(av.pct, 50);
  assert.equal(av.enRythme, false); // 50 % fait à 78 % de l'année
  assert.ok(av.projection > 1200 && av.projection < 1400);
  assert.equal(avancement({ sport: 'cyclisme', template: 'cyc_dist', target: 800 }, acts, 2026, MAINTENANT).enRythme, true);
  const bas = avancement({ sport: 'course', template: 'run_5k', target: 20, currentManual: 25 }, [], 2026, MAINTENANT);
  assert.equal(bas.pct, 80);
  assert.equal(bas.enRythme, false);
  assert.equal(avancement({ sport: 'course', template: 'run_5k', target: 20, currentManual: 19 }, [], 2026, MAINTENANT).enRythme, true);
  assert.equal(avancement({ sport: 'course', template: 'inconnu', target: 1 }, [], 2026), null);
  assert.equal(avancement({ sport: 'course', template: 'run_5k', target: 20 }, [], 2026, MAINTENANT).pct, 0);
});

test('records de volume', () => {
  const acts = [a('2026-03-01', 'cyclisme', 80, 200, 500, 150, 'Longue'), a('2026-03-01', 'cyclisme', 10, 30, 400, 20, 'Court'), a('2026-04-01', 'course', 10, 300, 0, 300, 'Marathon')];
  const r = recordsVolume(acts);
  assert.equal(r.find((x) => x.cle === 'distance').nom, 'Longue');
  assert.equal(r.find((x) => x.cle === 'duree').nom, 'Marathon');
  assert.equal(r.find((x) => x.cle === 'tss').valeur, 300);
  assert.equal(r.find((x) => x.cle === 'dplus').valeur, 900);
  assert.deepEqual(recordsVolume([]), []);
  assert.equal(recordRecent('2026-10-01', MAINTENANT), true);
  assert.equal(recordRecent('2026-01-01', MAINTENANT), false);
  assert.equal(recordRecent('', MAINTENANT), false);
});

test('cumul par année : s\'arrête aujourd\'hui pour l\'année en cours', () => {
  const acts = [a('2026-01-01', 'course', 10), a('2026-01-03', 'course', 5), a('2025-12-31', 'course', 7)];
  const c = cumulParAnnee(acts, [2026, 2025], 'distance_km', MAINTENANT);
  assert.equal(c.etiquettes.length, 366);
  const s26 = c.series[0].valeurs;
  assert.equal(s26[0], 10);
  assert.equal(s26[2], 15);
  assert.equal(s26[284], 15); // 12 octobre = jour 284 (0-indexé)
  assert.equal(s26[285], null);
  const s25 = c.series[1].valeurs;
  assert.equal(s25[364], 7); // 31 décembre 2025 (jour 364)
  assert.notEqual(s25[365], null);
});

test('volume mensuel et répartition par sport', () => {
  const acts = [a('2026-01-10', 'course', 0, 120), a('2026-01-20', 'cyclisme', 0, 60), a('2026-03-01', 'course', 0, 60), a('2025-01-01', 'course', 0, 600)];
  const m = volumeMensuel(acts, 2026);
  assert.equal(m.length, 12);
  assert.equal(m[0], 3);
  assert.equal(m[2], 1);
  const r = repartitionSport(acts.filter((x) => x.iso.startsWith('2026')));
  assert.equal(r[0].sport, 'course');
  assert.equal(r[0].part, 75);
  assert.equal(r.reduce((s, x) => s + x.part, 0), 100);
});

test('validerObjectif : cible positive, saisie seulement pour un objectif manuel', () => {
  assert.ok(validerObjectif({ sport: 'cyclisme', template: 'cyc_dist', cible: '' }).erreurs.cible);
  assert.ok(validerObjectif({ sport: 'cyclisme', template: 'cyc_dist', cible: '-4' }).erreurs.cible);
  assert.ok(validerObjectif({ sport: 'cyclisme', template: 'nul', cible: '5' }).erreurs.template);
  const ok = validerObjectif({ sport: 'cyclisme', template: 'cyc_dist', cible: '6 000'.replace(' ', ''), actuel: '12' });
  assert.equal(ok.valeurs.target, 6000);
  assert.equal(ok.valeurs.current_manual, null); // ignoré : objectif calculé
  const manuel = validerObjectif({ sport: 'cyclisme', template: 'cyc_ftp', cible: '280', actuel: '255,5' });
  assert.equal(manuel.valeurs.current_manual, 255.5);
});

test('familleBilanDuFiltre : filtre global de sport → famille de bilan', async () => {
  const { familleBilanDuFiltre } = await import('../src/lib/data/bilan.js');
  assert.equal(familleBilanDuFiltre('tout'), null);
  assert.equal(familleBilanDuFiltre('velo'), 'cyclisme');
  assert.equal(familleBilanDuFiltre('muscu'), 'musculation');
  assert.equal(familleBilanDuFiltre('course'), 'course');
  assert.equal(familleBilanDuFiltre('hyrox'), 'autre');
});
