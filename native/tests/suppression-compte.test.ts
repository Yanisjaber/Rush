import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmationValide, supprimerCompteAvec, type AppelFonction } from '../src/data/suppression-compte.ts';

const ok = (data: Record<string, unknown> = {}) => ({ ok: true, statut: 200, data });
const ko = (statut = 500) => ({ ok: false, statut, data: null });

test('confirmationValide : exactement SUPPRIMER, espaces autour ignorés', () => {
  assert.equal(confirmationValide('SUPPRIMER'), true);
  assert.equal(confirmationValide('  SUPPRIMER '), true);
  assert.equal(confirmationValide('supprimer'), false);
  assert.equal(confirmationValide(''), false);
});

test('supprimerCompteAvec : sans le bon mot, aucun appel serveur', async () => {
  let appels = 0;
  const r = await supprimerCompteAvec(async () => (appels++, ok()), 'oui');
  assert.equal(r.ok, false);
  assert.equal(appels, 0);
});

test('supprimerCompteAvec : prépare, purge par lots, puis supprime le compte', async () => {
  const etapes: string[] = [];
  const restes = [6, 2, 0];
  const appeler: AppelFonction = async (c) => {
    etapes.push(String(c.etape));
    if (c.etape === 'preparer') return ok({ total: 10 });
    if (c.etape === 'purger') return ok({ restant: restes.shift() });
    return ok();
  };
  const pcts: number[] = [];
  const r = await supprimerCompteAvec(appeler, 'SUPPRIMER', (a) => pcts.push(a.pct));
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(etapes, ['preparer', 'purger', 'purger', 'purger', 'supprimer']);
  assert.equal(pcts.at(-1), 100);
  assert.deepEqual([...pcts].sort((a, b) => a - b), pcts); // la barre ne recule jamais
});

test('supprimerCompteAvec : échec à la préparation = rien supprimé ; fonction absente = message dédié', async () => {
  const a = await supprimerCompteAvec(async () => ko(500), 'SUPPRIMER');
  assert.equal(a.ok === false && a.message.includes("Rien n'a été supprimé"), true);
  const b = await supprimerCompteAvec(async () => ko(404), 'SUPPRIMER');
  assert.equal(b.ok === false && b.message.includes('pas encore activée'), true);
});

test("supprimerCompteAvec : s'arrête si ça n'avance plus ou si un lot échoue", async () => {
  let n = 0;
  const bloque: AppelFonction = async (c) => (c.etape === 'preparer' ? ok({ total: 5 }) : (n++, ok({ restant: 5 })));
  const r = await supprimerCompteAvec(bloque, 'SUPPRIMER');
  assert.equal(r.ok, false);
  assert.equal(n, 3);
  const casse: AppelFonction = async (c) => (c.etape === 'preparer' ? ok({ total: 5 }) : ko());
  assert.equal((await supprimerCompteAvec(casse, 'SUPPRIMER')).ok, false);
});

test('supprimerCompteAvec : ancien serveur sans total = déjà tout supprimé', async () => {
  const etapes: string[] = [];
  const r = await supprimerCompteAvec(async (c) => (etapes.push(String(c.etape)), ok()), 'SUPPRIMER');
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(etapes, ['preparer']);
});
