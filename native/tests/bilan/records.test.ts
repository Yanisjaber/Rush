import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActiviteBilan } from '../../src/data/bilan/bilan.ts';
import { courbeDeLignes, indexDureeProche, periodesParSport, recordsBasiquesActivites, recordsBasiquesVelo, recordsPeriodes, recordsRegularite, recordsSeance, seancesLesPlusChargees, FC_MOYENNE_MAX_CREDIBLE, sortieVeloDeLigne, texteDuree, wattsParKg, type SortieVelo } from '../../src/data/bilan/records.ts';

const act = (iso: string, o: Partial<ActiviteBilan> = {}): ActiviteBilan => ({ id: `a-${iso}-${o.name ?? ''}`, name: `Sortie ${iso}`, iso, sport: 'cyclisme', famille: 'velo', duree_min: 60, distance_km: 30, d_plus: 100, tss: 50, ...o });

test('recordsPeriodes : meilleur jour, semaine et mois, avec le podium', () => {
  // 2026-03-02 = lundi. Semaine du 2 mars : 2 séances le lundi (120 min) + 1 le mercredi (60) ; semaine du 9 mars : 1 séance (90)
  const acts = [act('2026-03-02', { duree_min: 60, name: 'a' }), act('2026-03-02', { duree_min: 60, name: 'b' }), act('2026-03-04', { duree_min: 60 }), act('2026-03-10', { duree_min: 90 }), act('2026-04-01', { duree_min: 30 })];
  const g = recordsPeriodes(acts, 'heures');
  const jour = g.records.find((r) => r.cle === 'jour')!;
  assert.equal(jour.top[0].valeur, 2); // 2 h le lundi 2 mars
  assert.equal(jour.top[0].iso, '2026-03-02');
  assert.equal(jour.top[0].detail, '2 séances');
  assert.equal(jour.unite, 'h');
  const semaine = g.records.find((r) => r.cle === 'semaine')!;
  assert.deepEqual(semaine.top.map((e) => [e.iso, e.valeur]), [['2026-03-02', 3], ['2026-03-09', 1.5], ['2026-03-30', 0.5]]);
  const mois = g.records.find((r) => r.cle === 'mois')!;
  assert.deepEqual(mois.top.map((e) => [e.iso, e.valeur]), [['2026-03-01', 4.5], ['2026-04-01', 0.5]]);
  assert.equal(mois.periode, 'mois');
});

test('recordsPeriodes : une mesure à zéro (la distance en musculation) ne donne aucun record', () => {
  const g = recordsPeriodes([act('2026-03-02', { distance_km: 0 })], 'distance_km');
  assert.deepEqual(g.records, []);
});

test('recordsSeance : les cinq records et leur podium, sans les mesures à zéro', () => {
  const acts = [act('2026-03-01', { distance_km: 122, duree_min: 385, tss: 90, d_plus: 3000, name: 'Ski' }), act('2026-03-01', { distance_km: 10, d_plus: 5400, name: 'Vélo' }), act('2026-04-02', { distance_km: 70, duree_min: 200, tss: 120, d_plus: 800 })];
  const g = recordsSeance(acts);
  assert.deepEqual(g.records.map((r) => r.cle), ['distance', 'duree', 'tss', 'dplus', 'dplus_seance']);
  assert.equal(g.records[0].top[0].valeur, 122);
  assert.equal(g.records[0].top[0].nom, 'Ski');
  assert.equal(g.records[0].top.length, 3);
  assert.equal(g.records[3].top[0].valeur, 8400); // 3000 + 5400 le même jour
  assert.equal(g.records[3].top[0].id, null); // un jour cumule plusieurs séances : rien à ouvrir
  assert.equal(g.records[4].top[0].valeur, 5400); // la sortie seule avec le plus de D+, pas le cumul du jour
  assert.equal(g.records[4].top[0].nom, 'Vélo');
  // sans distance (musculation) : plus de record de distance
  const muscu = recordsSeance([act('2026-03-01', { distance_km: 0, d_plus: 0, tss: 40 })]);
  assert.deepEqual(muscu.records.map((r) => r.cle), ['duree', 'tss']); // sans D+ non plus
});

test('recordsRegularite : la plus longue série de jours et le plus de séances en une semaine', () => {
  const acts = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-04', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-31', '2026-04-01'].map((iso, i) => act(iso, { name: `s${i}` }));
  const g = recordsRegularite(acts);
  const serie = g.records.find((r) => r.cle === 'serie')!;
  assert.deepEqual(serie.top.map((e) => [e.valeur, e.iso, e.fin]), [[4, '2026-03-10', '2026-03-13'], [3, '2026-03-02', '2026-03-04'], [2, '2026-03-31', '2026-04-01']]);
  const sem = g.records.find((r) => r.cle === 'seances_semaine')!;
  assert.deepEqual(sem.top[0], { valeur: 4, nom: '', iso: '2026-03-02', id: null }); // 4 séances (dont 2 le même jour) du 2 au 8 mars… et 4 la semaine du 9 : la plus ancienne devant
});

const sortie = (iso: string, o: Partial<SortieVelo> = {}): SortieVelo => ({ id: `v-${iso}`, name: `Vélo ${iso}`, iso, sport: 'Ride', distance_km: 60, duree_min: 120, d_plus: 500, kj: 1200, tss: 80, puissance_moyenne: null, fc_moyenne: null, ...o });

test('recordsBasiquesVelo : cinq records, la distance, le dénivelé et la vitesse seulement dehors', () => {
  const sorties = [
    sortie('2026-01-10', { duree_min: 300, distance_km: 90, d_plus: 1200, tss: 200 }), // la plus longue : 5 h, 18 km/h
    sortie('2026-02-10', { sport: 'VirtualRide', duree_min: 400, distance_km: 200, d_plus: 3000, tss: 150 }), // virtuel : compte pour le temps et la charge, pas le reste
    sortie('2026-03-10', { distance_km: 6.7, duree_min: 15, d_plus: 50, tss: 20 }), // trop court pour une vitesse moyenne
    sortie('2026-04-10', { distance_km: 110, duree_min: 200, d_plus: 1800, tss: 120 }),
  ];
  const r = recordsBasiquesVelo(sorties);
  assert.deepEqual(r.map((x) => x.cle), ['duree', 'distance', 'dplus', 'tss', 'vmoy', 'kj']); // pas de puissance ni de FC dans ces sorties : pas de record ; 8 records au plus
  assert.equal(r[0].top[0].valeur, 400); // le virtuel compte pour le temps
  assert.equal(r[1].top[0].valeur, 110); // et pas pour la distance
  assert.equal(r[2].top[0].valeur, 1800);
  assert.equal(r[3].top[0].valeur, 200);
  assert.equal(r[4].top[0].valeur, 33); // 110 km en 3 h 20 = 33 km/h ; ni le virtuel ni la sortie de 6,7 km
  assert.equal(r[4].top.length, 2); // 90 km en 5 h (18 km/h) et 110 km en 3 h 20 : ni le virtuel ni la sortie de 6,7 km
  // pas de sortie : pas de record
  assert.deepEqual(recordsBasiquesVelo([]), []);
});

test('recordsBasiquesVelo : puissance moyenne et FC moyenne, sur 30 minutes ou plus, FC crédible', () => {
  const sorties = [
    sortie('2026-01-10', { duree_min: 120, puissance_moyenne: 200, fc_moyenne: 150 }),
    sortie('2026-02-10', { sport: 'VirtualRide', duree_min: 90, puissance_moyenne: 230, fc_moyenne: 226 }), // virtuel : la puissance compte ; FC de 226 : écartée
    sortie('2026-03-10', { duree_min: 5, puissance_moyenne: 275, fc_moyenne: 186 }), // 5 minutes : pas une sortie
    sortie('2026-04-10', { duree_min: 100, puissance_moyenne: 210, fc_moyenne: 181 }),
    sortie('2026-05-10', { duree_min: 60, puissance_moyenne: null, fc_moyenne: null }), // puissance estimée : absente
  ];
  const r = recordsBasiquesVelo(sorties);
  assert.deepEqual(r.find((x) => x.cle === 'pmoy')!.top.map((e) => e.valeur), [230, 210, 200]);
  assert.deepEqual(r.find((x) => x.cle === 'fcmoy')!.top.map((e) => e.valeur), [181, 150]);
  assert.equal(r.find((x) => x.cle === 'pmoy')!.libelle, 'Puissance moyenne max');
  assert.equal(r.find((x) => x.cle === 'kj')!.top[0].valeur, 1200); // court : le titre d'un widget XS ne dépasse pas une vingtaine de lettres
  assert.ok(FC_MOYENNE_MAX_CREDIBLE < 200);
});

test('courbeDeLignes : un point par durée, trié, le podium par rang', () => {
  const l = (duree_s: number, rang: number, valeur: number) => ({ duree_s, rang, valeur, activity_id: `a${valeur}`, name: duree_s === 5 && rang === 1 ? null : `s${valeur}`, start_date_local: '2026-03-02T09:00:00+00:00' });
  const c = courbeDeLignes([l(300, 1, 290), l(5, 2, 1100), l(5, 1, 1157), l(5, 3, 1000), l(60, 1, 480)]);
  assert.deepEqual(c.map((p) => p.duree), [5, 60, 300]);
  assert.deepEqual(c[0].top.map((e) => e.valeur), [1157, 1100, 1000]);
  assert.equal(c[0].top[0].nom, 'Sans titre');
  assert.equal(c[0].top[0].iso, '2026-03-02');
  assert.deepEqual(courbeDeLignes([]), []);
});

test('indexDureeProche : la durée la plus proche à l\'échelle logarithmique', () => {
  const c = [1, 5, 60, 300, 1200, 3600].map((duree) => ({ duree, top: [] }));
  assert.equal(indexDureeProche(c, 1200), 4);
  assert.equal(indexDureeProche(c, 1500), 4); // 25 min est plus près de 20 min que de 1 h
  assert.equal(indexDureeProche(c, 20), 2); // log(20) est plus près de log(60) que de log(5) (1,1 contre 1,4)
  assert.equal(indexDureeProche(c, 0.2), 0); // sous 1 s : la première
  assert.equal(indexDureeProche(c, 99999), 5);
  assert.equal(indexDureeProche([], 60), -1);
});

test('texteDuree : en secondes, minutes ou heures', () => {
  assert.deepEqual([5, 59, 60, 90, 600, 1200, 3600, 5400, 7200, 18000].map(texteDuree), ['5 s', '59 s', '1 min', '1 min 30', '10 min', '20 min', '1 h', '1 h 30', '2 h', '5 h']);
});

test('wattsParKg : une décimale, rien sans poids valable', () => {
  assert.equal(wattsParKg(259, 59), 4.4);
  assert.equal(wattsParKg(259, null), null);
  assert.equal(wattsParKg(259, 5), null);
});

test('sortieVeloDeLigne : une ligne de la base devient une sortie, avec des nombres sûrs', () => {
  const s = sortieVeloDeLigne({ id: 'x', name: null, sport: 'Ride', start_date_local: '2026-03-02T09:00:00+00:00', distance_km: '80.5', moving_time: 7200, total_elevation_gain: null, kj: null, tss: 55, avg_watts: 220, avg_heartrate: 150 });
  assert.deepEqual(s, { id: 'x', name: '', iso: '2026-03-02', sport: 'Ride', distance_km: 80.5, duree_min: 120, d_plus: 0, kj: null, tss: 55, puissance_moyenne: 220, fc_moyenne: 150 });
});

import { formatNum } from '../../src/data/outils/format.ts';
import { dateCourte, EnAnnee, enAnnee, jourMois, libelleEntree, texteRecordSimple, texteValeurRecord } from '../../src/data/bilan/records-texte.ts';

test('texteValeurRecord : la durée en heures-minutes, la distance avec une décimale, le reste en entier', () => {
  assert.deepEqual(texteValeurRecord(385, 'min'), { nombre: '6h25', unite: '' });
  assert.deepEqual(texteValeurRecord(7.2, 'h'), { nombre: '7h12', unite: '' });
  assert.deepEqual(texteValeurRecord(122.4, 'km'), { nombre: '122,4', unite: 'km' });
  assert.deepEqual(texteValeurRecord(78.43, 'km/h'), { nombre: '78,4', unite: 'km/h' });
  assert.deepEqual(texteValeurRecord(8372, 'm'), { nombre: formatNum(8372, 0), unite: 'm' }); // les milliers s'écrivent avec une espace insécable
  assert.deepEqual(texteValeurRecord(1, 'jours'), { nombre: '1', unite: 'jour' });
  assert.deepEqual(texteValeurRecord(11, 'jours'), { nombre: '11', unite: 'jours' });
  assert.equal(texteRecordSimple(9, 'séances'), '9 séances');
  assert.equal(texteRecordSimple(385, 'min'), '6h25');
});

test('libelleEntree : la séance et sa date, la période, la série', () => {
  const base = { cle: 'distance', libelle: 'x', unite: 'km', top: [] };
  assert.equal(jourMois('2026-03-04'), '4 mars');
  assert.equal(dateCourte('2023-02-25'), '25 févr. 2023');
  assert.equal(dateCourte('2025-07-02'), '2 juil. 2025');
  assert.deepEqual(libelleEntree(base, { valeur: 1, nom: 'Ski #4', iso: '2026-03-04', id: 'a' }), { titre: 'Ski #4', sous: 'Mercredi 4 mars' });
  assert.deepEqual(libelleEntree({ ...base, cle: 'semaine', periode: 'semaine' }, { valeur: 1, nom: '', iso: '2026-05-11', id: null, detail: '9 séances' }), { titre: 'Semaine du 11 mai', sous: '9 séances' });
  assert.deepEqual(libelleEntree({ ...base, cle: 'mois', periode: 'mois' }, { valeur: 1, nom: '', iso: '2026-03-01', id: null, detail: '30 séances' }), { titre: 'Mars 2026', sous: '30 séances' });
  assert.equal(libelleEntree({ ...base, cle: 'jour', periode: 'jour' }, { valeur: 1, nom: '', iso: '2026-03-04', id: null, detail: '3 séances' }).titre, 'Mercredi 4 mars');
  assert.equal(libelleEntree({ ...base, cle: 'serie' }, { valeur: 4, nom: '', iso: '2026-04-12', id: null, fin: '2026-04-22' }).titre, 'Du 12 avril au 22 avril');
  assert.equal(libelleEntree(base, { valeur: 1, nom: '', iso: '2026-03-04', id: 'a' }).titre, 'Sans titre');
});

test('enAnnee : « cette année » pour l\'année en cours, sinon l\'année écrite', () => {
  const maintenant = new Date(2026, 9, 28, 12);
  assert.equal(enAnnee(2026, maintenant), 'cette année');
  assert.equal(enAnnee(2025, maintenant), 'en 2025');
  assert.equal(EnAnnee(2026, maintenant), 'Cette année');
  assert.equal(EnAnnee(2025, maintenant), 'En 2025');
});

test('recordsBasiquesActivites : la course ajoute l\'allure moyenne (5 km ou plus) et la FC moyenne, la muscu n\'a pas de distance', () => {
  const course = [act('2026-03-01', { famille: 'course', distance_km: 10, duree_min: 50, name: 'Footing' }), act('2026-03-02', { famille: 'course', distance_km: 3, duree_min: 10, name: 'Court' })];
  const r = recordsBasiquesActivites(course, 'course');
  assert.deepEqual(r.map((x) => x.cle), ['duree', 'distance', 'dplus', 'tss', 'allure']); // pas de FC dans ces sorties : pas de record de FC
  assert.equal(r.find((x) => x.cle === 'allure')!.top.length, 1); // le 3 km ne compte pas
  assert.equal(r.find((x) => x.cle === 'allure')!.top[0].valeur, 12); // 12 km/h = 5'00"/km
  assert.equal(r.find((x) => x.cle === 'allure')!.unite, 'allure');
  const muscu = recordsBasiquesActivites([act('2026-03-01', { famille: 'muscu', distance_km: 0, d_plus: 0, duree_min: 70, tss: 40 })], 'muscu');
  assert.deepEqual(muscu.map((x) => x.cle), ['duree', 'tss']);
  assert.equal(muscu[0].libelle, 'Plus longue séance');
});

test('periodesParSport : les meilleures semaines, découpées par sport', () => {
  // semaine du 2 mars : vélo 100 + course 50 ; semaine du 9 mars : vélo 120
  const acts = [act('2026-03-02', { tss: 100, famille: 'velo' }), act('2026-03-03', { tss: 50, famille: 'course' }), act('2026-03-10', { tss: 120, famille: 'velo' })];
  const s = periodesParSport(acts, 'tss', 'semaine', 5);
  assert.deepEqual(s.map((x) => [x.iso, x.total]), [['2026-03-02', 150], ['2026-03-09', 120]]);
  assert.deepEqual(s[0].parts, [{ famille: 'velo', valeur: 100 }, { famille: 'course', valeur: 50 }]);
  assert.equal(periodesParSport(acts, 'tss', 'mois', 5).length, 1);
});

test('seancesLesPlusChargees : tous sports mélangés, avec le sport de chaque séance', () => {
  const r = seancesLesPlusChargees([act('2026-03-01', { tss: 90, famille: 'course', name: 'a' }), act('2026-03-02', { tss: 120, famille: 'velo', name: 'b' })], 5);
  assert.deepEqual(r.map((x) => [x.nom, x.famille]), [['b', 'velo'], ['a', 'course']]);
});
