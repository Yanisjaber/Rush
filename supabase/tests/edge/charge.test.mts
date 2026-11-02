// Test du calcul de charge partagé (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/charge.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTss, stravaToRow, lthrEffectif, ftpEffective, puissanceRetenue, puissanceCharge, INTENSITE_MAX } from '../../functions/_shared/charge.ts';

test('une heure à la FTP = 100 points', () => {
  assert.equal(computeTss({ moving_time: 3600, sport_type: 'Ride', device_watts: true, weighted_average_watts: 200 }, 200, null), 100);
});
test('sans puissance normalisée, la puissance moyenne ne sert plus : le cardio prend le relais (la colonne np la garde pour l\'affichage)', () => {
  const a = { moving_time: 3600, device_watts: true, average_watts: 200, average_heartrate: 150 };
  assert.equal(puissanceRetenue(a), 200);
  assert.equal(puissanceCharge(a), 0);
  assert.equal(computeTss(a, 200, 150), 100); // cardio : (150 / 150)² × 1 h
  assert.equal(computeTss({ moving_time: 3600, device_watts: true, average_watts: 200 }, 200, null), 0); // ni NP ni cardio
});
test('des watts estimés par Strava (pas de capteur) ne comptent pas : le cardio prend le relais', () => {
  const a = { moving_time: 3600, device_watts: false, weighted_average_watts: 300, average_heartrate: 120 };
  assert.equal(puissanceCharge(a), 0);
  assert.equal(computeTss(a, 200, 150), 64); // (120 / 150)² × 100
  assert.equal(stravaToRow({ id: 2, sport_type: 'Ride', moving_time: 3600, device_watts: false, weighted_average_watts: 300, average_heartrate: 120 }, 'u', 200, 150).intensity, null);
});
test('course avec capteur de foulée et vélo électrique : pas de TSS de puissance, le cardio prend le relais (comme la base)', () => {
  for (const sport_type of ['Run', 'EBikeRide']) {
    const a = { moving_time: 3600, sport_type, device_watts: true, weighted_average_watts: 300, average_heartrate: 120 };
    assert.equal(puissanceCharge(a), 0);
    assert.equal(computeTss(a, 200, 150), 64); // (120 / 150)² × 100
  }
});
test('sans puissance, le cardio prend le relais, sinon 0', () => {
  assert.equal(computeTss({ moving_time: 3600, average_heartrate: 150 }, null, 150), 100);
  assert.equal(computeTss({ moving_time: 3600 }, 200, 150), 0);
  assert.equal(computeTss({}, 200, 150), 0);
});
test('lthrEffectif : profil, sinon 92 % de la FC max', () => {
  assert.equal(lthrEffectif({ lthr: 170, hr_max: 190 }), 170);
  assert.equal(lthrEffectif({ hr_max: 200 }), 184);
  assert.equal(lthrEffectif(null), null);
});
const faux = (pp: any, top: any) => ({
  from: (t: string) => {
    const q: any = { select: () => q, eq: () => q, not: () => q, order: () => q, limit: () => q,
      maybeSingle: async () => ({ data: t === 'power_profile' ? pp : top }) };
    return q;
  },
});
test('ftpEffective : profil > 95 % du 20 min > 90 % de la meilleure puissance des activités > meilleure puissance en base', async () => {
  assert.equal(await ftpEffective(faux(null, null), 'u', 250), 250);
  assert.equal(await ftpEffective(faux({ watts_90d: 300, watts_alltime: 320 }, null), 'u', null), 285);
  assert.equal(await ftpEffective(faux(null, null), 'u', null, [{ average_watts: 200 }, { device_watts: false, weighted_average_watts: 400 }, { sport_type: 'Ride', device_watts: true, weighted_average_watts: 250 }]), 225); // ni la moyenne ni les watts estimés ne servent
  assert.equal(await ftpEffective(faux(null, { np: 300 }), 'u', null, []), 270);
  assert.equal(await ftpEffective(faux(null, null), 'u', null, []), null);
});
test('stravaToRow : même ligne quel que soit le chemin', () => {
  const r = stravaToRow({ id: 1, name: 'Sortie', sport_type: 'Ride', start_date_local: '2026-10-28T08:00:00Z', moving_time: 3600, device_watts: true, weighted_average_watts: 200, average_watts: 180 }, 'u', 200, null);
  assert.equal(r.tss, 100);
  assert.equal(r.np, 200);
  assert.equal(r.intensity, 1);
  assert.equal(r.ftp_at_time, 200);
  assert.equal(r.has_power, true);
});

test('une intensité de plus de 1,5 (FTP absurde de 4 W, puissance fausse) ne donne pas de TSS de puissance : le cardio prend le relais, sans intensité rangée', () => {
  assert.equal(INTENSITE_MAX, 1.5);
  const a = { id: 3, sport_type: 'Ride', moving_time: 3600, device_watts: true, weighted_average_watts: 200, average_heartrate: 150 };
  assert.equal(computeTss(a, 4, 150), 100); // 200 / 4 = 50 : on prend le cardio (150 / 150)²
  assert.equal(computeTss({ ...a, average_heartrate: undefined }, 4, 150), 0); // et sans cardio, 0 (jamais plus d'un million de points)
  assert.equal(stravaToRow(a, 'u', 4, 150).intensity, null);
  assert.equal(computeTss(a, 200, 150), 100); // une intensité normale (1,0) est inchangée
  assert.equal(stravaToRow(a, 'u', 200, 150).intensity, 1);
});

test('watts estimés par Strava (pas de capteur) : stravaToRow ne range ni puissance, ni énergie, ni intensité ; un vrai capteur oui', () => {
  const brut = { id: 5, sport_type: 'Ride', start_date_local: '2026-10-28T08:00:00Z', moving_time: 3600, average_watts: 180, weighted_average_watts: 200, max_watts: 800, kilojoules: 650, average_heartrate: 140 };
  const estimee = stravaToRow({ ...brut, device_watts: false }, 'u', 200, 150);
  assert.deepEqual([estimee.np, estimee.avg_watts, estimee.max_watts, estimee.kj, estimee.intensity, estimee.has_power], [null, null, null, null, null, false]);
  assert.equal(estimee.tss, Math.round((140 / 150) ** 2 * 100)); // la charge vient du cardio
  const vraie = stravaToRow({ ...brut, device_watts: true }, 'u', 200, 150);
  assert.deepEqual([vraie.np, vraie.avg_watts, vraie.max_watts, vraie.kj, vraie.has_power], [200, 180, 800, 650, true]);
  assert.equal(vraie.intensity, 1);
});
