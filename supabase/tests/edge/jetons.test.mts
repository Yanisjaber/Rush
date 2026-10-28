// Test du module partagé des jetons avec un FAUX client Supabase (aucun réseau, aucune vraie clé).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/jetons.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { lireJetons, ecrireJetons, joindreJetons, ecrireRenouvellementStrava } from '../../functions/_shared/jetons.ts';

const faux = (reponse: any) => {
  const appels: any[] = [];
  return { appels, rpc: async (nom: string, args: any) => (appels.push({ nom, args }), reponse) };
};

test('lireJetons appelle la fonction SQL réservée au serveur et renvoie les jetons', async () => {
  const sb = faux({ data: { access_token: 'a', refresh_token: 'r' }, error: null });
  assert.deepEqual(await lireJetons(sb, 'u1', 'strava'), { access_token: 'a', refresh_token: 'r' });
  assert.deepEqual(sb.appels[0], { nom: 'rpc_connection_secrets', args: { p_user_id: 'u1', p_app: 'strava' } });
});

test('lireJetons : connexion inconnue → null ; erreur → null sans fuite', async () => {
  assert.equal(await lireJetons(faux({ data: null, error: null }), 'u1', 'garmin'), null);
  const journal: string[] = [];
  const avant = console.error; console.error = (...a: any[]) => journal.push(a.join(' '));
  assert.equal(await lireJetons(faux({ data: null, error: { code: '42501', message: 'jeton_secret_12345' } }), 'u1', 'strava'), null);
  console.error = avant;
  assert.ok(journal.length === 1 && !journal[0].includes('jeton_secret_12345'), 'le message d\'erreur de la base ne doit pas être journalisé');
});

test('ecrireJetons envoie le payload et l\'expiration ; une erreur lève une exception sans détail', async () => {
  const sb = faux({ error: null });
  await ecrireJetons(sb, 'u1', 'strava', { access_token: 'n' }, '2030-01-01T00:00:00.000Z');
  assert.deepEqual(sb.appels[0].args, { p_user_id: 'u1', p_app: 'strava', p_payload: { access_token: 'n' }, p_expires_at: '2030-01-01T00:00:00.000Z' });
  const avant = console.error; console.error = () => {};
  await assert.rejects(ecrireJetons(faux({ error: { code: 'X', message: 'secret' } }), 'u1', 'strava', {}), { message: 'token_save_failed' });
  console.error = avant;
});

test('joindreJetons complète la ligne ; sans jetons, les champs valent null (jamais undefined)', async () => {
  const conn: any = { user_id: 'u1', app: 'garmin', expires_at: 'x' };
  await joindreJetons(faux({ data: { access_token: 'a', oauth1_token: 'o', oauth1_secret: 's' }, error: null }), conn);
  assert.deepEqual([conn.access_token, conn.refresh_token, conn.oauth1_token, conn.oauth1_secret], ['a', null, 'o', 's']);
  const vide: any = { user_id: 'u2' };
  await joindreJetons(faux({ data: null, error: null }), vide);
  assert.deepEqual([vide.access_token, vide.refresh_token], [null, null]);
});

test('ecrireRenouvellementStrava convertit l\'expiration (secondes → date ISO) et n\'écrit que les deux jetons', async () => {
  const sb = faux({ error: null });
  await ecrireRenouvellementStrava(sb, 'u1', { access_token: 'a2', refresh_token: 'r2', expires_at: 1893456000, athlete: { id: 1 } });
  const { p_payload, p_expires_at, p_app } = sb.appels[0].args;
  assert.equal(p_app, 'strava');
  assert.deepEqual(p_payload, { access_token: 'a2', refresh_token: 'r2' });
  assert.equal(p_expires_at, '2030-01-01T00:00:00.000Z');
});
