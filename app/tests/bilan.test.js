import test from 'node:test';
import assert from 'node:assert/strict';
import { familleBilan, normaliser, activitesAnnee, activitesAnneePrecedente, sommer, ecartPct, anneesDisponibles, modele, valeurActuelle, avancement, recordsVolume, recordRecent, cumulParAnnee, volumeMensuel, repartitionSport, validerObjectif, fusionnerChargement, decimalesObjectif, CATALOGUE } from '../src/lib/data/bilan.js';

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
  assert.equal(s26[285], 15); // 12 octobre 2026 : grille bissextile (le 29 février a sa case), donc jour 284 + 1
  assert.equal(s26[286], null);
  const s25 = c.series[1].valeurs;
  assert.equal(s25[365], 7); // 31 décembre 2025
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
  assert.equal(familleBilanDuFiltre('hyrox'), 'hyrox');
  assert.equal(familleBilanDuFiltre('triathlon'), 'triathlon');
  assert.equal(familleBilanDuFiltre('muscu'), 'musculation');
  assert.equal(familleBilanDuFiltre('course'), 'course');
  assert.equal(familleBilanDuFiltre('football'), 'autre');
});

test('objectif « par semaine » : une moyenne, sans repère ni projection, comparée directement à la cible', () => {
  const midAnnee = new Date(2026, 6, 2, 12); // 2 juillet 2026
  const acts = Array.from({ length: 104 }, (_, i) => a(`2026-${i < 52 ? '01' : '05'}-${String((i % 28) + 1).padStart(2, '0')}`, 'course', 5, 30, 0, 20, `s${i}`));
  const av = avancement({ sport: 'tous', template: 'all_sess_w', target: 8 }, acts, 2026, midAnnee);
  assert.equal(av.repere, null);
  assert.equal(av.projection, null);
  assert.equal(av.enRythme, av.actuel >= 8);
});

test('séances par semaine en début d\'année : des semaines à virgule, pas arrondies vers le bas', () => {
  const acts = Array.from({ length: 13 }, (_, i) => a(`2026-01-${String(i + 1).padStart(2, '0')}`, 'course'));
  const v = valeurActuelle({ sport: 'tous', template: 'all_sess_w', target: 4 }, acts, 2026, new Date(2026, 0, 14, 12));
  assert.ok(Math.abs(v - 13 / (13.5 / 7)) < 0.01, `attendu ~6,7 séances/sem, obtenu ${v}`);
});

test('chargement : un échec garde ce qui est déjà affiché, sans activités on ne montre que l\'erreur', () => {
  const avant = { brutes: [{ id: 1 }], objectifs: [{ id: 'g' }] };
  // tout réussit
  assert.deepEqual(fusionnerChargement(null, { data: [{ id: 2 }], erreur: '' }, { data: [], erreur: '' }), { brutes: [{ id: 2 }], objectifs: [], erreur: '', pret: true });
  // les activités échouent : on garde les anciennes, avec le message
  const r1 = fusionnerChargement(avant, { data: null, erreur: 'Impossible de charger tes activités.' }, { data: [], erreur: '' });
  assert.deepEqual(r1.brutes, [{ id: 1 }]);
  assert.equal(r1.pret, true);
  assert.equal(r1.erreur, 'Impossible de charger tes activités.');
  // les objectifs échouent : le bilan reste visible, les anciens objectifs aussi
  const r2 = fusionnerChargement(avant, { data: [{ id: 3 }], erreur: '' }, { data: null, erreur: 'Impossible de charger tes objectifs.' });
  assert.deepEqual(r2.objectifs, [{ id: 'g' }]);
  assert.equal(r2.pret, true);
  // premier chargement raté : rien à montrer
  const r3 = fusionnerChargement(null, { data: null, erreur: 'x' }, { data: [], erreur: '' });
  assert.deepEqual([r3.brutes, r3.pret, r3.erreur], [[], false, 'x']);
});

test('Hyrox, triathlon et duathlon sont des sports du bilan, plus rangés dans « autre »', () => {
  assert.equal(familleBilan('Hyrox'), 'hyrox');
  assert.equal(familleBilan('Triathlon'), 'triathlon');
  assert.equal(familleBilan('Duathlon'), 'duathlon');
  assert.equal(familleBilan('Soccer'), 'autre');
  for (const sport of ['hyrox', 'triathlon', 'duathlon']) assert.ok(CATALOGUE[sport].length >= 2, sport);
});

test('même date : le 1er janvier de l\'année affichée n\'est jamais dans l\'an dernier, et le 29 février devient le 28', () => {
  const acts = [a('2025-06-01', 'course'), a('2026-01-01', 'course'), a('2026-01-02', 'course'), a('2025-12-31', 'course')];
  // année passée (2026 vue en 2027, 2025 n'est pas bissextile) : on s'arrête au 31 décembre 2025
  assert.deepEqual(activitesAnneePrecedente(acts, 2026, new Date(2027, 5, 15, 12)).map((x) => x.iso), ['2025-06-01', '2025-12-31']);
  // 29 février 2028 : l'an dernier s'arrête au 28 février 2027, pas au 1er mars
  const fev = [a('2027-02-28', 'course'), a('2027-03-01', 'course')];
  assert.deepEqual(activitesAnneePrecedente(fev, 2028, new Date(2028, 1, 29, 12)).map((x) => x.iso), ['2027-02-28']);
});

test('cumul : le 1er mars tombe sur la même case quelle que soit l\'année (grille bissextile)', () => {
  const acts = [a('2024-03-01', 'course', 10), a('2026-03-01', 'course', 10), a('2026-02-28', 'course', 4)];
  const c = cumulParAnnee(acts, [2026, 2024], 'distance_km', new Date(2027, 0, 5, 12));
  const mars = c.etiquettes.indexOf('2024-03-01');
  assert.equal(c.series[0].valeurs[mars], 14);
  assert.equal(c.series[0].valeurs[mars - 1], 4); // le 29 février des années ordinaires garde le cumul du 28
  assert.equal(c.series[1].valeurs[mars], 10);
});

test('décimales d\'un objectif : une pour les heures, W/kg, rythmes et chronos ; aucune pour km, m, TSS, séances', () => {
  assert.equal(decimalesObjectif('W/kg'), 1);
  assert.equal(decimalesObjectif('/sem'), 1);
  assert.equal(decimalesObjectif('km/h'), 1);
  assert.equal(decimalesObjectif('km'), 0);
  assert.equal(decimalesObjectif(''), 0);
});

test('saisie d\'un objectif : seulement des chiffres, et le message dit l\'unité attendue', () => {
  const cible = (template, c) => validerObjectif({ sport: 'course', template, cible: c, actuel: '' });
  assert.equal(cible('run_5k', '17,5').valeurs.target, 17.5);
  for (const mauvais of ['3:30', '1e3', '0x10', '-5', 'abc']) assert.ok(cible('run_5k', mauvais).erreurs.cible, mauvais);
  assert.match(cible('run_mara', '3:30').erreurs.cible, /en min \(ex\. 210 pour 3 h 30\)/);
});

test('répartition : un sport sans durée n\'apparaît pas', () => {
  assert.deepEqual(repartitionSport([a('2026-03-01', 'musculation', 0, 0)]), []);
});

test('projection : pas avant un peu plus d\'un mois ; année future sans repère négatif', () => {
  const acts = [a('2026-01-03', 'course', 10)];
  const obj = { sport: 'tous', template: 'all_dist', target: 1000 };
  assert.equal(avancement(obj, acts, 2026, new Date(2026, 0, 9, 12)).projection, null);
  assert.ok(avancement(obj, acts, 2026, new Date(2026, 5, 9, 12)).projection > 0);
  assert.equal(avancement(obj, [], 2030, new Date(2026, 9, 27)).repere, 0);
});
