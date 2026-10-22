import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activitesAnnee, activitesAnneePrecedente, anneesDisponibles, avancement, cumulParAnnee, ecartPct, familleBilan, familleBilanDuFiltre, modele, normaliser,
  recordRecent, recordsVolume, repartitionSport, sommer, validerObjectif, valeurActuelle, volumeMensuel, CATALOGUE, type ActiviteBilan, type ObjectifAnnuel,
} from '../src/data/bilan.ts';
import { activitesBilanDemo, objectifsAnnuelsDemo } from '../src/data/demo.ts';

const maintenant = new Date(2026, 6, 1, 12); // 1er juillet 2026 : environ la moitié de l'année

const act = (iso: string, sport: ActiviteBilan['sport'], min: number, km: number, dplus = 0, tss = 0, id = iso + sport): ActiviteBilan => ({
  id, name: `Sortie ${iso}`, iso, sport, famille: sport === 'cyclisme' ? 'velo' : sport, duree_min: min, distance_km: km, d_plus: dplus, tss,
});

test('familleBilan : vélo (VTT et gravel compris) → cyclisme, trail → course, muscu → musculation, le reste → autre', () => {
  assert.equal(familleBilan('Ride'), 'cyclisme');
  assert.equal(familleBilan('MountainBikeRide'), 'cyclisme');
  assert.equal(familleBilan('Run'), 'course');
  assert.equal(familleBilan('TrailRun'), 'course');
  assert.equal(familleBilan('Swim'), 'natation');
  assert.equal(familleBilan('WeightTraining'), 'musculation');
  assert.equal(familleBilan('Hyrox'), 'autre');
  assert.equal(familleBilan(null), 'autre');
});

test('familleBilanDuFiltre : le filtre global vers la famille de bilan', () => {
  assert.equal(familleBilanDuFiltre('tout'), null);
  assert.equal(familleBilanDuFiltre('velo'), 'cyclisme');
  assert.equal(familleBilanDuFiltre('muscu'), 'musculation');
  assert.equal(familleBilanDuFiltre('course'), 'course');
  assert.equal(familleBilanDuFiltre('hyrox'), 'autre');
});

test('normaliser : une ligne de la base devient une activité de bilan, avec des nombres sûrs', () => {
  const a = normaliser({ id: 'x', name: null, sport: 'Run', start_date_local: '2026-03-02T18:00:00+00:00', moving_time: 3600, distance_km: null, total_elevation_gain: 120, tss: 55 });
  assert.deepEqual(a, { id: 'x', name: '', iso: '2026-03-02', sport: 'course', famille: 'course', duree_min: 60, distance_km: 0, d_plus: 120, tss: 55 });
});

test('activitesAnnee : du 1er janvier à aujourd\'hui pour l\'année en cours, l\'année entière sinon', () => {
  const liste = [act('2026-02-01', 'course', 60, 10), act('2026-09-01', 'course', 60, 10), act('2025-12-31', 'course', 60, 10), act('2025-06-01', 'course', 60, 10)];
  assert.equal(activitesAnnee(liste, 2026, maintenant).length, 1); // le 1er septembre est dans le futur
  assert.equal(activitesAnnee(liste, 2025, maintenant).length, 2);
});

test('activitesAnneePrecedente : l\'an dernier jusqu\'à la même date', () => {
  const liste = [act('2025-03-01', 'course', 60, 10), act('2025-06-30', 'course', 60, 10), act('2025-09-01', 'course', 60, 10), act('2024-12-31', 'course', 60, 10)];
  assert.deepEqual(activitesAnneePrecedente(liste, 2026, maintenant).map((a) => a.iso), ['2025-03-01', '2025-06-30']);
});

test('sommer et ecartPct', () => {
  const s = sommer([act('2026-01-01', 'course', 60, 10, 100, 50), act('2026-01-02', 'course', 30, 5, 20, 20)]);
  assert.deepEqual(s, { distance: 15, heures: 1.5, seances: 2, tss: 70, d_plus: 120 });
  assert.deepEqual(sommer([]), { distance: 0, heures: 0, seances: 0, tss: 0, d_plus: 0 });
  assert.equal(ecartPct(110, 100), 10);
  assert.equal(ecartPct(80, 100), -20);
  assert.equal(ecartPct(5, 0), null);
});

test('anneesDisponibles : les années avec des activités plus l\'année en cours, de la plus récente à la plus ancienne', () => {
  assert.deepEqual(anneesDisponibles([act('2024-05-01', 'course', 1, 1), act('2025-05-01', 'course', 1, 1)], maintenant), [2026, 2025, 2024]);
  assert.deepEqual(anneesDisponibles([], maintenant), [2026]);
});

test('catalogue : un identifiant unique par objectif, un modèle retrouvable', () => {
  const ids = Object.values(CATALOGUE).flat().map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(modele('course', 'run_dist')?.label, 'Distance annuelle');
  assert.equal(modele('course', 'inconnu'), null);
  assert.equal(modele('constructor', 'x'), null);
});

const objectif = (sport: string, template: string, target: number, extra: Partial<ObjectifAnnuel> = {}): ObjectifAnnuel => ({ id: 'o', annee: 2026, sport, template, target, ...extra });

test('valeurActuelle : cumuls, maximums et moyennes hebdomadaires', () => {
  const liste = [act('2026-02-01', 'course', 60, 10, 100), act('2026-03-01', 'course', 120, 21, 300), act('2026-03-01', 'cyclisme', 90, 40, 500)];
  assert.equal(valeurActuelle(objectif('course', 'run_dist', 1), liste, 2026, maintenant), 31);
  assert.equal(valeurActuelle(objectif('course', 'run_long', 1), liste, 2026, maintenant), 21);
  assert.equal(valeurActuelle(objectif('course', 'run_hours', 1), liste, 2026, maintenant), 3);
  assert.equal(valeurActuelle(objectif('tous', 'all_sess', 1), liste, 2026, maintenant), 3);
  assert.equal(valeurActuelle(objectif('cyclisme', 'cyc_elev', 1), liste, 2026, maintenant), 500);
  assert.equal(valeurActuelle(objectif('course', 'run_5k', 25, { currentManual: 24 }), liste, 2026, maintenant), 24); // saisi à la main
  assert.equal(valeurActuelle(objectif('course', 'run_5k', 25), liste, 2026, maintenant), null);
  assert.equal(valeurActuelle(objectif('course', 'inconnu', 1), liste, 2026, maintenant), null);
});

test('avancement : pourcentage, rythme attendu et projection de fin d\'année', () => {
  const liste = [act('2026-02-01', 'course', 60, 600)];
  const a = avancement(objectif('course', 'run_dist', 1000), liste, 2026, maintenant)!;
  assert.equal(a.actuel, 600);
  assert.equal(a.pct, 60);
  assert.equal(a.enRythme, true); // la moitié de l'année écoulée : 50 % attendus
  assert.ok(a.repere !== null && a.repere > 45 && a.repere < 55);
  assert.ok(a.projection !== null && a.projection > 1100 && a.projection < 1300);
  assert.ok((a.projectionPct ?? 0) >= 100);
});

test('avancement : « plus bas = mieux » progresse quand la valeur descend vers la cible', () => {
  const a = avancement(objectif('course', 'run_10k', 40, { currentManual: 50 }), [], 2026, maintenant)!;
  assert.equal(a.pct, 80); // 40 / 50
  assert.equal(a.enRythme, false);
  const b = avancement(objectif('course', 'run_10k', 40, { currentManual: 38 }), [], 2026, maintenant)!;
  assert.equal(b.pct, 100);
  assert.equal(b.enRythme, true);
  assert.equal(avancement(objectif('course', 'inconnu', 1), [], 2026, maintenant), null);
});

test('recordsVolume : plus longue sortie, plus longue durée, plus grosse charge, plus de D+ en un jour', () => {
  const liste = [act('2026-02-01', 'course', 60, 10, 100, 40, 'a'), act('2026-03-01', 'cyclisme', 200, 80, 600, 120, 'b'), act('2026-03-01', 'course', 30, 5, 400, 20, 'c')];
  const r = recordsVolume(liste);
  assert.deepEqual(r.map((x) => x.cle), ['distance', 'duree', 'tss', 'dplus']);
  assert.equal(r[0].id, 'b');
  assert.equal(r[3].valeur, 1000); // 600 + 400 le même jour
  assert.equal(r[3].id, null);
  assert.deepEqual(recordsVolume([]), []);
});

test('recordRecent : moins de 30 jours et pas dans le futur', () => {
  assert.equal(recordRecent('2026-06-20', maintenant), true);
  assert.equal(recordRecent('2026-05-01', maintenant), false);
  assert.equal(recordRecent('2026-07-15', maintenant), false);
  assert.equal(recordRecent('', maintenant), false);
});

test('volumeMensuel et repartitionSport', () => {
  const liste = [act('2026-01-10', 'course', 60, 10), act('2026-01-20', 'cyclisme', 120, 40), act('2026-03-05', 'course', 180, 30), act('2025-01-05', 'course', 600, 1)];
  const m = volumeMensuel(liste, 2026);
  assert.equal(m.length, 12);
  assert.deepEqual([m[0], m[1], m[2]], [3, 0, 3]);
  const r = repartitionSport(activitesAnnee(liste, 2026, maintenant));
  assert.deepEqual(r.map((x) => [x.sport, x.heures, x.part]), [['course', 4, 67], ['cyclisme', 2, 33]]); // 4 h et 2 h sur 6 h
});

test('cumulParAnnee : le cumul s\'arrête aujourd\'hui pour l\'année en cours', () => {
  const liste = [act('2026-01-02', 'course', 60, 10), act('2026-03-01', 'course', 60, 20), act('2025-01-02', 'course', 60, 5)];
  const c = cumulParAnnee(liste, [2026, 2025], 'distance_km', maintenant);
  assert.equal(c.etiquettes.length, 366);
  const s2026 = c.series[0].valeurs;
  assert.equal(s2026[0], 0);
  assert.equal(s2026[1], 10); // le 2 janvier
  assert.equal(s2026[300], null); // après aujourd'hui
  assert.equal(c.series[1].valeurs[365], 5); // l'année passée est entière
});

test('validerObjectif : cible positive, valeur saisie valide pour un objectif manuel', () => {
  assert.ok(validerObjectif({ sport: 'course', template: 'run_dist', cible: '1500', actuel: '' }).valeurs);
  assert.equal(validerObjectif({ sport: 'course', template: 'run_dist', cible: '1500', actuel: '' }).valeurs?.target, 1500);
  assert.equal(validerObjectif({ sport: 'course', template: 'run_10k', cible: '40,5', actuel: '42.5' }).valeurs?.current_manual, 42.5);
  assert.ok(validerObjectif({ sport: 'course', template: 'inconnu', cible: '1', actuel: '' }).erreurs.template);
  assert.ok(validerObjectif({ sport: 'course', template: 'run_dist', cible: '0', actuel: '' }).erreurs.cible);
  assert.ok(validerObjectif({ sport: 'course', template: 'run_dist', cible: 'abc', actuel: '' }).erreurs.cible);
  assert.ok(validerObjectif({ sport: 'course', template: 'run_10k', cible: '40', actuel: '-5' }).erreurs.actuel);
});

test('démo : trois ans d\'activités et quatre objectifs', () => {
  const liste = activitesBilanDemo(maintenant).map(normaliser);
  assert.ok(liste.length > 400);
  assert.deepEqual(anneesDisponibles(liste, maintenant), [2026, 2025, 2024]);
  assert.equal(objectifsAnnuelsDemo(maintenant).length, 4);
  assert.ok(liste.every((a) => a.iso <= '2026-07-01'));
});
