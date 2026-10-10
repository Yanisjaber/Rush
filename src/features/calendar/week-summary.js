/* src/features/calendar/week-summary.js — extrait de l'ancien app.js (découpage par fonctionnalité). */


// ========= BILAN HEBDO : suppression des intitulés quand ça déborde =========
// Règle : si un intitulé (Volume/Distance/Séances…) est tronqué, ou si l'unité
// de la valeur passe à la ligne (ex. « 0 \n min »), on supprime TOUS les
// intitulés de la carte (classe .wt-no-lbl → voir calendar.css).
// Détection sur le contenu réel (pas sur la largeur de la fenêtre), donc ça
// marche aussi quand le calendrier est écrasé par le panneau Bibliothèque.
export function enforceWtLabels() {
  document.querySelectorAll('#week-calendar .week-totals').forEach(card => {
    card.classList.remove('wt-no-lbl');
    let overflow = false;
    card.querySelectorAll('.wt-view .wt-row').forEach(row => {
      if (overflow || row.clientWidth === 0) return; // vue masquée : non mesurable
      // 1) intitulé/contenu tronqué horizontalement
      if (row.scrollWidth > row.clientWidth + 1) { overflow = true; return; }
      // 2) unité passée à la ligne : la valeur fait plus d'une ligne de haut
      const val = row.querySelector('.wt-val');
      if (val && val.offsetHeight > parseFloat(getComputedStyle(val).fontSize) * 1.5) overflow = true;
    });
    if (overflow) card.classList.add('wt-no-lbl');
  });
}

export function bootWeekSummary() {

// Re-vérifie quand la largeur du calendrier change (resize fenêtre, ouverture
// de la bibliothèque…), pas seulement au re-render.
if (window.ResizeObserver) {
  const _wtRo = new ResizeObserver(() => enforceWtLabels());
  const _wtCal = document.getElementById('week-calendar');
  if (_wtCal) _wtRo.observe(_wtCal);
}
}
