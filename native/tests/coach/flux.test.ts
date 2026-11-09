import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decouperEvenements, lireCarte, lireCartes, viderTampon } from '../../src/data/coach/flux.ts';

const carte = { id: 'c1', etat: 'proposee', proposition: { date: '2026-11-08', sport: 'velo', type: 'endurance', minutes: 90 }, tss_estime: 75, justification: 'Pour entretenir.' };
const ligne = (e: unknown) => `data: ${JSON.stringify(e)}\n\n`;

test('découpage : plusieurs événements complets arrivent d\'un coup', () => {
  const r = decouperEvenements(ligne({ type: 'texte', delta: 'Bon' }) + ligne({ type: 'texte', delta: 'jour' }));
  assert.deepEqual(r.evenements, [{ type: 'texte', delta: 'Bon' }, { type: 'texte', delta: 'jour' }]);
  assert.equal(r.reste, '');
});

test('découpage : un événement coupé en deux morceaux est reconstitué', () => {
  const entier = ligne({ type: 'texte', delta: 'Salut' });
  const a = decouperEvenements(entier.slice(0, 12));
  assert.deepEqual(a.evenements, []);
  const b = decouperEvenements(a.reste + entier.slice(12));
  assert.deepEqual(b.evenements, [{ type: 'texte', delta: 'Salut' }]);
  // coupé pile entre les deux sauts de ligne
  const c = decouperEvenements(entier.slice(0, -1));
  assert.deepEqual(c.evenements, []);
  assert.deepEqual(decouperEvenements(c.reste + entier.slice(-1)).evenements, [{ type: 'texte', delta: 'Salut' }]);
});

test('découpage : les accents et les retours chariot (\\r\\n) passent', () => {
  const r = decouperEvenements(ligne({ type: 'texte', delta: 'Allez, à fond !' }).replace(/\n/g, '\r\n'));
  assert.deepEqual(r.evenements, [{ type: 'texte', delta: 'Allez, à fond !' }]);
});

test('découpage : une ligne cassée, de type inconnu ou mal formée est ignorée sans empêcher les suivantes', () => {
  const r = decouperEvenements(
    'data: {pas du json}\n\n' + ligne({ type: 'inconnu' }) + ligne({ type: 'texte', delta: 12 }) + ligne({ type: 'fin', message_id: 'm1' }) + ': commentaire\n\n' + ligne({ type: 'texte', delta: 'ok' }),
  );
  assert.deepEqual(r.evenements, [{ type: 'texte', delta: 'ok' }]);
});

test('découpage : fin, erreur et carte', () => {
  const r = decouperEvenements(ligne({ type: 'carte', message_id: 'm1', carte }) + ligne({ type: 'fin', message_id: 'm1', texte: 'Voilà.' }) + ligne({ type: 'erreur', code: 'plafond_jour', message: 'Reviens demain.' }));
  assert.equal(r.evenements.length, 3);
  assert.deepEqual(r.evenements[0], { type: 'carte', message_id: 'm1', carte });
  assert.deepEqual(r.evenements[1], { type: 'fin', message_id: 'm1', texte: 'Voilà.' });
  assert.deepEqual(r.evenements[2], { type: 'erreur', code: 'plafond_jour', message: 'Reviens demain.' });
});

test('une carte douteuse est écartée : mauvais état, proposition incomplète, identifiant absent', () => {
  assert.equal(lireCarte({ ...carte, etat: 'hackee' }), null);
  assert.equal(lireCarte({ ...carte, proposition: { date: '2026-11-08' } }), null);
  assert.equal(lireCarte({ ...carte, id: 3 }), null);
  assert.equal(lireCarte(null), null);
  assert.equal(lireCarte([carte]), null);
  assert.deepEqual(lireCarte({ ...carte, tss_estime: 'beaucoup' })?.tss_estime, 0);
  // une carte dans un événement mal formé n'est pas affichée
  assert.deepEqual(decouperEvenements(ligne({ type: 'carte', message_id: 'm1', carte: { ...carte, etat: 'x' } })).evenements, []);
});

test('lireCartes : une liste ou rien ; les cartes douteuses sont filtrées ; les champs en trop sont retirés', () => {
  assert.deepEqual(lireCartes(null), []);
  assert.deepEqual(lireCartes('x'), []);
  assert.deepEqual(lireCartes({ a: 1 }), []);
  const l = lireCartes([carte, { id: 'z' }, { ...carte, id: 'c2', etat: 'ajoutee', seance_id: 's1', extra: '<script>' }]);
  assert.deepEqual(l.map((c) => c.id), ['c1', 'c2']);
  assert.equal(l[1].seance_id, 's1');
  assert.equal('extra' in l[1], false);
});

test('fin du flux : un dernier événement sans sa ligne vide est quand même lu', () => {
  const r = decouperEvenements(ligne({ type: 'texte', delta: 'a' }) + 'data: {"type":"texte","delta":"b"}');
  assert.equal(r.evenements.length, 1);
  assert.deepEqual(viderTampon(r.reste), [{ type: 'texte', delta: 'b' }]);
  assert.deepEqual(viderTampon('   '), []);
  assert.deepEqual(viderTampon(''), []);
});

// ---------- La carte de planning et les actions ----------
const plan = {
  id: 'p1',
  genre: 'planning',
  etat: 'proposee',
  intention: 'Blessure au genou, 10 jours',
  operations: [{ op: 'indisponibilite', type: 'blessure', du: '2026-11-07', au: '2026-11-16' }],
  lignes: [
    { op: 'indisponibilite', texte: 'Déclarer : blessure du sam. 07/11 au lun. 16/11', type: 'blessure', du: '2026-11-07', au: '2026-11-16' },
    { op: 'supprimer', texte: 'Supprimer : course 60 min du sam. 07/11', raison: 'blessure', sport: 'course', minutes: 60, de: '2026-11-07' },
    { op: 'ajouter', texte: 'Ajouter : course Footing facile 30 min le mer. 18/11', raison: 'reprise progressive', sport: 'course', minutes: 30, vers: '2026-11-18' },
  ],
  charge_avant: 460,
  charge_apres: 100,
};

test('carte de planning : relue avec ses lignes structurées ; les opérations du serveur ne sont pas gardées', () => {
  const c = lireCarte(plan) as Record<string, unknown>;
  assert.equal(c.genre, 'planning');
  assert.equal(c.intention, 'Blessure au genou, 10 jours');
  assert.equal((c.lignes as unknown[]).length, 3);
  assert.deepEqual((c.lignes as Record<string, unknown>[])[1], { op: 'supprimer', texte: 'Supprimer : course 60 min du sam. 07/11', raison: 'blessure', sport: 'course', minutes: 60, de: '2026-11-07' });
  assert.equal(c.charge_avant, 460);
  assert.equal('operations' in c, false);
});

test('carte de planning : tout ce qui est faux ou dangereux est écarté, sans casser la carte', () => {
  const c = lireCarte({
    ...plan,
    intention: 'x'.repeat(500),
    charge_avant: 'beaucoup',
    lignes: [
      { op: 'detruire', texte: 'ligne inconnue' },
      { op: 'supprimer', texte: '' },
      { op: 'supprimer', texte: 'ok', de: '2026-02-31x', vers: 'demain', minutes: 'longtemps', type: 'vacances', sport: 'a'.repeat(100) },
      'pas un objet',
      null,
    ],
  }) as Record<string, unknown>;
  assert.equal((c.intention as string).length, 200);
  assert.equal(c.charge_avant, 0);
  const l = (c.lignes as Record<string, unknown>[]);
  assert.equal(l.length, 1);
  assert.deepEqual(Object.keys(l[0]).sort(), ['op', 'sport', 'texte']);
  assert.equal((l[0].sport as string).length, 40);
});

test('carte de planning : sans ligne lisible, mal formée ou d\'un état inconnu = pas de carte', () => {
  assert.equal(lireCarte({ ...plan, lignes: [] }), null);
  assert.equal(lireCarte({ ...plan, lignes: [{ op: 'detruire', texte: 'x' }] }), null);
  assert.equal(lireCarte({ ...plan, lignes: 'x' }), null);
  assert.equal(lireCarte({ ...plan, etat: 'inconnu' }), null);
  assert.equal(lireCarte({ ...plan, id: 5 }), null);
  assert.equal(lireCarte({ ...plan, genre: 'autre' }), null, 'sans genre « planning », c\'est une carte de séance : elle n\'a pas de proposition');
});

test('carte de planning : un plan d\'un an (300 lignes) est gardé en entier, avec la structure de chaque séance', () => {
  const lignes = Array.from({ length: 300 }, (_, i) => ({ op: 'ajouter', texte: `ligne ${i}`, sport: 'velo', vers: '2027-01-07', structure: '10 min d\'échauffement · 50 min continues' }));
  const c = lireCarte({ ...plan, lignes }) as unknown as { lignes: { structure?: string }[] };
  assert.equal(c.lignes.length, 300);
  assert.equal(c.lignes[0].structure, '10 min d\'échauffement · 50 min continues');
});

test('carte de planning annulée : le bilan de l\'annulation est relu seulement s\'il est complet', () => {
  assert.deepEqual((lireCarte({ ...plan, etat: 'annulee', annulation: { annulees: 3, ignorees: 1 } }) as Record<string, unknown>).annulation, { annulees: 3, ignorees: 1 });
  assert.equal('annulation' in (lireCarte({ ...plan, annulation: { annulees: 3 } }) as Record<string, unknown>), false);
});

test('les cartes de séance continuent de passer, mélangées aux plans dans un même message', () => {
  const cartes = lireCartes([carte, plan, { id: 'z' }, plan]);
  assert.equal(cartes.length, 3);
  assert.equal((cartes[0] as Record<string, unknown>).genre, undefined);
  assert.equal((cartes[1] as Record<string, unknown>).genre, 'planning');
});

test('flux : une carte de planning arrive comme les autres', () => {
  const r = decouperEvenements(ligne({ type: 'carte', message_id: 'm1', carte: plan }));
  assert.equal(r.evenements.length, 1);
  assert.equal(r.evenements[0].type, 'carte');
});

test('flux : une action est relue (nom et paramètres), une action mal formée est ignorée', () => {
  const r = decouperEvenements(
    ligne({ type: 'action', nom: 'ouvrir_ecran', params: { ecran: 'calendrier' } }) +
      ligne({ type: 'action', nom: 'ouvrir_ecran' }) +
      ligne({ type: 'action', nom: 42, params: {} }) +
      ligne({ type: 'action', nom: 'x', params: [1, 2] }),
  );
  assert.deepEqual(r.evenements, [{ type: 'action', nom: 'ouvrir_ecran', params: { ecran: 'calendrier' } }]);
});

test('plan : une ligne de repos est gardée (le jour est dans « vers », « poser » vrai ou faux), pas écartée', () => {
  const c = lireCarte({ ...plan, lignes: [
    { op: 'repos', texte: 'Poser un jour de repos : jeu. 12/11', vers: '2026-11-12', poser: true },
    { op: 'repos', texte: 'Retirer le jour de repos : ven. 13/11', vers: '2026-11-13', poser: false },
    { op: 'repos', texte: 'Poser un jour de repos : sam. 14/11', vers: '2026-11-14', poser: 'oui' },
  ] }) as Record<string, unknown>;
  const l = c.lignes as Record<string, unknown>[];
  assert.equal(l.length, 3);
  assert.deepEqual(l[0], { op: 'repos', texte: 'Poser un jour de repos : jeu. 12/11', vers: '2026-11-12', poser: true });
  assert.equal(l[1].poser, false);
  assert.equal('poser' in l[2], false, 'un « poser » qui n\'est pas un booléen est ignoré');
});

// ---------- La structure des séances (blocs) ----------
import { lireBlocs, lireCarte as lireCarteBlocs } from '../../src/data/coach/flux.ts';

const SEG = { min: 10, int: 60, intHi: 75 };
const BLOC_OK = { type: 'warmup', name: 'Échauffement', reps: 1, metric: 'pace', unit: 'zone', work: SEG };

test('blocs : une structure valide est gardée telle quelle, une absente donne rien', () => {
  assert.deepEqual(lireBlocs([BLOC_OK]), [BLOC_OK]);
  assert.equal(lireBlocs(undefined), undefined);
  assert.equal(lireBlocs([]), undefined);
});
test('blocs : un seul bloc douteux et toute la structure est écartée (le profil ne s\'affiche pas)', () => {
  assert.equal(lireBlocs([BLOC_OK, { ...BLOC_OK, type: 'inconnu' }]), undefined);
  assert.equal(lireBlocs([{ ...BLOC_OK, reps: 0 }]), undefined);
  assert.equal(lireBlocs([{ ...BLOC_OK, reps: 1.5 }]), undefined);
  assert.equal(lireBlocs([{ ...BLOC_OK, work: { ...SEG, min: -3 } }]), undefined);
  assert.equal(lireBlocs([{ ...BLOC_OK, work: { ...SEG, min: 'dix' } }]), undefined);
  assert.equal(lireBlocs([{ ...BLOC_OK, rec: { min: 'x' } }]), undefined);
  assert.equal(lireBlocs(Array.from({ length: 21 }, () => BLOC_OK)), undefined);
});
test('une carte séance et une ligne de plan gardent leurs blocs ; sans blocs valides, la carte reste lisible', () => {
  const seance = { id: 'c1', etat: 'proposee', proposition: { date: '2026-11-12', sport: 'course', type: 'fractionne', minutes: 10 }, tss_estime: 20, justification: 'ok', blocs: [BLOC_OK] };
  assert.deepEqual((lireCarteBlocs(seance) as { blocs?: unknown }).blocs, [BLOC_OK]);
  assert.equal((lireCarteBlocs({ ...seance, blocs: [{ type: 'x' }] }) as { blocs?: unknown }).blocs, undefined);
  const plan = { id: 'p1', genre: 'planning', etat: 'proposee', intention: 'x', charge_avant: 1, charge_apres: 2, lignes: [{ op: 'ajouter', texte: 'Ajouter', sport: 'course', minutes: 10, vers: '2026-11-12', nom: '6 × 800 m', blocs: [BLOC_OK] }] };
  const l = (lireCarteBlocs(plan) as { lignes: { nom?: string; blocs?: unknown }[] }).lignes[0];
  assert.equal(l.nom, '6 × 800 m');
  assert.deepEqual(l.blocs, [BLOC_OK]);
});
