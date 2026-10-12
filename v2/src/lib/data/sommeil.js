// Sommeil : calculs à partir des nuits Garmin (table garmin_sleep, une ligne par nuit).
// Fonctions pures, sans accès réseau : faciles à tester.

/** Heure « HH:MM » d'un horodatage « AAAA-MM-JJ HH:MM » (ou null si absent/mal formé). */
export function heureDe(horodatage) {
  const m = /(\d{1,2}):(\d{2})/.exec(String(horodatage || '').split(' ')[1] || '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Minutes depuis minuit d'une heure « HH:MM » ; les heures après minuit comptent comme « tard » (+24 h si avant 12 h). */
export function minutesCoucher(heure) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(heure || '');
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return total < 12 * 60 ? total + 24 * 60 : total;
}

/** Remet des minutes (éventuellement > 24 h) en « HH:MM ». */
export function heureDepuisMinutes(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return null;
  const t = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Les phases d'une nuit : [{ cle, nom, secondes, part }] (part entre 0 et 1 du temps total passé au lit). */
export function phases(nuit) {
  if (!nuit) return [];
  const defs = [
    { cle: 'profond', nom: 'Profond', secondes: nuit.deep_sec },
    { cle: 'rem', nom: 'REM', secondes: nuit.rem_sec },
    { cle: 'leger', nom: 'Léger', secondes: nuit.light_sec },
    { cle: 'eveille', nom: 'Éveillé', secondes: nuit.awake_sec },
  ].map((p) => ({ ...p, secondes: Number(p.secondes) > 0 ? Number(p.secondes) : 0 }));
  const total = defs.reduce((s, p) => s + p.secondes, 0);
  if (!total) return [];
  return defs.map((p) => ({ ...p, part: p.secondes / total }));
}

/** Efficacité : part du temps au lit passée à dormir (0 à 1), ou null. */
export function efficacite(nuit) {
  const total = phases(nuit).reduce((s, p) => s + p.secondes, 0);
  const eveille = Number(nuit?.awake_sec) > 0 ? Number(nuit.awake_sec) : 0;
  return total ? (total - eveille) / total : null;
}

/** Moyenne d'un champ sur une liste de nuits (valeurs absentes ignorées), ou null. */
export function moyenne(nuits, champ) {
  const v = (nuits || []).map((n) => n?.[champ]).filter((x) => x != null && !Number.isNaN(Number(x))).map(Number);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/** Moyenne de l'heure de coucher (minutes depuis minuit, après-minuit = > 1440), ou null. */
export function moyenneCoucher(nuits) {
  const v = (nuits || []).map((n) => minutesCoucher(heureDe(n?.bedtime))).filter((x) => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/** Nuits triées de la plus récente à la plus ancienne (copie). */
export function triees(nuits) {
  return [...(nuits || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/** Tendance entre les 7 dernières nuits et les 23 précédentes (« mieux », « moins bien », « stable »). */
export function tendance(nuits, champ, seuil = 0.03) {
  const t = triees(nuits);
  const recent = moyenne(t.slice(0, 7), champ);
  const avant = moyenne(t.slice(7, 30), champ);
  if (recent == null || avant == null || avant === 0) return null;
  const ecart = (recent - avant) / avant;
  return Math.abs(ecart) < seuil ? 'stable' : ecart > 0 ? 'hausse' : 'baisse';
}
