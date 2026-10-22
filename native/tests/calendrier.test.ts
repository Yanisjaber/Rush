import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bornesGrille, chargeJour, chargeSeance, decalerMois, grilleMois, jourAffiche, jourVide, nomJour, resumeSemaine, teinteJour, titreMois } from '../src/data/calendrier.ts';
import { couleurNote, libelleNote, notesDuJour } from '../src/data/annotations.ts';
import { annotationsDemo, donneesDemo } from '../src/data/demo.ts';
import type { Note, Prevue, Seance } from '../src/data/types.ts';

const auj = new Date(2026, 9, 19); // lundi 19 octobre 2026

test('titreMois : mois en français et année', () => {
  assert.equal(titreMois(2026, 9), 'octobre 2026');
  assert.equal(titreMois(2026, 1), 'février 2026');
  assert.equal(titreMois(2027, 11), 'décembre 2027');
});

test('decalerMois : passe d\'une année à l\'autre dans les deux sens', () => {
  assert.deepEqual(decalerMois(2026, 11, 1), { annee: 2027, mois: 0 });
  assert.deepEqual(decalerMois(2026, 0, -1), { annee: 2025, mois: 11 });
  assert.deepEqual(decalerMois(2026, 5, 1), { annee: 2026, mois: 6 });
});

test('bornesGrille : de lundi à dimanche, en débordant sur les mois voisins', () => {
  // octobre 2026 : le 1er est un jeudi, le 31 un samedi
  assert.deepEqual(bornesGrille(2026, 9), { debut: '2026-09-28', fin: '2026-11-01' });
  // février 2027 : le 1er est un lundi, le 28 un dimanche : pile 4 semaines
  assert.deepEqual(bornesGrille(2027, 1), { debut: '2027-02-01', fin: '2027-02-28' });
});

test('grilleMois : des semaines de 7 jours, de lundi à dimanche, aujourd\'hui marqué', () => {
  const g = grilleMois(2026, 9, {}, auj);
  assert.equal(g.titre, 'octobre 2026');
  assert.ok(g.semaines.every((s) => s.length === 7));
  assert.equal(g.semaines.length, 5);
  assert.equal(g.semaines[0][0].iso, '2026-09-28');
  assert.equal(g.semaines[0][0].dansMois, false);
  const aujourdhui = g.semaines.flat().filter((j) => j.aujourdhui);
  assert.equal(aujourdhui.length, 1);
  assert.equal(aujourdhui[0].iso, '2026-10-19');
  assert.equal(aujourdhui[0].futur, false);
  assert.equal(g.semaines.flat().find((j) => j.iso === '2026-10-20')?.futur, true);
});

test('grilleMois : range séances, séances prévues, objectifs, notes et repos dans le bon jour', () => {
  const seance = { id: 's', sport: 'Run', start_date_local: '2026-10-14T18:00:00+00:00' } as Seance;
  const prevue = { id: 'p', date: '2026-10-21', sport: 'Ride' } as Prevue;
  const objectif = { id: 'o', date: '2026-10-25', sport: 'Run' } as Prevue;
  const note = { id: 'n', type: 'texte', text: 'x', color: null, from_date: '2026-10-10', to_date: '2026-10-12' } as Note;
  const g = grilleMois(2026, 9, { seances: [seance], planifiees: [prevue], objectifs: [objectif], notes: [note], repos: ['2026-10-05', { iso_date: '2026-10-06' }] }, auj);
  const jour = (iso: string) => g.semaines.flat().find((j) => j.iso === iso)!;
  assert.equal(jour('2026-10-14').seances.length, 1);
  assert.equal(jour('2026-10-21').planifiees.length, 1);
  assert.equal(jour('2026-10-25').objectifs.length, 1);
  assert.equal(jour('2026-10-11').notes.length, 1); // la note couvre trois jours
  assert.equal(jour('2026-10-13').notes.length, 0);
  assert.equal(jour('2026-10-05').repos, true);
  assert.equal(jour('2026-10-06').repos, true);
  assert.equal(jour('2026-10-07').repos, false);
});

test('grilleMois : fonctionne sur les 36 mois autour d\'aujourd\'hui, sans semaine hors du mois', () => {
  for (let annee = 2025; annee <= 2027; annee++) {
    for (let mois = 0; mois < 12; mois++) {
      const g = grilleMois(annee, mois, {}, auj);
      assert.ok(g.semaines.length >= 4 && g.semaines.length <= 6, `${annee}-${mois}`);
      assert.ok(g.semaines.every((s) => s.some((j) => j.dansMois)), `${annee}-${mois} : une semaine entièrement hors du mois`);
      assert.equal(g.semaines.flat().filter((j) => j.dansMois).length, new Date(annee, mois + 1, 0).getDate());
    }
  }
});

test('jourVide et jourAffiche : les jours vides sont masqués, sauf aujourd\'hui ; hors du mois, seulement avec une séance', () => {
  const g = grilleMois(2026, 9, { seances: [{ id: 's', sport: 'Run', start_date_local: '2026-09-30T18:00:00+00:00' } as Seance], repos: ['2026-09-29'] }, auj);
  const jour = (iso: string) => g.semaines.flat().find((j) => j.iso === iso)!;
  assert.equal(jourVide(jour('2026-10-07')), true);
  assert.equal(jourAffiche(jour('2026-10-07')), false);
  assert.equal(jourAffiche(jour('2026-10-19')), true); // aujourd'hui, même vide
  assert.equal(jourAffiche(jour('2026-09-30')), true); // hors du mois mais avec une séance
  assert.equal(jourAffiche(jour('2026-09-29')), false); // hors du mois, seulement un repos
});

test('nomJour : lundi à dimanche', () => {
  assert.equal(nomJour('2026-10-19'), 'Lun');
  assert.equal(nomJour('2026-10-25'), 'Dim');
  assert.equal(nomJour('2026-10-22'), 'Jeu');
});

test('notesDuJour, couleurNote, libelleNote', () => {
  const notes = [{ id: 'a', type: 'texte', text: 'Mot', color: '#60a5fa', from_date: '2026-10-02', to_date: '2026-10-05' }] as Note[];
  assert.equal(notesDuJour(notes, '2026-10-02').length, 1);
  assert.equal(notesDuJour(notes, '2026-10-05').length, 1);
  assert.equal(notesDuJour(notes, '2026-10-06').length, 0);
  assert.deepEqual(notesDuJour(null, '2026-10-02'), []);
  assert.equal(couleurNote('#fb923c'), '#fb923c');
  assert.equal(couleurNote('rouge'), '#60a5fa'); // une couleur venue de la base n'est utilisée que si c'est un #rrggbb
  assert.equal(couleurNote(null), '#60a5fa');
  assert.equal(couleurNote('url(javascript:1)'), '#60a5fa');
  assert.equal(libelleNote({ type: 'blessure', text: null }), 'Blessure');
  assert.equal(libelleNote({ type: 'texte', text: 'Mot' }), 'Mot');
  assert.equal(libelleNote({ type: 'texte', text: null }), 'Note');
});

test('démo : octobre 2026 contient des séances, la blessure et deux repos', () => {
  const d = donneesDemo(auj);
  const a = annotationsDemo(auj);
  const g = grilleMois(2026, 9, { seances: d.seances, planifiees: d.planifiees.filter((p) => p.category !== 'competition'), notes: a.notes, repos: a.repos }, auj);
  const jours = g.semaines.flat();
  assert.ok(jours.some((j) => j.seances.length));
  assert.ok(jours.some((j) => j.notes.length));
  assert.equal(jours.filter((j) => j.repos).length, 2);
});

const seanceCal = (id: string, jour: string, sport: string, minutes: number, tss: number | null): Seance => ({
  id, name: id, sport, start_date_local: `${jour}T08:00:00`, moving_time: minutes * 60, distance_km: null,
  total_elevation_gain: null, avg_heartrate: null, ftp_at_time: null, avg_watts: null, np: null, tss, category: 'workout',
});
const prevueCal = (id: string, jour: string, minutes: number | null): Prevue => ({ id, name: id, date: jour, sport: 'Run', duration: minutes, tss: null, category: 'entrainement', km: null });
const jourDe = (g: ReturnType<typeof grilleMois>, iso: string) => g.semaines.flat().find((j) => j.iso === iso)!;

test('chargeSeance : les points de la séance, sinon une estimation par la durée', () => {
  assert.equal(chargeSeance(seanceCal('a', '2026-10-14', 'Run', 60, 70)), 70);
  assert.equal(chargeSeance(seanceCal('b', '2026-10-14', 'Run', 60, null)), 42); // 0,7 point par minute
});

test('teinteJour : la couleur du sport de la séance la plus chargée, la force selon la charge du jour ; rien sans séance faite', () => {
  const g = grilleMois(2026, 9, {
    seances: [seanceCal('muscu', '2026-10-14', 'WeightTraining', 60, 30), seanceCal('velo', '2026-10-14', 'Ride', 90, 120), seanceCal('course', '2026-10-15', 'Run', 40, 45)],
    planifiees: [prevueCal('p', '2026-10-16', 50)],
  }, auj);
  const t = teinteJour(jourDe(g, '2026-10-14'));
  assert.equal(t?.famille, 'velo');
  assert.equal(t?.force, 1); // 150 points : une grosse journée
  assert.equal(teinteJour(jourDe(g, '2026-10-15'))?.force, 0.3);
  assert.equal(teinteJour(jourDe(g, '2026-10-16')), null); // une séance seulement prévue ne teinte pas
  assert.equal(teinteJour(jourDe(g, '2026-10-17')), null);
});

test('resumeSemaine : le temps fait, le temps prévu et la charge de la semaine', () => {
  const g = grilleMois(2026, 9, {
    seances: [seanceCal('a', '2026-10-19', 'Run', 60, 70), seanceCal('b', '2026-10-21', 'Ride', 90, null)],
    planifiees: [prevueCal('p1', '2026-10-23', 55), prevueCal('p2', '2026-10-24', 180), prevueCal('p3', '2026-10-25', null)],
  }, auj);
  const semaine = g.semaines.find((s) => s.some((j) => j.iso === '2026-10-19'))!;
  assert.deepEqual(resumeSemaine(semaine), { faites: 150 * 60, prevues: 235 * 60, charge: 133 }); // 70 + 63 (90 min estimées)
  assert.equal(chargeJour(jourDe(g, '2026-10-19')), 70);
  // Une semaine sans rien : des zéros
  assert.deepEqual(resumeSemaine(g.semaines[0]), { faites: 0, prevues: 0, charge: 0 });
});

