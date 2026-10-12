// Hyrox : un test ou une course = 16 segments dans l'ordre officiel (run 1 km, station, run 1 km, station… ×8).
// Fonctions pures : saisie des temps, totaux, écart à l'objectif, conversion des tours d'une montre.

export const STATIONS = [
  { cle: 'ski', nom: 'SkiErg', court: 'SKI', detail: '1 000 m' },
  { cle: 'push', nom: 'Sled Push', court: 'PUSH', detail: '50 m' },
  { cle: 'pull', nom: 'Sled Pull', court: 'PULL', detail: '50 m' },
  { cle: 'bbj', nom: 'Burpee Broad Jumps', court: 'BBJ', detail: '80 m' },
  { cle: 'row', nom: 'Rameur', court: 'ROW', detail: '1 000 m' },
  { cle: 'farm', nom: 'Farmers Carry', court: 'FARM', detail: '200 m' },
  { cle: 'lunge', nom: 'Sandbag Lunges', court: 'LUNG', detail: '100 m' },
  { cle: 'wall', nom: 'Wall Balls', court: 'WALL', detail: '100 reps' },
];

/** Les 16 segments dans l'ordre : run 1, SkiErg, run 2, Sled Push, … run 8, Wall Balls. */
export const SEGMENTS = STATIONS.flatMap((st, k) => [
  { i: 2 * k, type: 'run', cle: `run${k + 1}`, nom: `Run ${k + 1}`, court: `R${k + 1}`, detail: '1 km' },
  { i: 2 * k + 1, type: 'station', cle: st.cle, nom: st.nom, court: st.court, detail: st.detail },
]);

export const NB_SEGMENTS = SEGMENTS.length;
export const TEMPS_MAX = 36000; // 10 h : plafond de sécurité (aussi dans la base)

/** « 4:52 » → 292, « 1:13:42 » → 4422, « 292 » → 292 (secondes). NaN si le texte n'a pas un format de temps. */
export function lireTemps(texte) {
  const t = String(texte ?? '').trim().replace(/['′]/g, ':').replace(/["″]/g, '').replace(/\s/g, '');
  if (!t) return NaN;
  if (/^\d{1,5}$/.test(t)) return Number(t);
  const m = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{1,2})$/.exec(t);
  if (!m) return NaN;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const s = Number(m[3]);
  if (s > 59 || (m[1] && min > 59)) return NaN;
  return h * 3600 + min * 60 + s;
}

/** 292 → « 4:52 », 4422 → « 1:13:42 ». */
export function ecrireTemps(secondes) {
  const s = Math.max(0, Math.round(secondes || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Écart en secondes avec signe : 27 → « +27 s », -10 → « −10 s ». */
export function formatEcart(secondes) {
  const s = Math.round(secondes || 0);
  if (s === 0) return '0 s';
  return `${s > 0 ? '+' : '−'}${Math.abs(s)} s`;
}

/** Écart long : 222 → « +3'42" ». */
export function formatEcartLong(secondes) {
  const s = Math.round(secondes || 0);
  const a = Math.abs(s);
  return `${s < 0 ? '−' : '+'}${Math.floor(a / 60)}'${String(a % 60).padStart(2, '0')}"`;
}

/** Totaux d'un test : { total, runs, stations, allures (s par km, 8 valeurs) }. segments = 16 secondes. */
export function analyserTest(segments) {
  const seg = Array.isArray(segments) ? segments.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)) : [];
  let runs = 0;
  let stations = 0;
  const allures = [];
  seg.forEach((v, i) => {
    if (i % 2 === 0) {
      runs += v;
      allures.push(v);
    } else stations += v;
  });
  return { total: runs + stations, runs, stations, allures };
}

/**
 * Temps visé pour chaque segment. Si l'utilisateur a saisi ses temps par segment, on les prend ;
 * sinon on répartit son objectif total au prorata du dernier test (chaque segment garde son poids relatif).
 * Renvoie null si on ne peut rien calculer (pas d'objectif ou pas de test).
 */
export function ciblesSegments(objectif, test) {
  if (!objectif) return null;
  if (Array.isArray(objectif.segments) && objectif.segments.length === NB_SEGMENTS) return objectif.segments.map(Number);
  if (!test || !(test.total_s > 0) || !(objectif.total_s > 0)) return null;
  const k = objectif.total_s / test.total_s;
  return test.segments.map((v) => Math.round(Number(v) * k));
}

/** Écart de chaque segment entre le test et la cible (positif = temps à gagner), trié du plus grand écart au plus petit. */
export function ecartsParSegment(test, cibles, type = 'station') {
  if (!test || !cibles) return [];
  return SEGMENTS.filter((s) => s.type === type)
    .map((s) => ({ ...s, ecart: Math.round(Number(test.segments[s.i]) - Number(cibles[s.i])), test: Number(test.segments[s.i]), cible: Number(cibles[s.i]) }));
}

// ---------------------------------------------------------------------------
// Formulaire de saisie d'un test
// ---------------------------------------------------------------------------

/** Formulaire vide : date du jour, 16 champs de temps (texte). */
export function formulaireTestVide(dateIso) {
  return { date: dateIso, label: 'Simulation', kind: 'test', temps: new Array(NB_SEGMENTS).fill(''), notes: '' };
}

/** Formulaire prérempli depuis une ligne hyrox_tests (pour la modifier). */
export function formulaireDepuisTest(t) {
  return {
    date: String(t.date).slice(0, 10),
    label: t.label || 'Test',
    kind: t.kind === 'course' ? 'course' : 'test',
    temps: (Array.isArray(t.segments) ? t.segments : []).map((s) => ecrireTemps(s)).concat(new Array(NB_SEGMENTS).fill('')).slice(0, NB_SEGMENTS),
    notes: t.notes || '',
  };
}

/** Valide le formulaire. Renvoie { valeurs, erreurs } (valeurs = null en cas d'erreur). */
export function validerTest(f) {
  const erreurs = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) erreurs.date = 'Date invalide.';
  const label = String(f.label || '').trim();
  if (!label) erreurs.label = 'Donne un nom au test.';
  else if (label.length > 80) erreurs.label = '80 caractères maximum.';
  const notes = String(f.notes || '').trim();
  if (notes.length > 500) erreurs.notes = '500 caractères maximum.';
  const segments = [];
  const manquants = [];
  f.temps.forEach((txt, i) => {
    const s = lireTemps(txt);
    if (!(s >= 1 && s <= 7200)) manquants.push(SEGMENTS[i].nom);
    segments.push(s);
  });
  if (manquants.length) erreurs.temps = `Temps manquant ou invalide : ${manquants.slice(0, 4).join(', ')}${manquants.length > 4 ? '…' : ''}. Format : 4:52.`;
  if (Object.keys(erreurs).length) return { valeurs: null, erreurs };
  const total = segments.reduce((a, b) => a + b, 0);
  if (total > TEMPS_MAX) return { valeurs: null, erreurs: { temps: 'Le total dépasse 10 heures.' } };
  return { valeurs: { date: f.date, label, kind: f.kind === 'course' ? 'course' : 'test', segments, total_s: total, notes: notes || null }, erreurs: {} };
}

/** Valide l'objectif : un temps total (« 1:10:00 ») et, facultatif, 16 temps visés. Renvoie { valeurs, erreur }. */
export function validerObjectif(totalTexte, tempsTextes = null) {
  const total = lireTemps(totalTexte);
  if (!(total >= 600 && total <= TEMPS_MAX)) return { valeurs: null, erreur: 'Objectif entre 10 min et 10 h (format 1:10:00).' };
  if (!tempsTextes || tempsTextes.every((t) => String(t).trim() === '')) return { valeurs: { total_s: total, segments: null }, erreur: '' };
  const segments = tempsTextes.map(lireTemps);
  if (segments.length !== NB_SEGMENTS || segments.some((s) => !(s >= 1 && s <= 7200))) return { valeurs: null, erreur: 'Temps visés : 16 temps valides ou aucun.' };
  return { valeurs: { total_s: total, segments }, erreur: '' };
}

// ---------------------------------------------------------------------------
// Tours de montre → segments
// ---------------------------------------------------------------------------

/**
 * Convertit les tours (laps) d'une activité en 16 segments. On n'accepte que 16 tours exactement (un par segment) :
 * sinon null, pour ne jamais deviner un découpage faux.
 * tours : [{ elapsed_time (s) }] dans l'ordre.
 */
export function segmentsDepuisTours(tours) {
  if (!Array.isArray(tours)) return null;
  const temps = tours.map((t) => Math.round(Number(t?.elapsed_time ?? t?.moving_time)));
  if (temps.length !== NB_SEGMENTS || temps.some((s) => !(s >= 1 && s <= 7200))) return null;
  return temps;
}

/** Meilleur et dernier test (la liste vient triée du plus récent au plus ancien). */
export function resumeTests(tests) {
  if (!tests.length) return { dernier: null, meilleur: null, precedent: null };
  const meilleur = tests.reduce((m, t) => (t.total_s < m.total_s ? t : m), tests[0]);
  return { dernier: tests[0], meilleur, precedent: tests[1] || null };
}
