// Mise en forme des durées, distances et dates (français).

/** 3720 s → « 1h02 » ; 2400 s → « 40 min ». */
export function formatDuree(secondes) {
  const s = Math.max(0, Math.round(secondes || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** 28.47 → « 28,5 » (une décimale, virgule française). */
export function formatKm(km, decimales = 1) {
  if (km == null || Number.isNaN(Number(km))) return '—';
  return Number(km).toFixed(decimales).replace('.', ',');
}

/** Date ISO (2026-12-13) → « dim. 13 déc. ». */
export function formatDateCourte(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Date ISO → « Dimanche 13 décembre ». */
export function formatDateLongue(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Nombre de jours entre aujourd'hui et une date ISO (négatif si passée). */
export function joursAvant(iso, aujourdhui = new Date()) {
  const cible = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate(), 12);
  return Math.round((cible - base) / 86400000);
}

/** Date locale du jour au format ISO (AAAA-MM-JJ). */
export function dateIsoLocale(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
