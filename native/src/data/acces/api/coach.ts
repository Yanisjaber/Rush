import { fetch as fetchFlux } from 'expo/fetch';
import { SUPABASE_URL } from '@/config';
import { decouperEvenements, lireCarte, viderTampon } from '@/data/coach/flux';
import { MESSAGE_ERREUR_PAR_DEFAUT, phraseErreur } from '@/data/coach/fil';
import type { Carte, EvenementCoach, LigneMessage } from '@/data/coach/types';
import { sb } from '../supabase';
import type { Resultat } from './commun';

// Tout ce que l'app échange avec le Coach IA (voir docs/ia/CADRAGE_IA.md).
//   - Lire : la conversation (RLS : seulement les lignes du compte).
//   - Écrire : jamais directement. Les messages, les cartes et le calendrier passent par la fonction serveur « coach-chat »,
//     avec le jeton de la session (jamais de clé secrète dans l'app). Le serveur revérifie tout.

const ADRESSE = `${SUPABASE_URL}/functions/v1/coach-chat`;

/** Les derniers messages de la conversation (les plus récents d'abord, l'écran les remet dans l'ordre) */
export async function chargerMessagesCoach(userId: string, limite = 60): Promise<Resultat<LigneMessage[]>> {
  const { data, error } = await sb.from('chat_messages').select('id,role,contenu,cartes,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limite);
  if (error) {
    console.error('[app/api] messages coach', error.code || '');
    return { data: null, erreur: 'Impossible de charger la conversation.' };
  }
  return { data: (data ?? []) as LigneMessage[], erreur: '' };
}

/** Efface la conversation ET la mémoire du coach (les deux lignes de ce compte, la RLS l'impose) */
export async function effacerConversationCoach(userId: string): Promise<{ ok: boolean; erreur: string }> {
  const [messages, memoire] = await Promise.all([sb.from('chat_messages').delete().eq('user_id', userId), sb.from('coach_memoire').delete().eq('user_id', userId)]);
  if (messages.error || memoire.error) {
    console.error('[app/api] effacement coach', messages.error?.code || memoire.error?.code || '');
    return { ok: false, erreur: "Impossible d'effacer la conversation pour le moment." };
  }
  return { ok: true, erreur: '' };
}

async function jeton(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

const erreurReseau = (message = MESSAGE_ERREUR_PAR_DEFAUT): EvenementCoach => ({ type: 'erreur', code: 'erreur_reseau', message });

/**
 * Envoie un message au coach et transmet les événements au fur et à mesure (texte, carte, fin, erreur).
 * Ne lance jamais d'exception : tout problème devient un événement « erreur » avec une phrase lisible.
 * Si le flux se coupe avant la fin, c'est une erreur aussi (le serveur n'a alors rien enregistré tant que la réponse n'est pas finie).
 */
export async function envoyerMessageCoach(texte: string, surEvenement: (e: EvenementCoach) => void): Promise<void> {
  const j = await jeton();
  if (!j) return surEvenement({ type: 'erreur', code: 'non_connecte', message: 'Reconnecte-toi pour discuter avec le coach.' });

  let termine = false;
  const transmettre = (e: EvenementCoach) => {
    if (e.type === 'fin' || e.type === 'erreur') termine = true;
    surEvenement(e);
  };

  try {
    const res = await fetchFlux(ADRESSE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${j}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ action: 'message', texte, stream: true }),
    });
    if (!res.ok) {
      // Les refus avant le flux (jeton expiré, requête invalide…) arrivent en JSON avec un code
      const corps = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      return transmettre({ type: 'erreur', code: corps?.error ?? 'erreur_reseau', message: phraseErreur(corps?.error ?? '', corps?.message) });
    }

    const lecteur = res.body?.getReader();
    if (!lecteur) {
      // Pas de lecture au fil de l'eau possible : on lit tout d'un coup, la réponse arrive d'un bloc
      const tout = await res.text();
      const { evenements, reste } = decouperEvenements(tout);
      [...evenements, ...viderTampon(reste)].forEach(transmettre);
    } else {
      const decodeur = new TextDecoder();
      let tampon = '';
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const { evenements, reste } = decouperEvenements(tampon);
        tampon = reste;
        evenements.forEach(transmettre);
      }
      tampon += decodeur.decode();
      viderTampon(tampon).forEach(transmettre);
    }
  } catch {
    // Réseau coupé, délai dépassé… : pas de détail technique à l'écran
    if (!termine) transmettre(erreurReseau("Je n'ai pas pu joindre le coach. Vérifie ta connexion et réessaie."));
    return;
  }
  if (!termine) transmettre(erreurReseau());
}

/** `bilan` : après l'annulation d'un plan, combien de lignes ont été remises et combien laissées telles quelles */
type ReponseCarte = { ok: true; carte: Carte | null; bilan?: { annulees: number; ignorees: number } } | { ok: false; message: string };

async function actionCarte(action: 'ajouter' | 'annuler', carteId: string): Promise<ReponseCarte> {
  const j = await jeton();
  if (!j) return { ok: false, message: 'Reconnecte-toi pour continuer.' };
  try {
    const res = await fetch(ADRESSE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${j}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, carte_id: carteId }),
    });
    const corps = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string; carte?: unknown; erreurs?: { message?: string }[]; annulees?: unknown; ignorees?: unknown } | null;
    if (res.ok && corps?.ok) {
      const bilan = typeof corps.annulees === 'number' && typeof corps.ignorees === 'number' ? { annulees: corps.annulees, ignorees: corps.ignorees } : undefined;
      return { ok: true, carte: lireCarte(corps.carte), ...(bilan ? { bilan } : {}) };
    }
    // Refusée par les règles au moment du tap : on dit pourquoi
    if (res.ok && corps?.erreurs?.length) return { ok: false, message: corps.erreurs[0].message || 'Cette séance ne peut pas être ajoutée.' };
    return { ok: false, message: phraseErreur(corps?.error ?? '', corps?.message) };
  } catch {
    return { ok: false, message: "Je n'ai pas pu joindre le coach. Vérifie ta connexion et réessaie." };
  }
}

/** Le tap sur « Ajouter » (une séance) ou « Valider le plan » : le serveur revalide, écrit avec TES droits, et renvoie la carte à jour */
export const ajouterCarteCoach = (carteId: string) => actionCarte('ajouter', carteId);
/** Annule une séance ajoutée depuis une carte, ou défait tout un plan */
export const annulerCarteCoach = (carteId: string) => actionCarte('annuler', carteId);
