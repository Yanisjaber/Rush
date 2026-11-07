// Test du registre des actions du coach (aucun réseau, aucune base).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/coach-actions.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, FONCTIONS_HISTORIQUE, actionsDisponibles, MAX_PAR_NIVEAU, outilsExposes, trouverAction } from '../../functions/_shared/coach-actions.ts';

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
  assert.ok(vus.includes('proposer_seance') && vus.includes('ouvrir_ecran') && vus.includes('modifier_planning') && vus.includes('proposer_replanification'));
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
  assert.equal(trouverAction('modifier_planning')?.niveau, 'carte');
  assert.equal(trouverAction('proposer_replanification')?.niveau, 'carte');
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

test('actions de niveau confirmation (déclarées, pas encore branchées) : leurs paramètres sont déjà vérifiés et le modèle ne les voit pas', () => {
  const lire = (nom: string, x: unknown) => trouverAction(nom)!.lire!(x);
  assert.equal(lire('deconnecter_integration', { service: 'strava' }).ok, true);
  assert.equal(lire('deconnecter_integration', { service: 'whoop' }).ok, false);
  assert.equal(lire('supprimer_compte', {}).ok, true);
  assert.equal(lire('supprimer_compte', { confirme: true }).ok, false, 'le modèle ne peut pas « confirmer » lui-même');
  assert.equal(trouverAction('supprimer_compte')!.disponible, false);
  assert.equal(trouverAction('deconnecter_integration')!.disponible, false);
});

test('proposer_replanification : contraintes valides acceptées, le reste refusé avec une raison', () => {
  const lire = (x: unknown) => trouverAction('proposer_replanification')!.lire!(x);
  const ok = lire({ motif: 'Genou, 10 jours', indisponibilite: { type: 'blessure', du: '2026-11-07', au: '2026-11-16' } });
  assert.deepEqual(ok, { ok: true, params: { intention: 'Genou, 10 jours', contraintes: { indisponibilite: { type: 'blessure', du: '2026-11-07', au: '2026-11-16' } } } });
  assert.deepEqual((lire({ motif: 'Voyage', jours_bloques: ['2026-11-12', '2026-11-12', '2026-11-13'] }) as { params: { contraintes: unknown } }).params.contraintes, { joursBloques: ['2026-11-12', '2026-11-13'] });
  assert.deepEqual((lire({ motif: 'Pas de vélo', sports_exclus: { sports: ['velo', 'velo'], du: '2026-11-06', au: '2026-11-12' } }) as { params: { contraintes: unknown } }).params.contraintes, { sportsExclus: { sports: ['velo'], du: '2026-11-06', au: '2026-11-12' } });
  const mauvais: unknown[] = [
    { motif: 'x' }, // aucune contrainte
    { motif: 'ok ok', indisponibilite: { type: 'vacances', du: '2026-11-07', au: '2026-11-09' } },
    { motif: 'ok ok', indisponibilite: { type: 'blessure', du: '2026-11-09', au: '2026-11-07' } },
    { motif: 'ok ok', indisponibilite: { type: 'blessure', du: '2026-02-31', au: '2026-03-05' } },
    { motif: 'ok ok', jours_bloques: [] },
    { motif: 'ok ok', jours_bloques: Array.from({ length: 15 }, (_, i) => `2026-11-${String(i + 10).padStart(2, '0')}`) },
    { motif: 'ok ok', jours_bloques: ['demain'] },
    { motif: 'ok ok', sports_exclus: { sports: ['golf'], du: '2026-11-06', au: '2026-11-12' } },
    { motif: 'ok ok', sports_exclus: { sports: ['velo'], du: '2026-11-06', au: '2027-01-12' } },
    { motif: '', jours_bloques: ['2026-11-12'] },
    { motif: 'a'.repeat(201), jours_bloques: ['2026-11-12'] },
    { motif: 'ok ok', jours_bloques: ['2026-11-12'], clef_inconnue: 1 },
    null,
  ];
  for (const m of mauvais) assert.equal(lire(m).ok, false, JSON.stringify(m)?.slice(0, 90));
});

test('modifier_planning : les quatre opérations sont lues, nettoyées et strictement vérifiées', () => {
  const lire = (x: unknown) => trouverAction('modifier_planning')!.lire!(x);
  const r = lire({ motif: 'Décalage', operations: [
    { op: 'deplacer', seance_id: ID.toUpperCase(), vers: '2026-11-10' },
    { op: 'supprimer', seance_id: ID },
    { op: 'ajouter', date: '2026-11-11', sport: 'velo', type_seance: 'endurance', minutes: 60, justification: '  Entretien.  ' },
    { op: 'indisponibilite', type_periode: 'maladie', du: '2026-11-08', au: '2026-11-09' },
  ] }) as { ok: true; params: { operations: unknown[] } };
  assert.equal(r.ok, true);
  assert.deepEqual(r.params.operations, [
    { op: 'deplacer', seanceId: ID, vers: '2026-11-10' },
    { op: 'supprimer', seanceId: ID },
    { op: 'ajouter', proposition: { date: '2026-11-11', sport: 'velo', type: 'endurance', minutes: 60 }, justification: 'Entretien.' },
    { op: 'indisponibilite', type: 'maladie', du: '2026-11-08', au: '2026-11-09' },
  ]);
  const base = { motif: 'Test ok' };
  const mauvais: unknown[] = [
    { ...base, operations: [] },
    { ...base, operations: Array.from({ length: 9 }, () => ({ op: 'supprimer', seance_id: ID })) },
    { ...base, operations: [{ op: 'detruire', seance_id: ID }] },
    { ...base, operations: [{ op: 'supprimer', seance_id: 'abc' }] },
    { ...base, operations: [{ op: 'supprimer', seance_id: "x'; drop table activities;--" }] },
    { ...base, operations: [{ op: 'supprimer', seance_id: ID, vers: '2026-11-10' }] }, // clé en trop
    { ...base, operations: [{ op: 'deplacer', seance_id: ID }] },
    { ...base, operations: [{ op: 'deplacer', seance_id: ID, vers: '2026-02-31' }] },
    { ...base, operations: [{ op: 'ajouter', date: '2026-11-11', sport: 'golf', type_seance: 'x', minutes: 60, justification: 'a' }] },
    { ...base, operations: [{ op: 'ajouter', date: '2026-11-11', sport: 'velo', type_seance: 'endurance', minutes: 60.5, justification: 'a' }] },
    { ...base, operations: [{ op: 'ajouter', date: '2026-11-11', sport: 'velo', type_seance: 'endurance', minutes: 60 }] },
    { ...base, operations: [{ op: 'indisponibilite', type_periode: 'vacances', du: '2026-11-08', au: '2026-11-09' }] },
    { ...base, operations: 'tout supprimer' },
    { motif: '', operations: [{ op: 'supprimer', seance_id: ID }] },
  ];
  for (const m of mauvais) assert.equal(lire(m).ok, false, JSON.stringify(m)?.slice(0, 110));
});

test('lectures de l\'historique : chaque requête SQL est dans la liste fermée, et une lecture a soit une réponse du résumé, soit une requête', () => {
  for (const a of ACTIONS.filter((x) => x.niveau === 'lecture')) {
    assert.ok(a.repondre || a.requete, a.nom);
    assert.ok(!(a.repondre && a.requete), `${a.nom} : une seule source`);
    if (a.requete) assert.ok(FONCTIONS_HISTORIQUE.includes(a.requete.fonction), a.nom);
  }
  assert.deepEqual([...FONCTIONS_HISTORIQUE].sort(), ['rpc_coach_semaines', 'rpc_coach_seances'].sort());
});

test('lire_seances_periode : 92 jours exactement acceptés, 93 refusés', () => {
  const lire = (x: unknown) => trouverAction('lire_seances_periode')!.lire!(x);
  assert.equal(lire({ du: '2026-08-01', au: '2026-11-01' }).ok, true);   // 92 jours
  assert.equal(lire({ du: '2026-07-31', au: '2026-11-01' }).ok, false);  // 93 jours
});
