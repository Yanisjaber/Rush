// ============================================================
// Petites fonctions sur les dates au format « AAAA-MM-JJ » (jour local, sans heure).
// Utilisées par le garde-fou et le validateur du coach IA (docs/ia/CADRAGE_IA.md).
// Tout se fait en UTC à midi-minuit pur : pas de fuseau, donc pas de décalage d'un jour.
// ============================================================

const FORME = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai si `s` est une vraie date « AAAA-MM-JJ » (le 2026-02-30 est refusé). */
export function dateValide(s: unknown): s is string {
  if (typeof s !== 'string' || !FORME.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** La date `n` jours après (ou avant si n est négatif). */
export function ajouterJours(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `a` à `b` (positif si b est après a). */
export function ecartJours(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

/** `date` est-elle entre `du` et `au` inclus ? (les dates au format ISO se comparent comme du texte) */
export function entre(date: string, du: string, au: string): boolean {
  return date >= du && date <= au;
}
