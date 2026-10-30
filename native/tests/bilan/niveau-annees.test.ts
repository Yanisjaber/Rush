import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niveauxCourse, niveauxVelo, serieRecord, type SortieNiveauCourse, type SortieNiveauVelo } from '../../src/data/bilan/niveau-annees.ts';
import { axeScore, debutsAnnees, ecartAuSommet, formatMarge, formatNiveau, libellePeriode, pointsDepuis, positionsNiveau, recordsDeCourbe, reperesAnnees, segmentsContinus } from '../../src/data/bilan/niveau-annees-affichage.ts';

// Un bruit fixe (pas de hasard : le test doit toujours donner le même résultat)
const BRUIT = [-6, 3, -2, 5, 0, -4, 2, 4, -3, 1];
const FC = [138, 143, 148, 153, 158, 145, 150, 140, 155, 148];
const date = (an: number, mois: number, jour = 10): string => `${an}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}T08:00:00`;

/** `parTrimestre` sorties par trimestre à un niveau donné (watts à 149 bpm, sur route) ; les watts suivent le cardio (0,9 W par bpm). */
function annee(an: number, niveau: number, parTrimestre = 10, trimestres = [1, 2, 3, 4]): SortieNiveauVelo[] {
  const sorties: SortieNiveauVelo[] = [];
  for (const t of trimestres) {
    for (let i = 0; i < parTrimestre; i++) {
      const fc = FC[(i + t) % 10];
      sorties.push({ date: date(an, (t - 1) * 3 + 1 + (i % 3), 1 + i * 2), watts: niveau + 0.9 * (fc - 149) + BRUIT[(i * 3 + t) % 10], fc, interieur: false });
    }
  }
  return sorties;
}

test('niveauxVelo : le niveau de chaque année, le score (100 = meilleur) et l\'année la plus récente', () => {
  const serie = niveauxVelo([...annee(2023, 140), ...annee(2024, 160), ...annee(2025, 150)]);
  assert.ok(serie);
  assert.deepEqual(serie.annuel.map((p) => p.cle), ['2023', '2024', '2025']);
  assert.ok(Math.abs(serie.annuel[0].niveau - 140) < 4, `2023 : ${serie.annuel[0].niveau}`);
  assert.ok(Math.abs(serie.annuel[1].niveau - 160) < 4);
  assert.ok(Math.abs(serie.annuel[2].niveau - 150) < 4);
  // Le sommet est un trimestre de 2024 : l'année 2024 est donc tout près de 100. L'échelle va de 100 (le meilleur) à 0 (30 % en dessous) :
  // 2023 est à 87,5 % du meilleur, donc vers 58 ; 2025 à 93,7 %, donc vers 79
  assert.equal(serie.meilleur.an, 2024);
  assert.equal(serie.meilleur.score, 100);
  assert.ok(serie.annuel[1].score > 85 && serie.annuel[1].score <= 100);
  assert.ok(Math.abs(serie.annuel[0].score - 58) < 12, `2023 : ${serie.annuel[0].score}`);
  assert.ok(Math.abs(serie.annuel[2].score - 79) < 12, `2025 : ${serie.annuel[2].score}`);
  assert.ok(serie.annuel[0].score < serie.annuel[2].score && serie.annuel[2].score < serie.annuel[1].score);
  assert.equal(serie.actuel.an, 2025);
  assert.equal(serie.tranchesParAn, 4);
  assert.equal(serie.tranches.length, 12);
  assert.ok(ecartAuSommet(serie) > 10 && ecartAuSommet(serie) < 35, `écart ${ecartAuSommet(serie)}`);
  assert.ok(serie.annuel.every((p) => p.bas <= p.score && p.haut >= p.score - 0.01));
});

test('niveauxVelo : un cardio plus haut une année ne passe pas pour un meilleur niveau', () => {
  // Même niveau (150 W à 149 bpm) les deux années, mais 2025 se fait à 12 bpm de plus : ses watts sont plus hauts, pas la forme
  const a = annee(2024, 150);
  const b = annee(2025, 150).map((s) => ({ ...s, fc: s.fc + 12, watts: s.watts + 0.9 * 12 }));
  const serie = niveauxVelo([...a, ...b]);
  assert.ok(serie);
  assert.ok(Math.abs(serie.annuel[0].niveau - serie.annuel[1].niveau) < 5, `${serie.annuel[0].niveau} contre ${serie.annuel[1].niveau}`);
});

test('niveauxVelo : le home-trainer est compté à part', () => {
  // À cardio égal, 14 W de moins en salle. 2024 : surtout dehors ; 2025 : moitié en salle. Même niveau sur route.
  const dehors = annee(2024, 160);
  const mixte = annee(2025, 160).map((s, i) => (i % 2 ? { ...s, interieur: true, watts: s.watts - 14 } : s));
  const serie = niveauxVelo([...dehors, ...mixte]);
  assert.ok(serie);
  assert.ok(Math.abs(serie.annuel[0].niveau - serie.annuel[1].niveau) < 5, `${serie.annuel[0].niveau} contre ${serie.annuel[1].niveau}`);
});

test('niveauxVelo : une année à moins de 3 sorties n\'a pas de niveau ; moins de deux années calculables = pas de série', () => {
  const serie = niveauxVelo([...annee(2023, 140), ...annee(2024, 160), ...annee(2025, 150, 1, [1]).slice(0, 2)]);
  assert.ok(serie);
  assert.deepEqual(serie.annuel.map((p) => p.cle), ['2023', '2024']);
  assert.equal(niveauxVelo(annee(2024, 150)), null);
  assert.equal(niveauxVelo([]), null);
});

test('niveauxVelo : une période de peu de sorties au niveau exceptionnel ne fixe pas le sommet', () => {
  const normales = [...annee(2023, 150), ...annee(2024, 152)];
  // 3 sorties seulement, à 190 W : un hasard, ou une sortie en descente. Elle ne devient pas le « 100 ».
  const hasard: SortieNiveauVelo[] = [0, 1, 2].map((i) => ({ date: date(2025, 2, 5 + i), watts: 190, fc: 149, interieur: false }));
  const serie = niveauxVelo([...normales, ...hasard]);
  assert.ok(serie);
  const t = serie.tranches.find((p) => p.cle === '2025-T1')!;
  assert.equal(t.n, 3);
  assert.ok(t.score <= 100, 'le score est plafonné à 100');
  assert.ok(t.haut > 100, 'mais sa fourchette dépasse');
  assert.ok((serie.meilleur.n ?? 0) >= 8, 'le sommet vient d\'une période fournie');
  assert.ok(serie.meilleur.niveau < 170);
});

test('niveauxVelo : sans assez de sorties par trimestre, on garde seulement les années', () => {
  // Deux années de 8 sorties chacune, mais 2 par trimestre seulement : aucun trimestre n'atteint 3 sorties
  const serie = niveauxVelo([...annee(2024, 150, 2), ...annee(2025, 160, 2)]);
  assert.ok(serie);
  assert.equal(serie.annuel.length, 2);
  assert.equal(serie.tranchesParAn, 1);
  assert.equal(serie.tranches.length, 0);
});

// --- Course ---

/** `parSemestre` courses par semestre à un niveau donné (secondes par km à 165 bpm, au dénivelé médian) ; 4 s/km de plus par mètre de dénivelé par km, −3,5 s/km par bpm. */
function anneeCourse(an: number, niveau: number, parSemestre = 9): SortieNiveauCourse[] {
  const sorties: SortieNiveauCourse[] = [];
  for (const s of [1, 2]) {
    for (let i = 0; i < parSemestre; i++) {
      const fc = 150 + FC[i % 10] - 138 + 6 * (i % 4);
      const den = 6 + (i % 5) * 2;
      sorties.push({ date: date(an, (s - 1) * 6 + 1 + (i % 5), 3 + i * 3), allure: niveau - 3.5 * (fc - 165) + 4 * (den - 10) + BRUIT[(i * 3 + s) % 10], fc, denivele: den, tapis: false });
    }
  }
  return sorties;
}

test('niveauxCourse : plus rapide = score plus haut, et le dénivelé est corrigé', () => {
  const serie = niveauxCourse([...anneeCourse(2023, 340), ...anneeCourse(2024, 320), ...anneeCourse(2025, 330)]);
  assert.ok(serie);
  assert.equal(serie.meilleur.an, 2024);
  assert.equal(serie.meilleur.score, 100);
  // Le niveau est ramené au cardio médian des courses (pas à 165) : on corrige l'attendu de la même façon
  const decalage = -3.5 * (serie.fcReference! - 165);
  assert.ok(Math.abs(serie.annuel[0].niveau - (340 + decalage)) < 10, `2023 : ${serie.annuel[0].niveau} au lieu de ${340 + decalage}`);
  assert.ok(Math.abs(serie.annuel[1].niveau - (320 + decalage)) < 10);
  assert.ok(serie.annuel[0].score < serie.annuel[2].score && serie.annuel[2].score < serie.annuel[1].score + 1);
  assert.equal(serie.tranchesParAn, 2);
  assert.equal(serie.tranches.length, 6);
  assert.ok(serie.annuel.every((p) => p.haut >= p.score - 0.01 && p.bas <= p.score));
});

test('niveauxCourse : des parcours plus vallonnés une année ne passent pas pour un recul', () => {
  const plat = anneeCourse(2024, 330).map((s) => ({ ...s, denivele: s.denivele - 4, allure: s.allure - 16 }));
  const vallonne = anneeCourse(2025, 330).map((s) => ({ ...s, denivele: s.denivele + 4, allure: s.allure + 16 }));
  const serie = niveauxCourse([...plat, ...vallonne]);
  assert.ok(serie);
  assert.ok(Math.abs(serie.annuel[0].niveau - serie.annuel[1].niveau) < 10, `${serie.annuel[0].niveau} contre ${serie.annuel[1].niveau}`);
});

// --- Records ---

test('serieRecord : le meilleur record fait 100, une année sans record est absente', () => {
  const serie = serieRecord([{ an: 2022, w1200: 224 }, { an: 2023, w1200: 227 }, { an: 2024 }, { an: 2025, w1200: 259 }, { an: 2026, w1200: 223 }], 'w1200');
  assert.ok(serie);
  assert.deepEqual(serie.annuel.map((p) => p.cle), ['2022', '2023', '2025', '2026']);
  assert.equal(serie.meilleur.an, 2025);
  assert.equal(serie.meilleur.score, 100);
  // 223 W contre 259 W : à 86 % du meilleur, soit 54 sur l'échelle (100 = le meilleur, 0 = 30 % en dessous)
  assert.equal(Math.round(serie.annuel[3].score), 54);
  assert.equal(Math.round(serie.annuel[0].score), 55); // 224 W : 86,5 %
  assert.equal(serie.annuel[0].n, null);
  assert.equal(serie.tranches.length, 0);
  assert.equal(serieRecord([{ an: 2025, w300: 300 }], 'w300'), null);
  assert.equal(serieRecord([{ an: 2025, w300: 300 }, { an: 2026 }], 'w300'), null);
});

test('recordsDeCourbe : lit 5, 20 et 60 minutes dans la courbe de puissance d\'une année', () => {
  const top = (valeur: number) => [{ valeur, id: 'a', nom: 'x', iso: '2025-05-01' }];
  const r = recordsDeCourbe(2025, [{ duree: 60, top: top(500) }, { duree: 300, top: top(290) }, { duree: 1200, top: top(259) }]);
  assert.deepEqual(r, { an: 2025, w300: 290, w1200: 259, w3600: undefined });
  assert.deepEqual(recordsDeCourbe(2024, []), { an: 2024, w300: undefined, w1200: undefined, w3600: undefined });
});

// --- Affichage ---

test('positionsNiveau et segmentsContinus : les trimestres sans assez de sorties coupent la courbe', () => {
  const serie = niveauxVelo([...annee(2024, 150, 10, [1, 2, 4]), ...annee(2025, 160, 10, [1, 2, 3, 4])]);
  assert.ok(serie);
  const pos = positionsNiveau(serie.tranches, serie.tranchesParAn);
  assert.equal(pos.length, 7);
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i].t > pos[i - 1].t);
  const segments = segmentsContinus(pos);
  assert.equal(segments.length, 2); // 2024-T1, T2 | 2024-T4, 2025-T1…T4 : le T3 de 2024 manque
  assert.deepEqual(segments[0].map((p) => p.point.cle), ['2024-T1', '2024-T2']);
  assert.deepEqual(reperesAnnees(pos).map((r) => r.an), [2024, 2025]);
});

test('reperesAnnees : l\'année s\'écrit au milieu de ses points, pour ne pas chevaucher la suivante', () => {
  // 2023 n'a que ses deux derniers trimestres, 2024 les quatre
  const serie = niveauxVelo([...annee(2023, 150, 10, [3, 4]), ...annee(2024, 160, 10, [1, 2, 3, 4])]);
  assert.ok(serie);
  const reperes = reperesAnnees(positionsNiveau(serie.tranches, serie.tranchesParAn));
  assert.deepEqual(reperes.map((r) => r.an), [2023, 2024]);
  // 2023 : entre T3 et T4 ; 2024 : entre T1 et T4 ; l'écart est d'au moins 3 trimestres
  assert.ok(reperes[1].t - reperes[0].t >= 3, `${reperes[1].t - reperes[0].t}`);
});

test('debutsAnnees : une barre entre le dernier trimestre d\'une année et le premier de la suivante, rien sur une série annuelle', () => {
  const serie = niveauxVelo([...annee(2023, 150), ...annee(2024, 160), ...annee(2025, 155)]);
  assert.ok(serie);
  const pos = positionsNiveau(serie.tranches, serie.tranchesParAn);
  // 2023-T1 = 2023 × 4 : les barres sont à 2024 × 4 − 0,5 et 2025 × 4 − 0,5
  assert.deepEqual(debutsAnnees(pos, 4), [8095.5, 8099.5]);
  assert.deepEqual(debutsAnnees(positionsNiveau(serie.annuel, 1), 1), []);
  // Un trimestre manquant n'empêche pas la barre
  const trou = niveauxVelo([...annee(2023, 150, 10, [1, 2, 3]), ...annee(2024, 160, 10, [2, 3, 4])]);
  assert.ok(trou);
  assert.deepEqual(debutsAnnees(positionsNiveau(trou.tranches, trou.tranchesParAn), 4), [8095.5]);
});

test('pointsDepuis : la fenêtre des dernières années, ou tout s\'il n\'en reste pas assez', () => {
  const serie = niveauxVelo([...annee(2022, 140), ...annee(2023, 150), ...annee(2024, 160), ...annee(2025, 155)]);
  assert.ok(serie);
  assert.equal(pointsDepuis(serie.tranches, undefined).length, 16);
  const trois = pointsDepuis(serie.tranches, 2023);
  assert.equal(trois.length, 12);
  assert.ok(trois.every((p) => p.an >= 2023));
  // Une fenêtre qui ne garde qu'un point : on montre tout plutôt qu'un point seul
  assert.equal(pointsDepuis(serie.annuel, 2025).length, 4);
});

test('axeScore : de la dizaine sous le plus bas jusqu\'à 104, avec un repère par dizaine', () => {
  const serie = niveauxVelo([...annee(2023, 140), ...annee(2024, 160)]);
  assert.ok(serie);
  const axe = axeScore(serie.tranches);
  assert.equal(axe.max, 104);
  assert.ok(axe.min <= Math.min(...serie.tranches.map((p) => p.bas)) - 6 + 10);
  assert.equal(axe.min % 10, 0);
  assert.equal(axe.reperes[axe.reperes.length - 1], 100);
});

test('libellePeriode : trimestre, semestre ou année en toutes lettres', () => {
  assert.equal(libellePeriode('2025-T2'), 'T2 2025');
  assert.equal(libellePeriode('2026-S1'), '1er semestre 2026');
  assert.equal(libellePeriode('2025-S2'), '2e semestre 2025');
  assert.equal(libellePeriode('2024'), '2024');
});

test('formatNiveau et formatMarge : watts ou allure', () => {
  assert.equal(formatNiveau('velo', 169.4), '169 W');
  assert.equal(formatNiveau('record', 259), '259 W');
  assert.equal(formatNiveau('course', 322.6), `5'23"/km`);
  assert.equal(formatMarge('velo', 3.4), '± 3 W');
  assert.equal(formatMarge('course', 17.2), '± 17 s/km');
});
