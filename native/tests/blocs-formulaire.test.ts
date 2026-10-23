import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deplacerBloc, formulaireBlocVide, formulaireDepuisBloc, nomDuBloc, peutAjouterBloc, validerBloc } from '../src/data/blocs-formulaire.ts';
import { NOM_TYPE, ZONES } from '../src/data/structure.ts';

test('formulaireBlocVide : des valeurs de départ sensées, valides telles quelles', () => {
  for (const metric of ['power', 'hr', 'pace'] as const) {
    for (const type of ['warmup', 'interval', 'steady', 'recovery', 'cooldown'] as const) {
      const r = validerBloc(formulaireBlocVide(type, metric));
      assert.ok(r.ok, `${type} ${metric}`);
    }
  }
  const i = validerBloc(formulaireBlocVide('interval', 'power'));
  assert.ok(i.ok);
  if (i.ok) {
    assert.equal(i.bloc.reps, 5);
    assert.equal(i.bloc.work.int, ZONES.power.bas[3]); // les efforts au seuil (Z4)
    assert.ok(i.bloc.rec);
  }
});

test('validerBloc : durées libres, zone ou pourcentage, nom nettoyé', () => {
  const f = { ...formulaireBlocVide('steady', 'power'), nom: '  Tempo   long ', travail: { duree: '1h', zone: 2, int: '', intHi: '' } };
  const r = validerBloc(f);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.bloc.name, 'Tempo long');
    assert.equal(r.bloc.work.min, 60);
    assert.equal(r.bloc.work.int, ZONES.power.bas[2]);
    assert.equal(r.bloc.work.intHi, ZONES.power.haut[2]);
    assert.equal(r.bloc.unit, 'zone');
    assert.equal(r.bloc.reps, 1);
    assert.equal(r.bloc.rec, undefined); // seul un bloc d'intervalles a une récupération
  }
  const perso = validerBloc({ ...formulaireBlocVide('steady', 'hr'), travail: { duree: '30s', zone: 'perso', int: '82,5', intHi: '' } });
  assert.ok(perso.ok);
  if (perso.ok) {
    assert.equal(perso.bloc.work.min, 0.5);
    assert.equal(perso.bloc.work.int, 82.5);
    assert.equal(perso.bloc.work.intHi, null);
    assert.equal(perso.bloc.unit, 'pct');
  }
});

test('validerBloc : les valeurs absurdes sont refusées avec un message clair', () => {
  const base = formulaireBlocVide('interval', 'power');
  const refus = (f: typeof base) => {
    const r = validerBloc(f);
    assert.equal(r.ok, false);
    return r.ok ? '' : r.erreur;
  };
  assert.match(refus({ ...base, travail: { ...base.travail, duree: '0' } }), /durée/);
  assert.match(refus({ ...base, travail: { ...base.travail, duree: 'abc' } }), /durée/);
  assert.match(refus({ ...base, travail: { ...base.travail, duree: '700' } }), /durée/);
  assert.match(refus({ ...base, reps: '0' }), /répétitions/);
  assert.match(refus({ ...base, reps: '100' }), /répétitions/);
  assert.match(refus({ ...base, reps: '2,5' }), /répétitions/);
  assert.match(refus({ ...base, travail: { duree: '4', zone: 'perso', int: '500', intHi: '' } }), /intensité/);
  assert.match(refus({ ...base, travail: { duree: '4', zone: 'perso', int: '90', intHi: '80' } }), /borne haute/);
  assert.match(refus({ ...base, travail: { duree: '4', zone: 12, int: '', intHi: '' } }), /zone/);
  assert.match(refus({ ...base, recup: { ...base.recup, duree: '' } }), /Récupération/);
  assert.match(refus({ ...base, nom: 'x'.repeat(61) }), /nom/i);
  assert.match(refus({ ...base, type: 'piratage' as 'warmup' }), /type/);
  assert.match(refus({ ...base, metric: 'vitesse' as 'power' }), /mesure/);
});

test('formulaireDepuisBloc : un bloc existant se retrouve tel quel dans son formulaire', () => {
  const origine = validerBloc({ ...formulaireBlocVide('interval', 'pace'), nom: '4 × 4 min', reps: '4' });
  assert.ok(origine.ok);
  if (!origine.ok) return;
  const retour = validerBloc(formulaireDepuisBloc(origine.bloc));
  assert.ok(retour.ok);
  if (retour.ok) assert.deepEqual(retour.bloc, origine.bloc);
  // une intensité libre aussi (virgule française comprise)
  const libre = validerBloc({ ...formulaireBlocVide('steady', 'power'), travail: { duree: '8', zone: 'perso', int: '88,5', intHi: '95' } });
  assert.ok(libre.ok);
  if (libre.ok) {
    const f = formulaireDepuisBloc(libre.bloc);
    assert.equal(f.travail.zone, 'perso');
    assert.equal(f.travail.int, '88,5');
    const encore = validerBloc(f);
    assert.ok(encore.ok);
    if (encore.ok) assert.deepEqual(encore.bloc, libre.bloc);
  }
});

test('deplacerBloc, peutAjouterBloc et nomDuBloc', () => {
  const l = ['a', 'b', 'c'];
  assert.deepEqual(deplacerBloc(l, 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(deplacerBloc(l, 1, 1), ['a', 'c', 'b']);
  assert.deepEqual(deplacerBloc(l, 0, -1), l); // au bord : rien ne bouge
  assert.deepEqual(deplacerBloc(l, 2, 1), l);
  assert.deepEqual(l, ['a', 'b', 'c']); // l'original n'est jamais modifié
  assert.equal(peutAjouterBloc(39), true);
  assert.equal(peutAjouterBloc(40), false);
  assert.equal(nomDuBloc({ name: '', type: 'warmup' }, NOM_TYPE), 'Échauffement');
  assert.equal(nomDuBloc({ name: 'Mon bloc', type: 'warmup' }, NOM_TYPE), 'Mon bloc');
});
