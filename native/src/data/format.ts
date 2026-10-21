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

/** Date ISO → « Dimanche 13 décembre ». */
export function formatDateLongue(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Nombre de jours entre aujourd'hui et une date ISO (négatif si passée). */
export function joursAvant(iso: string, aujourdhui: Date = new Date()): number {
  const cible = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const base = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate(), 12);
  return Math.round((cible.getTime() - base.getTime()) / 86400000);
}

/** Chronomètre : 2472 s → « 41'12" », 5500 s → « 1h31'40" ». */
export function formatChrono(secondes: number | null | undefined): string {
  const s = Math.max(0, Math.round(secondes || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const sec = String(r).padStart(2, '0');
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}'${sec}"` : `${m}'${sec}"`;
}

/** Allure : 252 s/km → « 4'12"/km ». */
export function formatAllure(secondesParKm: number | null | undefined): string {
  const s = Math.round(secondesParKm || 0);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"/km`;
}

/**
 * Allure « m:ss » à partir d'une vitesse en km/h : course (secondes par km) ou natation (secondes par 100 m).
 * Vitesse nulle ou absente : « — ».
 */
export function formatAllureDepuisKmh(kmh: unknown, parCentMetres = false): string {
  const v = Number(kmh);
  if (!(v > 0)) return '—';
  const secondes = Math.round(parCentMetres ? 360 / v : 3600 / v);
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;
}

/** 82.5 → « 82,5 », 100 → « 100 » (virgule française, une décimale seulement si utile). */
export function formatKg(kg: unknown): string {
  if (kg == null || Number.isNaN(Number(kg))) return '—';
  return String(Math.round(Number(kg) * 10) / 10).replace('.', ',');
}

/** 14820 → « 14 820 » (espace insécable entre les milliers). */
export function formatNombre(n: unknown): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Math.round(Number(n)).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, '\u00a0');
}

/** « 7h42 » à partir de minutes. */
export const texteHM = (min: number): string => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;

/** Un nombre à la française, avec au plus `decimales` décimales : 1234.5 → « 1 234,5 ». */
export const formatNum = (v: number, decimales = 0): string => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: decimales });

/** Allure de natation : 102 s pour 100 m → « 1'42"/100 m ». */
export function formatAllure100m(secondesPar100m: number | null | undefined): string {
  const s = Math.round(secondesPar100m || 0);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"/100 m`;
}

/** Durée toujours en heures et minutes sur deux chiffres, pour que des temps empilés s'alignent : 3240 s → « 0h54 », 9000 s → « 2h30 ». */
export function formatHeuresMinutes(secondes: number | null | undefined): string {
  const s = Math.max(0, Math.round(secondes || 0));
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}
