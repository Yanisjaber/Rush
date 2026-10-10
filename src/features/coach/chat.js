/* src/features/coach/chat.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { renderCompList } from '../competitions/competitions-page.js';
import { renderCalendar } from '../calendar/realise-calendar.js';


// ========= CHAT COACH IA =========
const CHAT_KEY = 'coach_ia_chat_v1';

const PREFS_KEY = 'coach_ia_prefs_v1';


function loadChatMessages() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; }
  catch { return []; }
}

function saveChatMessages(msgs) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-50))); // garder max 50 derniers
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; }
  catch { return {}; }
}

function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}


const PREF_LABELS = {
  recoveryMode: 'Mode récup activé',
  hardMode: 'Mode pousser',
  blocked: 'Repos forcé (blessure)',
  focusZone_seuil: 'Focus : Seuil',
  focusZone_vo2: 'Focus : VO2max',
  focusZone_endurance: 'Focus : Endurance',
  focusZone_force: 'Focus : Force',
  sleepConcern: 'Sommeil dégradé',
  stressMode: 'Stress signalé',
};


function renderChatPrefs() {
  const prefs = loadPrefs();
  const el = document.getElementById('chat-prefs');
  if (!el) return; // UI chat retirée
  const tags = [];
  if (prefs.recoveryMode) tags.push(PREF_LABELS.recoveryMode);
  if (prefs.hardMode) tags.push(PREF_LABELS.hardMode);
  if (prefs.blocked) tags.push(PREF_LABELS.blocked);
  if (prefs.focusZone) tags.push(PREF_LABELS['focusZone_' + prefs.focusZone] || `Focus : ${prefs.focusZone}`);
  if (prefs.sleepConcern) tags.push(PREF_LABELS.sleepConcern);
  if (prefs.stressMode) tags.push(PREF_LABELS.stressMode);
  if (tags.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `<span style="color:var(--text-dim);font-size:11px;margin-right:6px;">Préférences actives :</span>` +
    tags.map(t => `<span class="chat-pref-tag">${t}</span>`).join('');
}


function renderChat() {
  const messages = loadChatMessages();
  const container = document.getElementById('chat-messages');
  if (!container) return; // UI chat retirée
  if (messages.length === 0) {
    container.innerHTML = `<div class="chat-empty">
      Démarre la conversation avec ton Coach IA.<br>
      Exemples : "Je me sens fatigué cette semaine" · "Je veux travailler mon seuil" · "J'ai mal au genou" · "Bien dormi, en forme aujourd'hui"
    </div>`;
    return;
  }
  container.innerHTML = messages.map(m => `
    <div class="chat-message ${m.role}">
      <div class="chat-avatar ${m.role}">${m.role === 'user' ? 'TOI' : 'IA'}</div>
      <div class="chat-bubble-wrap">
        <div class="chat-bubble">${m.text}</div>
        <div class="chat-time">${m.time}</div>
      </div>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
  renderChatPrefs();
}


function generateCoachResponse(userText) {
  const t = userText.toLowerCase();
  const tsb = appState.todayData?.tsb ?? 0;
  const ctxTSB = tsb < -15 ? ` Ton TSB actuel (${tsb.toFixed(0)}) confirme.` : tsb > 5 ? ` Ton TSB est positif (+${tsb.toFixed(0)}), c'est cohérent.` : '';

  // Détection d'intentions (ordre de priorité)
  if (/blesse|blessé|blessee|douleur|mal au|mal a la|tendinit|claqu|knee|genou|cheville|dos|épaule|coude|poignet/.test(t)) {
    return {
      message: `Important : ne t'entraîne pas avec une douleur. Repos complet jusqu'à disparition.\n\nSi ça persiste plus de 3-5 jours ou empire, consulte un kiné ou un médecin du sport — c'est non négociable.\n\nJe passe ton plan en mode repos forcé. Quand tu vas mieux, dis-moi pour reprendre progressivement.`,
      prefs: { recoveryMode: true, blocked: true }
    };
  }
  if (/fatig|crevé|crevee|épuis|epuis|nase|usé|usee|kacho|ko|naze/.test(t)) {
    return {
      message: `Compris, fatigue signalée.${ctxTSB}\n\nJe vais alléger les séances :\n• Pas de blocs VO2max\n• Focus endurance Z2 et récupération active\n• Si la fatigue persiste 2-3 jours, on bascule en semaine de décharge\n\nDors bien, hydrate-toi, mange protéiné.`,
      prefs: { recoveryMode: true, blocked: false }
    };
  }
  if (/frais|en forme|reposé|reposee|pleine forme|envie de pousser|au top|peche|pêche/.test(t)) {
    return {
      message: `Top, tu es frais.${ctxTSB} Bonne fenêtre pour pousser.\n\nJe peux densifier la semaine avec :\n• Un bloc de seuil supplémentaire\n• Ou un VO2max si ton TSB le permet\n\nTu veux travailler quoi en priorité ? Seuil, VO2max, endurance, force ?`,
      prefs: { hardMode: true, recoveryMode: false, blocked: false }
    };
  }
  if (/seuil|ftp|threshold/.test(t)) {
    return {
      message: `OK, focus sur le seuil.\n\nFormat type : 2 séances/sem de 3×12min ou 4×8min à 95-105% FTP, récup 3-5min.\n\nObjectif : pousser ton FTP dans 4-6 semaines. Re-test FTP dans 4 semaines pour mesurer.`,
      prefs: { focusZone: 'seuil' }
    };
  }
  if (/vo2|vmax|aerobie max|aérobie max/.test(t)) {
    return {
      message: `Compris, VO2max comme axe de travail.\n\nFormat type : 4×4min ou 6×3min à 110-115% FTP, récup 1:1.\nTrès exigeant → 1-2 fois/semaine max, jamais 2 jours de suite.\n\nLa phase Peak de ton plan se déclenche.`,
      prefs: { focusZone: 'vo2' }
    };
  }
  if (/endur|volume|sortie longue|fond|base aerobie|base aérobie/.test(t)) {
    return {
      message: `Bon choix, construire la base aérobie c'est la fondation.\n\nPlan : sorties Z2 longues le week-end (>2h), volume hebdo augmenté de 10% max/semaine. Reste sous 75% FTP, conversation aisée.\n\nC'est moins glamour mais c'est ce qui paie sur la durée.`,
      prefs: { focusZone: 'endurance' }
    };
  }
  if (/force|muscu|musculation|gainage|renfo/.test(t)) {
    return {
      message: `OK, focus force/musculation.\n\n2-3 séances/sem en complément du vélo, format : 4-5 exos polyarticulaires (squat, deadlift, presse, gainage), 3-4 séries de 5-8 reps lourdes.\n\nÉvite le jour avant une grosse séance vélo.`,
      prefs: { focusZone: 'force' }
    };
  }
  if (/sommeil|dormi mal|mal dormi|insomnie|nuit courte|fatigue chronique/.test(t)) {
    return {
      message: `Le sommeil c'est 50% de la récupération.\n\nSi tu dors mal 2+ nuits, j'allège auto le plan : pas plus que Z3 le lendemain.\n\nConseils : couche-toi 30min plus tôt, magnesium le soir, pas d'écran 30min avant. Si chronique, vérifie ton stress et ta charge globale.`,
      prefs: { sleepConcern: true }
    };
  }
  if (/stress|boulot|travail|charge mentale|presse|pressé|pressee/.test(t)) {
    return {
      message: `Stress non-sportif = fatigue cumulative pour le corps.\n\nJe réduis l'intensité cette semaine. Privilégie aussi des séances "plaisir" courtes (1h Z2) au lieu de tout planifier dur.\n\nLa séance dure quand tu es déjà stressé peut empirer les choses.`,
      prefs: { stressMode: true }
    };
  }
  if (/decharge|décharge|recup|récup|récupération|recuperation/.test(t)) {
    return {
      message: `OK, semaine de décharge.\n\nFormat : volume réduit de 30-50%, intensité conservée mais blocs courts. Format type : 3 sorties Z2 courtes + 1 séance modérée.\n\nL'objectif est de surcompenser pour repartir frais la semaine suivante.`,
      prefs: { recoveryMode: true }
    };
  }
  if (/competition|compétition|course|objectif|preparation|préparation/.test(t)) {
    return {
      message: `Pour structurer la prépa, ajoute ta compétition dans la section "Compétitions à venir" en haut de l'onglet.\n\nJe gère ensuite automatiquement les phases :\n• Build (>8 sem)\n• Peak (4-8 sem)\n• Taper (1-4 sem)\n• Race week (< 1 sem)`,
      prefs: {}
    };
  }
  if (/^(merci|ok|d'accord|compris|bien|super|nickel)/.test(t)) {
    return {
      message: `Pas de souci, je note. Si tu changes d'avis ou veux ajuster, dis-le moi à tout moment.`,
      prefs: {}
    };
  }
  if (/^(salut|bonjour|hello|coucou|hey|yo)/.test(t)) {
    return {
      message: `Salut ! Prêt à bosser. Dis-moi comment tu te sens aujourd'hui, ce que tu veux travailler, ou si tu as des douleurs/contraintes.${ctxTSB}`,
      prefs: {}
    };
  }
  // Réponse par défaut
  return {
    message: `Noté. Je tiens compte pour la suite.\n\nDis-moi par exemple :\n• Ta sensation du jour (frais / fatigué / douleur)\n• Ce que tu veux travailler (seuil / VO2 / endurance / force)\n• Ton sommeil, ton stress, des contraintes spécifiques`,
    prefs: {}
  };
}


function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const messages = loadChatMessages();
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  messages.push({ role: 'user', text, time });

  const { message: response, prefs: newPrefs } = generateCoachResponse(text);
  messages.push({ role: 'coach', text: response, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) });

  // Sauvegarder préférences extraites
  if (newPrefs && Object.keys(newPrefs).length > 0) {
    const cur = loadPrefs();
    Object.assign(cur, newPrefs);
    savePrefs(cur);
  }

  saveChatMessages(messages);
  input.value = '';
  renderChat();
  // Re-render du calendrier pour appliquer les nouvelles préfs
  if (typeof renderCalendar === 'function') renderCalendar();
}

export function bootChat() {


// Chat handlers — défensifs car le UI chat a été retiré de PANEL 2 (Entraîneur)
appState._chatSendBtn = document.getElementById('chat-send');

if (appState._chatSendBtn) appState._chatSendBtn.addEventListener('click', sendChatMessage);

appState._chatInputEl = document.getElementById('chat-input');

if (appState._chatInputEl) appState._chatInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

appState._chatClearBtn = document.getElementById('chat-clear');

if (appState._chatClearBtn) appState._chatClearBtn.addEventListener('click', async () => {
  const ok = await appConfirm({
    title: 'Effacer la conversation',
    message: 'Effacer la conversation et les préférences enregistrées ?',
    confirmLabel: 'Effacer',
    danger: true,
  });
  if (!ok) return;
  localStorage.removeItem(CHAT_KEY);
  localStorage.removeItem(PREFS_KEY);
  renderChat();
  if (typeof renderCalendar === 'function') renderCalendar();
});


try { renderChat(); } catch (e) { console.warn('[renderChat]', e); }


// Init
renderCompList();

renderCalendar();
}
