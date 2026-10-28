// Test du calcul de charge partagé (aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/charge.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTss, stravaToRow, lthrEffectif, ftpEffective, puissanceRetenue } from '../functions/_shared/charge.ts';

test('une heure à la FTP = 100 points', () => {
  assert.equal(computeTss({ moving_time: 3600, weighted_average_watts: 200 }, 200, null), 100);
});
test('sans puissance normalisée, la puissance moyenne sert (webhook et ingest donnent le même résultat)', () => {
  const a = { moving_time: 3600, average_watts: 200 };
  assert.equal(puissanceRetenue(a), 200);
  assert.equal(computeTss(a, 200, null), 100);
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
  assert.equal(await ftpEffective(faux({ best_watts: 300 }, null), 'u', null), 285);
  assert.equal(await ftpEffective(faux(null, null), 'u', null, [{ average_watts: 200 }, { weighted_average_watts: 250 }]), 225);
  assert.equal(await ftpEffective(faux(null, { np: 300 }), 'u', null, []), 270);
  assert.equal(await ftpEffective(faux(null, null), 'u', null, []), null);
});
test('stravaToRow : même ligne quel que soit le chemin', () => {
  const r = stravaToRow({ id: 1, name: 'Sortie', sport_type: 'Ride', start_date_local: '2026-10-28T08:00:00Z', moving_time: 3600, average_watts: 200 }, 'u', 200, null);
  assert.equal(r.tss, 100);
  assert.equal(r.np, 200);
  assert.equal(r.ftp_at_time, 200);
  assert.equal(r.has_power, true);
});
