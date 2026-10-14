// Les muscles qui composent chaque groupe, et quels muscles travaille chaque exercice.
// Une série compte 1 pour chaque muscle principal et 0,5 pour chaque muscle secondaire (la méthode des « séries fractionnées »,
// la plus courante). Les clés des muscles sont celles du dessin du corps (voir corps-svg.js).
// Les zones visées sont des repères courants de volume hebdomadaire par muscle (séries pondérées par semaine), pas des lois.

/** slug du dessin → nom, groupe, zone visée [bas, haut] et exercices à proposer pour le renforcer. */
export const MUSCLES = {
  chest: { nom: 'Pectoraux', groupe: 'pectoraux', cible: [10, 20], idee: ['Développé couché', 'Développé incliné haltères'] },
  trapezius: { nom: 'Trapèzes', groupe: 'dos', cible: [4, 10], idee: ['Shrugs', 'Rowing barre'] },
  'upper-back': { nom: 'Haut du dos', groupe: 'dos', cible: [10, 20], idee: ['Tractions', 'Tirage horizontal', 'Rowing haltère'] },
  'lower-back': { nom: 'Lombaires', groupe: 'dos', cible: [3, 8], idee: ['Hyperextensions', 'Soulevé de terre roumain'] },
  deltoids: { nom: 'Deltoïdes', groupe: 'epaules', cible: [8, 16], idee: ['Élévations latérales', 'Développé militaire', 'Oiseau'] },
  biceps: { nom: 'Biceps', groupe: 'bras', cible: [8, 14], idee: ['Curl haltères', 'Curl marteau'] },
  triceps: { nom: 'Triceps', groupe: 'bras', cible: [8, 14], idee: ['Extension triceps poulie', 'Barre au front'] },
  forearm: { nom: 'Avant-bras', groupe: 'bras', cible: [4, 10], idee: ['Curl marteau', 'Soulevé de terre'] },
  abs: { nom: 'Abdominaux', groupe: 'tronc', cible: [6, 12], idee: ['Crunch poulie', 'Relevé de jambes', 'Roue abdominale'] },
  obliques: { nom: 'Obliques', groupe: 'tronc', cible: [3, 8], idee: ['Russian twist', 'Gainage'] },
  quadriceps: { nom: 'Quadriceps', groupe: 'jambes', cible: [10, 20], idee: ['Squat', 'Presse à cuisses', 'Leg extension'] },
  hamstring: { nom: 'Ischio-jambiers', groupe: 'jambes', cible: [8, 16], idee: ['Leg curl', 'Soulevé de terre roumain'] },
  gluteal: { nom: 'Fessiers', groupe: 'jambes', cible: [8, 16], idee: ['Hip thrust', 'Fentes bulgares'] },
  calves: { nom: 'Mollets', groupe: 'jambes', cible: [6, 12], idee: ['Mollets debout'] },
  adductors: { nom: 'Adducteurs', groupe: 'jambes', cible: [3, 8], idee: ['Squat large', 'Presse à cuisses'] },
};

/** Les muscles de chaque groupe, dans l'ordre d'affichage. */
export const MUSCLES_PAR_GROUPE = Object.entries(MUSCLES).reduce((acc, [slug, m]) => {
  (acc[m.groupe] ||= []).push(slug);
  return acc;
}, {});

const E = (p, s = []) => ({ p, s });

/** Exercices de la bibliothèque (par clé) → muscles principaux (p) et secondaires (s). */
export const MUSCLES_DES_EXERCICES = {
  'developpe-couche': E(['chest'], ['triceps', 'deltoids']),
  'developpe-incline-halteres': E(['chest'], ['deltoids', 'triceps']),
  'developpe-incline-barre': E(['chest'], ['deltoids', 'triceps']),
  'developpe-halteres': E(['chest'], ['triceps', 'deltoids']),
  ecartes: E(['chest']),
  pompes: E(['chest'], ['triceps', 'deltoids', 'abs']),
  dips: E(['chest', 'triceps'], ['deltoids']),
  'pec-deck': E(['chest']),
  'souleve-de-terre': E(['lower-back', 'hamstring', 'gluteal'], ['trapezius', 'upper-back', 'forearm']),
  tractions: E(['upper-back'], ['biceps', 'forearm', 'trapezius']),
  'rowing-barre': E(['upper-back'], ['trapezius', 'biceps', 'lower-back', 'forearm']),
  'rowing-haltere': E(['upper-back'], ['biceps', 'trapezius']),
  'tirage-vertical': E(['upper-back'], ['biceps']),
  'tirage-horizontal': E(['upper-back'], ['biceps', 'trapezius']),
  'tirage-menton': E(['deltoids', 'trapezius'], ['biceps']),
  hyperextensions: E(['lower-back'], ['gluteal', 'hamstring']),
  squat: E(['quadriceps', 'gluteal'], ['hamstring', 'adductors', 'lower-back']),
  'front-squat': E(['quadriceps'], ['gluteal', 'abs']),
  'presse-a-cuisses': E(['quadriceps'], ['gluteal', 'adductors']),
  fentes: E(['quadriceps', 'gluteal'], ['hamstring', 'adductors']),
  'fentes-bulgares': E(['quadriceps', 'gluteal'], ['hamstring', 'adductors']),
  'souleve-de-terre-roumain': E(['hamstring', 'gluteal'], ['lower-back']),
  'hip-thrust': E(['gluteal'], ['hamstring']),
  'leg-extension': E(['quadriceps']),
  'leg-curl': E(['hamstring']),
  'mollets-debout': E(['calves']),
  'step-up': E(['quadriceps', 'gluteal']),
  'developpe-militaire': E(['deltoids'], ['triceps', 'trapezius']),
  'developpe-epaules-halteres': E(['deltoids'], ['triceps', 'trapezius']),
  'elevations-laterales': E(['deltoids']),
  'elevations-frontales': E(['deltoids']),
  oiseau: E(['deltoids'], ['upper-back', 'trapezius']),
  'face-pull': E(['deltoids'], ['upper-back', 'trapezius']),
  shrugs: E(['trapezius'], ['forearm']),
  'curl-barre': E(['biceps'], ['forearm']),
  'curl-halteres': E(['biceps'], ['forearm']),
  'curl-marteau': E(['biceps', 'forearm']),
  'curl-pupitre': E(['biceps'], ['forearm']),
  'extension-triceps-poulie': E(['triceps']),
  'barre-au-front': E(['triceps']),
  'dips-banc': E(['triceps'], ['deltoids', 'chest']),
  kickback: E(['triceps']),
  crunch: E(['abs']),
  'releve-de-jambes': E(['abs'], ['obliques']),
  gainage: E(['abs'], ['obliques', 'lower-back']),
  'russian-twist': E(['obliques'], ['abs']),
  'roue-abdominale': E(['abs'], ['obliques', 'lower-back']),
  'crunch-poulie': E(['abs']),
};

// Exercices inconnus (importés de Hevy ou créés par toi) : on devine d'après le nom, en français ou en anglais.
// L'ordre compte : les règles précises passent avant les générales.
const REGLES_NOM = [
  [/leg raise|knee raise|toes to bar|releve de jambes|releve de genoux/, E(['abs'], ['obliques'])],
  [/russian twist|woodchop|oblique|rotation/, E(['obliques'], ['abs'])],
  [/crunch|plank|gainage|sit.?up|\bcore\b|\babs?\b|ab wheel|rollout|abdo/, E(['abs'], ['obliques'])],
  [/back extension|hyperext|good morning|lombaire|reverse hyper/, E(['lower-back'], ['gluteal', 'hamstring'])],
  [/romanian|roumain|stiff|rdl/, E(['hamstring', 'gluteal'], ['lower-back'])],
  [/deadlift|souleve/, E(['lower-back', 'hamstring', 'gluteal'], ['trapezius', 'upper-back', 'forearm'])],
  [/calf|calves|mollet/, E(['calves'])],
  [/hip thrust|glute|fessier|kickback.*(cable|machine)|pull.?through/, E(['gluteal'], ['hamstring'])],
  [/leg curl|hamstring|ischio|nordic/, E(['hamstring'])],
  [/adductor|abductor|adducteur|abducteur/, E(['adductors'])],
  [/leg extension|quad/, E(['quadriceps'])],
  [/squat|lunge|leg press|presse|fente|step.?up|hack|sissy/, E(['quadriceps', 'gluteal'], ['hamstring', 'adductors'])],
  [/skull|pushdown|tricep|barre au front|\bdips? (sur )?banc|bench dip|overhead extension|kickback/, E(['triceps'])],
  [/bicep|curl|pupitre|preacher/, E(['biceps'], ['forearm'])],
  [/forearm|wrist|avant.?bras|grip|farmer/, E(['forearm'])],
  [/shrug|upright|tirage menton/, E(['trapezius', 'deltoids'])],
  [/face pull|rear delt|reverse fly|oiseau|pec deck rear/, E(['deltoids'], ['upper-back', 'trapezius'])],
  [/lateral raise|front raise|elevation|shoulder|overhead press|military|arnold|epaule|\bohp\b/, E(['deltoids'], ['triceps', 'trapezius'])],
  [/pull.?up|chin.?up|pulldown|\blat\b|row|tirage|traction|rowing|rhomboid/, E(['upper-back'], ['biceps', 'trapezius'])],
  [/dip|push.?up|pompe/, E(['chest', 'triceps'], ['deltoids'])],
  [/chest|bench|\bfly\b|flye|ecarte|pec|developpe|incline|decline|press/, E(['chest'], ['triceps', 'deltoids'])],
];

const sansAccent = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Comment une série se répartit entre les muscles : [{ muscle, poids }] (principal : 1, secondaire : 0,5).
 * 1. l'exercice de la bibliothèque, par sa clé ; 2. à défaut, des mots du nom ; 3. à défaut, la série est partagée
 * à parts égales entre les muscles de son groupe (pour que le total du groupe reste juste).
 */
export function repartirSerie(cle, nom, groupe) {
  let e = MUSCLES_DES_EXERCICES[cle];
  if (!e) {
    const n = sansAccent(nom || '');
    const regle = REGLES_NOM.find(([motif]) => motif.test(n));
    if (regle && (!groupe || MUSCLES[regle[1].p[0]].groupe === groupe || regle[1].p.some((m) => MUSCLES[m].groupe === groupe))) e = regle[1];
  }
  if (e) return [...e.p.map((muscle) => ({ muscle, poids: 1 })), ...e.s.map((muscle) => ({ muscle, poids: 0.5 }))];
  const membres = MUSCLES_PAR_GROUPE[groupe] || [];
  return membres.map((muscle) => ({ muscle, poids: 1 / membres.length }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Portions de muscle : seulement là où elles ont un vrai rôle différent (épaules, trapèzes, triceps).
// Les zones visées sont des repères de volume par portion (séries pondérées par semaine), pas des lois.
// ---------------------------------------------------------------------------------------------------------------------
export const PORTIONS = {
  deltoids: [
    { cle: 'avant', nom: 'Avant (faisceau antérieur)', cible: [4, 10], idee: ['Développé militaire'] },
    { cle: 'lateral', nom: 'Côté (faisceau latéral)', cible: [6, 14], idee: ['Élévations latérales'] },
    { cle: 'arriere', nom: 'Arrière (faisceau postérieur)', cible: [6, 14], idee: ['Oiseau', 'Face pull'] },
  ],
  trapezius: [
    { cle: 'haut', nom: 'Haut', cible: [3, 8], idee: ['Shrugs'] },
    { cle: 'milieu', nom: 'Milieu', cible: [4, 10], idee: ['Rowing barre', 'Tirage horizontal'] },
    { cle: 'bas', nom: 'Bas', cible: [2, 6], idee: ['Face pull', 'Tractions'] },
  ],
  triceps: [
    { cle: 'long', nom: 'Chef long', cible: [4, 9], idee: ['Barre au front', 'Extension triceps au-dessus de la tête'] },
    { cle: 'courts', nom: 'Chefs latéral et médial', cible: [4, 9], idee: ['Extension triceps poulie', 'Dips sur banc'] },
  ],
};

const D = (avant, lateral, arriere) => ({ avant, lateral, arriere });

/** Pour un exercice et un muscle : comment la série se partage entre les portions du muscle (la somme fait 1). */
const PARTS_DES_EXERCICES = {
  deltoids: {
    'developpe-militaire': D(0.6, 0.4, 0),
    'developpe-epaules-halteres': D(0.6, 0.4, 0),
    'elevations-laterales': D(0, 1, 0),
    'elevations-frontales': D(1, 0, 0),
    oiseau: D(0, 0, 1),
    'face-pull': D(0, 0, 1),
    'tirage-menton': D(0.4, 0.6, 0),
    // Les développés de pectoraux sollicitent surtout l'avant de l'épaule
    'developpe-couche': D(1, 0, 0),
    'developpe-incline-halteres': D(1, 0, 0),
    'developpe-incline-barre': D(1, 0, 0),
    'developpe-halteres': D(1, 0, 0),
    pompes: D(1, 0, 0),
    dips: D(1, 0, 0),
    'dips-banc': D(1, 0, 0),
  },
  trapezius: {
    shrugs: { haut: 1, milieu: 0, bas: 0 },
    'rowing-barre': { haut: 0, milieu: 1, bas: 0 },
    'rowing-haltere': { haut: 0, milieu: 1, bas: 0 },
    'tirage-horizontal': { haut: 0, milieu: 1, bas: 0 },
    'tirage-menton': { haut: 0.7, milieu: 0.3, bas: 0 },
    tractions: { haut: 0, milieu: 0.5, bas: 0.5 },
    'souleve-de-terre': { haut: 0.6, milieu: 0.4, bas: 0 },
    'developpe-militaire': { haut: 1, milieu: 0, bas: 0 },
    'developpe-epaules-halteres': { haut: 1, milieu: 0, bas: 0 },
    oiseau: { haut: 0, milieu: 0.5, bas: 0.5 },
    'face-pull': { haut: 0, milieu: 0.5, bas: 0.5 },
  },
  triceps: {
    'extension-triceps-poulie': { long: 0.3, courts: 0.7 },
    'barre-au-front': { long: 0.6, courts: 0.4 },
    kickback: { long: 0.5, courts: 0.5 },
    dips: { long: 0.5, courts: 0.5 },
    'dips-banc': { long: 0.5, courts: 0.5 },
    'developpe-couche': { long: 0.3, courts: 0.7 },
    'developpe-incline-halteres': { long: 0.3, courts: 0.7 },
    'developpe-incline-barre': { long: 0.3, courts: 0.7 },
    'developpe-halteres': { long: 0.3, courts: 0.7 },
    pompes: { long: 0.3, courts: 0.7 },
    'developpe-militaire': { long: 0.5, courts: 0.5 },
    'developpe-epaules-halteres': { long: 0.5, courts: 0.5 },
  },
};

// Exercices inconnus : on devine la portion d'après le nom (le premier motif qui correspond gagne).
const REGLES_PORTION = {
  deltoids: [
    [/rear|reverse fly|oiseau|face pull|arriere|reverse pec/, D(0, 0, 1)],
    [/lateral|side raise|laterale/, D(0, 1, 0)],
    [/front raise|frontale/, D(1, 0, 0)],
    [/upright|tirage menton/, D(0.4, 0.6, 0)],
    [/overhead|military|shoulder press|arnold|epaule|\bohp\b/, D(0.6, 0.4, 0)],
    [/bench|chest|push.?up|pompe|dip|incline|decline|developpe/, D(1, 0, 0)],
  ],
  trapezius: [
    [/shrug/, { haut: 1, milieu: 0, bas: 0 }],
    [/row|tirage|rowing/, { haut: 0, milieu: 1, bas: 0 }],
    [/face pull|rear|reverse fly|oiseau|pull.?up|chin|traction/, { haut: 0, milieu: 0.5, bas: 0.5 }],
    [/deadlift|souleve|overhead|military|upright/, { haut: 1, milieu: 0, bas: 0 }],
  ],
  triceps: [
    [/overhead|skull|french|barre au front|jm press|au.?dessus/, { long: 0.7, courts: 0.3 }],
    [/pushdown|push.?down|kickback|poulie|rope/, { long: 0.3, courts: 0.7 }],
  ],
};

/** Partage d'une série entre les portions d'un muscle : [{ portion, part }] (la somme des parts fait 1). Sans portions : []. */
export function repartirPortions(cle, nom, muscle) {
  const portions = PORTIONS[muscle];
  if (!portions) return [];
  let parts = PARTS_DES_EXERCICES[muscle]?.[cle];
  if (!parts) {
    const n = sansAccent(nom || '');
    parts = REGLES_PORTION[muscle]?.find(([motif]) => motif.test(n))?.[1];
  }
  if (!parts) return portions.map((p) => ({ portion: p.cle, part: 1 / portions.length })); // pas d'indice : à parts égales
  return portions.filter((p) => parts[p.cle] > 0).map((p) => ({ portion: p.cle, part: parts[p.cle] }));
}
