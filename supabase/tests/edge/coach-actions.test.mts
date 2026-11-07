// Test du registre des actions du coach (aucun réseau, aucune base).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/coach-actions.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, actionsDisponibles, MAX_PAR_NIVEAU, outilsExposes, trouverAction } from '../../functions/_shared/coach-actions.ts';

const ID = '00000000-0000-4000-8000-000000000001';

test('registre : noms uniques, niveau valide, schéma fermé (additionalProperties: false)', () => {
  const noms = ACTIONS.map((a) => a.nom);
  assert.equal(new Set(noms).size, noms.length);
  for (const a of ACTIONS) {
    assert.ok(['lecture', 'direct', 'carte', 'confirmation'].includes(a.niveau), a.nom);
    assert.equal((a.schema as { additionalProperties?: unknown }).additionalProperties, false, `${a.nom} : schéma fermé`);
    assert.ok(a.description.length > 10, a.nom);
    if (a.nom !== 'proposer_seance') assert.equal(typeof a.lire, 'function', `${a.nom} : paramètres vérifiés`);
  }
});

test('registre : le modèle ne voit que les actions disponibles', () => {
  const vus = outilsExposes().map((o) => o.name);
  assert.deepEqual(vus, actionsDisponibles().map((a) => a.nom));
  assert.ok(vus.includes('proposer_seance') && vus.includes('ouvrir_ecran'));
  assert.ok(!vus.includes('supprimer_compte'), 'une action irréversible non branchée reste invisible');
});

test('sécurité : aucune action « carte » ou « confirmation » n\'est exécutée par le registre, et les gros niveaux sont limités', () => {
  assert.equal(MAX_PAR_NIVEAU.confirmation, 1);
  // les actions directes ne portent aucun identifiant de donnée : elles ne peuvent rien modifier
  for (const a of ACTIONS.filter((x) => x.niveau === 'direct')) {
    const cles = Object.keys((a.schema as { properties: object }).properties);
    assert.ok(!cles.some((c) => /id$/.test(c)), `${a.nom} ne cible aucune donnée`);
  }
  // le coach ne peut proposer de supprimer son propre compte que sous « confirmation »
  assert.equal(trouverAction('supprimer_compte')?.niveau, 'confirmation');
  assert.equal(trouverAction('deconnecter_integration')?.niveau, 'confirmation');
  assert.equal(trouverAction('supprimer_seance')?.niveau, 'carte');
});

test('ouvrir_ecran / ouvrir_calendrier / filtrer_sport : valeurs valides acceptées, le reste refusé', () => {
  const lire = (nom: string, x: unknown) => trouverAction(nom)!.lire!(x);
  assert.deepEqual(lire('ouvrir_ecran', { ecran: 'sante' }), { ok: true, params: { ecran: 'sante' } });
  assert.equal(lire('ouvrir_ecran', { ecran: 'admin' }).ok, false);
  assert.equal(lire('ouvrir_ecran', { ecran: 'sante', extra: 1 }).ok, false);
  assert.equal(lire('ouvrir_ecran', null).ok, false);
  assert.equal(lire('ouvrir_ecran', ['sante']).ok, false);
  assert.deepEqual(lire('ouvrir_calendrier', { date: '2026-11-08' }), { ok: true, params: { date: '2026-11-08' } });
  for (const d of ['2026-02-31', '2026-13-01', '8 nov', '2026-11-8', 20261108, null]) assert.equal(lire('ouvrir_calendrier', { date: d }).ok, false, String(d));
  assert.deepEqual(lire('filtrer_sport', { sport: 'velo' }), { ok: true, params: { sport: 'velo' } });
  assert.equal(lire('filtrer_sport', { sport: 'golf' }).ok, false);
});

test('actions de niveau carte et confirmation (déclarées, pas encore branchées) : leurs paramètres sont déjà vérifiés', () => {
  const lire = (nom: string, x: unknown) => trouverAction(nom)!.lire!(x);
  assert.equal(lire('deplacer_seance', { seance_id: ID, date: '2026-11-10' }).ok, true);
  assert.equal(lire('deplacer_seance', { seance_id: 'abc', date: '2026-11-10' }).ok, false);
  assert.equal(lire('supprimer_seance', { seance_id: ID }).ok, true);
  assert.equal(lire('supprimer_seance', { seance_id: "x'; drop table activities;--" }).ok, false);
  assert.equal(lire('declarer_indisponibilite', { type: 'blessure', du: '2026-11-08', au: '2026-11-18' }).ok, true);
  assert.equal(lire('declarer_indisponibilite', { type: 'blessure', du: '2026-11-18', au: '2026-11-08' }).ok, false, 'fin avant le début');
  assert.equal(lire('declarer_indisponibilite', { type: 'vacances', du: '2026-11-08', au: '2026-11-18' }).ok, false);
  assert.equal(lire('deconnecter_integration', { service: 'strava' }).ok, true);
  assert.equal(lire('deconnecter_integration', { service: 'whoop' }).ok, false);
  assert.equal(lire('supprimer_compte', {}).ok, true);
  assert.equal(lire('supprimer_compte', { confirme: true }).ok, false, 'le modèle ne peut pas « confirmer » lui-même');
});
