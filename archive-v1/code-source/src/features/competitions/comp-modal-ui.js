/* src/features/competitions/comp-modal-ui.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { getSportCategory } from '../dashboard/filters.js';
import { reflowCompParcoursRows, reflowSecGrids } from './comp-form.js';


// ========= MODAL D'AJOUT DE COMPÉTITION =========
// === Custom dropdown qui remplace les <select> natifs ===
// Le <select> reste dans le DOM (caché) pour stocker la valeur, on construit un widget par-dessus
export function enhanceSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || sel._enhanced) return;
  sel._enhanced = true;
  // Cache le select natif
  sel.style.display = 'none';
  sel.tabIndex = -1;

  // Wrapper
  const wrap = document.createElement('div');
  wrap.className = 'custom-select';
  wrap.tabIndex = 0;

  // Bouton qui affiche la valeur courante
  const btn = document.createElement('div');
  btn.className = 'custom-select-btn';
  btn.innerHTML = '<span class="custom-select-label">—</span><span class="custom-select-arrow"></span>';
  wrap.appendChild(btn);

  // Panel des options
  const panel = document.createElement('div');
  panel.className = 'custom-select-panel';
  wrap.appendChild(panel);

  // Insère après le select
  sel.parentNode.insertBefore(wrap, sel.nextSibling);

  function rebuildPanel() {
    panel.innerHTML = '';
    // Pour chaque <optgroup> ou <option> direct
    Array.from(sel.children).forEach(child => {
      if (child.tagName === 'OPTGROUP') {
        const og = document.createElement('div');
        og.className = 'cs-group';
        og.textContent = child.label;
        panel.appendChild(og);
        Array.from(child.children).forEach(opt => panel.appendChild(buildOption(opt)));
      } else if (child.tagName === 'OPTION') {
        panel.appendChild(buildOption(child));
      }
    });
  }
  function buildOption(opt) {
    const item = document.createElement('div');
    item.className = 'cs-option';
    item.dataset.value = opt.value;
    item.textContent = opt.textContent;
    if (sel.value === opt.value) item.classList.add('selected');
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      updateLabel();
      panel.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
      item.classList.add('selected');
      closePanel();
    });
    return item;
  }
  function updateLabel() {
    const selected = sel.options[sel.selectedIndex];
    const labEl = btn.querySelector('.custom-select-label');
    const full = selected ? selected.textContent : '—';
    labEl.textContent = full;
    // Pas la place pour le nom complet ? on retire les emojis de tête
    // (ex : "🏊🚴🏃 Triathlon" tronqué -> "Triathlon" lisible)
    // setTimeout et non rAF : rAF est gelé fenêtre en arrière-plan
    setTimeout(() => {
      if (labEl.scrollWidth > labEl.clientWidth + 1) {
        const noEmoji = full.replace(/^[^\p{L}\p{N}]+\s*/u, '');
        if (noEmoji && noEmoji !== full) labEl.textContent = noEmoji;
      }
    }, 0);
  }
  function openPanel() {
    rebuildPanel();
    wrap.classList.add('open');
    // Scroll vers l'option sélectionnée
    const sel_ = panel.querySelector('.cs-option.selected');
    if (sel_) sel_.scrollIntoView({ block: 'nearest' });
    // Ferme au clic en dehors
    setTimeout(() => document.addEventListener('mousedown', onOutside), 0);
  }
  function closePanel() {
    wrap.classList.remove('open');
    document.removeEventListener('mousedown', onOutside);
  }
  function onOutside(e) {
    if (!wrap.contains(e.target)) closePanel();
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    wrap.classList.contains('open') ? closePanel() : openPanel();
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      wrap.classList.contains('open') ? closePanel() : openPanel();
    }
  });

  // Init
  updateLabel();
  // Si le select change depuis l'extérieur, met à jour le label
  sel._customUpdate = updateLabel;
}


// === Sport select : peuple avec tous les sports SPORTS_CATALOG groupés par catégorie ===
export function populateSportSelect(selectId, defaultValue) {
  const sel = document.getElementById(selectId);
  if (!sel || !window.SPORTS_CATALOG) return;
  // Groupe les sports par catégorie
  const groups = {};
  for (const [rawType, info] of Object.entries(window.SPORTS_CATALOG)) {
    const cat = info.category || 'autre';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ rawType, fr: info.fr, icon: info.icon || '' });
  }
  // Ordre d'affichage des catégories
  const catOrder = ['triathlon', 'cyclisme', 'course', 'natation', 'musculation', 'autre'];
  const catLabels = {
    triathlon: '🏊🚴🏃 Triathlon',
    cyclisme: '🚴 Cyclisme',
    course: '🏃 Course à pied',
    natation: '🏊 Natation',
    musculation: '🏋️ Musculation',
    autre: '📦 Autre',
  };
  // Vide et reconstruit
  sel.innerHTML = '';
  for (const cat of catOrder) {
    if (!groups[cat]) continue;
    const og = document.createElement('optgroup');
    og.label = catLabels[cat] || cat;
    // Tri alphabétique dans chaque catégorie
    groups[cat].sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    for (const s of groups[cat]) {
      const opt = document.createElement('option');
      opt.value = s.rawType; // ex: "Ride", "AlpineSki" — pour avoir le sport Strava exact
      opt.textContent = `${s.icon ? s.icon + ' ' : ''}${s.fr}`;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
  if (defaultValue) sel.value = defaultValue;
  // Si le select a déjà été enhanced, refresh le label
  if (sel._customUpdate) sel._customUpdate();
  // Sinon, l'enhance maintenant
  enhanceSelect(selectId);
}


// === File picker custom (au lieu du bouton "Choisir un fichier" natif) ===
export function initFilePickers() {
  document.querySelectorAll('.file-picker').forEach(picker => {
    if (picker._wired) return;
    picker._wired = true;
    const targetId = picker.getAttribute('data-target');
    const input = targetId ? document.getElementById(targetId) : picker.querySelector('input[type="file"]');
    const btn = picker.querySelector('.file-picker-btn');
    const label = picker.querySelector('.file-picker-label');
    const clearBtn = picker.querySelector('.file-picker-clear');
    const defaultLabel = label.textContent;
    if (!input || !btn || !label) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      input.click();
    });
    input.addEventListener('change', () => {
      const f = input.files[0];
      if (f) {
        label.textContent = f.name;
        picker.classList.add('has-file');
        if (clearBtn) clearBtn.hidden = false;
      } else {
        label.textContent = defaultLabel;
        picker.classList.remove('has-file');
        if (clearBtn) clearBtn.hidden = true;
      }
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        input.value = '';
        label.textContent = defaultLabel;
        picker.classList.remove('has-file');
        clearBtn.hidden = true;
      });
    }
  });
}


// === Time stepper (heure avec flèches haut/bas) ===
// Step: +/- 1h pour heure, +/- 5 min pour minutes
function initTimeSteppers() {
  document.querySelectorAll('.time-stepper').forEach(stepper => {
    if (stepper._wired) return;
    stepper._wired = true;
    const targetId = stepper.getAttribute('data-target');
    const hiddenInput = targetId ? document.getElementById(targetId) : null;

    function read() {
      const h = parseInt(stepper.querySelector('.time-val[data-part="hour"]').textContent, 10) || 0;
      const m = parseInt(stepper.querySelector('.time-val[data-part="min"]').textContent, 10) || 0;
      return { h, m };
    }
    function write(h, m) {
      // Normalise (wrap)
      h = ((h % 24) + 24) % 24;
      m = ((m % 60) + 60) % 60;
      stepper.querySelector('.time-val[data-part="hour"]').textContent = h.toString().padStart(2, '0');
      stepper.querySelector('.time-val[data-part="min"]').textContent = m.toString().padStart(2, '0');
      if (hiddenInput) hiddenInput.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
    // Init hidden input depuis l'état affiché
    const cur = read();
    write(cur.h, cur.m);

    stepper.addEventListener('click', (e) => {
      const btn = e.target.closest('.time-arrow');
      if (!btn) return;
      e.preventDefault();
      const part = btn.getAttribute('data-part');
      const dir = parseInt(btn.getAttribute('data-dir'), 10);
      const { h, m } = read();
      if (part === 'hour') write(h + dir, m);
      else if (part === 'min') write(h, m + dir * 5);
    });
  });
}


// Custom dropdowns pour mois ET année dans Flatpickr (au lieu du select natif moche)
// Approche : on REMPLACE complètement le contenu de .flatpickr-current-month
function attachCustomMonthDropdown(monthBox, fpInstance) {
  if (monthBox._customMonthAttached) return;
  monthBox._customMonthAttached = true;

  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  // Sauvegarde du contenu original au cas où on doive le restaurer
  const originalHTML = monthBox.innerHTML;
  // On vide et reconstruit le contenu du header
  monthBox.innerHTML = '';
  monthBox.classList.add('fp-cm-custom');

  function buildBtn(label, extraClass) {
    const wrap = document.createElement('div');
    wrap.className = 'fp-cs-wrap';
    const btn = document.createElement('div');
    btn.className = 'fp-cs-btn ' + (extraClass || '');
    btn.innerHTML = `<span class="fp-cs-label">${label}</span><span class="fp-cs-arrow"></span>`;
    wrap.appendChild(btn);
    const panel = document.createElement('div');
    panel.className = 'fp-cs-panel';
    wrap.appendChild(panel);
    return { wrap, btn, panel };
  }

  // Panels en body (pour échapper à tout container avec overflow:hidden / z-index trop bas)
  function buildBody(extraClass) {
    const panel = document.createElement('div');
    panel.className = 'fp-cs-panel-body ' + (extraClass || '');
    // Le panneau est dans <body>, hors du calendrier Flatpickr : sans ça, le
    // mousedown serait vu comme un "clic extérieur" et Flatpickr fermerait avant
    // que le clic sur l'option n'aboutisse → la sélection mois/année serait perdue.
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    document.body.appendChild(panel);
    return panel;
  }

  // === MOIS ===
  const m = buildBtn(monthNames[fpInstance.currentMonth], 'fp-month-btn');
  m.panel.remove(); // on n'utilise pas le panel inline, on en crée un dans body
  const mPanel = buildBody('fp-month-panel-body');
  for (let i = 0; i < 12; i++) {
    const it = document.createElement('div');
    it.className = 'fp-cs-option';
    it.textContent = monthNames[i];
    it.dataset.month = i;
    it.addEventListener('click', (e) => {
      e.stopPropagation();
      // On garde le jour courant (borné au dernier jour du mois cible) et on
      // VALIDE la date → le changement se sauvegarde sans avoir à cliquer un jour.
      const cur = fpInstance.selectedDates[0] || new Date(fpInstance.currentYear, fpInstance.currentMonth, 1);
      const maxDay = new Date(fpInstance.currentYear, i + 1, 0).getDate();
      fpInstance.setDate(new Date(fpInstance.currentYear, i, Math.min(cur.getDate(), maxDay)), true);
      syncLabels();
      closeAll();
    });
    mPanel.appendChild(it);
  }
  m.btn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel(m.btn, mPanel, fpInstance.currentMonth);
  });
  monthBox.appendChild(m.wrap);

  // === ANNÉE ===
  const y = buildBtn(String(fpInstance.currentYear), 'fp-year-btn');
  y.panel.remove();
  const yPanel = buildBody('fp-year-panel-body');
  function rebuildYears(centerYear) {
    yPanel.innerHTML = '';
    for (let yy = centerYear - 8; yy <= centerYear + 8; yy++) {
      const it = document.createElement('div');
      it.className = 'fp-cs-option';
      it.textContent = yy;
      it.dataset.year = yy;
      if (yy === fpInstance.currentYear) it.classList.add('selected');
      it.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = fpInstance.selectedDates[0] || new Date(fpInstance.currentYear, fpInstance.currentMonth, 1);
        const maxDay = new Date(yy, fpInstance.currentMonth + 1, 0).getDate();
        fpInstance.setDate(new Date(yy, fpInstance.currentMonth, Math.min(cur.getDate(), maxDay)), true);
        syncLabels();
        closeAll();
      });
      yPanel.appendChild(it);
    }
  }
  rebuildYears(fpInstance.currentYear);
  y.btn.addEventListener('click', (e) => {
    e.stopPropagation();
    rebuildYears(fpInstance.currentYear);
    togglePanel(y.btn, yPanel, null, true);
  });
  monthBox.appendChild(y.wrap);

  // Stocke refs panels pour syncLabels / closeAll
  const allPanels = [mPanel, yPanel];
  const allBtns = [m.btn, y.btn];

  // Nettoyage si la modal/calendrier se ferme
  fpInstance.config.onClose = (fpInstance.config.onClose || []).concat([() => closeAll()]);
  // Nettoyage panel si Flatpickr est détruit
  const origDestroy = fpInstance.destroy.bind(fpInstance);
  fpInstance.destroy = function() {
    allPanels.forEach(p => p.remove());
    return origDestroy();
  };

  // === Sync au changement (via les flèches prev/next ou via select date) ===
  function syncLabels() {
    m.btn.querySelector('.fp-cs-label').textContent = monthNames[fpInstance.currentMonth];
    y.btn.querySelector('.fp-cs-label').textContent = String(fpInstance.currentYear);
  }
  // On hook nos handlers en config (Flatpickr accepte un tableau)
  const addHook = (key, fn) => {
    if (!fpInstance.config[key]) fpInstance.config[key] = [];
    else if (!Array.isArray(fpInstance.config[key])) fpInstance.config[key] = [fpInstance.config[key]];
    fpInstance.config[key].push(fn);
  };
  addHook('onMonthChange', syncLabels);
  addHook('onYearChange', syncLabels);
  addHook('onChange', syncLabels);

  function closeAll() {
    allPanels.forEach(p => p.classList.remove('open'));
    allBtns.forEach(b => b.classList.remove('open'));
    document.removeEventListener('mousedown', onOutside);
  }
  function positionPanel(btn, panel) {
    const rect = btn.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.top = (rect.bottom + 6) + 'px';
    panel.style.left = (rect.left + rect.width / 2) + 'px';
    panel.style.transform = 'translateX(-50%)';
  }
  function togglePanel(btn, panel, highlightIdx, isYear) {
    const wasOpen = panel.classList.contains('open');
    closeAll();
    if (!wasOpen) {
      panel.querySelectorAll('.fp-cs-option').forEach((it, i) => {
        if (isYear) {
          it.classList.toggle('selected', parseInt(it.dataset.year, 10) === fpInstance.currentYear);
        } else {
          it.classList.toggle('selected', i === highlightIdx);
        }
      });
      positionPanel(btn, panel);
      panel.classList.add('open');
      btn.classList.add('open');
      setTimeout(() => {
        const sel = panel.querySelector('.fp-cs-option.selected');
        if (sel) sel.scrollIntoView({ block: 'center' });
        document.addEventListener('mousedown', onOutside);
      }, 0);
    }
  }
  function onOutside(e) {
    if (!monthBox.contains(e.target) && !allPanels.some(p => p.contains(e.target))) closeAll();
  }
}


// Init Flatpickr (date pickers stylisés) sur tous les inputs date/time
export function initFlatpickrAll() {
  if (typeof flatpickr === 'undefined') return;
  // Locale française
  if (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.fr) {
    flatpickr.localize(flatpickr.l10ns.fr);
  }
  // Helper : empêche complètement la caret de l'input visible (cliquable mais pas éditable)
  function lockInput(t) {
    if (!t) return;
    t.setAttribute('readonly', 'readonly');
    t.setAttribute('inputmode', 'none');
    t.setAttribute('tabindex', '0');
    // Empêche le caret de se positionner même au clic
    t.addEventListener('mousedown', (e) => {
      // On laisse le clic ouvrir Flatpickr, mais on annule la sélection texte
      t.blur();
      setTimeout(() => t.focus(), 0);
      // Désélectionne immédiatement toute sélection en cours sur le document
      if (window.getSelection) window.getSelection().removeAllRanges();
    });
    t.addEventListener('focus', () => {
      // Pas de caret visible
      t.setSelectionRange && t.setSelectionRange(0, 0);
    });
    t.addEventListener('select', () => {
      t.setSelectionRange && t.setSelectionRange(0, 0);
    });
  }

  // Dates : format dd/mm/yyyy à l'affichage, valeur stockée en yyyy-mm-dd
  document.querySelectorAll('input[type="date"]').forEach(el => {
    if (el._flatpickr) return;
    flatpickr(el, {
      dateFormat: 'Y-m-d',
      altInput: true,
      // "Forme & fatigue" (pleine largeur) en lettres ; les colonnes étroites en chiffres (compact, 1 ligne).
      altFormat: (el.id === 'load-from' || el.id === 'load-to') ? 'j F Y' : 'd/m/Y',
      allowInput: false,
      disableMobile: true,
      clickOpens: true,
      monthSelectorType: 'static', // pas de select natif moche, navigation par flèches uniquement
      onReady(_, __, instance) {
        if (instance.altInput) {
          instance.altInput.placeholder = 'Sélectionner une date';
          instance.altInput.classList.add('fp-with-icon', 'fp-icon-date');
          lockInput(instance.altInput);
        }
        // Rend le mois cliquable pour ouvrir notre custom dropdown
        try {
          const monthBox = instance.calendarContainer.querySelector('.flatpickr-current-month');
          if (monthBox && typeof attachCustomMonthDropdown === 'function') {
            attachCustomMonthDropdown(monthBox, instance);
          }
        } catch (err) {
          console.error('[attachCustomMonthDropdown]', err);
        }
      },
    });
  });
  // Plus de Flatpickr pour les heures : on utilise le time-stepper custom
  initTimeSteppers();
}


// === Options "Type d'épreuve" selon le sport choisi ===
// Pour Cyclisme : 2 choix (Course en ligne, Contre la montre)
// Pour les autres sports : pas d'options spécifiques pour l'instant (champ vide)
// Type d'épreuve : réservé au CYCLISME (Circuit / Course en ligne / CLM)
const CYCLING_TYPE_OPTIONS = ['Circuit', 'Course en ligne', 'Contre la montre'];


export function populateTypeSelectForSport(rawType) {
  const sel = document.getElementById('comp-modal-type');
  if (!sel) return;
  const isCyc = (typeof getSportCategory === 'function') && getSportCategory(rawType) === 'cyclisme';
  // Champ visible uniquement pour le cyclisme
  const wrap = sel.closest('label') || (sel.parentElement && sel.parentElement.closest('.form-field'));
  const cs = sel.parentElement && sel.parentElement.classList.contains('custom-select') ? sel.parentElement : null;
  const holder = (cs && cs.closest('label')) || wrap;
  if (holder) holder.style.display = isCyc ? '' : 'none';
  const opts = isCyc ? CYCLING_TYPE_OPTIONS : [];
  const prev = sel.value;
  sel.innerHTML = '';
  // Option vide par défaut (texte libre / non précisé)
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = opts.length ? 'Sélectionner...' : 'Non précisé';
  sel.appendChild(empty);
  opts.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  });
  // Réessaye de garder la valeur précédente si possible
  if (prev && Array.from(sel.options).some(o => o.value === prev)) {
    sel.value = prev;
  } else {
    sel.value = '';
  }
  // Re-enhance le custom dropdown
  if (typeof enhanceSelect === 'function') enhanceSelect('comp-modal-type');
  if (sel._customUpdate) sel._customUpdate();
  if (typeof updateLapsVisibility === 'function') updateLapsVisibility();
}


// Fédérations par catégorie de sport (filtres futurs : FFC vs UFOLEP etc.)
export const FEDERATIONS_BY_CAT = {
  cyclisme: ['FFC', 'UFOLEP', 'FSGT'],
  course: ['FFA', 'Hors stade'],
  triathlon: ['FFTri'],
  natation: ['FFN'],
};

const LEVEL_PLACEHOLDER_BY_FED = {
  FFC: 'ex : Open 1-3, Access 3-4',
  UFOLEP: 'ex : 2e-3e cat',
  FSGT: 'ex : 3e-4e cat',
  FFTri: 'ex : D3, Open',
};

// Catalogues de categories fermees par federation (le champ devient un select).
// FFA : categories d'age officielles (reforme 2020), determinees par l'annee
// de naissance ; saison du 1er novembre au 31 octobre.
const LEVEL_OPTIONS_BY_FED = {
  FFA: [
    ['EA', 'EA · Éveil athlétique (U10)'],
    ['PO', 'PO · Poussin (U12)'],
    ['BE', 'BE · Benjamin (U14)'],
    ['MI', 'MI · Minime (U16)'],
    ['CA', 'CA · Cadet (U18)'],
    ['JU', 'JU · Junior (U20)'],
    ['ES', 'ES · Espoir (U23)'],
    ['SE', 'SE · Senior (23-34)'],
    ['M0', 'M0 · Master 35-39'], ['M1', 'M1 · Master 40-44'], ['M2', 'M2 · Master 45-49'],
    ['M3', 'M3 · Master 50-54'], ['M4', 'M4 · Master 55-59'], ['M5', 'M5 · Master 60-64'],
    ['M6', 'M6 · Master 65-69'], ['M7', 'M7 · Master 70-74'], ['M8', 'M8 · Master 75-79'],
    ['M9', 'M9 · Master 80-84'], ['M10', 'M10 · Master 85+'],
  ],
};

// Niveau : select si la fede a un catalogue ferme, saisie libre sinon
export function updateLevelFieldForFed(fed, keepValue) {
  const inp = document.getElementById('comp-modal-level');
  const sel = document.getElementById('comp-modal-level-select');
  if (!inp || !sel) return;
  const opts = LEVEL_OPTIONS_BY_FED[fed];
  const selWrap = (sel.parentElement && sel.parentElement.classList.contains('custom-select')) ? sel.parentElement : sel;
  if (opts) {
    const prev = keepValue != null ? keepValue : (sel.value || inp.value);
    sel.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Non précisée';
    sel.appendChild(empty);
    opts.forEach(([v, lab]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = lab;
      sel.appendChild(o);
    });
    // valeur legacy hors catalogue : on la garde comme option supplementaire
    if (prev && !opts.some(([v]) => v === prev)) {
      const o = document.createElement('option');
      o.value = prev;
      o.textContent = prev;
      sel.appendChild(o);
    }
    sel.value = prev || '';
    sel.hidden = false;
    inp.style.display = 'none';
    if (typeof enhanceSelect === 'function') enhanceSelect('comp-modal-level-select');
    if (sel._customUpdate) sel._customUpdate();
    if (selWrap !== sel) selWrap.style.display = '';
  } else {
    if (selWrap !== sel) selWrap.style.display = 'none';
    sel.hidden = true;
    inp.style.display = '';
    inp.placeholder = LEVEL_PLACEHOLDER_BY_FED[fed] || 'ex : Open 1-3';
    if (keepValue != null) inp.value = keepValue;
  }
}

export function populateFedSelectForSport(rawType) {
  const sel = document.getElementById('comp-modal-federation');
  if (!sel) return;
  const cat = (typeof getSportCategory === 'function') ? getSportCategory(rawType) : 'autre';
  const opts = (FEDERATIONS_BY_CAT[cat] || []).concat('Autre');
  const prev = sel.value;
  sel.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Non précisée';
  sel.appendChild(empty);
  opts.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  });
  if (prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
  else sel.value = '';
  if (typeof enhanceSelect === 'function') enhanceSelect('comp-modal-federation');
  if (sel._customUpdate) sel._customUpdate();
  // Niveau : select FFA / saisie libre selon la fede
  updateLevelFieldForFed(sel.value);
  // Format : uniquement pour le triathlon
  const tfWrap = document.getElementById('comp-modal-triformat-wrap');
  if (tfWrap) {
    const holder = (tfWrap.querySelector('.custom-select') && tfWrap) || tfWrap;
    holder.style.display = (cat === 'triathlon') ? '' : 'none';
  }
  if (typeof reflowSecGrids === 'function') reflowSecGrids();
}


// « Nombre de tours » : uniquement pour une épreuve en Circuit
export function updateLapsVisibility() {
  const typeSel = document.getElementById('comp-modal-type');
  const laps = document.getElementById('comp-modal-laps');
  const lab = laps && laps.closest('label');
  if (!lab) return;
  lab.style.display = (typeSel && typeSel.value === 'Circuit') ? '' : 'none';
  if (typeof reflowCompParcoursRows === 'function') reflowCompParcoursRows();
}

export function bootCompModalUi() {

// Peuple à l'init (si SPORTS_CATALOG déjà chargé), sinon différé à l'ouverture de la modal
if (window.SPORTS_CATALOG) {
  populateSportSelect('comp-modal-sport', 'Ride');
  populateSportSelect('train-modal-sport', 'Ride');
}

initFilePickers();

// Helper public pour reset un stepper à une heure donnée (ex: openCompModal)
window.resetTimeStepper = function(targetId, h = 12, m = 0) {
  const stepper = document.querySelector(`.time-stepper[data-target="${targetId}"]`);
  if (!stepper) return;
  stepper.querySelector('.time-val[data-part="hour"]').textContent = h.toString().padStart(2, '0');
  stepper.querySelector('.time-val[data-part="min"]').textContent = m.toString().padStart(2, '0');
  const hidden = document.getElementById(targetId);
  if (hidden) hidden.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

initTimeSteppers();

// Init initial + ré-init si la liste change
initFlatpickrAll();

document.getElementById('comp-modal-federation')?.addEventListener('change', () => {
  const sel = document.getElementById('comp-modal-federation');
  if (sel) updateLevelFieldForFed(sel.value);
});

document.getElementById('comp-modal-type')?.addEventListener('change', updateLapsVisibility);


// Écoute les changements de sport pour mettre à jour les options du type
(function wireTypeSelectToSport() {
  const sportSel = document.getElementById('comp-modal-sport');
  if (!sportSel) return;
  sportSel.addEventListener('change', () => { populateTypeSelectForSport(sportSel.value); populateFedSelectForSport(sportSel.value); });
})();
}
