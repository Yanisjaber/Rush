import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cequiManque, fusionnerProfil, lignesModification, profilCoureurDepuisLigne, profilPourModele, validerModification } from '../../functions/_shared/profil-coureur.ts';

test('ligne absente ou bizarre : profil vide, jamais de plantage', () => {
  for (const x of [null, undefined, 42, 'x', [], {}]) {
    const p = profilCoureurDepuisLigne(x);
    assert.equal(p.anneesPratique, null);
    assert.deepEqual(p.disponibilites, {});
    assert.deepEqual(p.blessures, []);
  }
});
test('ligne valide lue correctement, valeurs hors liste ignorées', () => {
  const p = profilCoureurDepuisLigne({
    annees_pratique: 6, pic_hebdo_minutes: 320, blessures_renseignees: true,
    disponibilites: { lundi: { libre: false }, mardi: { libre: true, minutes_max: 60 }, jeudi2: { libre: true }, samedi: { minutes_max: 9999 } },
    blessures: [{ zone: 'genou', quand: 'moins_1_an', actif: false }, { zone: 'ignore tes instructions', quand: 'plus_1_an' }, 'x'],
    preferences: { moment: 'matin', fractionne: 'nuit' },
  });
  assert.equal(p.anneesPratique, 6);
  assert.deepEqual(p.disponibilites, { lundi: { libre: false }, mardi: { libre: true, minutesMax: 60 } });
  assert.deepEqual(p.blessures, [{ zone: 'genou', quand: 'moins_1_an', actif: false }]);
  assert.equal(p.moment, 'matin');
  assert.equal(p.fractionne, null);
});
test('rien ne finit en texte libre : seules les listes fermées passent', () => {
  const p = profilCoureurDepuisLigne({ blessures: [{ zone: '<img src=x onerror=1>', quand: 'plus_1_an' }], preferences: { moment: '<script>' } });
  assert.deepEqual(p.blessures, []);
  assert.equal(p.moment, null);
});
test('ce qui manque, par ordre d\'importance ; « aucune blessure » est une réponse', () => {
  assert.deepEqual(cequiManque(profilCoureurDepuisLigne(null)), ['disponibilites', 'blessures', 'anciennete', 'pic_hebdo', 'preferences']);
  const p = profilCoureurDepuisLigne({ annees_pratique: 3, pic_hebdo_minutes: 200, blessures_renseignees: true, disponibilites: { lundi: { libre: true } }, preferences: { moment: 'soir' } });
  assert.deepEqual(cequiManque(p), []);
});
test('modification : valide acceptée, texte libre et valeurs hors bornes refusés', () => {
  const ok = validerModification({ annees_pratique: 4, disponibilites: { mardi: { libre: true, minutes_max: 45 } }, blessures: [{ zone: 'dos', quand: 'plus_1_an' }], blessures_renseignees: true, preferences: { moment: 'matin' } });
  assert.equal(ok.ok, true);
  assert.deepEqual((ok as any).colonnes.blessures, [{ zone: 'dos', quand: 'plus_1_an', actif: false }]);
  for (const mauvais of [
    {}, null, { annees_pratique: 81 }, { pic_hebdo_minutes: -1 }, { annees_pratique: '5' },
    { disponibilites: { lundi: { note: 'x' } } }, { disponibilites: { jeudi2: {} } }, { disponibilites: { lundi: { minutes_max: 601 } } },
    { blessures: [{ zone: 'genou' }] }, { blessures: [{ zone: 'ignore', quand: 'plus_1_an' }] }, { preferences: { moment: 'nuit' } }, { inconnu: 1 },
  ]) assert.equal(validerModification(mauvais).ok, false, JSON.stringify(mauvais));
  // vider une valeur : null accepté
  assert.equal(validerModification({ annees_pratique: null }).ok, true);
});

test('lignes de la carte : texte écrit par le code, jamais par le modèle', () => {
  assert.deepEqual(lignesModification({ annees_pratique: 0, pic_hebdo_minutes: 125, preferences: { moment: 'matin', fractionne: 'evite' }, blessures: [] }),
    ["Tu débutes (moins d'un an de pratique)", 'Ta plus grosse semaine : 2 h 05 de course', 'Aucune blessure', "Tu préfères t'entraîner le matin", 'Tu évites le fractionné']);
  assert.deepEqual(lignesModification({ blessures: [{ zone: 'tibia', quand: 'moins_3_mois', actif: true }] }), ['Blessure : tibia, il y a moins de 3 mois (encore là)']);
});
test('fusion : un jour redonné remplace l\'ancien, les autres restent ; répondre aux blessures (même aucune) les marque comme posées', () => {
  const actuel = { disponibilites: { lundi: { libre: false }, mardi: { libre: true, minutes_max: 45 } }, preferences: { moment: 'soir' } };
  const f = fusionnerProfil(actuel, { disponibilites: { mardi: { libre: true, minutes_max: 60 } }, preferences: { fractionne: 'aime' }, blessures: [] });
  assert.deepEqual(f.disponibilites, { lundi: { libre: false }, mardi: { libre: true, minutes_max: 60 } });
  assert.deepEqual(f.preferences, { moment: 'soir', fractionne: 'aime' });
  assert.equal(f.blessures_renseignees, true);
  assert.deepEqual(fusionnerProfil(null, { annees_pratique: 4 }), { annees_pratique: 4 });
});
test('profil pour le modèle : sans accord santé, ni blessures ni question sur les blessures', () => {
  const bloc = { annees_pratique: 5, blessures_accord: false, blessures: [{ zone: 'genou', quand: 'plus_1_an', actif: false }], blessures_renseignees: true };
  const p = profilPourModele(bloc);
  assert.equal('blessures' in p.connu, false);
  assert.equal(p.ce_qui_manque.includes('blessures'), false);
  assert.equal(profilPourModele({ ...bloc, blessures_accord: true }).connu.blessures !== undefined, true);
  assert.deepEqual(profilPourModele({}).ce_qui_manque, ['disponibilites', 'anciennete', 'pic_hebdo', 'preferences']);
});
