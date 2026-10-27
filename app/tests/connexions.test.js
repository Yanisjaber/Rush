import test from 'node:test';
import assert from 'node:assert/strict';
import { statutConnexion, detailStrava, detailGarmin, urlAutorisationStrava, lireRetourOAuth, messageErreurOAuth, progressionStreams, texteDate } from '../src/lib/data/connexions.js';

test('statut : non connecté, connecté, erreur', () => {
  assert.equal(statutConnexion(null).cle, 'non');
  assert.equal(statutConnexion({ last_sync_status: 'ok' }).cle, 'ok');
  assert.equal(statutConnexion({ last_sync_status: 'error' }).cle, 'erreur');
});

test('détails : pluriels, nom de l\'athlète, date absente tolérée', () => {
  assert.match(detailStrava(null), /Importe/);
  assert.equal(detailStrava({ athlete_name: 'Yanis J.' }, 1), 'Yanis J. · 1 activité');
  assert.match(detailStrava({}, 969), /969 activités/);
  assert.match(detailGarmin(0), /arrive bientôt/);
  assert.match(detailGarmin(1), /1 nuit déjà importée,/);
  assert.match(detailGarmin(2), /2 nuits déjà importées/);
  assert.equal(texteDate('pas une date'), '');
  assert.equal(texteDate(null), '');
});

test('adresse Strava : paramètres attendus, state transmis tel quel', () => {
  const u = new URL(urlAutorisationStrava({ clientId: '1', redirectUri: 'https://x.test/cb', state: 'abc123' }));
  assert.equal(u.origin + u.pathname, 'https://www.strava.com/oauth/authorize');
  assert.equal(u.searchParams.get('state'), 'abc123');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://x.test/cb');
  assert.equal(u.searchParams.get('scope'), 'read,activity:read_all');
});

test('retour OAuth : lu dans l\'adresse, erreur nettoyée', () => {
  assert.deepEqual(lireRetourOAuth('?strava_connected=1'), { connecte: true, erreur: '' });
  assert.deepEqual(lireRetourOAuth(''), { connecte: false, erreur: '' });
  assert.equal(lireRetourOAuth('?strava_error=access_denied').erreur, 'access_denied');
  const piege = lireRetourOAuth('?strava_error=' + encodeURIComponent('<img src=x onerror=alert(1)>'));
  assert.match(piege.erreur, /^[A-Za-z0-9_-]+$/);
  assert.ok(lireRetourOAuth('?strava_error=' + 'a'.repeat(500)).erreur.length <= 60);
  assert.equal(lireRetourOAuth('?strava_error=%3C%3E').erreur, 'erreur');
});

test('messages d\'erreur OAuth', () => {
  assert.equal(messageErreurOAuth(''), '');
  assert.match(messageErreurOAuth('access_denied'), /refusé/);
  assert.match(messageErreurOAuth('token_exchange_400'), /token_exchange_400/);
});

test('progression : bornée entre 28 et 99, tolère les valeurs absurdes', () => {
  assert.deepEqual(progressionStreams(100, 100), { traitees: 0, pct: 28 });
  assert.equal(progressionStreams(100, 0).pct, 99);
  assert.equal(progressionStreams(100, 50).pct, 64);
  assert.equal(progressionStreams(0, 5).pct, 28);
  assert.equal(progressionStreams(10, 500).traitees, 0);
  assert.equal(progressionStreams('x', 'y').pct, 28);
});

