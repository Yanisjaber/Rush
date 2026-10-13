import test from 'node:test';
import assert from 'node:assert/strict';
import { lireLienAuth, messageLienErreur, validerMotDePasse, MDP_MIN, MDP_MAX } from '../src/lib/data/lien-auth.js';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3OCJ9.c2lnbmF0dXJlX2JpZW5fbG9uZ3VlXzEyMw';

test("lien d'invitation et de réinitialisation valides", () => {
  const inv = lireLienAuth(`#access_token=${JWT}&expires_in=3600&refresh_token=abc123xyz&token_type=bearer&type=invite`);
  assert.deepEqual(inv, { type: 'invite', accessToken: JWT, refreshToken: 'abc123xyz' });
  assert.equal(lireLienAuth(`#access_token=${JWT}&refresh_token=abc123xyz&type=recovery`).type, 'recovery');
});

test("ce qui n'est pas un lien d'authentification donne null (les routes de l'app ne sont jamais touchées)", () => {
  for (const h of ['', '#', '#/', '#/calendrier', '#/force/seance/abc', '#/seance/42', 'pas-un-fragment', null, undefined]) {
    assert.equal(lireLienAuth(h), null, String(h));
  }
});

test('lien invalide : type inconnu (magiclink, signup…), jeton mal formé, jeton manquant, trop long', () => {
  assert.equal(lireLienAuth(`#access_token=${JWT}&refresh_token=abc123xyz&type=magiclink`), null);
  assert.equal(lireLienAuth(`#access_token=${JWT}&refresh_token=abc123xyz`), null);
  assert.equal(lireLienAuth('#access_token=pas-un-jwt&refresh_token=abc123xyz&type=invite'), null);
  assert.equal(lireLienAuth(`#access_token=${JWT}&type=invite`), null);
  assert.equal(lireLienAuth(`#access_token=${JWT}&refresh_token=<script>alert(1)</script>&type=invite`), null);
  assert.equal(lireLienAuth(`#access_token=${JWT}&refresh_token=abc123xyz&type=invite&x=${'a'.repeat(9000)}`), null);
});

test('lien expiré ou refusé : erreur lisible', () => {
  assert.deepEqual(lireLienAuth('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'), { erreur: 'expire' });
  assert.deepEqual(lireLienAuth('#error=access_denied&error_code=bad_jwt'), { erreur: 'invalide' });
  assert.match(messageLienErreur('expire'), /expiré/);
  assert.match(messageLienErreur('invalide'), /pas valable/);
});

test('mot de passe : longueur, chiffres seuls, espaces, e-mail dedans, confirmation', () => {
  assert.equal(MDP_MIN, 10);
  assert.equal(validerMotDePasse('Court1!', 'Court1!').ok, false);
  assert.equal(validerMotDePasse('x'.repeat(MDP_MAX + 1), 'x'.repeat(MDP_MAX + 1)).ok, false);
  assert.match(validerMotDePasse('1234567890', '1234567890').message, /chiffres seuls/);
  assert.equal(validerMotDePasse(' '.repeat(12), ' '.repeat(12)).ok, false);
  assert.match(validerMotDePasse('Yanisjaber23-abc', 'Yanisjaber23-abc', 'yanisjaber23@gmail.com').message, /e-mail/);
  assert.match(validerMotDePasse('Une-phrase-longue-1', 'Une-phrase-longue-2').message, /identiques/);
  assert.deepEqual(validerMotDePasse('Une-phrase-longue-1', 'Une-phrase-longue-1', 'yanisjaber23@gmail.com'), { ok: true });
  assert.equal(validerMotDePasse('x'.repeat(MDP_MAX), 'x'.repeat(MDP_MAX)).ok, true);
});
