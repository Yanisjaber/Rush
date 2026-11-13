import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formulaireCompetitionVide, formulaireSeanceVide, prevueDepuisLigne, validerCompetition, validerSeance } from '../../src/data/calendrier/ajouts.ts';
import { apercuDeGpx } from '../../src/data/calendrier/apercu-import.ts';
import { chiffresPrevue, completerAvecStructure } from '../../src/data/calendrier/prevue-detail.ts';
import { resume, type Bloc } from '../../src/data/calendrier/structure.ts';

const id = 'a1b2c3d4-0000-4000-8000-000000000001';
const libelles = (liste: { libelle: string }[]) => liste.map((c) => c.libelle);

test('chiffresPrevue : une séance donne sa durée, sa charge, sa distance et son allure prévue', () => {
  const r = validerSeance({ ...formulaireSeanceVide(), type: 'Run', duree: '75', distance: '13,5', dplus: '120', rpe: 7 }, '2026-10-29', 'Course à pied');
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = chiffresPrevue(prevueDepuisLigne(id, r.ligne));
  assert.deepEqual(libelles(c), ['Durée', 'Distance', 'Dénivelé +', 'Charge', 'Effort estimé', 'Allure prévue', 'Glucides', 'Hydratation']);
  assert.equal(c[0].valeur, '1h15');
  assert.deepEqual([c[1].valeur, c[1].unite], ['13,5', 'km']);
});

test('chiffresPrevue : seuls les chiffres renseignés sont montrés, la natation est en mètres', () => {
  const r = validerSeance({ ...formulaireSeanceVide(), type: 'Swim', duree: '40', distance: '2400' }, '2026-10-29', 'Natation');
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = chiffresPrevue(prevueDepuisLigne(id, r.ligne));
  assert.ok(!libelles(c).includes('Dénivelé +'));
  assert.ok(!libelles(c).includes('Effort estimé'));
  const dist = c.find((x) => x.cle === 'distance');
  assert.deepEqual([dist?.valeur.replace(/\s/g, ' '), dist?.unite], ['2 400', 'm']); // l'espace des milliers est insécable
});

test('chiffresPrevue : une compétition donne son temps cible, son allure cible et ses infos d\'épreuve', () => {
  const r = validerCompetition({ ...formulaireCompetitionVide(), nom: 'Semi', type: 'Run', distance: '21,1', cible: '1h35', federation: 'FFA', niveau: 'Senior', tours: '1', rpe: 9, tss: '140' }, '2027-03-07');
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = chiffresPrevue(prevueDepuisLigne(id, r.ligne));
  assert.deepEqual(libelles(c), ['Temps cible', 'Distance', 'Allure cible', 'Fédération', 'Niveau', 'Tours', 'Charge estimée', 'Effort estimé']);
  assert.equal(c[0].valeur, '1h35');
});

test('chiffresPrevue : une ligne presque vide ne montre rien plutôt que des zéros', () => {
  const vide = prevueDepuisLigne(id, { category: 'entrainement', name: '', date: '2026-10-29', start_date_local: '', sport: 'Run', duration: null, tss: null, rpe: null, km: null, d_plus: null, notes: null });
  assert.deepEqual(chiffresPrevue(vide), []);
});

test('apercuDeGpx : la trace, la zone de carte et le profil d\'altitude d\'un parcours enregistré', () => {
  const gpx = '<gpx><trk><trkseg><trkpt lat="48.85" lon="2.35"><ele>40</ele></trkpt><trkpt lat="48.86" lon="2.36"><ele>60</ele></trkpt><trkpt lat="48.87" lon="2.37"><ele>50</ele></trkpt></trkseg></trk></gpx>';
  const a = apercuDeGpx(gpx);
  assert.ok(a);
  assert.equal(a?.trace.length, 3);
  assert.equal(a?.altitudeMin, 40);
  assert.equal(a?.altitudeMax, 60);
  assert.ok(a?.region && a.region.latitudeDelta > 0);
});

test('apercuDeGpx : un fichier vide ou à un seul point ne donne pas de carte', () => {
  assert.equal(apercuDeGpx(''), null);
  assert.equal(apercuDeGpx('<gpx><trk><trkseg><trkpt lat="48.85" lon="2.35"></trkpt></trkseg></trk></gpx>'), null);
});

// --- Ce que les blocs permettent de calculer ---------------------------------------------------------------------------------
const seg = (min: number, int: number) => ({ min, int, intHi: null });
const blocsCourse: Bloc[] = [
  { type: 'warmup', name: '', reps: 1, metric: 'pace', unit: 'pct', work: seg(10, 75) },
  { type: 'interval', name: '', reps: 3, metric: 'pace', unit: 'pct', work: seg(5, 105), rec: seg(2, 70) },
  { type: 'cooldown', name: '', reps: 1, metric: 'pace', unit: 'pct', work: seg(10, 70) },
];
const prevueCourse = (extra: Record<string, unknown> = {}) =>
  ({ id, name: 'Rappel d\'allure', sport: 'Run', category: 'entrainement', date: '2026-12-10', duration: 43, tss: null, km: null, d_plus: null, rpe: null, est_watts: null, est_bpm: null, est_kj: null, structure: blocsCourse, ...extra }) as never;

test('completerAvecStructure : une allure cible et une durée donnent une distance, et donc une allure prévue', () => {
  const r = resume(blocsCourse, { allureBase: 300 }, 'Run'); // 5:00/km à 100 %
  const p = completerAvecStructure(prevueCourse(), r);
  assert.ok((p.km ?? 0) > 5 && (p.km ?? 0) < 12, `distance calculée : ${p.km}`);
  const c = chiffresPrevue(p);
  assert.ok(c.some((x) => x.cle === 'distance'));
  assert.ok(c.some((x) => x.cle === 'allure'));
});

test('completerAvecStructure : ce que la séance a déjà d\'enregistré ne change jamais', () => {
  const r = resume(blocsCourse, { allureBase: 300 }, 'Run');
  const p = completerAvecStructure(prevueCourse({ km: 7.5, tss: 80 }), r);
  assert.equal(p.km, 7.5);
  assert.equal(p.tss, 80);
});

test('completerAvecStructure : sans blocs, ou pour une compétition, la séance est rendue telle quelle', () => {
  const sans = prevueCourse({ structure: null });
  assert.equal(completerAvecStructure(sans, null), sans);
  const r = resume(blocsCourse, { allureBase: 300 }, 'Run');
  const comp = prevueCourse({ category: 'competition' });
  assert.equal(completerAvecStructure(comp, r), comp);
});

test('completerAvecStructure : des watts dans les blocs donnent une puissance et une énergie', () => {
  const blocsVelo: Bloc[] = [{ type: 'steady', name: '', reps: 1, metric: 'power', unit: 'pct', work: seg(60, 80) }];
  const r = resume(blocsVelo, { ftp: 250 }, 'Ride');
  const p = completerAvecStructure(prevueCourse({ sport: 'Ride', structure: blocsVelo, duration: 60 }), r);
  assert.equal(p.est_watts, 200);
  assert.ok((p.est_kj ?? 0) > 0);
  assert.equal(p.km, null); // pas d'allure : pas de distance inventée
});

test('chiffresPrevue : glucides à partir d\'une heure (0 en dessous), boisson à partir d\'une demi-heure, plus d\'eau quand l\'effort monte', () => {
  const faire = (duree: string, rpe: number) => {
    const r = validerSeance({ ...formulaireSeanceVide(), type: 'Run', duree, distance: '5', rpe }, '2026-10-29', 'Course à pied');
    assert.ok(r.ok);
    return r.ok ? chiffresPrevue(prevueDepuisLigne(id, r.ligne)) : [];
  };
  const courte = faire('20', 5);
  assert.ok(!courte.some((c) => c.cle === 'hydratation'));
  assert.equal(courte.find((c) => c.cle === 'glucides')?.valeur, '0');
  const moyenne = faire('45', 5);
  assert.equal(moyenne.find((c) => c.cle === 'glucides')?.valeur, '0');
  assert.equal(moyenne.find((c) => c.cle === 'hydratation')?.valeur, '500–750');
  assert.equal(faire('90', 9).find((c) => c.cle === 'hydratation')?.valeur, '600–900');
  assert.equal(faire('90', 5).find((c) => c.cle === 'glucides')?.valeur, '30–60');
  assert.equal(faire('180', 5).find((c) => c.cle === 'glucides')?.valeur, '60–90');
});

test('chiffresPrevue : un vélo sans watts ni blocs estime ses calories avec la durée, l\'effort et la FTP', () => {
  const r = validerSeance({ ...formulaireSeanceVide(), type: 'Ride', duree: '120', distance: '36', rpe: 5 }, '2026-10-29', 'Vélo');
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = chiffresPrevue(prevueDepuisLigne(id, r.ligne), null, { ftp: 250 });
  // effort 5 → intensité 0,7 ; 0,7 × 0,85 × 250 W = 149 W pendant 2 h → 1 071 kJ ≈ 1 071 kcal
  assert.equal(Number(String(c.find((x) => x.cle === 'kcal')?.valeur).replace(/\s/g, '')), 1071);
  const sansEffort = validerSeance({ ...formulaireSeanceVide(), type: 'Ride', duree: '120', distance: '36' }, '2026-10-29', 'Vélo');
  assert.ok(sansEffort.ok);
  if (sansEffort.ok) assert.ok(!chiffresPrevue(prevueDepuisLigne(id, sansEffort.ligne)).some((x) => x.cle === 'kcal'));
});
