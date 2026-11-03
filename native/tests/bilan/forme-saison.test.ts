import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formeParSemaine, type SeanceHeures } from '../../src/data/bilan/forme-saison.ts';
import { niveauxVelo, noteDe, type SortieNiveauVelo } from '../../src/data/bilan/niveau-annees.ts';

// Un bruit fixe (pas de hasard : le test doit toujours donner le même résultat)
const BRUIT = [-4, 2, -1, 3, 0, -3, 1, 4, -2, 0];
const FC = [138, 143, 148, 153, 158, 145, 150, 140, 155, 148];
const iso = (jour: number): string => new Date(jour * 86400000).toISOString().slice(0, 10) + 'T08:00:00';
const jourDe = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400000;

/** Une sortie tous les `pas` jours entre deux dates, au niveau donné (watts à 149 bpm) ; les watts suivent le cardio (0,9 W par bpm). */
function sorties(du: string, au: string, niveau: (jour: number) => number, pas = 3, interieur = false, decalage = 0): SortieNiveauVelo[] {
  const out: SortieNiveauVelo[] = [];
  for (let j = jourDe(du), i = 0; j <= jourDe(au); j += pas, i++) {
    const fc = FC[i % 10];
    out.push({ date: iso(j), watts: niveau(j) + 0.9 * (fc - 149) + BRUIT[(i * 3) % 10] + decalage, fc, interieur });
  }
  return out;
}

const MI_2025 = jourDe('2025-07-01');
const HISTORIQUE = [...sorties('2024-01-01', '2024-12-31', () => 150), ...sorties('2025-01-01', '2025-12-31', (j) => (j < MI_2025 ? 140 : 160))];
const SERIE = niveauxVelo(HISTORIQUE);
const FIN_ANNEE = new Date(2026, 5, 1);

test('formeParSemaine : 52 semaines, la forme suit le niveau de la fenêtre de 6 semaines, sur l\'échelle de la courbe Forme', () => {
  const f = formeParSemaine(HISTORIQUE, [], SERIE, 2025, FIN_ANNEE)!;
  assert.equal(f.semaines.length, 52);
  assert.equal(f.semaines[0].debut, '2025-01-01');
  assert.equal(f.semaines[51].debut, '2025-12-24');
  // Mars : fenêtre entièrement à 140 W ; décembre : à 160 W (le meilleur trimestre)
  const mars = f.semaines[10], dec = f.semaines[50];
  const attendu = noteDe(140 / SERIE!.meilleur.niveau);
  assert.ok(Math.abs(mars.score! - attendu) < 6, `mars ${mars.score} contre ${attendu}`);
  assert.ok(dec.score! > 95, `décembre ${dec.score}`);
  assert.ok(f.semaines[f.meilleure].score! >= dec.score! - 1e-9);
  // Juillet : la fenêtre mélange les deux niveaux, la forme est entre les deux
  const juillet = f.semaines[28];
  assert.ok(juillet.score! > mars.score! && juillet.score! < dec.score!, `juillet ${juillet.score}`);
  // La marge entoure le score ; 14 sorties dans 6 semaines (une tous les 3 jours)
  for (const s of [mars, juillet, dec]) assert.ok(s.bas! <= s.score! && s.haut! >= s.score!);
  assert.ok(mars.n >= 13 && mars.n <= 15, `${mars.n}`);
});

test('formeParSemaine : moins de 3 sorties dans la fenêtre = semaine vide ; l\'année en cours s\'arrête à la semaine d\'aujourd\'hui', () => {
  // Une pause du 1er avril au 30 juin : à la mi-juin même la fenêtre élargie à 10 semaines (depuis le 16 avril) n'a plus rien
  const avecPause = HISTORIQUE.filter((s) => s.date < '2025-04-01' || s.date >= '2025-07-01');
  const f = formeParSemaine(avecPause, [], niveauxVelo(avecPause), 2025, FIN_ANNEE)!;
  assert.equal(f.semaines[24].score, null); // semaine du 18 juin : fenêtres de 6 et 10 semaines vides
  assert.equal(f.semaines[24].bas, null);
  assert.ok(f.semaines[15].score !== null);
  // Le 20 mars 2025, l'année n'a que ses 12 premières semaines
  const enCours = formeParSemaine(HISTORIQUE, [], SERIE, 2025, new Date(2025, 2, 20))!;
  assert.equal(enCours.semaines.length, 12);
  // Une année sans sortie : rien à dessiner
  assert.equal(formeParSemaine(HISTORIQUE, [], SERIE, 2019, FIN_ANNEE), null);
  assert.equal(formeParSemaine(HISTORIQUE, [], null, 2025, FIN_ANNEE), null);
});

test('formeParSemaine : le home-trainer est corrigé comme dans la courbe Forme (moins de watts à cardio égal ne veut pas dire moins en forme)', () => {
  // Même niveau toute l'année, mais l'hiver sur home-trainer à −20 W à cardio égal
  // (quelques sorties sur route l'hiver : sans elles, on ne pourrait pas séparer « home-trainer » et « hiver 2025 »)
  const route = [...sorties('2024-01-01', '2024-12-31', () => 150), ...sorties('2025-01-05', '2025-03-31', () => 150, 11), ...sorties('2025-04-01', '2025-12-31', () => 150)];
  const salle = sorties('2025-01-01', '2025-03-31', () => 150, 3, true, -20);
  const toutes = [...route, ...salle];
  const f = formeParSemaine(toutes, [], niveauxVelo(toutes), 2025, FIN_ANNEE)!;
  const fevrier = f.semaines[7].score!, septembre = f.semaines[37].score!;
  assert.ok(Math.abs(fevrier - septembre) < 8, `février ${fevrier}, septembre ${septembre}`);
});

test('formeParSemaine : les heures de vélo de chaque semaine, sans le vélo électrique ni les autres sports', () => {
  const seances: SeanceHeures[] = [
    { sport: 'Ride', start_date_local: '2025-01-02T09:00:00', moving_time: 7200 },
    { sport: 'VirtualRide', start_date_local: '2025-01-05T18:00:00', moving_time: 3600 },
    { sport: 'EBikeRide', start_date_local: '2025-01-06T10:00:00', moving_time: 3600 },
    { sport: 'Run', start_date_local: '2025-01-03T10:00:00', moving_time: 3600 },
    { sport: 'Ride', start_date_local: '2025-01-08T10:00:00', moving_time: 5400 },
    { sport: 'Ride', start_date_local: '2025-12-31T10:00:00', moving_time: 1800 }, // le 31 décembre tombe dans la dernière semaine
    { sport: 'Ride', start_date_local: '2024-12-31T10:00:00', moving_time: 9000 }, // une autre année
  ];
  const f = formeParSemaine(HISTORIQUE, seances, SERIE, 2025, FIN_ANNEE)!;
  assert.equal(f.semaines[0].heures, 3);
  assert.equal(f.semaines[1].heures, 1.5);
  assert.equal(f.semaines[51].heures, 0.5);
  assert.equal(f.semaines[20].heures, 0);
});

test('formeParSemaine : sans assez de sorties la forme est estimée (elle baisse avec la charge), en pointillé ; elle revient à la mesure à la reprise', () => {
  // Une pause du 1er avril au 30 juin ; chaque sortie du vélo a une charge de 60
  const avecPause = HISTORIQUE.filter((s) => s.date < '2025-04-01' || s.date >= '2025-07-01');
  const seances: SeanceHeures[] = avecPause.map((s) => ({ sport: 'Ride', start_date_local: s.date, moving_time: 3600, tss: 60 }));
  const f = formeParSemaine(avecPause, seances, niveauxVelo(avecPause), 2025, FIN_ANNEE)!;
  const juin = f.semaines[24]; // semaine du 18 juin : fenêtre vide
  assert.equal(juin.estimee, true);
  assert.ok(juin.score !== null && juin.bas !== null && juin.haut !== null);
  // Elle part de la dernière semaine mesurée et descend semaine après semaine
  const derniereMesuree = [...f.semaines].filter((s) => !s.estimee && s.score !== null && s.index < 24).pop()!;
  assert.ok(juin.score! < derniereMesuree.score!, `${juin.score} contre ${derniereMesuree.score}`);
  assert.ok(f.semaines[24].score! < f.semaines[19].score! || f.semaines[19].estimee);
  // Plus la pause dure, plus la marge s'élargit
  assert.ok(juin.haut! - juin.bas! > f.semaines[derniereMesuree.index].haut! - f.semaines[derniereMesuree.index].bas!);
  // La baisse reste mesurée : au plus la moitié de la note (PART_BAISSE_FORME)
  assert.ok(juin.score! >= derniereMesuree.score! * 0.5 - 1e-9);
  // À la reprise (fin juillet) on repasse sur la mesure
  assert.equal(f.semaines[31].estimee, false);
  // La meilleure semaine n'est jamais une semaine estimée
  assert.equal(f.semaines[f.meilleure].estimee, false);
  // Sans aucune charge connue (pas de séances), on ne peut rien estimer : la semaine reste vide
  const sansCharge = formeParSemaine(avecPause, [], niveauxVelo(avecPause), 2025, FIN_ANNEE)!;
  assert.equal(sansCharge.semaines[24].score, null);
  assert.equal(sansCharge.semaines[24].estimee, false);
});

test('formeParSemaine : avec peu de sorties mesurées (mais pas aucune), la fenêtre passe à 10 semaines au lieu d\'estimer', () => {
  // Une sortie mesurée tous les 20 jours : 6 semaines n'en contiennent que 2, 10 semaines en contiennent 3 ou 4
  const rares = sorties('2024-01-01', '2025-12-31', () => 150, 20);
  const seances: SeanceHeures[] = rares.map((s) => ({ sport: 'Ride', start_date_local: s.date, moving_time: 3600, tss: 60 }));
  const f = formeParSemaine(rares, seances, niveauxVelo(rares), 2025, FIN_ANNEE)!;
  const mesurees = f.semaines.filter((s) => s.score !== null && !s.estimee);
  assert.ok(mesurees.length >= 40, `${mesurees.length} semaines mesurées sur 52`);
  assert.ok(f.semaines.filter((s) => s.estimee).length <= 4);
});
