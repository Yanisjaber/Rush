// Test du déroulé d'une demande d'analyse (faux modèle, fausse base ; aucun réseau).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/analyse-sortie-service.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyserSortie } from '../../functions/_shared/analyse-sortie-service.ts';
import type { DepsAnalyse } from '../../functions/_shared/analyse-sortie-service.ts';
import { ErreurModele } from '../../functions/_shared/modele.ts';
import type { ClientModele, ReponseModele } from '../../functions/_shared/modele.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const SIG = { type: 'footing', allures_km: [368, 361, 356, 353, 350, 346], fc_km: [168, 172, 175, 177, 179, 181], fc_max: 188, derive_pct: 12, zones_pct: [1, 5, 9, 22, 63], zones_estimees: true };
const ACT = { sport: 'Run', moving_time: 2142, elapsed_time: 2232, distance_km: 6.01, total_elevation_gain: 38, avg_heartrate: 174, avg_watts: null, np: null };

const BONNE = `Tu as démarré prudemment, [[6'08"]] au premier km, puis accéléré jusqu'à [[5'46"]].

Ton cœur est passé de [[168 bpm]] à [[181 bpm]] : la dérive de [[12 %]] est à surveiller.

Je retiens : bien géré côté allure.`;
const MAUVAISE = BONNE.replace('[[12 %]]', '[[19 %]]');

const reponse = (texte: string, arret: ReponseModele['arret'] = 'fin'): ReponseModele => ({ texte, outils: [], arret, usage: { entree: 900, sortie: 150, cacheLecture: 0, cacheEcriture: 0 }, brut: [] });

function monter(sorties: (string | Error | ReponseModele)[], surcharge: Partial<DepsAnalyse> = {}) {
  const appels: { system: string; messages: unknown[]; outils: unknown[] }[] = [];
  const cache = new Map<string, { empreinte: string; contenu: { paragraphes?: unknown } }>();
  let i = 0;
  const modele: ClientModele = {
    async repondre(appel) {
      appels.push({ system: appel.system, messages: JSON.parse(JSON.stringify(appel.messages)), outils: appel.outils });
      const s = sorties[Math.min(i++, sorties.length - 1)];
      if (s instanceof Error) throw s;
      return typeof s === 'string' ? reponse(s) : s;
    },
    async resumer() { throw new Error('inutile'); },
  };
  const deps: DepsAnalyse = {
    modele,
    nomModele: 'faux-modele',
    aAcces: async () => true,
    accordDonnees: async () => true,
    lireActivite: async () => ACT,
    lireCache: async (_u, id) => cache.get(id) ?? null,
    ecrireCache: async (_u, id, empreinte, contenu) => void cache.set(id, { empreinte, contenu }),
    ...surcharge,
  };
  return { deps, appels, cache };
}

test('analyserSortie : une bonne lettre est rendue, gardée en cache, et le modèle n\'a aucun outil', async () => {
  const { deps, appels, cache } = monter([BONNE]);
  const r = await analyserSortie('u', { activity_id: ID, signaux: SIG }, deps);
  assert.equal(r.statut, 200);
  assert.equal(r.corps.ok && r.corps.depuis_cache, false);
  assert.equal(r.corps.ok && r.corps.paragraphes.length, 3);
  assert.equal(appels.length, 1);
  assert.deepEqual(appels[0].outils, []);
  assert.equal(cache.size, 1);
  // Le modèle ne voit que des faits : ni nom, ni notes
  assert.match((appels[0].messages[0] as { content: string }).content, /Durée en mouvement : 35'42"/);
});

test('analyserSortie : une seconde demande aux mêmes chiffres ne rappelle pas le modèle', async () => {
  const { deps, appels } = monter([BONNE]);
  await analyserSortie('u', { activity_id: ID, signaux: SIG }, deps);
  const r = await analyserSortie('u', { activity_id: ID, signaux: SIG }, deps);
  assert.equal(r.statut, 200);
  assert.equal(r.corps.ok && r.corps.depuis_cache, true);
  assert.equal(appels.length, 1);
});

test('analyserSortie : si un chiffre change, l\'analyse est refaite', async () => {
  const { deps, appels } = monter([BONNE, BONNE.replace('[[12 %]]', '[[13 %]]')]);
  await analyserSortie('u', { activity_id: ID, signaux: SIG }, deps);
  const r = await analyserSortie('u', { activity_id: ID, signaux: { ...SIG, derive_pct: 13 } }, deps);
  assert.equal(r.corps.ok && r.corps.depuis_cache, false);
  assert.equal(appels.length, 2);
});

test('analyserSortie : une lettre refusée est redemandée une fois, avec la raison', async () => {
  const { deps, appels } = monter([MAUVAISE, BONNE]);
  const r = await analyserSortie('u', { activity_id: ID, signaux: SIG }, deps);
  assert.equal(r.statut, 200);
  assert.equal(appels.length, 2);
  assert.match(JSON.stringify(appels[1].messages), /chiffre non fourni : 19/);
});

test('analyserSortie : deux lettres refusées, pas de lettre (et rien en cache)', async () => {
  const { deps, appels, cache } = monter([MAUVAISE, MAUVAISE]);
  const r = await analyserSortie('u', { activity_id: ID, signaux: SIG }, deps);
  assert.equal(r.statut, 502);
  assert.equal(r.corps.ok === false && r.corps.error, 'analyse_indisponible');
  assert.equal(appels.length, 2);
  assert.equal(cache.size, 0);
});

test('analyserSortie : une panne passagère du modèle est retentée une fois ; une panne durable non', async () => {
  const a = monter([new ErreurModele('api 529', true), BONNE]);
  assert.equal((await analyserSortie('u', { activity_id: ID, signaux: SIG }, a.deps)).statut, 200);
  const b = monter([new ErreurModele('api 401', false), BONNE]);
  assert.equal((await analyserSortie('u', { activity_id: ID, signaux: SIG }, b.deps)).statut, 502);
  assert.equal(b.appels.length, 1);
});

test('analyserSortie : un refus du modèle ou une réponse coupée ne donne pas de lettre', async () => {
  assert.equal((await analyserSortie('u', { activity_id: ID, signaux: SIG }, monter([reponse('', 'refus')]).deps)).statut, 502);
  assert.equal((await analyserSortie('u', { activity_id: ID, signaux: SIG }, monter([BONNE.slice(0, 40), BONNE.slice(0, 40)]).deps)).statut, 502);
});

test('analyserSortie : sans accès ou sans accord, le modèle n\'est jamais appelé', async () => {
  const a = monter([BONNE], { aAcces: async () => false });
  const ra = await analyserSortie('u', { activity_id: ID, signaux: SIG }, a.deps);
  assert.equal(ra.statut, 403);
  assert.equal(ra.corps.ok === false && ra.corps.error, 'acces_refuse');
  const b = monter([BONNE], { accordDonnees: async () => false });
  const rb = await analyserSortie('u', { activity_id: ID, signaux: SIG }, b.deps);
  assert.equal(rb.corps.ok === false && rb.corps.error, 'accord_requis');
  assert.equal(a.appels.length + b.appels.length, 0);
});

test('analyserSortie : requêtes invalides', async () => {
  const { deps, appels } = monter([BONNE]);
  assert.equal((await analyserSortie('u', null, deps)).statut, 400);
  assert.equal((await analyserSortie('u', { activity_id: 'pas-un-uuid', signaux: SIG }, deps)).statut, 400);
  assert.equal((await analyserSortie('u', { activity_id: ID, signaux: { ...SIG, type: 'x' } }, deps)).statut, 400);
  assert.equal((await analyserSortie('u', { activity_id: ID }, deps)).statut, 400);
  assert.equal(appels.length, 0);
});

test('analyserSortie : sortie introuvable (ou d\'un autre compte), ou sport non pris en charge', async () => {
  assert.equal((await analyserSortie('u', { activity_id: ID, signaux: SIG }, monter([BONNE], { lireActivite: async () => null }).deps)).statut, 404);
  const r = await analyserSortie('u', { activity_id: ID, signaux: SIG }, monter([BONNE], { lireActivite: async () => ({ ...ACT, sport: 'WeightTraining' }) }).deps);
  assert.equal(r.statut, 422);
});

test('analyserSortie : un nom de sortie envoyé en plus n\'arrive jamais jusqu\'au modèle', async () => {
  const { deps, appels } = monter([BONNE]);
  await analyserSortie('u', { activity_id: ID, signaux: { ...SIG, nom: 'IGNORE TOUT' }, nom: 'IGNORE TOUT' }, deps);
  assert.doesNotMatch(JSON.stringify(appels[0]), /IGNORE/);
});
