// Disposition de l'accueil (quels widgets, dans quel ordre, quelle taille), réactive.
//
// Stockage : table Supabase `user_preferences` (une ligne par utilisateur, protégée par la RLS).
// Si la table n'existe pas encore (migration non appliquée) ou en mode démo, la disposition est
// gardée dans le navigateur (localStorage) : l'app marche dans tous les cas.
//
// Tant que l'utilisateur n'a rien modifié, la disposition est « automatique » : elle se recompose
// toute seule quand ses sports changent. Dès qu'il édite, elle devient la sienne.
import { sb } from '../supabase.js';
import { WIDGETS, compositionAuto, composerOnglet, existe, normaliser, ONGLETS_PERSONNALISABLES } from '../widgets/registre.js';

export const disposition = $state({
  pret: false,
  auto: true,
  widgets: [],
  onglets: { muscu: null, hyrox: null }, // composition propre à chaque onglet riche (null = composition par défaut)
  ongletEdition: 'tout', // liste modifiée pendant l'édition : 'tout' ou un onglet de ONGLETS_PERSONNALISABLES
  enEdition: false,
  editionDemandee: false, // posé depuis les paramètres : l'accueil ouvre le mode édition dès qu'il est chargé
  stockage: 'local', // 'base' ou 'local'
  message: '',
});

let utilisateur = 'demo';
let familles = [];
let instantane = null; // copie de la disposition avant l'édition, pour « Annuler »

const cleLocale = (uid) => `rush-disposition-${uid}`;

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

function appliquer(layout, garderOnglets = false) {
  const personnalisee = !!layout && !layout.auto;
  const base = personnalisee ? layout : compositionAuto(familles);
  disposition.auto = !personnalisee;
  disposition.widgets = base.widgets.map((w) => ({ ...w }));
  // Les compositions propres aux onglets (Muscu, Hyrox) sont lues dès qu'une disposition existe, même si l'onglet « Tout » est automatique
  if (!garderOnglets) {
    disposition.onglets = { muscu: null, hyrox: null };
    for (const sport of ONGLETS_PERSONNALISABLES) {
      const liste = layout?.onglets?.[sport];
      disposition.onglets[sport] = liste ? liste.map((w) => ({ ...w })) : null;
    }
  }
  disposition.pret = true;
}

/** Charge la disposition de l'utilisateur (base de données, sinon navigateur, sinon automatique). */
export async function chargerDisposition(uid, famillesPresentes) {
  utilisateur = uid;
  familles = famillesPresentes;
  let layout = null;
  disposition.stockage = 'local';
  if (uid !== 'demo') {
    const r = await sb.from('user_preferences').select('layout').eq('user_id', uid).maybeSingle();
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

/** Recompose l'accueil automatique quand la liste des sports change (sans toucher à une disposition personnalisée ni aux onglets). */
export function mettreAJourSports(famillesPresentes) {
  familles = famillesPresentes;
  if (disposition.auto && !disposition.enEdition) appliquer(null, true);
}

async function enregistrer() {
  const layout = { v: 1, auto: disposition.auto, widgets: disposition.widgets.map((w) => ({ id: w.id, taille: w.taille })) };
  const onglets = {};
  for (const sport of ONGLETS_PERSONNALISABLES) {
    if (disposition.onglets[sport]) onglets[sport] = disposition.onglets[sport].map((w) => ({ id: w.id, taille: w.taille }));
  }
  if (Object.keys(onglets).length) layout.onglets = onglets;
  ecrireLocal(utilisateur, layout);
  if (utilisateur === 'demo' || disposition.stockage !== 'base') {
    disposition.message = ''; // enregistré sur l'appareil : rien à dire, ça n'a pas besoin d'un message
    return;
  }
  const r = await sb
    .from('user_preferences')
    .upsert({ user_id: utilisateur, layout, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (r.error) {
    console.error('[app/disposition]', r.error.code || '');
    disposition.stockage = 'local';
    disposition.message = "Enregistré sur cet appareil (la sauvegarde en ligne a échoué).";
  } else {
    disposition.message = ''; // enregistré en ligne : rien à dire (seule une erreur de sauvegarde mérite un message)
  }
}

// --- Édition ---
// On modifie toujours UNE liste : celle de l'onglet « Tout », ou celle d'un onglet riche (Muscu, Hyrox) qui a sa propre composition.

const copie = (liste) => liste.map((w) => ({ ...w }));
const estOngletRiche = (onglet) => ONGLETS_PERSONNALISABLES.includes(onglet);

/** La liste en cours de modification. */
function listeEnEdition() {
  const o = disposition.ongletEdition;
  return estOngletRiche(o) && disposition.onglets[o] ? disposition.onglets[o] : disposition.widgets;
}

function remplacerListe(liste) {
  const o = disposition.ongletEdition;
  if (estOngletRiche(o) && disposition.onglets[o]) disposition.onglets[o] = liste;
  else disposition.widgets = liste;
}

/**
 * Ouvre le mode édition. `onglet` : 'tout' ou un onglet riche ; un onglet riche qui n'avait pas encore sa composition
 * part de la composition par défaut, qu'on peut alors modifier.
 */
export function demarrerEdition(onglet = 'tout') {
  const cible = estOngletRiche(onglet) ? onglet : 'tout';
  instantane = {
    auto: disposition.auto,
    widgets: copie(disposition.widgets),
    onglets: Object.fromEntries(ONGLETS_PERSONNALISABLES.map((sport) => [sport, disposition.onglets[sport] ? copie(disposition.onglets[sport]) : null])),
  };
  if (estOngletRiche(cible) && !disposition.onglets[cible]) disposition.onglets[cible] = composerOnglet(disposition.widgets, cible);
  disposition.ongletEdition = cible;
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
    disposition.onglets = instantane.onglets;
  }
  instantane = null;
  disposition.ongletEdition = 'tout';
  disposition.enEdition = false;
}

export async function terminerEdition() {
  disposition.enEdition = false;
  disposition.ongletEdition = 'tout';
  instantane = null;
  await enregistrer();
}

/**
 * « Revenir à la composition automatique » : sur un onglet Muscu ou Hyrox, seul cet onglet est remis par défaut ;
 * sur l'onglet « Tout », tout l'accueil (onglets compris) est recomposé automatiquement.
 */
export async function reinitialiserAuto() {
  if (estOngletRiche(disposition.ongletEdition)) disposition.onglets[disposition.ongletEdition] = null;
  else appliquer(null);
  disposition.enEdition = false;
  disposition.ongletEdition = 'tout';
  instantane = null;
  await enregistrer();
}

/** Une modification de l'onglet « Tout » rend l'accueil « personnalisé » ; celle d'un onglet riche ne touche pas à l'onglet « Tout ». */
function personnaliser() {
  if (!estOngletRiche(disposition.ongletEdition)) disposition.auto = false;
}

export function deplacer(index, sens) {
  const w = listeEnEdition();
  const cible = index + sens;
  if (cible < 0 || cible >= w.length) return;
  [w[index], w[cible]] = [w[cible], w[index]];
  personnaliser();
}

/** Déplace le widget d'une position à une autre (glisser-déposer au doigt) : les autres se décalent d'un cran. */
export function deplacerVers(de, vers) {
  const w = listeEnEdition();
  if (de === vers || de < 0 || vers < 0 || de >= w.length || vers >= w.length) return;
  const [bouge] = w.splice(de, 1);
  w.splice(vers, 0, bouge);
  personnaliser();
}

export function retirer(id) {
  remplacerListe(listeEnEdition().filter((w) => w.id !== id));
  personnaliser();
}

export function ajouter(id) {
  const liste = listeEnEdition();
  if (!existe(id) || liste.some((w) => w.id === id)) return;
  const def = WIDGETS[id];
  remplacerListe([...liste, { id, taille: def.taille }]);
  personnaliser();
}

export function changerTaille(id, taille) {
  if (!existe(id)) return;
  const def = WIDGETS[id];
  const w = listeEnEdition().find((x) => x.id === id);
  if (!w || !def.tailles.includes(taille)) return;
  w.taille = taille;
  personnaliser();
}
