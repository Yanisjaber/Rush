/* src/core/ui/dialogs.js — extrait de l'ancien app.js (découpage par fonctionnalité). */


export function bootDialogs() {


// ========= Modal de confirmation custom (remplace window.confirm) =========
// Usage : const ok = await appConfirm({ title, message, confirmLabel, cancelLabel, danger })
window.appConfirm = function(opts) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const okBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const inner = overlay.querySelector('.confirm-modal');
    if (!overlay || !titleEl || !msgEl || !okBtn || !cancelBtn || !inner) {
      // Fallback ultra-safe
      resolve(window.confirm(opts && opts.message ? opts.message : 'Confirmer ?'));
      return;
    }
    // Configuration
    titleEl.textContent = (opts && opts.title) || 'Confirmer';
    // Support du HTML simple (pour mettre en gras le nom)
    if (opts && opts.html) msgEl.innerHTML = opts.html;
    else msgEl.textContent = (opts && opts.message) || '';
    okBtn.textContent = (opts && opts.confirmLabel) || 'Confirmer';
    cancelBtn.textContent = (opts && opts.cancelLabel) || 'Annuler';
    inner.classList.toggle('is-danger', !!(opts && opts.danger));

    function cleanup() {
      overlay.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKey);
    }
    function onOk() { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }
    function onOverlayClick(e) { if (e.target === overlay) onCancel(); }
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onOk();
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKey);
    overlay.classList.add('active');
    // Focus sur le bouton de confirmation pour Enter direct
    setTimeout(() => okBtn.focus(), 50);
  });
};

// Helper d'escape HTML pour les noms d'item dans les messages de confirmation
window._confirmEscape = function(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};


// ========= Modal de saisie texte (remplace window.prompt) =========
// Usage : const txt = await appPrompt({ title, message, defaultValue, placeholder, okLabel })
// Retourne la string saisie, ou null si annulé.
window.appPrompt = function(opts) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('prompt-modal');
    const titleEl = document.getElementById('prompt-modal-title');
    const msgEl = document.getElementById('prompt-modal-message');
    const input = document.getElementById('prompt-modal-input');
    const okBtn = document.getElementById('prompt-modal-ok');
    const cancelBtn = document.getElementById('prompt-modal-cancel');
    if (!overlay || !titleEl || !msgEl || !input || !okBtn || !cancelBtn) {
      resolve(window.prompt((opts && opts.message) || '', (opts && opts.defaultValue) || ''));
      return;
    }
    titleEl.textContent = (opts && opts.title) || 'Saisir une valeur';
    msgEl.textContent = (opts && opts.message) || '';
    msgEl.style.display = (opts && opts.message) ? '' : 'none';
    input.value = (opts && opts.defaultValue) || '';
    input.placeholder = (opts && opts.placeholder) || '';
    okBtn.textContent = (opts && opts.okLabel) || 'Valider';
    cancelBtn.textContent = (opts && opts.cancelLabel) || 'Annuler';

    function cleanup() {
      overlay.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKey);
    }
    function onOk() { const v = input.value; cleanup(); resolve(v); }
    function onCancel() { cleanup(); resolve(null); }
    function onOverlayClick(e) { if (e.target === overlay) onCancel(); }
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onOk();
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKey);
    overlay.classList.add('active');
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
};


// ========= Modal d'alerte (remplace window.alert) =========
// Usage : await appAlert({ title, message, okLabel })
window.appAlert = function(opts) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('alert-modal');
    const titleEl = document.getElementById('alert-modal-title');
    const msgEl = document.getElementById('alert-modal-message');
    const okBtn = document.getElementById('alert-modal-ok');
    if (!overlay || !titleEl || !msgEl || !okBtn) {
      window.alert((opts && opts.message) || '');
      resolve();
      return;
    }
    titleEl.textContent = (opts && opts.title) || 'Information';
    msgEl.textContent = (opts && opts.message) || '';
    okBtn.textContent = (opts && opts.okLabel) || 'OK';

    function cleanup() {
      overlay.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKey);
    }
    function onOk() { cleanup(); resolve(); }
    function onOverlayClick(e) { if (e.target === overlay) onOk(); }
    function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter') onOk(); }
    okBtn.addEventListener('click', onOk);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKey);
    overlay.classList.add('active');
    setTimeout(() => okBtn.focus(), 50);
  });
};
}
