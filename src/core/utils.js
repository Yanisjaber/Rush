/* ============================================================
   src/core/utils.js — Helpers génériques

   Petites fonctions utilisées partout : random, clamp, format date.
   Aucun état, aucune dépendance.
   ============================================================ */

export const rand = (min, max) => Math.random() * (max - min) + min;
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const fmtDate = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

// Échappe un texte venant de Strava, de la base ou d'un fichier avant de l'insérer dans du HTML.
export const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
