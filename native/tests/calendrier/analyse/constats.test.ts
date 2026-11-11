import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserSortie } from '../../../src/data/calendrier/analyse/constats.ts';
import type { EntreeAnalyse } from '../../../src/data/calendrier/analyse/constats.ts';
import { flux1Hz } from '../../../src/data/calendrier/analyse/flux.ts';
import type { PrevueAnalyse } from '../../../src/data/calendrier/analyse/plan.ts';

const ZONES = [0, 153, 170, 178, 189]; // début de Z1 à Z5

// Ton footing : 35'42", départ à 5'38" pendant 5 min, puis 6'02", cœur de 160 à 190 bpm
function footing(options: { fc?: (i: number) => number; v?: (i: number) => number } = {}) {
  const n = 2142;
  const v = Array.from({ length: n }, (_, i) => (options.v ? options.v(i) : i < 300 ? 1000 / 338 : 1000 / 362));
  const fc = Array.from({ length: n }, (_, i) => (options.fc ? options.fc(i) : 160 + (i / n) * 30));
  return flux1Hz({ temps: v.map((_, i) => i), vitesse: v, fc })!;
}

const PLAN: PrevueAnalyse = { id: 'p', name: 'Footing', date: '2026-11-10', sport: 'Run', duration: 30, km: null, tss: 45, rpe: 3, category: 'entrainement', structure: null };

const base = (flux = footing()): EntreeAnalyse => ({
  famille: 'course', type: 'footing', flux, dureeS: 2142, distanceKm: 6.01, deniveleM: 38, derivePct: 12, zonesCardio: ZONES, zonesEstimees: false, hrMaxProfil: 205,
  wattsMesures: null, tss: 60, prevue: PLAN, refs: { ftp: null, hrMax: 205, allureBase: 300 },
});

test('ton footing : objectif raté, départ trop rapide, écart au plan, dérive : et une consigne', () => {
  const a = analyserSortie(base());
  const texte = a.lignes.map((l) => `${l.label} | ${l.texte}`).join('\n');
  assert.equal(a.avecPlan, true);
  assert.match(texte, /Objectif \| Footing raté : \d+ % du temps en zone 4 ou plus/);
  assert.match(texte, /Départ \| Trop rapide : 5'38" sur les 4 premières minutes, 6'0[12]" ensuite/);
  assert.match(texte, /Prévu \| Durée 35'42" au lieu de 30'00" \(\+19 %\), charge 60 au lieu de 45 \(\+33 %\)\./);
  assert.match(texte, /Cœur \| Dérive de \+12,0 % \(au-delà de 10 %\), dès le km \d,\d : le cœur a nettement monté à allure égale\./);
  assert.ok(a.lignes.length <= 5);
  // La consigne vient du verdict (le plus important) : le haut de la zone 2 = 170 − 1
  assert.equal(a.aFaire, 'Au prochain footing, reste sous 169 bpm même si ça paraît lent.');
  // Les lignes sont classées par importance : l'objectif d'abord
  assert.equal(a.lignes[0].label, 'Objectif');
});

test('un vrai footing en zone 2 : objectif tenu, rien d\'alarmant, pas de consigne', () => {
  const a = analyserSortie({ ...base(footing({ fc: () => 140, v: () => 1000 / 400 })), derivePct: 2, tss: 40 });
  const texte = a.lignes.map((l) => l.texte).join('\n');
  assert.match(texte, /Footing tenu : 100 % du temps en zones 1 et 2/);
  assert.doesNotMatch(texte, /raté|Trop rapide|nettement/);
  assert.equal(a.aFaire, null);
});

test('sans séance prévue, le nom « footing » donne l\'objectif ; une sortie sans nom parlant n\'a pas de verdict', () => {
  assert.match(analyserSortie({ ...base(), prevue: null }).lignes[0].texte, /Footing raté/);
  const a = analyserSortie({ ...base(), prevue: null, type: 'autre' });
  assert.ok(!a.lignes.some((l) => l.label === 'Objectif'));
  assert.equal(a.avecPlan, false);
});

test('zones estimées : le verdict le dit et une ligne Données prévient', () => {
  const a = analyserSortie({ ...base(), zonesEstimees: true });
  assert.match(a.lignes.find((l) => l.label === 'Objectif')!.texte, /\(zones estimées\)/);
});

test('FC max du profil dépassée : prioritaire, avec la consigne de la corriger', () => {
  const a = analyserSortie({ ...base(footing({ fc: (i) => 150 + (i / 2142) * 55 })), hrMaxProfil: 190 });
  const l = a.lignes.find((x) => x.label === 'Données')!;
  assert.match(l.texte, /Ton cœur est monté à \d+ bpm, au-dessus de ta FC max enregistrée \(190\)/);
});

test('puissance estimée en course : signalée ; mesurée : rien', () => {
  const n = 2142;
  const brut = { temps: Array.from({ length: n }, (_, i) => i), vitesse: new Array(n).fill(2.7), fc: new Array(n).fill(140), watts: new Array(n).fill(235) };
  const f = flux1Hz(brut)!;
  assert.match(analyserSortie({ ...base(f), wattsMesures: false, prevue: null }).lignes.map((l) => l.texte).join(' '), /Puissance estimée par Strava/);
  assert.doesNotMatch(analyserSortie({ ...base(f), wattsMesures: true, prevue: null }).lignes.map((l) => l.texte).join(' '), /Puissance estimée/);
});

// Un fractionné prévu : 10 min échauffement, 3 x 4 min seuil (95-106 % de l'allure de base 5'00"), retour au calme
const PLAN_FRAC: PrevueAnalyse = {
  ...PLAN, name: '3 x 4 min seuil', duration: 29, rpe: null, tss: null,
  structure: [
    { type: 'warmup', name: 'Échauffement', reps: 1, metric: 'pace', unit: 'zone', work: { min: 10, int: 75, intHi: 85 } },
    { type: 'interval', name: '3 x 4 min seuil', reps: 3, metric: 'pace', unit: 'zone', work: { min: 4, int: 95, intHi: 106 }, rec: { min: 2, int: 60, intHi: 70 } },
    { type: 'cooldown', name: 'Retour au calme', reps: 1, metric: 'pace', unit: 'zone', work: { min: 5, int: 70, intHi: null } },
  ],
};
function frac(allures: number[]) {
  // échauffement 600 s à 6'00", puis (travail 240 s, récup 120 s à 7'00") x 3, retour au calme 300 s à 6'20"
  const segs: [number, number][] = [[600, 360]];
  allures.forEach((a) => segs.push([240, a], [120, 420]));
  segs.push([300, 380]);
  const v: number[] = [];
  for (const [d, a] of segs) for (let i = 0; i < d; i++) v.push(1000 / a);
  return flux1Hz({ temps: v.map((_, i) => i), vitesse: v, fc: v.map(() => 160) })!;
}

test('fractionné tenu : la ligne Plan le confirme, sans verdict de zone ni dérive', () => {
  const a = analyserSortie({ ...base(frac([300, 300, 300])), type: 'fractionne', prevue: PLAN_FRAC, derivePct: 15, tss: null });
  const texte = a.lignes.map((l) => `${l.label} | ${l.texte}`).join('\n');
  assert.match(texte, /Plan \| 3 x 4 min seuil : 3 répétitions sur 3 dans la cible \(4'43" à 5'16"\/km\)/);
  assert.doesNotMatch(texte, /Dérive|Objectif/);
});

test('fractionné où la dernière répétition s\'effondre : dit où, de combien, et quoi faire', () => {
  const a = analyserSortie({ ...base(frac([300, 305, 345])), type: 'fractionne', prevue: PLAN_FRAC, tss: null });
  const l = a.lignes.find((x) => x.label === 'Plan')!;
  assert.match(l.texte, /2 répétitions sur 3 dans la cible \(4'43" à 5'16"\/km\), les autres trop lent\. La 1re à 5'00"\/km, la dernière à 5'45"\/km\./);
  assert.equal(a.aFaire, "Raccourcis la dernière répétition ou allonge la récup d'une minute.");
});

test('plan avec un chrono qui ne suit pas la structure, et aucun effort retrouvé : on le dit', () => {
  const f = flux1Hz({ temps: Array.from({ length: 2400 }, (_, i) => i), vitesse: new Array(2400).fill(3), fc: new Array(2400).fill(150) })!;
  const a = analyserSortie({ ...base(f), type: 'fractionne', prevue: PLAN_FRAC, tss: null });
  assert.match(a.lignes.find((l) => l.label === 'Plan')!.texte, /3 x 4 min seuil : aucune retrouvée sur 3/);
});

test('plan sans vitesse seuil dans le profil : on le dit et on dit quoi renseigner', () => {
  const a = analyserSortie({ ...base(frac([300, 300, 300])), type: 'fractionne', prevue: PLAN_FRAC, refs: { ftp: null, hrMax: 205, allureBase: null }, tss: null });
  assert.match(a.lignes.find((l) => l.label === 'Plan')!.texte, /il manque ta vitesse seuil/);
});

test('arrêts et allure irrégulière sur un terrain plat', () => {
  const f = footing({ v: (i) => (i >= 600 && i < 700 ? 0 : 1000 / 380) });
  const a = analyserSortie({ ...base(f), prevue: null, derivePct: null, zonesCardio: null });
  assert.match(a.lignes.map((l) => l.texte).join('\n'), /1'40" d'arrêts cumulés, le plus long \(1'40"\) au km 1,6/);
});

test('moins d\'informations : jamais une ligne inventée ; sans rien à dire, une liste vide', () => {
  const a = analyserSortie({ ...base(null), flux: null, prevue: null, derivePct: null, zonesCardio: null, tss: null });
  assert.deepEqual(a.lignes, []);
  assert.equal(a.aFaire, null);
});

test('sortie en vélo : tendance en km/h, pas de départ ni d\'allure au km', () => {
  const n = 3600;
  const v = Array.from({ length: n }, (_, i) => (i < n / 2 ? 9 : 7.5));
  const f = flux1Hz({ temps: v.map((_, i) => i), vitesse: v, fc: v.map(() => 140) })!;
  const a = analyserSortie({ ...base(f), famille: 'velo', type: 'longue', prevue: null, derivePct: null, zonesCardio: null, tss: null });
  const texte = a.lignes.map((l) => l.texte).join('\n');
  assert.match(texte, /Tu ralentis : 32,4 km\/h sur la 1re moitié, 27,0 sur la 2e/);
  assert.doesNotMatch(texte, /Trop rapide/);
});

// TON plan du 10 nov. : « Footing à 6:28/km » 22 min (82 %), puis 6 lignes droites de 20 s à 4:46/km (111 %) avec 1 min de récupération
const PLAN_REEL: PrevueAnalyse = {
  id: 'p', name: 'Course · Footing 30 min + 6 lignes droites', date: '2026-11-10', sport: 'Run', duration: 30, km: null, tss: 25, rpe: null, category: 'entrainement',
  structure: [
    { type: 'steady', name: 'Footing à 6:28/km', reps: 1, metric: 'pace', unit: 'pct', work: { min: 22.2, int: 82, intHi: null } },
    { type: 'interval', name: '6 lignes droites de 20 s à 4:46/km', reps: 6, metric: 'pace', unit: 'pct', work: { min: 0.3, int: 111, intHi: null }, rec: { min: 1, int: 82, intHi: null } },
  ],
};

// 36 min : fond à `fond` s/km, et `lignes` accélérations de 20 s à `vite` s/km aux minutes données
function footingEtLignes(fond: number, lignes: { minute: number; vite: number }[]) {
  const n = 2142;
  const v = Array.from({ length: n }, () => 1000 / fond);
  for (const l of lignes) for (let i = l.minute * 60; i < l.minute * 60 + 20; i++) v[i] = 1000 / l.vite;
  return flux1Hz({ temps: v.map((_, i) => i), vitesse: v, fc: v.map(() => 150) })!;
}
const SIX = [24, 26, 28, 30, 32, 34].map((minute) => ({ minute, vite: 280 }));

test('ton plan : footing + 6 lignes droites, le chrono ne suit pas : on retrouve les lignes et on juge le footing', () => {
  const a = analyserSortie({ ...base(footingEtLignes(358, SIX)), prevue: PLAN_REEL, derivePct: 3, tss: 50 });
  const texte = a.lignes.map((l) => `${l.label} | ${l.texte}`).join('\n');
  assert.match(texte, /Plan \| 6 lignes droites de 20 s à 4:46\/km : 6 retrouvées sur 6, 6 dans la cible \(4'46"\/km\)/);
  assert.match(texte, /Plan \| Footing à 6:28\/km : 5'58"\/km au lieu de 6'28"\/km \(30 s\/km trop vite\)\./);
  assert.match(texte, /Prévu \| Durée 35'42" au lieu de 30'00" \(\+19 %\), charge 50 au lieu de 25 \(\+100 %\)/);
  // Un footing + quelques lignes droites reste un footing : le reste de l'analyse s'applique
  assert.ok(a.lignes.some((l) => l.label === 'Objectif') || a.lignes.some((l) => l.label === 'Cœur'));
});

test('ton plan : il manque deux lignes droites, on dit combien', () => {
  const a = analyserSortie({ ...base(footingEtLignes(388, SIX.slice(0, 4))), prevue: PLAN_REEL, derivePct: 3 });
  const l = a.lignes.find((x) => x.texte.startsWith('6 lignes droites'))!;
  assert.match(l.texte, /4 retrouvées sur 6/);
  assert.match(l.texte, /2 manquantes\./);
});

test('ton plan : footing tenu à 6:28, lignes tenues : tout est vert', () => {
  const a = analyserSortie({ ...base(footingEtLignes(388, SIX)), prevue: PLAN_REEL, derivePct: 2 });
  const texte = a.lignes.map((l) => l.texte).join('\n');
  assert.match(texte, /Footing à 6:28\/km : tenu, 6'28"\/km pour 6'28"\/km visés/);
  assert.doesNotMatch(texte, /trop vite/);
});

test('ton plan : de simples accélérations molles (le bout de la sortie) ne sont pas des lignes droites', () => {
  const a = analyserSortie({ ...base(footingEtLignes(358, [{ minute: 33, vite: 325 }, { minute: 35, vite: 330 }])), prevue: PLAN_REEL, derivePct: 3 });
  const l = a.lignes.find((x) => x.texte.startsWith('6 lignes droites'))!;
  assert.match(l.texte, /aucune retrouvée sur 6/);
});

test('le verdict porte le type de séance, pas le long nom de la séance prévue', () => {
  const a = analyserSortie({ ...base(), prevue: PLAN_REEL });
  assert.match(a.lignes.find((l) => l.label === 'Objectif')!.texte, /^Footing (raté|tenu|un cran)/);
});

test('compte rendu : un footing fait trop vite se lit comme un coach (message unique, cause, conséquence)', () => {
  const prevue: PrevueAnalyse = { ...PLAN, structure: [{ type: 'steady', name: 'Footing à 6:28/km', duration: 30, intensity: 82 }] as never };
  const c = analyserSortie({ ...base(), prevue, refs: { ftp: null, hrMax: 205, allureBase: 300 } }).compteRendu!;
  assert.match(c.titre, /^Trop (vite|dur) pour un footing$/);
  assert.ok(c.phrases.length >= 2 && c.phrases.length <= 4);
  assert.match(c.phrases.join(' '), /devait rester facile/);
  assert.match(c.phrases.join(' '), /Ton cœur l'a payé : il a dérivé de 12 %/);
});

test('compte rendu : un footing tenu est félicité en peu de mots', () => {
  const c = analyserSortie({ ...base(footing({ fc: () => 140, v: () => 1000 / 400 })), derivePct: 2, tss: 40 }).compteRendu!;
  assert.equal(c.titre, 'Footing bien tenu');
  assert.match(c.phrases[0], /Tu es resté tranquille : 100 %/);
  assert.match(c.phrases.join(' '), /Cœur stable/);
});

test('compte rendu : un footing tenu dit aussi si tu progresses (à cœur égal, sur les mêmes footings)', () => {
  const histo = [5, 12, 19].map((j) => ({ id: `h${j}`, sport: 'Run', type: 'footing', date: `2026-10-${String(j).padStart(2, '0')}T08:00:00`, dureeS: 2400, distanceKm: 6, coeurMoyen: 140, deniveleM: 38 }));
  const entree = { ...base(footing({ fc: () => 140, v: () => 1000 / 400 })), derivePct: 2, tss: 40, dureeS: 2142, distanceKm: 5.35, courante: { id: 'now', sport: 'Run', date: '2026-11-10T20:00:00', coeurMoyen: 140 }, historique: histo };
  const c = analyserSortie(entree).compteRendu!;
  assert.match(c.phrases.join(' '), /Tu progresses : à cœur égal, tu vas \d+ s\/km plus vite que sur tes 3 derniers footings\./);
});
