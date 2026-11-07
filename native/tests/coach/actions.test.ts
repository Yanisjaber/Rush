import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lireAction, ROUTE_ECRAN } from '../../src/data/coach/actions.ts';

test('ouvrir un écran : seulement les écrans de la liste blanche', () => {
  assert.deepEqual(lireAction('ouvrir_ecran', { ecran: 'calendrier' }), { type: 'ecran', ecran: 'calendrier' });
  for (const e of Object.keys(ROUTE_ECRAN)) assert.equal(lireAction('ouvrir_ecran', { ecran: e })?.type, 'ecran', e);
  for (const mauvais of ['admin', '/parametres/compte', '../x', '', 'toString', '__proto__', 'constructor', 42, null, undefined]) {
    assert.equal(lireAction('ouvrir_ecran', { ecran: mauvais }), null, String(mauvais));
  }
  assert.equal(lireAction('ouvrir_ecran', {}), null);
});

test('chaque écran a un chemin de navigation connu', () => {
  assert.deepEqual(ROUTE_ECRAN, { accueil: '/', calendrier: '/calendrier', bilan: '/bilan', sante: '/sante', coach: '/coach', parametres: '/parametres' });
});

test('ouvrir un jour du calendrier : une vraie date AAAA-MM-JJ', () => {
  assert.deepEqual(lireAction('ouvrir_calendrier', { date: '2026-11-12' }), { type: 'jour', date: '2026-11-12' });
  for (const mauvais of ['2026-02-31', '2026-13-01', '12/11/2026', '2026-11-1', '', 20261112, null, 'demain']) {
    assert.equal(lireAction('ouvrir_calendrier', { date: mauvais }), null, String(mauvais));
  }
});

test('filtrer un sport : vélo, course ou natation seulement', () => {
  assert.deepEqual(lireAction('filtrer_sport', { sport: 'velo' }), { type: 'sport', sport: 'velo' });
  for (const mauvais of ['golf', 'tout', '', 'Velo', 7, null]) assert.equal(lireAction('filtrer_sport', { sport: mauvais }), null, String(mauvais));
});

test('une action inconnue ou dangereuse est ignorée, même avec des paramètres plausibles', () => {
  for (const nom of ['supprimer_compte', 'deconnecter_integration', 'modifier_planning', 'eval', '', '__proto__', 'ouvrir_ecran ']) {
    assert.equal(lireAction(nom, { ecran: 'parametres', date: '2026-11-12', sport: 'velo' }), null, nom);
  }
});
