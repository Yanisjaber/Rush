import { useSyncExternalStore } from 'react';
import { chargerLayout, enregistrerLayout } from '@/data/api';
import { ajouterA, deplacerDans, retirerDe, taillerDans } from '@/data/disposition-edition';
import { compositionAuto, composerOnglet, normaliser, ONGLETS_PERSONNALISABLES, type Disposition, type WidgetPlace } from '@/data/registre';
import type { Taille } from '@/data/types';

// Disposition de l'accueil (quels widgets, dans quel ordre, quelle taille). Port de stores/disposition.svelte.js.
//
// Stockage : colonne `layout` de user_preferences (une ligne par utilisateur, protégée par la RLS). En démo, ou si la lecture échoue,
// la disposition reste en mémoire : l'app marche dans tous les cas.
// Tant que l'utilisateur n'a rien modifié, la disposition est « automatique » : elle se recompose toute seule quand ses sports changent.
// Dès qu'il édite, elle devient la sienne.
export interface EtatDisposition {
  pret: boolean;
  auto: boolean;
  widgets: WidgetPlace[];
  /** Composition propre à chaque onglet riche (Muscu, Hyrox) ; null = composition par défaut. */
  onglets: Record<string, WidgetPlace[] | null>;
  /** Liste modifiée pendant l'édition : 'tout' ou un onglet de ONGLETS_PERSONNALISABLES. */
  ongletEdition: string;
  enEdition: boolean;
  /** 'base' = enregistrée dans le compte ; 'local' = seulement sur cet appareil (démo, ou base injoignable). */
  stockage: 'base' | 'local';
  message: string;
}

const ongletsVides = (): Record<string, WidgetPlace[] | null> => Object.fromEntries(ONGLETS_PERSONNALISABLES.map((s) => [s, null]));
const copie = (liste: WidgetPlace[]): WidgetPlace[] => liste.map((w) => ({ ...w }));
const estOngletRiche = (onglet: string) => ONGLETS_PERSONNALISABLES.includes(onglet);

let etat: EtatDisposition = { pret: false, auto: true, widgets: [], onglets: ongletsVides(), ongletEdition: 'tout', enEdition: false, stockage: 'local', message: '' };
let utilisateur: string | null = null; // identifiant du compte, ou 'demo'
let familles: string[] = [];
let instantane: { auto: boolean; widgets: WidgetPlace[]; onglets: Record<string, WidgetPlace[] | null> } | null = null; // avant l'édition, pour « Annuler »
const ecouteurs = new Set<() => void>();

const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};
function changer(suite: Partial<EtatDisposition>) {
  etat = { ...etat, ...suite };
  ecouteurs.forEach((fn) => fn());
}

export const useDisposition = (): EtatDisposition => useSyncExternalStore(abonner, () => etat, () => etat);

function appliquer(layout: Disposition | null, garderOnglets = false) {
  const personnalisee = !!layout && !layout.auto;
  const widgets = personnalisee ? copie(layout.widgets) : compositionAuto(familles);
  // Les compositions des onglets (Muscu, Hyrox) sont lues dès qu'une disposition existe, même si l'onglet « Tout » est automatique
  const onglets = garderOnglets ? etat.onglets : ongletsVides();
  if (!garderOnglets) for (const sport of ONGLETS_PERSONNALISABLES) onglets[sport] = layout?.onglets?.[sport] ? copie(layout.onglets[sport]) : null;
  changer({ auto: !personnalisee, widgets, onglets, pret: true });
}

/**
 * Charge la disposition d'un utilisateur (`'demo'` : en mémoire, automatique). À appeler quand le compte ou ses sports changent :
 * si c'est le même compte, seule la composition automatique est recalculée (sans toucher à une disposition personnalisée).
 */
export async function chargerDisposition(uid: string, famillesPresentes: string[]) {
  familles = famillesPresentes;
  if (utilisateur === uid && etat.pret) {
    if (etat.auto && !etat.enEdition) appliquer(null, true);
    return;
  }
  utilisateur = uid;
  if (uid === 'demo') {
    changer({ stockage: 'local', message: '', enEdition: false });
    appliquer(null);
    return;
  }
  const r = await chargerLayout(uid);
  if (utilisateur !== uid) return; // le compte a changé pendant la lecture
  changer({ stockage: r.erreur ? 'local' : 'base', message: '', enEdition: false });
  appliquer(r.erreur ? null : normaliser(r.data));
}

/** Déconnexion : on oublie la disposition de ce compte. */
export function oublierDisposition() {
  utilisateur = null;
  instantane = null;
  changer({ pret: false, auto: true, widgets: [], onglets: ongletsVides(), ongletEdition: 'tout', enEdition: false, message: '' });
}

async function enregistrer() {
  const layout: Disposition = { v: 1, auto: etat.auto, widgets: etat.widgets.map((w) => ({ id: w.id, taille: w.taille })) };
  const onglets: Record<string, WidgetPlace[]> = {};
  for (const sport of ONGLETS_PERSONNALISABLES) {
    const liste = etat.onglets[sport];
    if (liste) onglets[sport] = liste.map((w) => ({ id: w.id, taille: w.taille }));
  }
  if (Object.keys(onglets).length) layout.onglets = onglets;
  if (!utilisateur || utilisateur === 'demo' || etat.stockage !== 'base') return changer({ message: '' });
  const r = await enregistrerLayout(utilisateur, layout);
  changer({ stockage: r.erreur ? 'local' : 'base', message: r.erreur ? 'Enregistré sur cet appareil seulement (la sauvegarde en ligne a échoué).' : '' });
}

// --- Édition ---
// On modifie toujours UNE liste : celle de l'onglet « Tout », ou celle d'un onglet riche (Muscu, Hyrox) qui a sa propre composition.

/** La liste en cours de modification. */
export function listeEnEdition(e: EtatDisposition = etat): WidgetPlace[] {
  const o = e.ongletEdition;
  return estOngletRiche(o) && e.onglets[o] ? (e.onglets[o] as WidgetPlace[]) : e.widgets;
}

function remplacerListe(liste: WidgetPlace[]) {
  const o = etat.ongletEdition;
  if (estOngletRiche(o) && etat.onglets[o]) changer({ onglets: { ...etat.onglets, [o]: liste } });
  else changer({ widgets: liste });
}

/** Une modification de l'onglet « Tout » rend l'accueil « personnalisé » ; celle d'un onglet riche ne touche pas à l'onglet « Tout ». */
const personnaliser = () => {
  if (!estOngletRiche(etat.ongletEdition) && etat.auto) changer({ auto: false });
};

/** Ouvre le mode édition sur `onglet` ('tout' ou un onglet riche ; celui-ci part de sa composition par défaut s'il n'en avait pas). */
export function demarrerEdition(onglet = 'tout') {
  const cible = estOngletRiche(onglet) ? onglet : 'tout';
  instantane = {
    auto: etat.auto,
    widgets: copie(etat.widgets),
    onglets: Object.fromEntries(ONGLETS_PERSONNALISABLES.map((s) => [s, etat.onglets[s] ? copie(etat.onglets[s] as WidgetPlace[]) : null])),
  };
  const onglets = { ...etat.onglets };
  if (estOngletRiche(cible) && !onglets[cible]) onglets[cible] = composerOnglet(etat.widgets, cible);
  changer({ onglets, ongletEdition: cible, message: '', enEdition: true });
}

export function annulerEdition() {
  if (instantane) changer({ auto: instantane.auto, widgets: instantane.widgets, onglets: instantane.onglets });
  instantane = null;
  changer({ ongletEdition: 'tout', enEdition: false });
}

export async function terminerEdition() {
  changer({ enEdition: false, ongletEdition: 'tout' });
  instantane = null;
  await enregistrer();
}

/**
 * « Revenir à la composition automatique » : sur un onglet Muscu ou Hyrox, seul cet onglet est remis par défaut ;
 * sur l'onglet « Tout », tout l'accueil (onglets compris) est recomposé automatiquement.
 */
export async function reinitialiserAuto() {
  if (estOngletRiche(etat.ongletEdition)) changer({ onglets: { ...etat.onglets, [etat.ongletEdition]: null } });
  else appliquer(null);
  changer({ enEdition: false, ongletEdition: 'tout' });
  instantane = null;
  await enregistrer();
}

export function deplacer(index: number, sens: -1 | 1) {
  remplacerListe(deplacerDans(listeEnEdition(), index, sens));
  personnaliser();
}

export function retirer(id: string) {
  remplacerListe(retirerDe(listeEnEdition(), id));
  personnaliser();
}

export function ajouter(id: string) {
  remplacerListe(ajouterA(listeEnEdition(), id));
  personnaliser();
}

export function changerTaille(id: string, taille: Taille) {
  remplacerListe(taillerDans(listeEnEdition(), id, taille));
  personnaliser();
}
