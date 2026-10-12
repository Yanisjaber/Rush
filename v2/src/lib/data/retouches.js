// Sorties réalisées : retouches des sorties Strava et conversion des sorties saisies à la main. Fonctions pures, sans réseau.
//
// Les sorties Strava sont réécrites à chaque synchro : on ne les modifie jamais. Tes changements (nom, sport, durée, distance,
// D+, charge, effort, notes) sont stockés à part dans `activity_edits` (data jsonb, clé = strava_id) et réappliqués à l'affichage,
// exactement comme dans la v1. Une sortie saisie à la main (source = 'manual') est une vraie ligne de `activities` : on la modifie.
import { validerPrevue, formulaireVide } from './prevue.js';

export { formulaireVide };

/** Clé d'une sortie dans activity_edits : le strava_id (en texte), sinon l'identifiant de la ligne. */
export const cleRetouche = (ligne) => (ligne?.strava_id != null ? String(ligne.strava_id) : ligne?.id != null ? String(ligne.id) : null);

/** Une sortie est-elle modifiable directement ? (saisie à la main, pas issue de Strava ou Garmin) */
export const estManuelle = (ligne) => ligne?.source === 'manual';

/** Applique une retouche (objet `data` de activity_edits) à une ligne de activities. Renvoie une copie ; ne touche jamais l'originale. */
export function appliquer(ligne, retouche) {
  if (!retouche || typeof retouche !== 'object') return ligne;
  const r = { ...ligne };
  // On garde les valeurs d'origine (avant retouche) : elles servent à ne recalculer que ce qui a changé
  r.origine = ligne.origine || { name: ligne.name, sport: ligne.sport, moving_time: ligne.moving_time, distance_km: ligne.distance_km, tss: ligne.tss, total_elevation_gain: ligne.total_elevation_gain, rpe: ligne.rpe, user_notes: ligne.user_notes };
  if (typeof retouche.name === 'string' && retouche.name) r.name = retouche.name;
  if (typeof retouche.sport === 'string' && retouche.sport) r.sport = retouche.sport;
  if (Number.isFinite(retouche.duration)) r.moving_time = retouche.duration * 60;
  if (Number.isFinite(retouche.distance_km)) r.distance_km = retouche.distance_km;
  if (Number.isFinite(retouche.tss)) r.tss = retouche.tss;
  if (Number.isFinite(retouche.elevation_gain)) r.total_elevation_gain = retouche.elevation_gain;
  if (Number.isFinite(retouche.rpe)) r.rpe = retouche.rpe;
  if (typeof retouche.notes === 'string') r.user_notes = retouche.notes;
  r.retouchee = true;
  return r;
}

/** Applique les retouches d'une table { cle: data } à une liste de sorties. */
export function appliquerTout(lignes, table) {
  if (!Array.isArray(lignes) || !table) return lignes || [];
  return lignes.map((l) => {
    const cle = cleRetouche(l);
    return cle && Object.hasOwn(table, cle) ? appliquer(l, table[cle]) : l;
  });
}

/** Formulaire prérempli depuis une sortie (valeurs déjà retouchées incluses). */
export function formulaireDepuisSortie(l) {
  const t = (v) => (v == null ? '' : String(v));
  const iso = String(l.start_date_local || '');
  const heure = /T(\d{2}:\d{2})/.exec(iso);
  return {
    ...formulaireVide(iso.slice(0, 10)),
    nom: t(l.name),
    heure: heure ? heure[1] : '12:00',
    sport: l.sport || 'Workout',
    duree: l.moving_time ? String(Math.round(l.moving_time / 60)) : '',
    tss: t(l.tss),
    rpe: t(l.rpe),
    km: t(l.distance_km),
    dPlus: t(l.total_elevation_gain),
    notes: t(l.user_notes),
    structure: [],
  };
}

/** Valide le formulaire d'une sortie (mêmes règles que la séance prévue, sans structure). { valeurs, erreurs }. */
export function validerSortie(f) {
  return validerPrevue({ ...f, structure: [] });
}

/** Ligne à écrire dans `activities` pour une sortie saisie à la main (sans user_id : ajouté par l'API depuis la session). */
export function versLigneManuelle(v) {
  return {
    source: 'manual',
    category: 'entrainement',
    name: v.nom,
    start_date_local: `${v.date}T${v.heure}:00`,
    sport: v.sport,
    moving_time: v.duree * 60,
    tss: v.tss,
    rpe: v.rpe,
    distance_km: v.km,
    total_elevation_gain: v.dPlus,
    user_notes: v.notes,
  };
}

/**
 * Retouche (objet `data` de activity_edits) à partir des valeurs validées : on ne garde que ce qui DIFFÈRE de la sortie d'origine,
 * pour ne pas figer des valeurs que la synchro corrigerait ensuite. Renvoie null s'il n'y a aucune différence.
 */
export function retoucheDepuis(valeurs, ligne) {
  const o = ligne?.origine || ligne || {}; // valeurs d'origine si la sortie est déjà retouchée
  const data = {};
  if (valeurs.nom !== (o.name ?? '')) data.name = valeurs.nom;
  if (valeurs.sport !== o.sport) data.sport = valeurs.sport;
  if (valeurs.duree !== Math.round((o.moving_time || 0) / 60)) data.duration = valeurs.duree;
  if ((valeurs.km ?? null) !== (o.distance_km != null ? Number(o.distance_km) : null) && valeurs.km != null) data.distance_km = valeurs.km;
  if (valeurs.tss !== (o.tss != null ? Number(o.tss) : null)) data.tss = valeurs.tss;
  if (valeurs.dPlus != null && valeurs.dPlus !== (o.total_elevation_gain != null ? Number(o.total_elevation_gain) : null)) data.elevation_gain = valeurs.dPlus;
  if (valeurs.rpe != null && valeurs.rpe !== (o.rpe != null ? Number(o.rpe) : null)) data.rpe = valeurs.rpe;
  if ((valeurs.notes ?? '') !== (o.user_notes ?? '')) data.notes = valeurs.notes ?? '';
  return Object.keys(data).length ? data : null;
}
