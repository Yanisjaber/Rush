// Le modèle de fatigue tient-il sur TOI ? On regarde tes séances passées : quand un groupe était fatigué (d'après le modèle)
// la veille ou l'avant-veille, ta performance sur ses exercices a-t-elle vraiment baissé ?
// Performance d'un exercice un jour donné = ton meilleur 1RM estimé de la séance, comparé à ta médiane des séances du même exercice
// dans les 28 jours autour (pour retirer ta progression). Si la fatigue prédite compte, l'écart doit être négatif.
// Fonctions pures. Ce n'est PAS une preuve médicale : une corrélation sur tes données, avec sa marge d'erreur.
import { chargeParGroupeEtJour, fatigueBrute, referenceGrosse, TAU_GROUPE } from './fatigue-musculaire.js';
import { GROUPES, ORDRE_GROUPES, groupeValide } from '../data/exercices.js';
import { decalerJour, ecartJours, moyenne, ecartType } from './maths.js';

const MIN_SEANCES = 25; // observations minimum pour tirer quelque chose de l'ensemble
const nombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const mediane = (t) => {
  const v = [...t].sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : 0;
};

/** Performance relative de chaque (exercice, jour) : [{ date, groupe, relatif }] (relatif = 1RM du jour ÷ médiane des séances voisines). */
export function performances(series) {
  const parExo = new Map();
  for (const s of series) {
    const p = nombre(s.weight_kg);
    const r = nombre(s.reps);
    if (!(p > 0) || r < 1 || r > 12 || !groupeValide(s.muscle_group)) continue;
    const d = String(s.date).slice(0, 10);
    if (!parExo.has(s.exercise_key)) parExo.set(s.exercise_key, { groupe: s.muscle_group, jours: new Map() });
    const e = parExo.get(s.exercise_key);
    e.jours.set(d, Math.max(e.jours.get(d) || 0, p * (1 + r / 30)));
  }
  const sortie = [];
  for (const e of parExo.values()) {
    const jours = [...e.jours.entries()];
    for (const [d, rm] of jours) {
      const voisines = jours.filter(([o]) => o !== d && Math.abs(ecartJours(o, d)) <= 28).map(([, v]) => v);
      if (voisines.length >= 3) sortie.push({ date: d, groupe: e.groupe, relatif: rm / mediane(voisines) });
    }
  }
  return sortie;
}

/** Corrélation de Pearson, ou null s'il n'y a pas de variation. */
function pearson(xs, ys) {
  const mx = moyenne(xs);
  const my = moyenne(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Fatigue prédite du groupe le matin du jour (les séances de ce jour ne comptent pas), en % d'une grosse journée. */
function fatigueDuMatin(parJour, ref, tau, date) {
  return ((fatigueBrute(parJour, decalerJour(date, -1), tau) * Math.exp(-1 / tau)) / ref) * 100;
}

const comparer = (obs) => {
  const fatigues = obs.filter((o) => o.pct >= 45);
  const fraiches = obs.filter((o) => o.pct < 20);
  if (fatigues.length < 3 || fraiches.length < 5) return { nFatigue: fatigues.length, nFraiches: fraiches.length, delta: null, confiance: 'insuffisant' };
  const mf = moyenne(fatigues.map((o) => o.relatif));
  const mr = moyenne(fraiches.map((o) => o.relatif));
  const delta = (mf / mr - 1) * 100;
  const erreur = (Math.sqrt(ecartType(fatigues.map((o) => o.relatif)) ** 2 / fatigues.length + ecartType(fraiches.map((o) => o.relatif)) ** 2 / fraiches.length) / mr) * 100;
  const confiance = Math.abs(delta) >= 2 * erreur && fatigues.length >= 4 ? 'nette' : Math.abs(delta) >= erreur ? 'indicative' : 'non concluante';
  return { nFatigue: fatigues.length, nFraiches: fraiches.length, delta, erreur, confiance };
};

/**
 * Valide le modèle sur tes séances. `series` : tes séries (carnet de force), `sets` : leurs charges (chargeParSerie).
 * Renvoie { n, global, parGroupe: [{ groupe, nom, ...comparaison }], tauSuggere, rDefaut, rMeilleur } ou null s'il n'y a pas assez de séances.
 * `tauSuggere` : la constante de temps qui colle le mieux à tes données (en jours), seulement si elle améliore nettement le lien.
 */
export function validerFatigue(series, sets) {
  const perfs = performances(series);
  if (perfs.length < MIN_SEANCES) return null;
  const parJourGroupe = chargeParGroupeEtJour(sets);
  const refs = Object.fromEntries(ORDRE_GROUPES.map((g) => [g, referenceGrosse(parJourGroupe[g])]));
  const observations = (facteurTau = null) =>
    perfs
      .filter((p) => refs[p.groupe])
      .map((p) => ({ groupe: p.groupe, relatif: p.relatif, pct: fatigueDuMatin(parJourGroupe[p.groupe], refs[p.groupe], facteurTau ? TAU_GROUPE[p.groupe] * facteurTau : TAU_GROUPE[p.groupe], p.date) }));
  const obs = observations();
  if (obs.length < MIN_SEANCES) return null;
  const global = comparer(obs);
  const parGroupe = ORDRE_GROUPES.map((g) => ({ groupe: g, nom: GROUPES[g].nom, n: obs.filter((o) => o.groupe === g).length, ...comparer(obs.filter((o) => o.groupe === g)) })).filter((x) => x.n >= 8);

  // Quelle vitesse de récupération colle le mieux à tes données ? On essaie la moitié, le double, etc. des constantes de départ.
  const essais = [0.5, 0.75, 1, 1.5, 2].map((f) => ({ f, r: pearson(observations(f).map((o) => Math.min(o.pct, 150)), observations(f).map((o) => o.relatif)) }));
  const rDefaut = essais.find((e) => e.f === 1).r;
  const meilleur = essais.filter((e) => e.r != null).sort((a, b) => a.r - b.r)[0];
  let tauSuggere = null;
  if (meilleur && meilleur.f !== 1 && rDefaut != null && meilleur.r < -0.15 && meilleur.r < rDefaut - 0.05 && obs.length >= 30) {
    tauSuggere = { facteur: meilleur.f, gros: Math.round(TAU_GROUPE.jambes * meilleur.f * 10) / 10, petits: Math.round(TAU_GROUPE.bras * meilleur.f * 10) / 10, r: meilleur.r };
  }
  return { n: obs.length, global, parGroupe, tauSuggere, rDefaut, rMeilleur: meilleur?.r ?? null };
}
