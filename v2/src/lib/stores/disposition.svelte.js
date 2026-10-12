// Disposition de l'accueil (quels widgets, dans quel ordre, quelle taille), réactive.
//
// Stockage : table Supabase `user_dashboard` (une ligne par utilisateur, protégée par la RLS).
// Si la table n'existe pas encore (migration non appliquée) ou en mode démo, la disposition est
// gardée dans le navigateur (localStorage) : l'app marche dans tous les cas.
//
// Tant que l'utilisateur n'a rien modifié, la disposition est « automatique » : elle se recompose
// toute seule quand ses sports changent. Dès qu'il édite, elle devient la sienne.
import { sb } from '../supabase.js';
import { WIDGETS, compositionAuto, existe, normaliser } from '../widgets/registre.js';

export const disposition = $state({
  pret: false,
  auto: true,
  widgets: [],
  enEdition: false,
  editionDemandee: false, // posé depuis les paramètres : l'accueil ouvre le mode édition dès qu'il est chargé
  stockage: 'local', // 'base' ou 'local'
  message: '',
});

let utilisateur = 'demo';
let familles = [];
let instantane = null; // copie de la disposition avant l'édition, pour « Annuler »

const cleLocale = (uid) => `coachia-v2-disposition-${uid}`;

function lireLocal(uid) {
  try {
    const brut = localStorage.getItem(cleLocale(uid));
    return brut ? normaliser(JSON.parse(brut)) : null;
  } catch (e) {
    return null;
  }
}

function ecrireLocal(uid, layout) {
  try {
    localStorage.setItem(cleLocale(uid), JSON.stringify(layout));
  } catch (e) {
    /* stockage indisponible : on garde seulement la mémoire */
  }
}

function appliquer(layout) {
  const personnalisee = !!layout && !layout.auto;
  const base = personnalisee ? layout : compositionAuto(familles);
  disposition.auto = !personnalisee;
  disposition.widgets = base.widgets.map((w) => ({ ...w }));
  disposition.pret = true;
}

/** Charge la disposition de l'utilisateur (base de données, sinon navigateur, sinon automatique). */
export async function chargerDisposition(uid, famillesPresentes) {
  utilisateur = uid;
  familles = famillesPresentes;
  let layout = null;
  disposition.stockage = 'local';
  if (uid !== 'demo') {
    const r = await sb.from('user_dashboard').select('layout').eq('user_id', uid).maybeSingle();
    if (!r.error) {
      disposition.stockage = 'base';
      layout = normaliser(r.data?.layout);
    } else {
      // Table absente (migration pas encore appliquée) ou réseau : on retombe sur le navigateur.
      layout = lireLocal(uid);
    }
  } else {
    layout = lireLocal(uid);
  }
  appliquer(layout);
}

/** Recompose l'accueil automatique quand la liste des sports change (sans toucher à une disposition personnalisée). */
export function mettreAJourSports(famillesPresentes) {
  familles = famillesPresentes;
  if (disposition.auto && !disposition.enEdition) appliquer(null);
}

async function enregistrer() {
  const layout = { v: 1, auto: disposition.auto, widgets: disposition.widgets.map((w) => ({ id: w.id, taille: w.taille })) };
  ecrireLocal(utilisateur, layout);
  if (utilisateur === 'demo' || disposition.stockage !== 'base') {
    disposition.message = 'Enregistré sur cet appareil.';
    return;
  }
  const r = await sb
    .from('user_dashboard')
    .upsert({ user_id: utilisateur, layout, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (r.error) {
    console.error('[v2/disposition]', r.error.code || '');
    disposition.stockage = 'local';
    disposition.message = "Enregistré sur cet appareil (la sauvegarde en ligne a échoué).";
  } else {
    disposition.message = 'Accueil enregistré.';
  }
}

// --- Édition ---

export function demarrerEdition() {
  instantane = { auto: disposition.auto, widgets: disposition.widgets.map((w) => ({ ...w })) };
  disposition.message = '';
  disposition.enEdition = true;
}

/** Demande l'ouverture du mode édition à l'arrivée sur l'accueil (utilisé par la page Paramètres). */
export function demanderEdition() {
  disposition.editionDemandee = true;
}

export function annulerEdition() {
  if (instantane) {
    disposition.auto = instantane.auto;
    disposition.widgets = instantane.widgets;
  }
  instantane = null;
  disposition.enEdition = false;
}

export async function terminerEdition() {
  disposition.enEdition = false;
  instantane = null;
  await enregistrer();
}

export async function reinitialiserAuto() {
  appliquer(null);
  disposition.enEdition = false;
  instantane = null;
  await enregistrer();
}

function personnaliser() {
  disposition.auto = false;
}

export function deplacer(index, sens) {
  const cible = index + sens;
  if (cible < 0 || cible >= disposition.widgets.length) return;
  const w = disposition.widgets;
  [w[index], w[cible]] = [w[cible], w[index]];
  personnaliser();
}

export function retirer(id) {
  disposition.widgets = disposition.widgets.filter((w) => w.id !== id);
  personnaliser();
}

export function ajouter(id) {
  if (!existe(id) || disposition.widgets.some((w) => w.id === id)) return;
  const def = WIDGETS[id];
  disposition.widgets = [...disposition.widgets, { id, taille: def.taille }];
  personnaliser();
}

export function changerTaille(id, taille) {
  if (!existe(id)) return;
  const def = WIDGETS[id];
  const w = disposition.widgets.find((x) => x.id === id);
  if (!w || !def.tailles.includes(taille)) return;
  w.taille = taille;
  personnaliser();
}
