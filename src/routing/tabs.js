/* src/routing/tabs.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../core/state.js';
import { applySportFilter } from '../features/dashboard/filters.js';
import { activeSports } from '../features/dashboard/init.js';


// ========= TABS =========
// ========= ONGLETS + routage par ancre (#entraineur, #bilan, #termes) =========
// p1 (Tableau de bord) = pas de hash. #profil est géré par profile-modal.js.
const PANEL_HASH = { p2: '#calendrier', p3: '#statistiques', p4: '#performance', p5: '#termes', p6: '#competitions', p7: '#ia', p8: '#sommeil' };

// '#bilan' conservé comme alias (anciens liens/favoris) → pointe toujours sur p3.
const HASH_PANEL = { '#calendrier': 'p2', '#statistiques': 'p3', '#performance': 'p4', '#bilan': 'p3', '#termes': 'p5', '#competitions': 'p6', '#ia': 'p7', '#sommeil': 'p8' };


export function activatePanel(panelId, updateHash = true) {
  const panelEl = document.getElementById(panelId);
  const btn = document.querySelector(`.tab[data-panel="${panelId}"]`);
  if (!panelEl || !btn) return;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  panelEl.classList.add('active');
  // Met à jour le titre de la barre supérieure avec le libellé de l'onglet actif.
  const _tbTitle = document.getElementById('topbar-title');
  if (_tbTitle) { const _lbl = btn.querySelector('span'); _tbTitle.textContent = _lbl ? _lbl.textContent : btn.textContent.trim(); }
  if (updateHash) {
    const h = PANEL_HASH[panelId] || '';
    if (h) {
      if (window.location.hash !== h) history.replaceState(null, '', h);
    } else if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}


// Active le bon onglet selon l'ancre (chargement initial + back/forward + lien partagé).
function syncTabFromHash() {
  const panelId = HASH_PANEL[window.location.hash];
  if (panelId) activatePanel(panelId, false); // ancres inconnues / vide / #profil → on ne force rien
}

export function bootTabs() {


document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => activatePanel(btn.dataset.panel, true));
});

window.addEventListener('hashchange', syncTabFromHash);

syncTabFromHash();


// Clic sur le logo / "Coach IA" → retour au Tableau de bord (ferme aussi
// profil / paramètres / aide en restaurant le header).
window.goHome = function () {
  document.querySelector('.tabs')?.classList.remove('profile-hidden');
  document.getElementById('sport-filter')?.style.setProperty('display', '');
  const hi = document.querySelector('.header-info'); if (hi) hi.style.display = '';
  const ft = document.querySelector('footer'); if (ft) ft.style.display = '';
  const ob = document.getElementById('onboarding-banner'); if (ob) ob.style.display = '';
  ['profile-header-title', 'settings-header-title', 'help-header-title'].forEach(id => {
    const e = document.getElementById(id); if (e) e.style.display = 'none';
  });
  activatePanel('p1', true); // active le tableau de bord + nettoie l'ancre
};

appState._logoEl = document.querySelector('header .logo');

if (appState._logoEl) {
  appState._logoEl.style.cursor = 'pointer';
  appState._logoEl.title = 'Retour au tableau de bord';
  appState._logoEl.addEventListener('click', () => window.goHome());
}


// ========= FILTRES SPORTS (boutons header) =========
document.querySelectorAll('#sport-filter .sport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sport = btn.dataset.sport;
    if (sport === 'tout') {
      // Clic sur "Tout" : ne sélectionne QUE Tout
      activeSports.clear();
      activeSports.add('tout');
    } else {
      activeSports.delete('tout');
      if (activeSports.has(sport)) {
        activeSports.delete(sport);
      } else {
        activeSports.add(sport);
      }
      // Si plus rien de sélectionné, revenir sur Tout
      if (activeSports.size === 0) activeSports.add('tout');
      // Si TOUS les sports individuels sont sélectionnés → bascule sur Tout
      const individuals = ['cyclisme', 'course', 'musculation', 'natation', 'triathlon', 'autre'];
      if (individuals.every(s => activeSports.has(s))) {
        activeSports.clear();
        activeSports.add('tout');
      }
    }
    // MAJ visuelle des boutons
    document.querySelectorAll('#sport-filter .sport-btn').forEach(b => {
      b.classList.toggle('active', activeSports.has(b.dataset.sport));
    });
    applySportFilter();
  });
});
}
