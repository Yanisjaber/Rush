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
    assert.ok(['lecture', 'direct', 'ecriture', 'carte', 'confirmation'].includes(a.niveau), a.nom);
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
  assert.deepEqual(ACTIONS.filter((x) => x.niveau === 'ecriture').map((x) => x.nom), ['retenir_profil'], 'seul le profil s\'écrit sans carte');
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
    { motif: 'ok ok', jours_bloques: Array.from({ length: 401 }, (_, i) => new Date(Date.UTC(2026, 10, 10 + i)).toISOString().slice(0, 10)) },
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
    { ...base, operations: Array.from({ length: 201 }, () => ({ op: 'supprimer', seance_id: ID })) },
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
  assert.deepEqual([...FONCTIONS_HISTORIQUE].sort(), [
    'rpc_coach_semaines', 'rpc_coach_seances', 'rpc_coach_prevues', 'rpc_coach_force', 'rpc_coach_hyrox',
    'rpc_coach_objectifs', 'rpc_coach_fiche', 'rpc_coach_sante', 'rpc_courbe_course', 'rpc_courbe_puissance',
  ].sort());
});

test('lire_seances_periode : 400 jours exactement acceptés, 401 refusés', () => {
  const lire = (x: unknown) => trouverAction('lire_seances_periode')!.lire!(x);
  assert.equal(lire({ du: '2025-09-27', au: '2026-11-01' }).ok, true);   // 400 jours
  assert.equal(lire({ du: '2025-09-26', au: '2026-11-01' }).ok, false);  // 401 jours
});

test('planifier_semaine : une demande valide est lue et nettoyée, le reste est refusé avec la raison', () => {
  const lire = (x: unknown) => trouverAction('planifier_semaine')!.lire!(x);
  const ok = lire({ motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2 }, { sport: 'course', seances: 3 }], debut: '2026-11-09', jours: 7, jours_libres: ['2026-11-10', '2026-11-10'], intensite: 'facile' });
  assert.deepEqual(ok, { ok: true, params: { intention: 'Ma semaine', demande: { sports: [{ sport: 'velo', seances: 2 }, { sport: 'course', seances: 3 }], debut: '2026-11-09', jours: 7, joursLibres: ['2026-11-10'], intensite: 'facile' } } });
  assert.deepEqual(lire({ motif: 'Ma semaine', sports: [{ sport: 'course', seances: 1 }] }), { ok: true, params: { intention: 'Ma semaine', demande: { sports: [{ sport: 'course', seances: 1 }] } } });
  const mauvais: unknown[] = [
    { motif: 'Ma semaine' },
    { motif: 'Ma semaine', sports: [] },
    { motif: 'Ma semaine', sports: [{ sport: 'golf', seances: 2 }] },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 0 }] },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 7 }] },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2.5 }] },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2 }, { sport: 'velo', seances: 1 }] },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2, extra: 1 }] },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2 }], debut: 'demain' },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2 }], jours: 15 },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2 }], jours_libres: ['2026-02-31'] },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2 }], jours_libres: Array.from({ length: 401 }, (_, i) => new Date(Date.UTC(2026, 10, 10 + i)).toISOString().slice(0, 10)) },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2 }], intensite: 'extreme' },
    { motif: '', sports: [{ sport: 'velo', seances: 2 }] },
    { motif: 'Ma semaine', sports: [{ sport: 'velo', seances: 2 }], clef: 1 },
    null,
  ];
  for (const m of mauvais) assert.equal(lire(m).ok, false, JSON.stringify(m)?.slice(0, 100));
});

test('modifier_planning : l\'opération « repos » est lue (poser par défaut, retirer avec poser: false) et strictement vérifiée', () => {
  const lire = (op: unknown) => trouverAction('modifier_planning')!.lire!({ motif: 'Repos', operations: [op] }) as { ok: boolean; params?: { operations: unknown[] } };
  assert.deepEqual(lire({ op: 'repos', date: '2026-11-12' }).params?.operations, [{ op: 'repos', date: '2026-11-12', poser: true }]);
  assert.deepEqual(lire({ op: 'repos', date: '2026-11-12', poser: false }).params?.operations, [{ op: 'repos', date: '2026-11-12', poser: false }]);
  for (const mauvais of [{ op: 'repos' }, { op: 'repos', date: 'jeudi' }, { op: 'repos', date: '2026-02-31' }, { op: 'repos', date: '2026-11-12', poser: 'oui' }, { op: 'repos', date: '2026-11-12', extra: 1 }]) {
    assert.equal(lire(mauvais).ok, false, JSON.stringify(mauvais));
  }
});

test('planifier_periode : durée en semaines ou date de course (pas les deux, pas aucune), le reste est vérifié', () => {
  const lire = (x: unknown) => trouverAction('planifier_periode')!.lire!(x);
  const sports = [{ sport: 'course', seances: 3 }];
  assert.deepEqual(lire({ motif: 'Marathon', sports, objectif: '2027-04-12' }), { ok: true, params: { intention: 'Marathon', demande: { sports, objectif: '2027-04-12' } } });
  assert.deepEqual(lire({ motif: 'Un an', sports, semaines: 52, intensite: 'facile', debut: '2026-11-09' }), { ok: true, params: { intention: 'Un an', demande: { sports, semaines: 52, debut: '2026-11-09', intensite: 'facile' } } });
  const mauvais: unknown[] = [
    { motif: 'Marathon', sports },
    { motif: 'Marathon', sports, semaines: 4, objectif: '2027-04-12' },
    { motif: 'Marathon', sports, semaines: 0 },
    { motif: 'Marathon', sports, semaines: 61 },
    { motif: 'Marathon', sports, objectif: '2027-02-31' },
    { motif: 'Marathon', sports: [], semaines: 4 },
    { motif: 'Marathon', sports, semaines: 4, clef: 1 },
    null,
  ];
  for (const m of mauvais) assert.equal(lire(m).ok, false, JSON.stringify(m)?.slice(0, 90));
});

test('preparer_course : tout est facultatif sauf le motif ; valeurs vérifiées', () => {
  const lire = (x: unknown) => trouverAction('preparer_course')!.lire!(x);
  assert.deepEqual(lire({ motif: 'Mon 10 km' }), { ok: true, params: { intention: 'Mon 10 km', demande: {} } });
  assert.deepEqual(lire({ motif: 'Mon 10 km', date: '2026-12-13', km: 10.15, temps_cible_minutes: 45, seances_par_semaine: 4 }), { ok: true, params: { intention: 'Mon 10 km', demande: { date: '2026-12-13', km: 10.15, tempsCibleMinutes: 45, seancesParSemaine: 4 } } });
  const mauvais: unknown[] = [{}, { motif: 'x' }, { motif: 'Mon 10 km', date: '2026-02-31' }, { motif: 'Mon 10 km', km: 0 }, { motif: 'Mon 10 km', km: '10' }, { motif: 'Mon 10 km', temps_cible_minutes: 2 }, { motif: 'Mon 10 km', seances_par_semaine: 7 }, { motif: 'Mon 10 km', clef: 1 }, null];
  for (const m of mauvais) assert.equal(lire(m).ok, false, JSON.stringify(m)?.slice(0, 80));
});

test('preparer_course avec allures et ajuster_seance_course : lecture stricte', () => {
  const lire = (nom: string, x: unknown) => trouverAction(nom)!.lire!(x);
  assert.deepEqual((lire('preparer_course', { motif: 'Plan ajusté', allures: { vma: '4:30', tempo: "4'50" } }) as { params: { demande: unknown } }).params.demande, { allures: { vma: 270, tempo: 290 } });
  for (const m of [{ allures: {} }, { allures: { vma: '4:99' } }, { allures: { turbo: '4:30' } }, { allures: 'vite' }]) assert.equal(lire('preparer_course', { motif: 'Plan ajusté', ...m }).ok, false, JSON.stringify(m));
  const ok = lire('ajuster_seance_course', { motif: 'Jeudi plus court', date: '2026-11-19', genre: 'intervalles', reps: 5, metres: 600, allure: '4:30', recup_secondes: 90 });
  assert.deepEqual(ok, { ok: true, params: { intention: 'Jeudi plus court', seance: { date: '2026-11-19', genre: 'intervalles', reps: 5, metres: 600, allure: 270, recupSecondes: 90 } } });
  const mauvais: unknown[] = [
    {}, { motif: 'Jeudi plus court' }, { motif: 'Jeudi plus court', date: '2026-11-19' },
    { motif: 'Jeudi plus court', date: '2026-11-19', genre: 'intervalles' }, // sans reps ni metres
    { motif: 'Jeudi plus court', date: '2026-11-19', genre: 'footing' }, // sans minutes
    { motif: 'Jeudi plus court', date: '2026-11-19', genre: 'sprint', minutes: 30 },
    { motif: 'Jeudi plus court', date: '2026-02-31', genre: 'footing', minutes: 30 },
    { motif: 'Jeudi plus court', date: '2026-11-19', genre: 'footing', minutes: 5 },
    { motif: 'Jeudi plus court', date: '2026-11-19', genre: 'footing', minutes: 30, allure: 'lent' },
    { motif: 'Jeudi plus court', date: '2026-11-19', genre: 'footing', minutes: 30, clef: 1 },
    null,
  ];
  for (const m of mauvais) assert.equal(lire('ajuster_seance_course', m).ok, false, JSON.stringify(m)?.slice(0, 90));
});

test('ajuster_seance : lecture stricte (vélo et natation, intervalles ou continu)', () => {
  const lire = (x: unknown) => trouverAction('ajuster_seance')!.lire!(x);
  const base = { motif: 'Jeudi au seuil', date: '2026-11-19', sport: 'velo', zone: 4 };
  assert.deepEqual(lire({ ...base, genre: 'intervalles', reps: 4, minutes_travail: 8, minutes_recup: 3 }), { ok: true, params: { intention: 'Jeudi au seuil', seance: { date: '2026-11-19', sport: 'velo', genre: 'intervalles', zone: 4, reps: 4, minutesTravail: 8, minutesRecup: 3 } } });
  assert.deepEqual(lire({ ...base, sport: 'natation', genre: 'continu', minutes: 45 }), { ok: true, params: { intention: 'Jeudi au seuil', seance: { date: '2026-11-19', sport: 'natation', genre: 'continu', zone: 4, minutes: 45 } } });
  const mauvais: unknown[] = [
    null, {}, base,
    { ...base, genre: 'intervalles' }, // sans reps ni durées
    { ...base, genre: 'intervalles', reps: 4, minutes_travail: 8 }, // sans récupération
    { ...base, genre: 'intervalles', reps: 4, minutes_travail: 8, minutes_recup: 3, minutes: 30 }, // mélange des deux genres
    { ...base, genre: 'continu' }, // sans durée
    { ...base, genre: 'continu', minutes: 5 },
    { ...base, genre: 'continu', minutes: 30, reps: 4 },
    { ...base, genre: 'continu', minutes: 30, zone: 6 },
    { ...base, genre: 'continu', minutes: 30, sport: 'course' }, // la course a son propre outil
    { ...base, genre: 'continu', minutes: 30, date: '2026-02-31' },
    { ...base, genre: 'continu', minutes: 30, clef: 1 },
  ];
  for (const m of mauvais) assert.equal(lire(m).ok, false, JSON.stringify(m)?.slice(0, 90));
});

test('lecture des données de l\'athlète : les nouveaux outils vérifient leurs paramètres (liste blanche, bornes)', () => {
  const lire = (nom: string, x: unknown) => trouverAction(nom)!.lire!(x);
  for (const nom of ['lire_seances_prevues', 'lire_force', 'lire_sante_periode']) {
    assert.equal(lire(nom, { du: '2026-11-01', au: '2026-11-30' }).ok, true, nom);
    assert.equal(lire(nom, { du: '2025-09-26', au: '2026-11-01' }).ok, false, `${nom} : 401 jours`);
    assert.equal(lire(nom, { du: '2026-11-30', au: '2026-11-01' }).ok, false, `${nom} : à l'envers`);
    assert.equal(lire(nom, { du: '2026-11-01', au: '2026-11-30', sql: 'drop table x' }).ok, false, `${nom} : clé en trop`);
  }
  assert.equal(lire('lire_records_course', { distance_m: 10000 }).ok, true);
  assert.equal(lire('lire_records_course', { distance_m: 7777 }).ok, false);
  assert.equal(lire('lire_records_course', { distance_m: 5000, nb: 11 }).ok, false);
  assert.equal(lire('lire_records_velo', { duree_s: 1200 }).ok, true);
  assert.equal(lire('lire_records_velo', { duree_s: 0 }).ok, false);
  assert.equal(lire('lire_records_velo', { duree_s: 1200, du: 'hier' }).ok, false);
  assert.equal(lire('lire_hyrox', {}).ok, true);
  assert.equal(lire('lire_hyrox', { nb: 50 }).ok, false);
  for (const nom of ['lire_objectifs', 'lire_fiche_athlete']) {
    assert.equal(lire(nom, {}).ok, true, nom);
    assert.equal(lire(nom, { user_id: ID }).ok, false, `${nom} : jamais d'identifiant d'utilisateur`);
  }
});

test('lecture des données de l\'athlète : la santé ne part vers SQL qu\'avec les catégories autorisées, et aucun outil ne prend d\'identifiant d\'utilisateur', () => {
  const sante = ['ressenti'];
  const fiche = trouverAction('lire_fiche_athlete')!.requete!.args({}, '2026-11-12', sante);
  assert.deepEqual(fiche, { p_sante: ['ressenti'] });
  const hist = trouverAction('lire_sante_periode')!.requete!.args({ du: '2026-11-01', au: '2026-11-30' }, '2026-11-12', sante);
  assert.deepEqual(hist, { p_du: '2026-11-01', p_au: '2026-11-30', p_sante: ['ressenti'], p_limite: 200 });
  for (const a of ACTIONS.filter((x) => x.requete)) {
    const props = Object.keys((a.schema as { properties: Record<string, unknown> }).properties);
    assert.ok(!props.some((k) => /user|uid|compte/i.test(k)), `${a.nom} : pas d'identifiant d'utilisateur`);
  }
});
