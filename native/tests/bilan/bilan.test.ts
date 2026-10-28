import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activitesAnnee, activitesAnneePrecedente, anneesDisponibles, avancement, cumulParAnnee, ecartPct, familleBilan, familleBilanDuFiltre, modele, normaliser,
  decimalesObjectif, donneesPerimees, fusionnerChargement, kmParMois, verdictObjectif, chargeParSemaine, regulariteAnnee, recordRecent, recordsVolume, repartitionSport, valeursParMois, phraseVerdict, sommer, validerObjectif, valeurActuelle, volumeMensuel, CATALOGUE, type ActiviteBilan, type ObjectifAnnuel,
} from '../../src/data/bilan/bilan.ts';
import { activitesBilanDemo, objectifsAnnuelsDemo } from '../../src/data/demo/demo.ts';

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
  assert.equal(familleBilan('Hyrox'), 'hyrox');
  assert.equal(familleBilan('Triathlon'), 'triathlon');
  assert.equal(familleBilan('Duathlon'), 'duathlon');
  assert.equal(familleBilan('Soccer'), 'autre');
  assert.equal(familleBilan(null), 'autre');
});

test('familleBilanDuFiltre : le filtre global vers la famille de bilan', () => {
  assert.equal(familleBilanDuFiltre('tout'), null);
  assert.equal(familleBilanDuFiltre('velo'), 'cyclisme');
  assert.equal(familleBilanDuFiltre('muscu'), 'musculation');
  assert.equal(familleBilanDuFiltre('course'), 'course');
  assert.equal(familleBilanDuFiltre('hyrox'), 'hyrox');
  assert.equal(familleBilanDuFiltre('triathlon'), 'triathlon');
  assert.equal(familleBilanDuFiltre('football'), 'autre');
});

test('normaliser : une ligne de la base devient une activité de bilan, avec des nombres sûrs', () => {
  const a = normaliser({ id: 'x', name: null, sport: 'Run', start_date_local: '2026-03-02T18:00:00+00:00', moving_time: 3600, distance_km: null, total_elevation_gain: 120, tss: 55 });
  assert.deepEqual(a, { id: 'x', name: '', iso: '2026-03-02', sport: 'course', famille: 'course', type: 'Run', duree_min: 60, distance_km: 0, d_plus: 120, tss: 55 });
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

test('repartitionSport : « autre » est détaillé par sport du catalogue', () => {
  const autre = (iso: string, type: string, min: number) => ({ ...act(iso, 'autre', min, 0), type });
  const r = repartitionSport(activitesAnnee([autre('2026-01-10', 'Hike', 180), autre('2026-01-11', 'Hike', 60), autre('2026-01-12', 'Soccer', 60), autre('2026-01-13', 'Other', 60)], 2026, maintenant));
  assert.deepEqual(r.map((x) => [x.cle, x.type, x.heures]), [['Hike', 'Hike', 4], ['Soccer', 'Soccer', 1], ['autre', undefined, 1]]);
});

test('repartitionSport : par discipline, la famille vélo se détaille en route, VTT, virtuel', () => {
  const velo = (iso: string, type: string, min: number) => ({ ...act(iso, 'cyclisme', min, 0), type });
  const r = repartitionSport(activitesAnnee([velo('2026-01-10', 'Ride', 180), velo('2026-01-11', 'MountainBikeRide', 60), velo('2026-01-12', 'VirtualRide', 60)], 2026, maintenant), 'heures', true);
  assert.deepEqual(r.map((x) => [x.cle, x.heures]), [['Ride', 3], ['MountainBikeRide', 1], ['VirtualRide', 1]]);
});

test('valeursParMois : la mesure choisie, mois par mois', () => {
  const liste = [act('2026-01-10', 'course', 60, 10), act('2026-01-20', 'cyclisme', 120, 40), act('2026-03-05', 'course', 180, 30), act('2025-01-05', 'course', 600, 1)];
  assert.deepEqual(valeursParMois(liste, 2026, 'distance_km').slice(0, 3), [50, 0, 30]);
  assert.deepEqual(valeursParMois(liste, 2026, 'heures').slice(0, 3), [3, 0, 3]);
  assert.deepEqual(valeursParMois(liste, 2026, 'seances').slice(0, 3), [2, 0, 1]);
});

test('volumeMensuel et repartitionSport', () => {
  const liste = [act('2026-01-10', 'course', 60, 10), act('2026-01-20', 'cyclisme', 120, 40), act('2026-03-05', 'course', 180, 30), act('2025-01-05', 'course', 600, 1)];
  const m = volumeMensuel(liste, 2026);
  assert.equal(m.length, 12);
  assert.deepEqual([m[0], m[1], m[2]], [3, 0, 3]);
  const r = repartitionSport(activitesAnnee(liste, 2026, maintenant));
  assert.deepEqual(r.map((x) => [x.sport, x.heures, x.part]), [['course', 4, 67], ['cyclisme', 2, 33]]); // 4 h et 2 h sur 6 h
  // Autre mesure : la distance (course 40 km, vélo 40 km → 50 / 50) ; un sport à zéro n'apparaît pas
  const dist = repartitionSport(activitesAnnee(liste, 2026, maintenant), 'distance_km');
  assert.deepEqual(dist.map((x) => [x.sport, x.valeur, x.part]), [['course', 40, 50], ['cyclisme', 40, 50]]);
  assert.deepEqual(repartitionSport(activitesAnnee([act('2026-01-10', 'musculation', 60, 0), act('2026-01-11', 'course', 60, 10)], 2026, maintenant), 'distance_km').map((x) => x.sport), ['course']);
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

test('démo : six ans d\'activités et quatre objectifs', () => {
  const liste = activitesBilanDemo(maintenant).map(normaliser);
  assert.ok(liste.length > 400);
  assert.deepEqual(anneesDisponibles(liste, maintenant), [2026, 2025, 2024, 2023, 2022, 2021]);
  assert.equal(objectifsAnnuelsDemo(maintenant).length, 4);
  assert.ok(liste.every((a) => a.iso <= '2026-07-01'));
});

// --- Rythme : km par mois, charge par semaine, régularité ---

test('kmParMois : 12 mois, seulement l\'année demandée', () => {
  const m = kmParMois([act('2026-01-05', 'cyclisme', 60, 30), act('2026-01-20', 'course', 30, 5), act('2026-03-02', 'cyclisme', 60, 40), act('2025-03-02', 'cyclisme', 60, 99)], 2026);
  assert.equal(m.length, 12);
  assert.equal(m[0], 35);
  assert.equal(m[2], 40);
  assert.equal(m[11], 0);
});

test('chargeParSemaine : une autre mesure (séances, distance) et 52 semaines', () => {
  const acts = [act('2026-06-29', 'course', 60, 10, 0, 50), act('2026-07-01', 'cyclisme', 90, 40, 0, 70, 'b'), act('2026-01-02', 'course', 30, 5, 0, 99, 'd')];
  const seances = chargeParSemaine(acts, 2026, maintenant, 52, 'seances');
  assert.equal(seances.length, 52);
  assert.equal(seances[51], 2);
  const km = chargeParSemaine(acts, 2026, maintenant, 4, 'distance_km');
  assert.deepEqual(km, [0, 0, 0, 50]);
});

test('chargeParSemaine : la dernière valeur est la semaine en cours, les semaines vides valent 0', () => {
  // 1er juillet 2026 = mercredi : la semaine en cours va du lundi 29 juin au dimanche 5 juillet
  const acts = [act('2026-06-29', 'course', 60, 10, 0, 50), act('2026-07-01', 'cyclisme', 90, 40, 0, 70, 'b'), act('2026-06-22', 'cyclisme', 60, 20, 0, 30, 'c'), act('2026-01-02', 'course', 30, 5, 0, 99, 'd')];
  const s = chargeParSemaine(acts, 2026, maintenant);
  assert.equal(s.length, 12);
  assert.equal(s[11], 120);
  assert.equal(s[10], 30);
  assert.equal(s[9], 0);
  assert.equal(s.reduce((a, b) => a + b, 0), 150); // la séance de janvier est hors des 12 semaines
});

test('chargeParSemaine : une année passée s\'arrête au 31 décembre', () => {
  const s = chargeParSemaine([act('2025-12-30', 'course', 60, 10, 0, 40)], 2025, maintenant);
  assert.equal(s[11], 40);
});

test('regulariteAnnee : jours, jours actifs, séries et cases', () => {
  const acts = [
    act('2026-06-27', 'course', 60, 10, 0, 50, 'a'), act('2026-06-28', 'cyclisme', 60, 30, 0, 90, 'b'), act('2026-06-29', 'cyclisme', 60, 30, 0, 30, 'c'),
    act('2026-06-30', 'course', 60, 10, 0, 50, 'd'), act('2026-07-01', 'course', 60, 10, 0, 50, 'e'),
    act('2026-06-01', 'course', 60, 10, 0, 50, 'f'), act('2026-06-02', 'course', 60, 10, 0, 50, 'g'),
  ];
  const r = regulariteAnnee(acts, 2026, maintenant);
  assert.equal(r.jours, 182); // du 1er janvier au 1er juillet 2026
  assert.equal(r.joursActifs, 7);
  assert.equal(r.serieEnCours, 5);
  assert.equal(r.serieRecord, 5);
  assert.equal(r.cases.length, 7 * r.colonnes);
  assert.equal(r.cases.filter((c) => !c.vide).length, 182); // les jours hors année ou à venir sont vides
  assert.equal(r.cases.filter((c) => c.intensite > 0).length, 7);
  assert.ok(r.cases.some((c) => c.famille === 'velo' && c.intensite === 3)); // 28 juin : 90 de charge, vélo
});

test('regulariteAnnee : sans séance aujourd\'hui, la série tient si hier était actif', () => {
  const r = regulariteAnnee([act('2026-06-29', 'course', 60, 10, 0, 50), act('2026-06-30', 'course', 60, 10, 0, 50, 'b')], 2026, maintenant);
  assert.equal(r.serieEnCours, 2);
  assert.equal(regulariteAnnee([act('2026-06-20', 'course', 60, 10, 0, 50)], 2026, maintenant).serieEnCours, 0);
});

// --- Verdict d'un objectif ---

const objectifKm = (cible: number): ObjectifAnnuel => ({ id: 'o', annee: 2026, sport: 'course', template: 'run_dist', target: cible, current_manual: null } as ObjectifAnnuel);

test('verdictObjectif : en retard, la projection est sous la cible et il manque l\'écart', () => {
  // 1er juillet : environ la moitié de l'année ; 300 km faits sur 1 000 de cible
  const av = avancement(objectifKm(1000), [act('2026-03-01', 'course', 600, 300)], 2026, maintenant)!;
  const v = verdictObjectif(av);
  assert.equal(v.ton, 'alerte');
  assert.equal(v.atteint, false);
  assert.ok(v.projection! < 1000 && v.projection! > 500);
  assert.equal(Math.round(v.ecart!), Math.round(1000 - v.projection!));
  assert.ok(v.attendu! > 400 && v.attendu! < 600); // environ la moitié de la cible
});

test('verdictObjectif : en avance, la projection dépasse la cible', () => {
  const v = verdictObjectif(avancement(objectifKm(1000), [act('2026-03-01', 'course', 600, 700)], 2026, maintenant)!);
  assert.equal(v.ton, 'ok');
  assert.ok(v.projection! > 1000);
  assert.equal(Math.round(v.ecart!), Math.round(v.projection! - 1000));
});

test('verdictObjectif : cible atteinte, ou année passée (pas de projection)', () => {
  assert.equal(verdictObjectif(avancement(objectifKm(1000), [act('2026-03-01', 'course', 600, 1200)], 2026, maintenant)!).atteint, true);
  const passee = verdictObjectif(avancement({ ...objectifKm(1000), annee: 2025 }, [act('2025-03-01', 'course', 600, 800)], 2025, maintenant)!);
  assert.equal(passee.projection, null);
  assert.equal(passee.ton, 'alerte');
  assert.equal(Math.round(passee.ecart!), 200);
  assert.equal(passee.attendu, null);
});

test('cumulParAnnee : séances, charge et temps (en heures) se cumulent comme la distance', () => {
  const acts = [act('2026-01-02', 'course', 90, 10, 50, 60, 'a'), act('2026-01-02', 'cyclisme', 30, 20, 0, 40, 'b'), act('2026-01-05', 'course', 60, 5, 0, 20, 'c')];
  const dernier = (m: Parameters<typeof cumulParAnnee>[2]) => cumulParAnnee(acts, [2026], m, maintenant).series[0].valeurs[181];
  assert.equal(dernier('seances'), 3);
  assert.equal(dernier('tss'), 120);
  assert.equal(dernier('heures'), 3); // 90 + 30 + 60 minutes
  assert.equal(dernier('distance_km'), 35);
  assert.equal(dernier('d_plus'), 50);
});

test('objectif « par semaine » : une moyenne, sans repère ni projection ; semaines écoulées à virgule', () => {
  const acts = Array.from({ length: 13 }, (_, i) => ({ id: String(i), name: 'x', iso: `2026-01-${String(i + 1).padStart(2, '0')}`, sport: 'course' as const, famille: 'course', duree_min: 60, distance_km: 5, d_plus: 0, tss: 50 }));
  const obj = { id: 'g', annee: 2026, sport: 'tous', template: 'all_sess_w', target: 8 };
  const av = avancement(obj, acts, 2026, new Date(2026, 0, 14, 12));
  assert.ok(av);
  assert.equal(av.repere, null);
  assert.equal(av.projection, null);
  assert.ok(Math.abs((av.actuel ?? 0) - 13 / (13.5 / 7)) < 0.01);
});

test('fusionnerChargement : un échec garde ce qui est déjà affiché, sans activités on ne montre que l\'erreur', () => {
  const obj = { id: 'g', annee: 2026, sport: 'tous', template: 'all_hours', target: 100 };
  const avant = { brutes: [{ id: 1 }], objectifs: [obj] };
  const r1 = fusionnerChargement(avant, { data: null, erreur: 'Impossible de charger tes activités.' }, { data: [], erreur: '' });
  assert.deepEqual(r1.brutes, [{ id: 1 }]);
  assert.equal(r1.pret, true);
  assert.equal(r1.erreur, 'Impossible de charger tes activités.');
  const r2 = fusionnerChargement(avant, { data: [{ id: 3 }], erreur: '' }, { data: null, erreur: 'Impossible de charger tes objectifs.' });
  assert.deepEqual(r2.objectifs, [obj]);
  assert.equal(r2.pret, true);
  const r3 = fusionnerChargement(null, { data: null, erreur: 'x' }, { data: [], erreur: '' });
  assert.deepEqual([r3.brutes, r3.pret, r3.erreur], [[], false, 'x']);
});

test('donneesPerimees : jamais chargées ou vieilles de cinq minutes → à recharger', () => {
  const t = 1_000_000;
  assert.equal(donneesPerimees(null, t), true);
  assert.equal(donneesPerimees(t, t + 60_000), false); // une minute
  assert.equal(donneesPerimees(t, t + 5 * 60_000 - 1), false);
  assert.equal(donneesPerimees(t, t + 5 * 60_000), true);
  assert.equal(donneesPerimees(t, t - 1), true); // l'horloge a reculé : on recharge par prudence
});

test('même date : le 1er janvier de l\'année affichée n\'est jamais dans l\'an dernier, et le 29 février devient le 28', () => {
  const acts = [act('2025-06-01', 'course'), act('2026-01-01', 'course'), act('2025-12-31', 'course')];
  assert.deepEqual(activitesAnneePrecedente(acts, 2026, new Date(2027, 5, 15, 12)).map((x) => x.iso), ['2025-06-01', '2025-12-31']);
  const fev = [act('2027-02-28', 'course'), act('2027-03-01', 'course')];
  assert.deepEqual(activitesAnneePrecedente(fev, 2028, new Date(2028, 1, 29, 12)).map((x) => x.iso), ['2027-02-28']);
});

test('cumul : le 1er mars tombe sur la même case quelle que soit l\'année (grille bissextile)', () => {
  const acts = [act('2024-03-01', 'course', 60, 10), act('2026-03-01', 'course', 60, 10), act('2026-02-28', 'course', 60, 4)];
  const c = cumulParAnnee(acts, [2026, 2024], 'distance_km', new Date(2027, 0, 5, 12));
  const mars = c.etiquettes.indexOf('2024-03-01');
  assert.equal(c.series[0].valeurs[mars], 14);
  assert.equal(c.series[0].valeurs[mars - 1], 4);
  assert.equal(c.series[1].valeurs[mars], 10);
});

test('décimales d\'un objectif et saisie : chiffres seulement, message avec l\'unité', () => {
  assert.equal(decimalesObjectif('W/kg'), 1);
  assert.equal(decimalesObjectif('km'), 0);
  const cible = (template: string, c: string) => validerObjectif({ sport: 'course', template, cible: c, actuel: '' });
  assert.equal(cible('run_5k', '17,5').valeurs?.target, 17.5);
  for (const mauvais of ['3:30', '1e3', '0x10', '-5', 'abc']) assert.ok(cible('run_5k', mauvais).erreurs.cible, mauvais);
  assert.match(cible('run_mara', '3:30').erreurs.cible, /en min \(ex\. 210 pour 3 h 30\)/);
});

test('projection : pas avant un peu plus d\'un mois ; année future sans repère négatif', () => {
  const acts = [act('2026-01-03', 'course', 60, 10)];
  const obj = { id: 'g', annee: 2026, sport: 'tous', template: 'all_dist', target: 1000 };
  assert.equal(avancement(obj, acts, 2026, new Date(2026, 0, 9, 12))?.projection, null);
  assert.ok((avancement(obj, acts, 2026, new Date(2026, 5, 9, 12))?.projection ?? 0) > 0);
  assert.equal(avancement(obj, [], 2030, new Date(2026, 9, 27))?.repere, 0);
});

test('poids corporel : on progresse en s\'approchant de la cible, par le haut comme par le bas', () => {
  const perte = avancement(objectif('musculation', 'mus_bw', 75, { currentManual: 85 }), [], 2026, maintenant)!;
  assert.ok(perte.pct > 85 && perte.pct < 90); // 75 / 85, plus jamais 100 % au départ
  assert.equal(perte.enRythme, false);
  const prise = avancement(objectif('musculation', 'mus_bw', 80, { currentManual: 70 }), [], 2026, maintenant)!;
  assert.equal(Math.round(prise.pct), 88); // 70 / 80
  const arrive = avancement(objectif('musculation', 'mus_bw', 75, { currentManual: 75.5 }), [], 2026, maintenant)!;
  assert.equal(arrive.enRythme, true); // à 2 % près
  assert.equal(verdictObjectif(perte).ton, 'alerte');
  assert.equal(Math.round(verdictObjectif(perte).ecart!), 10);
  assert.equal(validerObjectif({ sport: 'musculation', template: 'mus_bw', cible: '75', actuel: '85' }).valeurs?.current_manual, 85);
});

test('année bissextile : le repère d\'un cumul tombe à mi-année le 2 juillet 2028, et 52,14 semaines en 2025', () => {
  const av = avancement(objectif('tous', 'all_hours', 100, { annee: 2028 }), [], 2028, new Date(2028, 6, 2, 12))!;
  assert.ok(Math.abs(av.repere! - 50) < 0.5);
  const sem = avancement(objectif('tous', 'all_sess_w', 10, { annee: 2025 }), Array.from({ length: 365 }, (_, i) => act(new Date(2025, 0, 1 + i, 12).toISOString().slice(0, 10), 'course', 30, 5, 0, 10, 's' + i)), 2025, maintenant)!;
  assert.ok(Math.abs(sem.actuel! - 7) < 0.01); // une séance par jour = 7 par semaine, pas 7,02
});

test('phraseVerdict : projection, manque, atteint, chrono et poids', () => {
  const fmt = (v: number) => String(Math.round(v));
  const retard = phraseVerdict(avancement(objectifKm(1000), [act('2026-03-01', 'course', 600, 300)], 2026, maintenant)!, fmt);
  assert.equal(retard.ton, 'alerte');
  assert.match(retard.texte, /^Fin d'année prévue : \d+ km, il manquerait \d+ km$/);
  const avance = phraseVerdict(avancement(objectifKm(1000), [act('2026-03-01', 'course', 600, 700)], 2026, maintenant)!, fmt);
  assert.equal(avance.ton, 'ok');
  assert.match(avance.texte, /cible dépassée$/);
  assert.equal(phraseVerdict(avancement(objectifKm(1000), [act('2026-03-01', 'course', 600, 1200)], 2026, maintenant)!, fmt).texte, 'Objectif atteint');
  const passee = phraseVerdict(avancement({ ...objectifKm(1000), annee: 2025 }, [act('2025-03-01', 'course', 600, 800)], 2025, maintenant)!, fmt);
  assert.equal(passee.texte, 'Il manque 200 km');
  assert.equal(phraseVerdict(avancement(objectif('course', 'run_10k', 40, { currentManual: 50 }), [], 2026, maintenant)!, fmt).texte, 'Encore 10 min à gagner');
  assert.equal(phraseVerdict(avancement(objectif('musculation', 'mus_bw', 75, { currentManual: 85 }), [], 2026, maintenant)!, fmt).texte, "Encore 10 kg d'écart");
  assert.equal(phraseVerdict(avancement(objectif('cyclisme', 'cyc_ftp', 300), [], 2026, maintenant)!, fmt).texte, ''); // pas de valeur saisie : rien à dire
});
