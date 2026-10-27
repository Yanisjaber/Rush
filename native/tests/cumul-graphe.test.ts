import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grapheCumul, jourDeX, libelleJour, maximumRond, HAUTEUR_CUMUL, LARGEUR_CUMUL, MARGE_DROITE_CUMUL } from '../src/data/cumul-graphe.ts';

// Une série qui monte de 1 par jour jusqu'au jour `jusque` (null après), sur 366 jours
const monte = (annee: number, pente: number, jusque = 365) => ({ annee, valeurs: Array.from({ length: 366 }, (_, j) => (j > jusque ? null : j * pente)) });

test('maximumRond : arrondit vers le haut à un chiffre rond, jamais 0', () => {
  assert.equal(maximumRond(8433), 9000);
  assert.equal(maximumRond(96100), 100000);
  assert.equal(maximumRond(9000), 9000);
  assert.equal(maximumRond(0), 1);
  assert.equal(maximumRond(-5), 1);
});

test('grapheCumul : une courbe par série, 4 graduations, un mois sur deux dans le cadre', () => {
  const g = grapheCumul([monte(2026, 30, 298), monte(2025, 25), monte(2024, 22)]);
  assert.equal(g.courbes.length, 3);
  assert.ok(g.courbes.every((c) => c.d.startsWith('M')));
  assert.equal(g.graduations.length, 4);
  assert.equal(g.graduations[0].valeur, 0);
  assert.equal(g.graduations[3].valeur, g.maximum);
  assert.equal(g.mois.length, 6);
  assert.deepEqual(g.mois.map((m) => m.nom), ['Janv.', 'Mars', 'Mai', 'Juil.', 'Sept.', 'Nov.']);
  assert.ok(g.mois.every((m, i) => m.x > 0 && m.x < LARGEUR_CUMUL && (i === 0 || m.x > g.mois[i - 1].x)));
});

test('grapheCumul : le repère est le dernier jour connu de la première série, avec un point par série', () => {
  const g = grapheCumul([monte(2026, 30, 298), monte(2025, 25), monte(2024, 22)]);
  assert.equal(g.points.length, 3);
  assert.ok(g.points.every((p) => p.x === g.repereX)); // même date pour les trois
  assert.equal(g.points[0].valeur, 298 * 30);
  assert.equal(g.points[1].valeur, 298 * 25);
  assert.ok(g.points[0].y < g.points[1].y && g.points[1].y < g.points[2].y); // en haut = plus de km
  assert.ok(g.points.every((p) => p.y >= 0 && p.y <= HAUTEUR_CUMUL));
  assert.ok(g.repereX < LARGEUR_CUMUL - MARGE_DROITE_CUMUL); // 2026 s'arrête avant la fin de l'année
});

test('grapheCumul : une année passée va jusqu\'à la fin du graphique', () => {
  const g = grapheCumul([monte(2025, 25), monte(2024, 22), monte(2023, 20)]);
  assert.equal(Math.round(g.repereX), LARGEUR_CUMUL - MARGE_DROITE_CUMUL);
});

test('grapheCumul : sans aucune donnée, ni plantage ni courbe', () => {
  const vide = { annee: 2026, valeurs: new Array(366).fill(null) };
  const g = grapheCumul([vide]);
  assert.equal(g.courbes[0].d, '');
  assert.equal(g.points.length, 0);
  assert.equal(grapheCumul([]).courbes.length, 0);
});

test('grapheCumul : les étiquettes de droite ne se chevauchent pas, même si les trois courbes se touchent', () => {
  const g = grapheCumul([monte(2026, 30, 298), monte(2025, 30, 298), monte(2024, 30, 298)]); // exactement les mêmes valeurs
  assert.equal(g.etiquettes.length, 3);
  const ys = g.etiquettes.map((e) => e.y).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 15 && ys[2] - ys[1] >= 15);
  assert.ok(g.etiquettes.every((e) => e.x > g.repereX && e.ancrage === 'debut')); // à droite de la ligne
  // Courbes bien séparées : les étiquettes restent à la hauteur de leur point
  const h = grapheCumul([monte(2026, 60, 298), monte(2025, 30, 298), monte(2024, 10, 298)]);
  h.etiquettes.forEach((e, i) => assert.equal(Math.round(e.y), Math.round(h.points[i].y)));
});

test('libelleJour : « 12 mars » (année bissextile, 0 = 1er janvier)', () => {
  assert.equal(libelleJour(0), '1 janvier');
  assert.equal(libelleJour(59), '29 février');
  assert.equal(libelleJour(71), '12 mars');
  assert.equal(libelleJour(365), '31 décembre');
});

test('jourDeX : le doigt à gauche = 1er janvier, à droite = fin de l\'année (on peut dépasser aujourd\'hui)', () => {
  const series = [monte(2026, 30, 298), monte(2025, 25)];
  assert.equal(jourDeX(0, 330, series), 0);
  assert.equal(jourDeX(330, 330, series), 365); // tout à droite : le dernier jour du graphique, même si 2026 s'arrête à 298
  assert.equal(jourDeX(-20, 330, series), 0);
  assert.equal(jourDeX(100, 0, series), 0); // largeur inconnue : pas de plantage
  const milieu = jourDeX(110, 330, series);
  assert.ok(milieu > 110 && milieu < 130); // 104 / 316 de la largeur utile, sur 365 jours
});

test('grapheCumul avec un jour pointé : les points et étiquettes sont ceux de ce jour, les étiquettes suivent la ligne', () => {
  const series = [monte(2026, 30, 298), monte(2025, 25), monte(2024, 22)];
  const auj = grapheCumul(series);
  const g = grapheCumul(series, 100);
  assert.equal(g.jour, 100);
  assert.equal(g.points[0].valeur, 100 * 30);
  assert.equal(g.points[1].valeur, 100 * 25);
  assert.ok(g.curseurX < auj.curseurX);
  assert.equal(g.repereX, auj.repereX); // « aujourd'hui » ne bouge pas
  assert.ok(g.etiquettes[0].x < auj.etiquettes[0].x); // les étiquettes suivent la ligne
  assert.equal(grapheCumul(series, 999).jour, 365); // au-delà de la fin : ramené au dernier jour du graphique
  assert.equal(grapheCumul(series, null).jour, 298);
});

test('grapheCumul : les étiquettes passent à gauche de la ligne quand il n\'y a pas la place à droite', () => {
  const series = [monte(2026, 30, 298), monte(2025, 25), monte(2024, 22)];
  const large = grapheCumul([monte(2026, 20, 298), monte(2025, 25), monte(2024, 22)], null, 80); // aujourd'hui (jour 298) est trop près du bord pour 80 de large ; 2026 est assez bas pour qu'on empile au-dessus
  assert.ok(large.etiquettes.every((e) => e.ancrage === 'fin' && e.x < large.curseurX));
  const hautDuPoint = Math.min(...large.points.map((pt) => pt.y));
  assert.ok(large.etiquettes.every((e) => e.y < hautDuPoint)); // toutes au-dessus de la courbe la plus haute
  const ys = large.etiquettes.map((e) => e.y).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 15 && ys[2] - ys[1] >= 15);
  assert.equal(large.etiquettes[0].annee, 2026); // la courbe la plus haute a l'étiquette la plus haute
  const petit = grapheCumul(series, 100, 80); // plus tôt dans l'année : la place est là
  assert.ok(petit.etiquettes.every((e) => e.ancrage === 'debut' && e.x > petit.curseurX));
  assert.ok(petit.etiquettes.every((e) => e.x + 80 <= LARGEUR_CUMUL));
});

test('grapheCumul : si la courbe est tout en haut, les étiquettes de gauche restent à la hauteur de leurs points', () => {
  const g = grapheCumul([monte(2026, 30, 298), monte(2025, 25), monte(2024, 22)], null, 80); // 2026 touche presque le haut du graphique
  assert.ok(g.etiquettes.every((e) => e.ancrage === 'fin'));
  assert.ok(g.etiquettes.every((e) => e.y >= 12)); // jamais coupées par le haut
  const ys = g.etiquettes.map((e) => e.y).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 15 && ys[2] - ys[1] >= 15);
});

test('grapheCumul : après aujourd\'hui, seules les années passées ont une valeur', () => {
  const g = grapheCumul([monte(2026, 30, 298), monte(2025, 25), monte(2024, 22)], 330);
  assert.equal(g.jour, 330);
  assert.deepEqual(g.points.map((p) => p.annee), [2025, 2024]); // 2026 n'a rien à cette date
  assert.equal(g.points[0].valeur, 330 * 25);
  assert.equal(g.etiquettes.length, 2);
  assert.ok(g.curseurX > g.repereX); // la ligne est après le repère « aujourd'hui »
});

test('grapheCumul : en début d\'année (valeurs à zéro), les étiquettes restent au-dessus des noms des mois', () => {
  const zero = (annee: number) => ({ annee, valeurs: Array.from({ length: 366 }, (_, j) => (j > 298 ? null : 0)) });
  const g = grapheCumul([zero(2026), zero(2025), zero(2024)], 0, 40);
  assert.equal(g.points.length, 3);
  const limite = HAUTEUR_CUMUL - 18; // la ligne de base : en dessous, ce sont les noms des mois
  assert.ok(g.etiquettes.every((e) => e.y + 4 <= limite)); // le bas du texte reste au-dessus de la base
  const ys = g.etiquettes.map((e) => e.y).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 15 && ys[2] - ys[1] >= 15); // toujours écartées
});

test('graduations : jamais deux fois la même valeur, même avec un très petit maximum', () => {
  const serie = (v: number) => [{ annee: 2026, valeurs: [0, v, v] as (number | null)[] }];
  for (const v of [0, 0.4, 1, 2, 3, 7]) {
    const valeurs = grapheCumul(serie(v)).graduations.map((g) => g.valeur);
    assert.equal(new Set(valeurs).size, valeurs.length, `maximum ${v} : ${valeurs.join(', ')}`);
    assert.equal(valeurs[0], 0);
  }
  assert.equal(maximumRond(0.4), 1);
});
