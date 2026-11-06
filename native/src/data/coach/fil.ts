// L'état du fil de discussion : des fonctions pures, une par chose qui peut arriver (le serveur envoie un événement, l'utilisateur écrit…).
// L'écran ne fait que les appeler et afficher le résultat.
import { lireCartes } from './flux.ts';
import type { CarteSeance, EvenementCoach, LigneMessage, MessageCoach } from './types.ts';

/** Le message du coach en train de s'écrire porte toujours cet identifiant, jusqu'à ce que le serveur donne le vrai */
export const ID_REPONSE_EN_COURS = 'reponse-en-cours';

/** Les lignes enregistrées (de la plus récente à la plus ancienne ou l'inverse) → les messages à afficher, du plus ancien au plus récent */
export function messagesDepuisLignes(lignes: LigneMessage[]): MessageCoach[] {
  return [...lignes]
    .filter((l) => (l.role === 'user' || l.role === 'assistant') && typeof l.contenu === 'string')
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    .map((l) => ({ id: l.id, role: l.role as 'user' | 'assistant', texte: l.contenu, cartes: lireCartes(l.cartes) }));
}

/** L'utilisateur envoie : son message apparaît tout de suite, suivi d'une réponse vide qui va se remplir */
export function debutEnvoi(messages: MessageCoach[], texte: string, idLocal: string): MessageCoach[] {
  return [
    ...messages.filter((m) => !m.echec),
    { id: idLocal, role: 'user', texte, cartes: [] },
    { id: ID_REPONSE_EN_COURS, role: 'assistant', texte: '', cartes: [], enCours: true },
  ];
}

/** Un événement du serveur arrive */
export function appliquerEvenement(messages: MessageCoach[], e: EvenementCoach): MessageCoach[] {
  const enCours = messages.findIndex((m) => m.id === ID_REPONSE_EN_COURS);
  if (enCours < 0) return messages;
  const m = messages[enCours];
  const remplacer = (n: MessageCoach) => messages.map((x, i) => (i === enCours ? n : x));
  switch (e.type) {
    case 'texte':
      return remplacer({ ...m, texte: m.texte + e.delta });
    case 'carte':
      return remplacer({ ...m, cartes: [...m.cartes.filter((c) => c.id !== e.carte.id), e.carte] });
    case 'fin':
      // Le texte final du serveur fait foi (il est nettoyé), et le message prend son vrai identifiant
      return remplacer({ ...m, id: e.message_id, texte: e.texte, enCours: false });
    case 'erreur':
      return erreurEnvoi(messages, e.message || MESSAGE_ERREUR_PAR_DEFAUT);
  }
}

export const MESSAGE_ERREUR_PAR_DEFAUT = "Je n'arrive pas à répondre pour le moment. Réessaie dans un instant.";

/**
 * L'envoi a échoué : la réponse vide disparaît, et le message de l'utilisateur reste, marqué en échec, pour qu'il puisse le renvoyer.
 * Rien n'est enregistré côté serveur dans ce cas : on peut renvoyer le même texte sans doublon.
 */
export function erreurEnvoi(messages: MessageCoach[], message: string): MessageCoach[] {
  const sansReponse = messages.filter((m) => m.id !== ID_REPONSE_EN_COURS);
  for (let i = sansReponse.length - 1; i >= 0; i--) {
    if (sansReponse[i].role === 'user') return sansReponse.map((m, j) => (j === i ? { ...m, echec: message } : m));
  }
  return sansReponse;
}

/** Le texte d'un message en échec, pour le remettre dans la zone de saisie */
export function dernierEnEchec(messages: MessageCoach[]): MessageCoach | null {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].echec) return messages[i];
  return null;
}

/** Une carte a changé d'état (ajoutée, refusée, annulée) : on remplace la carte, où qu'elle soit dans le fil */
export function majCarte(messages: MessageCoach[], carte: CarteSeance): MessageCoach[] {
  return messages.map((m) => (m.cartes.some((c) => c.id === carte.id) ? { ...m, cartes: m.cartes.map((c) => (c.id === carte.id ? carte : c)) } : m));
}

/** Les réponses du serveur qui ne sont pas des erreurs de réseau : un code → une phrase lisible (le serveur en envoie déjà une, ceci sert de filet) */
export const PHRASES_ERREUR: Record<string, string> = {
  acces_refuse: "Le coach n'est pas encore ouvert pour ton compte.",
  accord_requis: "Avant de discuter, il faut que tu acceptes le partage de tes données avec le coach.",
  plafond_jour: 'Tu as atteint la limite de messages du jour. Reviens demain.',
  service_en_pause: 'Le coach est indisponible pour le moment.',
  service_non_configure: 'Le coach est indisponible pour le moment.',
  message_invalide: 'Ton message doit faire entre 1 et 2000 caractères.',
  modele_indisponible: MESSAGE_ERREUR_PAR_DEFAUT,
};

export function phraseErreur(code: string, messageServeur?: string): string {
  if (messageServeur && messageServeur.trim()) return messageServeur;
  return Object.hasOwn(PHRASES_ERREUR, code) ? PHRASES_ERREUR[code] : MESSAGE_ERREUR_PAR_DEFAUT;
}

/** Ces erreurs ne s'arrangent pas en réessayant tout de suite : on ne propose pas « Réessayer » */
export const ERREURS_SANS_REESSAI: readonly string[] = ['acces_refuse', 'accord_requis', 'plafond_jour', 'service_en_pause', 'service_non_configure'];
