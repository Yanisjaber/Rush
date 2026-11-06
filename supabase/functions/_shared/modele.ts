// ============================================================
// Le modèle de langage vu par le coach : une interface, pas une marque (docs/ia/CADRAGE_IA.md).
//
// Toute la logique du chat (coach-chat.ts) parle à `ClientModele`. La vraie implémentation (SDK Anthropic) est dans
// coach-chat/modele-anthropic.ts ; les tests utilisent un faux modèle qui rend des réponses écrites d'avance.
// Aucune clé, aucun réseau ici.
// ============================================================

export interface Usage {
  /** Tokens d'entrée non mis en cache */
  entree: number;
  sortie: number;
  /** Tokens d'entrée relus dans le cache (moins chers) */
  cacheLecture: number;
  /** Tokens d'entrée écrits dans le cache (un peu plus chers) */
  cacheEcriture: number;
}

export const USAGE_NUL: Usage = { entree: 0, sortie: 0, cacheLecture: 0, cacheEcriture: 0 };

export function ajouterUsage(a: Usage, b: Usage): Usage {
  return {
    entree: a.entree + b.entree,
    sortie: a.sortie + b.sortie,
    cacheLecture: a.cacheLecture + b.cacheLecture,
    cacheEcriture: a.cacheEcriture + b.cacheEcriture,
  };
}

/** Un message envoyé au modèle. Pour un tour du modèle rejoué tel quel (avec ses blocs de réflexion), `content` est la liste brute rendue par le client. */
export interface MessageModele {
  role: 'user' | 'assistant';
  content: string | unknown[];
}

export interface OutilModele {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AppelModele {
  /** Texte stable (identique d'une requête à l'autre : c'est ce qui permet le cache de prompt) */
  system: string;
  messages: MessageModele[];
  outils: OutilModele[];
  maxTokens: number;
}

export interface AppelOutil {
  id: string;
  name: string;
  /** Tel que le modèle l'a écrit : à valider, jamais à croire */
  input: unknown;
}

export interface ReponseModele {
  /** Tout le texte de ce tour */
  texte: string;
  outils: AppelOutil[];
  /** fin = le modèle a terminé ; outil = il attend le résultat d'un outil ; longueur = coupé par max_tokens ; refus = le modèle a refusé */
  arret: 'fin' | 'outil' | 'longueur' | 'refus' | 'autre';
  usage: Usage;
  /** Les blocs du tour tels que le client les a reçus, à renvoyer tels quels au tour suivant */
  brut: unknown[];
}

export interface ClientModele {
  /** Un tour de conversation. `surTexte` reçoit le texte au fur et à mesure (streaming). */
  repondre(appel: AppelModele, surTexte: (delta: string) => void): Promise<ReponseModele>;
  /** Met à jour le résumé de la conversation (mémoire). Sans streaming. */
  resumer(entree: { resumeActuel: string | null; anciens: string }): Promise<{ texte: string; usage: Usage }>;
}

/** Une erreur du modèle qui mérite un nouvel essai (réseau, surcharge, 5xx). Les autres (clé, requête invalide) n'en méritent pas. */
export class ErreurModele extends Error {
  transitoire: boolean;
  constructor(message: string, transitoire: boolean) {
    super(message);
    this.name = 'ErreurModele';
    this.transitoire = transitoire;
  }
}
