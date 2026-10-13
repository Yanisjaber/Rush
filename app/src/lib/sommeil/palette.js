// Couleurs du sommeil : une couleur par phase (indice du niveau d'un segment : 0 profond, 1 léger, 2 paradoxal, 3 éveillé)
// et une couleur par état du score (bon, moyen, faible). L'état utilise les couleurs d'alerte de l'app.
export const COULEURS_PHASE = ['#3b82f6', '#93c5fd', '#fbbf24', '#f87171'];
export const COULEUR_TON = { bon: 'var(--ok)', moyen: 'var(--alerte)', faible: 'var(--danger)', neutre: 'var(--texte-muet)', attention: 'var(--alerte)', mauvais: 'var(--danger)' };
