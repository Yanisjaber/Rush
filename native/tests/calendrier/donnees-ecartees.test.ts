import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aUneVraiePuissance, chargeRetenue, chiffreEcarte, COLONNES_ECART, DONNEES_DU_CHIFFRE, estEcartee, pucesEcart, sansDonneesEcartees, wattsEstimes } from '../../src/data/calendrier/donnees-ecartees.ts';
import { chiffresSeance } from '../../src/data/calendrier/seance-detail.ts';
import { sortiesCourse } from '../../src/data/bilan/progression-course.ts';
import { sortiesVelo } from '../../src/data/bilan/progression-velo.ts';
import type { Seance } from '../../src/data/types.ts';

const velo = (extra: Partial<Seance> = {}): Seance => ({
  id: 'a', name: 'Sortie', sport: 'Ride', start_date_local: '2026-03-01T09:00:00', moving_time: 7200, distance_km: 60, total_elevation_gain: 800,
  avg_heartrate: 140, ftp_at_time: 250, avg_watts: 190, np: 205, tss: 90, category: 'entrainement', device_watts: true, avg_cadence: 88, kj: 1400, max_watts: 900, max_heartrate: 175, avg_speed_kmh: 30,
  ...extra,
});

test('pucesEcart : une puce par donnée que la séance a, dans l\'ordre de l\'écran', () => {
  assert.deepEqual(pucesEcart(velo()).map((p) => p.cle), ['duree', 'puissance', 'cardio', 'cadence', 'distance', 'denivele', 'charge']);
  // Une course à pied sans capteur de puissance ni cadence : ni puissance ni cadence
  const course = velo({ sport: 'Run', avg_watts: null, np: null, avg_cadence: null, device_watts: null });
  assert.deepEqual(pucesEcart(course).map((p) => p.cle), ['duree', 'cardio', 'distance', 'denivele', 'charge']);
  // Une séance de musculation à la main : la durée et la charge
  const muscu = velo({ sport: 'WeightTraining', distance_km: null, total_elevation_gain: null, avg_heartrate: null, avg_watts: null, np: null, avg_cadence: null });
  assert.deepEqual(pucesEcart(muscu).map((p) => p.cle), ['duree', 'charge']);
});

test('pucesEcart : une donnée déjà écartée reste proposée, même si ses chiffres n\'y sont plus (pour pouvoir la remettre)', () => {
  const s = velo({ avg_watts: null, np: null, excl_power: true });
  const puce = pucesEcart(s).find((p) => p.cle === 'puissance')!;
  assert.equal(puce.ecartee, true);
  assert.equal(puce.colonne, 'excl_power');
  assert.equal(pucesEcart(velo()).find((p) => p.cle === 'puissance')!.ecartee, false);
  assert.equal(estEcartee(s, 'puissance'), true);
  assert.equal(estEcartee(s, 'cardio'), false);
});

test('chargeRetenue : la charge vient de la puissance, sinon du cardio ; écarter la source la retire', () => {
  assert.equal(chargeRetenue(velo()), 90);
  assert.equal(chargeRetenue(velo({ excl_power: true })), null); // charge calculée avec la puissance
  assert.equal(chargeRetenue(velo({ excl_hr: true })), 90); // la charge vient de la puissance : le cardio n'y change rien
  const courseAuCardio = velo({ sport: 'Run', avg_watts: null, np: null, tss: 55 });
  assert.equal(chargeRetenue(courseAuCardio), 55);
  assert.equal(chargeRetenue({ ...courseAuCardio, excl_hr: true }), null); // charge calculée avec le cardio
  assert.equal(chargeRetenue({ ...courseAuCardio, excl_power: true }), 55); // pas de puissance : écarter la puissance ne change rien
  assert.equal(chargeRetenue(velo({ excl_load: true })), null);
  assert.equal(chargeRetenue(velo({ excl_duration: true })), null); // toute charge se calcule avec la durée
  assert.equal(chargeRetenue({ ...courseAuCardio, excl_duration: true }), null);
  // Musculation : ni puissance ni cardio, la charge vient de l'effort ressenti : seul « charge » la retire
  const muscu = velo({ sport: 'WeightTraining', avg_watts: null, np: null, avg_heartrate: null, tss: 40 });
  assert.equal(chargeRetenue({ ...muscu, excl_hr: true, excl_power: true }), 40);
  assert.equal(chargeRetenue({ ...muscu, excl_load: true }), null);
});

test('sansDonneesEcartees : chaque donnée écartée est vidée, les autres restent, les drapeaux aussi', () => {
  const s = velo({ excl_power: true, excl_distance: true });
  const r = sansDonneesEcartees(s);
  assert.equal(r.avg_watts, null);
  assert.equal(r.np, null);
  assert.equal(r.max_watts, null);
  assert.equal(r.kj, null);
  assert.equal(r.distance_km, null);
  assert.equal(r.avg_speed_kmh, null);
  assert.equal(r.tss, null); // la charge venait de la puissance
  assert.equal(r.avg_heartrate, 140);
  assert.equal(r.avg_cadence, 88);
  assert.equal(r.total_elevation_gain, 800);
  assert.equal(r.excl_power, true);
  assert.equal(r.moving_time, 7200);
  // La séance d'origine n'est pas modifiée
  assert.equal(s.avg_watts, 190);
  assert.equal(s.tss, 90);
});

test('sansDonneesEcartees : un à un, cardio, cadence, dénivelé et charge', () => {
  assert.deepEqual([sansDonneesEcartees(velo({ excl_hr: true })).avg_heartrate, sansDonneesEcartees(velo({ excl_hr: true })).max_heartrate], [null, null]);
  assert.equal(sansDonneesEcartees(velo({ excl_hr: true })).tss, 90);
  assert.equal(sansDonneesEcartees(velo({ excl_cadence: true })).avg_cadence, null);
  assert.equal(sansDonneesEcartees(velo({ excl_elevation: true })).total_elevation_gain, null);
  assert.equal(sansDonneesEcartees(velo({ excl_load: true })).tss, null);
  assert.equal(sansDonneesEcartees(velo({ excl_load: true })).avg_watts, 190);
});

test('sansDonneesEcartees : rien d\'écarté = la même séance (pas de copie)', () => {
  const s = velo();
  assert.equal(sansDonneesEcartees(s), s);
  assert.equal(sansDonneesEcartees(velo({ excl_power: false, excl_hr: null })).avg_watts, 190);
});

test('COLONNES_ECART : une colonne par donnée écartable', () => {
  assert.equal(new Set(COLONNES_ECART).size, 7);
  assert.deepEqual([...new Set(Object.values(DONNEES_DU_CHIFFRE).flat())].sort(), ['cadence', 'cardio', 'denivele', 'distance', 'duree', 'puissance']);
});

test('chaque chiffre de l\'écran est relié à la donnée dont il vient', () => {
  const cles = chiffresSeance(velo()).map((c) => c.cle);
  for (const cle of cles) if (cle !== 'rpe' && cle !== 'charge') assert.ok(DONNEES_DU_CHIFFRE[cle], `${cle} n'a pas de donnée`);
});

test('chiffreEcarte : le chiffre est barré dès que l\'une de ses données est écartée', () => {
  assert.equal(chiffreEcarte(velo(), 'distance'), false);
  assert.equal(chiffreEcarte(velo({ excl_distance: true }), 'distance'), true);
  // La vitesse est une distance divisée par une durée : l'une ou l'autre l'écarte
  assert.equal(chiffreEcarte(velo({ excl_distance: true }), 'vitesse'), true);
  assert.equal(chiffreEcarte(velo({ excl_duration: true }), 'vitesse'), true);
  assert.equal(chiffreEcarte(velo({ excl_duration: true }), 'duree'), true);
  assert.equal(chiffreEcarte(velo({ excl_duration: true }), 'distance'), false);
  // La charge : écartée avec la durée, avec sa source (ici la puissance), ou toute seule ; pas avec le cardio quand elle vient de la puissance
  assert.equal(chiffreEcarte(velo(), 'charge'), false);
  assert.equal(chiffreEcarte(velo({ excl_duration: true }), 'charge'), true);
  assert.equal(chiffreEcarte(velo({ excl_power: true }), 'charge'), true);
  assert.equal(chiffreEcarte(velo({ excl_hr: true }), 'charge'), false);
  assert.equal(chiffreEcarte(velo({ excl_load: true }), 'charge'), true);
  assert.equal(chiffreEcarte(velo({ tss: null, excl_load: true }), 'charge'), false); // pas de charge à barrer
});

test('sansDonneesEcartees : une durée écartée vaut 0 minute, sans vitesse, et retire la charge', () => {
  const r = sansDonneesEcartees(velo({ excl_duration: true, elapsed_time: 8000 }));
  assert.equal(r.moving_time, 0);
  assert.equal(r.elapsed_time, null);
  assert.equal(r.avg_speed_kmh, null);
  assert.equal(r.tss, null);
  assert.equal(r.distance_km, 60);
  assert.equal(r.avg_watts, 190);
});

test('les progressions ignorent ce qui est écarté, avec ou sans masque', () => {
  const sorties = [velo()];
  assert.equal(sortiesVelo(sorties, null).length, 1);
  assert.equal(sortiesVelo([velo({ excl_power: true })], null).length, 0);
  assert.equal(sortiesVelo([sansDonneesEcartees(velo({ excl_power: true }))], null).length, 0);
  assert.equal(sortiesVelo([velo({ excl_hr: true })], null).length, 0);
  assert.equal(sortiesVelo([velo({ excl_duration: true })], null).length, 0);
  assert.equal(sortiesVelo([sansDonneesEcartees(velo({ excl_duration: true }))], null).length, 0);
  const course = velo({ sport: 'Run', distance_km: 10, moving_time: 3000, avg_watts: null, np: null, total_elevation_gain: 50 });
  assert.equal(sortiesCourse([course], null).length, 1);
  assert.equal(sortiesCourse([{ ...course, excl_distance: true }], null).length, 0);
  assert.equal(sortiesCourse([{ ...course, excl_hr: true }], null).length, 0);
  assert.equal(sortiesCourse([{ ...course, excl_duration: true }], null).length, 0);
  assert.equal(sortiesCourse([{ ...course, excl_elevation: true }], null).length, 0); // l'allure ne se corrige plus sans le dénivelé
  assert.equal(sortiesCourse([sansDonneesEcartees({ ...course, excl_elevation: true })], null).length, 0);
});

test('watts estimés par Strava (device_watts faux) : l\'app ne les montre pas, ne les utilise nulle part, et ne propose pas de les écarter', () => {
  const estimee = velo({ device_watts: false });
  assert.equal(wattsEstimes(estimee), true);
  assert.equal(wattsEstimes(velo({ device_watts: true })), false);
  assert.equal(wattsEstimes(velo({ device_watts: null })), false); // inconnu (séance saisie à la main, import de fichier) : on ne présume rien
  assert.equal(aUneVraiePuissance(estimee), false);
  assert.equal(aUneVraiePuissance(velo()), true);
  // Les calculs la voient sans puissance ni énergie ; le reste ne bouge pas, la charge non plus (elle vient du cardio ou d'une estimation)
  const vue = sansDonneesEcartees(estimee);
  assert.deepEqual([vue.avg_watts, vue.np, vue.max_watts, vue.kj], [null, null, null, null]);
  assert.equal(vue.tss, 90);
  assert.equal(vue.avg_heartrate, 140);
  assert.equal(vue.moving_time, 7200);
  assert.equal(estimee.avg_watts, 190); // la séance d'origine n'est pas modifiée (la ligne en base garde ses chiffres)
  // Pas de puce « Puissance » : il n'y a rien à écarter
  assert.deepEqual(pucesEcart(estimee).map((p) => p.cle), ['duree', 'cardio', 'cadence', 'distance', 'denivele', 'charge']);
  // Un vrai capteur ou un capteur inconnu : même séance, rien n'est copié
  const vraie = velo();
  assert.equal(sansDonneesEcartees(vraie), vraie);
  const inconnue = velo({ device_watts: null });
  assert.equal(sansDonneesEcartees(inconnue), inconnue);
  // Les progressions du vélo n'ont plus ces séances
  assert.equal(sortiesVelo([sansDonneesEcartees(velo({ device_watts: false }))], 2026).length, 0);
});

test('watts estimés : la charge d\'une séance reste (elle ne vient pas de la puissance) et écarter le cardio la retire', () => {
  const estimee = velo({ device_watts: false, tss: 70 });
  assert.equal(chargeRetenue(estimee), 70);
  assert.equal(sansDonneesEcartees(estimee).tss, 70);
});
