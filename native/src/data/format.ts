// Mise en forme des durées, distances et dates (français). Port de app/src/lib/utils/format.js.

/** 3720 s → « 1h02 » ; 2400 s → « 40 min ». */
export function formatDuree(secondes: number | null | undefined): string {
  const s = Math.max(0, Math.round(secondes || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** 28.47 → « 28,5 » (une décimale, virgule française). */
export function formatKm(km: number | null | undefined, decimales = 1): string {
  if (km == null || Number.isNaN(Number(km))) return '—';
  return Number(km).toFixed(decimales).replace('.', ',');
}

/** Date ISO (2026-12-13) → « dim. 13 déc. ». */
export function formatDateCourte(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Date locale du jour au format ISO (AAAA-MM-JJ). */
export function dateIsoLocale(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
