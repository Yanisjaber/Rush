/* src/features/calendar/overrides.js — extrait de l'ancien app.js (découpage par fonctionnalité). */


// ========= CALQUE D'OVERRIDES D'ACTIVITÉ =========
// Les activités viennent de Strava (réécrites à chaque synchro). On stocke ici
// les modifications manuelles (nom/type/sport/durée/distance/TSS/notes) et les
// masquages de métriques (puissance/cardio/distance), réappliqués après synchro.
const ACT_EDIT_KEY = 'coach_ia_activity_edits_v1';

function loadActivityEdits() {
  try { return JSON.parse(localStorage.getItem(ACT_EDIT_KEY) || '{}'); } catch { return {}; }
}

export function getActivityEdit(id) { return loadActivityEdits()[String(id)] || null; }

export function setActivityEdit(id, ov) {
  const map = loadActivityEdits();
  if (ov && Object.keys(ov).length) map[String(id)] = ov; else delete map[String(id)];
  localStorage.setItem(ACT_EDIT_KEY, JSON.stringify(map));
  if (window.cloudSync) {
    if (map[String(id)] && window.cloudSync.pushActivityEdit) window.cloudSync.pushActivityEdit(String(id), map[String(id)]);
    else if (window.cloudSync.deleteActivityEdit) window.cloudSync.deleteActivityEdit(String(id));
  }
  if (window.__applyOverridesAndRerender) window.__applyOverridesAndRerender();
}


// Applique les overrides sur une liste de jours (mutation), recalcule les totaux
// jour + le PMC (CTL/ATL/TSB) si au moins un TSS a été modifié.
export function applyActivityEditsToDays(days) {
  const overrides = loadActivityEdits();
  if (!days || !days.length) return days;
  let anyTss = false;
  for (const d of days) {
    if (!d.activities || !d.activities.length) {
      // Jour SANS activité : daily_metrics peut garder un TSS/durée obsolète
      // (activité supprimée ou re-datée sans recalcul serveur → « TSS fantôme »
      // qui fait monter la courbe + point cliquable sur un jour de repos).
      // Source unique = les activités : un jour sans activité est un jour à zéro.
      if ((d.tss || 0) !== 0 || (d.duration || 0) !== 0) {
        d.tss = 0; d.duration = 0;
        d.sessionName = null; d.sessionType = null;
        d.np = 0; d.avgW = 0; d.hr = 0; d.ftpPct = 0;
      }
      continue;
    }
    // Activites Strava masquees (poubelle "masquer") : on les retire completement
    // -> elles disparaissent de l'affichage ET des stats/charge (TSS + CTL/ATL recalcules sans elles).
    d.activities = d.activities.filter(a => {
      const ovh = overrides[String(a.id)];
      return !(ovh && ovh.hidden);
    });
    for (const a of d.activities) {
      const ov = overrides[String(a.id)];
      if (!ov) continue;
      if (ov.name != null) a.name = ov.name;
      if (ov.type != null) { a.type = ov.type; a.sessionType = ov.type; }
      if (ov.sport != null) { a.sport = ov.sport; a.raw_type = ov.sport; }
      if (ov.duration != null) a.duration = ov.duration;
      if (ov.distance_km != null) a.distance_km = ov.distance_km;
      if (ov.tss != null) { a.tss = ov.tss; anyTss = true; }
      if (ov.elevation_gain != null) a.elevation_gain = ov.elevation_gain;
      if (ov.rpe != null) a.rpe = ov.rpe;
      if (ov.laps != null) a.laps = ov.laps;
      if (ov.notes != null) a.notes = ov.notes;
      // Exclusion des records/stats : la donnée RESTE sur l'activité, on pose juste
      // des drapeaux pour que le power profile / les stats l'ignorent.
      a._exclPower = !!ov.excludePower;
      a._exclHr = !!ov.excludeHr;
      a._exclDistance = !!ov.excludeDistance;
    }
    d.activities.sort((x, y) => (y.tss || 0) - (x.tss || 0));
    d.tss = d.activities.reduce((s, a) => s + (a.tss || 0), 0);
    d.duration = d.activities.reduce((s, a) => s + (a.duration || 0), 0);
    const main = d.activities[0];
    if (main) {
      d.sessionName = main.name; d.sessionType = main.type; d.sport = main.sport;
      d.np = main.np || 0; d.avgW = main.avg_watts || 0; d.hr = main.hr || 0; d.ftpPct = main.ftpPct || 0;
    } else {
      // Plus aucune activite (toutes masquees) : on vide le resume du jour.
      d.sessionName = ''; d.sessionType = null;
      d.np = 0; d.avgW = 0; d.hr = 0; d.ftpPct = 0;
    }
  }
  // Recalcul PMC depuis les TSS (toujours), ancré sur le 1er jour — reflète les
  // activités manuelles / TSS modifiés. (anyTss conservé pour lisibilité.)
  void anyTss;
  if (days.length) {
    let ctl = days[0].ctl || 0, atl = days[0].atl || 0;
    for (let i = 1; i < days.length; i++) {
      const prevCtl = ctl, prevAtl = atl;
      const tss = days[i].tss || 0;
      ctl = prevCtl + (tss - prevCtl) / 42;
      atl = prevAtl + (tss - prevAtl) / 7;
      days[i].ctl = +ctl.toFixed(1);
      days[i].atl = +atl.toFixed(1);
      days[i].tsb = +(prevCtl - prevAtl).toFixed(1);
    }
  }
  return days;
}

export function bootOverrides() {

window.activityEdits = { get: getActivityEdit, set: setActivityEdit, load: loadActivityEdits };
}
