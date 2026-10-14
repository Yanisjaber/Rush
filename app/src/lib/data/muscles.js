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
