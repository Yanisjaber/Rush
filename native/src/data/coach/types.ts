// Les formes échangées avec le Coach IA (voir docs/ia/CADRAGE_IA.md et la fonction serveur supabase/functions/coach-chat).
// L'état d'une carte vient du serveur : l'app ne le décide jamais toute seule.

export type EtatCarte = 'proposee' | 'en_cours' | 'ajoutee' | 'refusee' | 'annulee';

export interface Proposition {
  date: string;
  sport: string;
  type: string;
  minutes: number;
}

export interface CarteSeance {
  id: string;
  etat: EtatCarte;
  proposition: Proposition;
  tss_estime: number;
  justification: string;
  /** Raison du refus (état « refusee ») */
  motif?: string;
  /** La séance créée dans le calendrier (état « ajoutee ») */
  seance_id?: string;
}

export type TypeOperation = 'indisponibilite' | 'deplacer' | 'supprimer' | 'ajouter' | 'repos';
export type TypePeriode = 'maladie' | 'blessure' | 'indisponible';

/**
 * Une ligne d'un plan de modifications (supabase/functions/_shared/planning.ts, LignePlan). Le texte est déjà écrit en français par le serveur ;
 * les autres champs servent à DESSINER le plan : sport, durée, jour d'origine (`de`) et d'arrivée (`vers`), ou la période déclarée (`type`, `du`, `au`).
 */
export interface LignePlan {
  op: TypeOperation;
  texte: string;
  raison?: string;
  sport?: string | null;
  minutes?: number | null;
  de?: string;
  vers?: string;
  type?: TypePeriode;
  du?: string;
  au?: string;
  /** Jour de repos : posé (vrai) ou retiré (faux) ; le jour est dans `vers` */
  poser?: boolean;
}

/**
 * Plusieurs modifications du calendrier (déplacer, remplacer, retirer des séances, déclarer une maladie ou une blessure) validées EN UNE FOIS.
 * Rien n'est écrit tant que l'utilisateur n'a pas validé ; le serveur revérifie alors tout le plan et peut le refuser.
 */
export interface CartePlanning {
  id: string;
  genre: 'planning';
  etat: EtatCarte;
  /** La phrase du coach qui dit pourquoi (affichée comme titre de la carte) */
  intention: string;
  lignes: LignePlan[];
  /** Charge prévue sur les 14 prochains jours (points), avant et après le plan */
  charge_avant: number;
  charge_apres: number;
  /** Raison du refus (état « refusee ») */
  motif?: string;
  /** Après une annulation : combien de lignes ont été remises, et combien laissées telles quelles parce que l'utilisateur les avait changées depuis (côté app seulement) */
  annulation?: { annulees: number; ignorees: number };
}

export type Carte = CarteSeance | CartePlanning;

export const estPlanning = (c: Carte): c is CartePlanning => (c as CartePlanning).genre === 'planning';

/** Un message tel que l'écran l'affiche */
export interface MessageCoach {
  id: string;
  role: 'user' | 'assistant';
  texte: string;
  cartes: Carte[];
  /** Le coach est en train d'écrire ce message (le texte arrive au fil de l'eau) */
  enCours?: boolean;
  /** Un message de l'utilisateur qui n'est pas parti : le texte reste pour pouvoir réessayer */
  echec?: string;
}

/** Ce que le serveur envoie, une ligne « data: {…} » par événement */
export type EvenementCoach =
  | { type: 'texte'; delta: string }
  | { type: 'carte'; message_id: string; carte: Carte }
  /** Une action sans danger (ouvrir un écran…) que l'application exécute tout de suite, parmi une liste blanche (data/coach/actions.ts) */
  | { type: 'action'; nom: string; params: Record<string, unknown> }
  | { type: 'fin'; message_id: string; texte: string }
  | { type: 'erreur'; code: string; message: string };

/** Une ligne de la table chat_messages, telle que la lit l'app */
export interface LigneMessage {
  id: string;
  role: string;
  contenu: string;
  cartes: unknown;
  created_at: string;
}
