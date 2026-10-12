// Structure d'une séance (échauffement, intervalles, retour au calme…) : calculs purs, sans DOM ni réseau.
//
// FORMAT STOCKÉ (colonne `structure`, jsonb de activity_planned) : identique à celui de la v1, pour que les deux
// versions relisent les mêmes séances. Un tableau de blocs :
//   { type, name, reps, metric: 'power' | 'hr' | 'pace', unit: 'zone' | 'pct',
//     work: { min, int, intHi }, rec?: { min, int, intHi } }
// `min` = durée en minutes (décimale), `int` / `intHi` = intensité en % (de la FTP, de la FC max ou de l'allure de base),
// `intHi` null = valeur unique. `rec` n'existe que pour les blocs d'intervalles.

export const TYPES_BLOC = ['warmup', 'interval', 'steady', 'recovery', 'cooldown'];
export const NOM_TYPE = {
  warmup: 'Échauffement',
  interval: 'Intervalles',
  steady: 'Bloc continu',
  recovery: 'Récupération',
  cooldown: 'Retour au calme',
};
export const METRIQUES = ['power', 'hr', 'pace'];
export const NOM_METRIQUE = { power: 'Watts', hr: 'Cardio', pace: 'Allure' };

/** Zones par métrique : bornes basse (incluse) et haute en %, et pourcentage « milieu ». */
export const ZONES = {
  power: {
    noms: ['Z1 Récup', 'Z2 Endurance', 'Z3 Tempo', 'Z4 Seuil', 'Z5 VO2max', 'Z6 Anaérobie', 'Z7 Sprint'],
    bas: [40, 56, 76, 91, 106, 121, 151],
    haut: [55, 75, 90, 105, 120, 150, 200],
  },
  hr: {
    noms: ['Z1 Récup', 'Z2 Aérobie', 'Z3 Tempo', 'Z4 Seuil', 'Z5 VO2max'],
    bas: [50, 60, 71, 83, 94],
    haut: [60, 70, 82, 93, 106],
  },
  pace: {
    noms: ['Z1 Footing', 'Z2 Endurance', 'Z3 Marathon', 'Z4 Seuil', 'Z5 VO2max'],
    bas: [60, 75, 85, 95, 106],
    haut: [75, 85, 95, 106, 125],
  },
};

/** Couleur de chaque zone, de Z1 (bleu) à Z7 (rose) : un code couleur d'information, partagé par toutes les métriques. */
export const COULEURS_ZONE = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#ec4899'];

const MAX_BLOCS = 40;
const bornes = (v, min, max, repli) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : repli);

/** Métriques disponibles selon le sport (type brut Strava) : vélo = watts/cardio, course et natation = allure/cardio. */
export function metriquesDuSport(sport) {
  if (['Run', 'TrailRun', 'VirtualRun', 'Swim', 'OpenWaterSwim'].includes(sport)) return ['pace', 'hr'];
  return ['power', 'hr'];
}

/** Le sport accepte-t-il une structure ? (vélo, course, natation) */
export function sportAvecStructure(sport) {
  return ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'Run', 'TrailRun', 'VirtualRun', 'Swim', 'OpenWaterSwim'].includes(sport);
}

function segmentPropre(s, repli) {
  if (!s || typeof s !== 'object') return repli ? { ...repli } : null;
  const int = bornes(Number(s.int), 1, 400, repli ? repli.int : 60);
  const hautBrut = s.intHi == null || s.intHi === '' ? null : Number(s.intHi);
  return {
    min: bornes(Number(s.min), 0.1, 600, repli ? repli.min : 10),
    int,
    intHi: hautBrut != null && Number.isFinite(hautBrut) && hautBrut > 0 ? bornes(hautBrut, 1, 400, int) : null,
  };
}

/**
 * Nettoie une structure lue en base ou fabriquée par l'éditeur : types connus, nombres bornés, tailles limitées.
 * Une valeur incohérente est ramenée à un défaut raisonnable plutôt que de faire planter l'affichage.
 */
export function normaliser(brut, metriqueParDefaut = 'power') {
  if (!Array.isArray(brut)) return [];
  return brut.slice(0, MAX_BLOCS).filter((b) => b && typeof b === 'object').map((b) => {
    const type = TYPES_BLOC.includes(b.type) ? b.type : 'steady';
    const metric = METRIQUES.includes(b.metric) ? b.metric : metriqueParDefaut;
    const bloc = {
      type,
      name: String(b.name ?? NOM_TYPE[type]).slice(0, 60) || NOM_TYPE[type],
      reps: type === 'interval' ? Math.round(bornes(Number(b.reps), 1, 99, 4)) : 1,
      metric,
      unit: b.unit === 'pct' ? 'pct' : 'zone',
      work: segmentPropre(b.work, { min: 10, int: 60, intHi: null }),
    };
    if (type === 'interval') bloc.rec = segmentPropre(b.rec, { min: 3, int: 40, intHi: 55 });
    return bloc;
  });
}

/** Intensité moyenne (%) d'un segment. */
export const milieu = (seg) => (seg.intHi != null ? (seg.int + seg.intHi) / 2 : seg.int);

/** Indice de zone d'une intensité (%), selon les bornes basses de la métrique. */
export function indiceZone(pct, metric) {
  const z = ZONES[metric] || ZONES.power;
  let i = 0;
  for (let k = z.bas.length - 1; k >= 0; k--) {
    if (pct >= z.bas[k]) {
      i = k;
      break;
    }
  }
  return i;
}

/** Les segments d'un bloc, dans l'ordre où ils sont réalisés (travail, récup, travail, récup…). */
export function segmentsDuBloc(b) {
  const liste = [];
  for (let i = 0; i < b.reps; i++) {
    liste.push({ seg: b.work, role: 'travail' });
    if (b.type === 'interval' && b.rec) liste.push({ seg: b.rec, role: 'recup' });
  }
  return liste;
}

/** Tous les segments de toute la structure. */
export const tousSegments = (blocs) => blocs.flatMap((b) => segmentsDuBloc(b).map((s) => ({ ...s, metric: b.metric })));

/**
 * Résumé chiffré : durée, charge (TSS), facteur d'intensité, énergie, puissance et cardio moyens, distance.
 * ref : { ftp, hrMax, allureBase } ; allureBase en secondes par km (course) ou par 100 m (natation), à 100 % d'intensité.
 */
export function resume(blocs, ref = {}, sport = 'Ride') {
  const ftp = ref.ftp > 0 ? ref.ftp : 250;
  const hrMax = ref.hrMax > 0 ? ref.hrMax : 190;
  const nage = ['Swim', 'OpenWaterSwim'].includes(sport);
  const allureBase = ref.allureBase > 0 ? ref.allureBase : nage ? 100 : 240;

  let duree = 0;
  let tss = 0;
  let kj = 0;
  let wMin = 0, wPct = 0, hMin = 0, hPct = 0, distance = 0, minAllure = 0;
  for (const { seg, metric } of tousSegments(blocs)) {
    const f = milieu(seg) / 100;
    duree += seg.min;
    tss += (seg.min / 60) * f * f * 100;
    if (metric === 'power') {
      kj += (seg.min * 60 * f * ftp) / 1000;
      wMin += seg.min;
      wPct += seg.min * f;
    } else if (metric === 'hr') {
      hMin += seg.min;
      hPct += seg.min * f;
    } else if (metric === 'pace' && f > 0) {
      const secParUnite = allureBase / f; // plus l'intensité est haute, plus l'allure est rapide
      distance += (seg.min * 60) / secParUnite;
      minAllure += seg.min;
    }
  }
  return {
    dureeMin: Math.round(duree),
    tss: Math.round(tss),
    facteurIntensite: duree > 0 ? Math.round(Math.sqrt(tss / (duree / 60) / 100) * 100) / 100 : 0,
    kj: kj > 0 ? Math.round(kj) : null,
    watts: wMin > 0 ? Math.round((wPct / wMin) * ftp) : null,
    bpm: hMin > 0 ? Math.round((hPct / hMin) * hrMax) : null,
    km: distance > 0 ? Math.round((nage ? distance / 10 : distance) * 100) / 100 : null,
  };
}

/** Texte de la cible d'un segment : « 210–245 W · Z4 », « 4:12/km · Z4 »… */
export function texteCible(seg, metric, ref = {}, sport = 'Run') {
  const ftp = ref.ftp > 0 ? ref.ftp : 250;
  const hrMax = ref.hrMax > 0 ? ref.hrMax : 190;
  const nage = ['Swim', 'OpenWaterSwim'].includes(sport);
  const allureBase = ref.allureBase > 0 ? ref.allureBase : nage ? 100 : 240;
  const zone = (ZONES[metric] || ZONES.power).noms[indiceZone(milieu(seg), metric)].split(' ')[0];
  const bas = seg.intHi != null ? Math.min(seg.int, seg.intHi) : seg.int;
  const haut = seg.intHi != null ? Math.max(seg.int, seg.intHi) : seg.int;
  const unique = seg.intHi == null;
  if (metric === 'power') return `${unique ? Math.round((ftp * bas) / 100) : `${Math.round((ftp * bas) / 100)}–${Math.round((ftp * haut) / 100)}`} W · ${zone}`;
  if (metric === 'hr') return `${unique ? Math.round((hrMax * bas) / 100) : `${Math.round((hrMax * bas) / 100)}–${Math.round((hrMax * haut) / 100)}`} bpm · ${zone}`;
  const allure = (pct) => formatAllureSec((allureBase * 100) / Math.max(1, pct));
  return `${unique ? allure(bas) : `${allure(haut)}–${allure(bas)}`}${nage ? '/100 m' : '/km'} · ${zone}`;
}

function formatAllureSec(s) {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Durée écrite librement → minutes : « 15 », « 15min », « 45s », « 1h30 », « 4:30 », « 1,5 ». Renvoie null si illisible. */
export function lireDuree(texte) {
  const v = String(texte ?? '').trim().toLowerCase().replace(',', '.').replace(/\s+/g, '').replace(/’/g, "'");
  if (!v) return null;
  let m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60;
  m = /^(\d+):(\d{1,2})$/.exec(v);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  m = /^(\d+)h(\d{1,2})$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)(?:min|mn|m|'))?(?:(\d+(?:\.\d+)?)(?:sec|s|"))?$/.exec(v);
  if (m && (m[1] || m[2] || m[3])) return (Number(m[1]) || 0) * 60 + (Number(m[2]) || 0) + (Number(m[3]) || 0) / 60;
  const f = Number(v);
  return Number.isFinite(f) && f > 0 ? f : null;
}

/** Durée en minutes → texte court : « 4 min », « 45 s », « 1h05 ». */
export function texteDuree(min) {
  const s = Math.round(min * 60);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}h${String(m).padStart(2, '0')}`;
  if (m && r) return `${m}:${String(r).padStart(2, '0')}`;
  if (!m) return `${r} s`;
  return `${m} min`;
}

// --- Ligne de commande : « 4x4' Z5 récup 3' », « 20' à 250W », « 2x20' 90% r5' » -----------------------------

/** Cible écrite (« Z4 », « 90% », « 250w », « 150bpm ») → { metric, int, intHi, unit } ou null. */
export function lireCible(texte, metriqueParDefaut = 'power', ref = {}) {
  const t = String(texte ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  let m = /^z(\d)$/.exec(t);
  if (m) {
    const z = ZONES[metriqueParDefaut] || ZONES.power;
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= z.bas.length) return null;
    return { metric: metriqueParDefaut, int: z.bas[i], intHi: z.haut[i], unit: 'zone' };
  }
  m = /^(\d+(?:[.,]\d+)?)%$/.exec(t);
  if (m) return { metric: metriqueParDefaut, int: Number(m[1].replace(',', '.')), intHi: null, unit: 'pct' };
  m = /^(\d+)w$/.exec(t);
  if (m) return { metric: 'power', int: Math.round((Number(m[1]) / (ref.ftp > 0 ? ref.ftp : 250)) * 100), intHi: null, unit: 'pct' };
  m = /^(\d+)bpm$/.exec(t);
  if (m) return { metric: 'hr', int: Math.round((Number(m[1]) / (ref.hrMax > 0 ? ref.hrMax : 190)) * 100), intHi: null, unit: 'pct' };
  return null;
}

const MOT_DUREE = "(\\d+(?:[.,]\\d+)?)\\s*(h|min|mn|m|'|\"|sec|s)?";
const COMMANDE = new RegExp(`^(?:(\\d+)\\s*x\\s*)?${MOT_DUREE}\\s*(?:à|a|@)?\\s*([^\\s].*?)?\\s*(?:(?:\\+|r[ée]cup|r)\\s*${MOT_DUREE}\\s*(.*))?$`);

function minutes(valeur, unite) {
  const v = Number(String(valeur).replace(',', '.'));
  if (unite === 'h') return v * 60;
  if (unite === '"' || unite === 's' || unite === 'sec') return v / 60;
  return v;
}

/**
 * Transforme une ligne de commande en bloc, ou null si elle n'est pas comprise.
 * Exemples : « 15' Z1 » · « 20' à 250W » · « 3x8' Z4 récup 4' » · « 45" Z6 » · « 2x20' 90% r5' ».
 */
export function lireCommande(texte, metriqueParDefaut = 'power', ref = {}) {
  const t = String(texte ?? '').trim().toLowerCase().replace(/’/g, "'");
  if (!t) return null;
  const m = COMMANDE.exec(t);
  if (!m) return null;
  const reps = m[1] ? Math.round(Number(m[1])) : 1;
  const dureeTravail = minutes(m[2], m[3]);
  const cible = lireCible(m[4], metriqueParDefaut, ref);
  if (!(dureeTravail > 0) || !cible || reps < 1 || reps > 99) return null;

  const bloc = {
    type: reps > 1 ? 'interval' : 'steady',
    name: reps > 1 ? `${reps}×${m[2]}${m[3] === '"' ? '"' : "'"}` : NOM_TYPE.steady,
    reps,
    metric: cible.metric,
    unit: cible.unit,
    work: { min: dureeTravail, int: cible.int, intHi: cible.intHi },
  };
  if (reps > 1) {
    const dureeRecup = m[5] ? minutes(m[5], m[6]) : Math.max(0.5, Math.round(dureeTravail * 0.75 * 2) / 2);
    const cibleRecup = m[7] ? lireCible(m[7], cible.metric, ref) : null;
    bloc.rec = { min: dureeRecup, int: cibleRecup ? cibleRecup.int : 40, intHi: cibleRecup ? cibleRecup.intHi : 55 };
  }
  const [propre] = normaliser([bloc], cible.metric);
  return propre || null;
}

// --- Modèles de séance proposés -------------------------------------------------------------------------------

const bloc = (type, min, metric, int, intHi) => ({ type, name: NOM_TYPE[type], reps: 1, metric, unit: 'zone', work: { min, int, intHi } });
const echauffement = (metric) => bloc('warmup', 15, metric, 40, 55);
const retourCalme = (metric) => bloc('cooldown', 10, metric, 40, 55);

/** Modèles prêts à l'emploi pour la métrique donnée (la même structure vaut en watts, en cardio ou en allure). */
export function modeles(metric = 'power') {
  const interval = (nom, reps, work, rec, unit = 'zone') => ({ type: 'interval', name: nom, reps, metric, unit, work, rec });
  return [
    { nom: '30/30 ×12', blocs: [echauffement(metric), interval('30/30', 12, { min: 0.5, int: 121, intHi: 150 }, { min: 0.5, int: 40, intHi: 55 }), retourCalme(metric)] },
    { nom: '4×4 min', blocs: [echauffement(metric), interval('4×4 VO2', 4, { min: 4, int: 106, intHi: 120 }, { min: 3, int: 40, intHi: 55 }), retourCalme(metric)] },
    { nom: '2×20 seuil', blocs: [echauffement(metric), interval('Seuil', 2, { min: 20, int: 88, intHi: 93 }, { min: 5, int: 40, intHi: 55 }, 'pct'), retourCalme(metric)] },
    { nom: 'Endurance 1h', blocs: [echauffement(metric), bloc('steady', 40, metric, 56, 75), retourCalme(metric)] },
  ].map((m) => ({ nom: m.nom, blocs: normaliser(m.blocs, metric) }));
}

/** Bloc neuf d'un type donné, avec des valeurs de départ raisonnables. */
export function nouveauBloc(type, metric = 'power') {
  const [b] = normaliser(
    [
      type === 'interval'
        ? { type, metric, reps: 4, work: { min: 4, int: 106, intHi: 120 }, rec: { min: 3, int: 40, intHi: 55 } }
        : type === 'steady'
          ? bloc(type, 30, metric, 76, 90)
          : bloc(type, type === 'warmup' ? 15 : 10, metric, 40, 55),
    ],
    metric,
  );
  return b;
}
