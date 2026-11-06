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

/** Un message tel que l'écran l'affiche */
export interface MessageCoach {
  id: string;
  role: 'user' | 'assistant';
  texte: string;
  cartes: CarteSeance[];
  /** Le coach est en train d'écrire ce message (le texte arrive au fil de l'eau) */
  enCours?: boolean;
  /** Un message de l'utilisateur qui n'est pas parti : le texte reste pour pouvoir réessayer */
  echec?: string;
}

/** Ce que le serveur envoie, une ligne « data: {…} » par événement */
export type EvenementCoach =
  | { type: 'texte'; delta: string }
  | { type: 'carte'; message_id: string; carte: CarteSeance }
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
