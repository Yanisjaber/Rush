import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { sb } from '@/data/acces/supabase';

// État d'authentification. Trois situations :
//  - pas encore lu (`pret` faux) : on affiche un écran d'attente ;
//  - connecté (`session`) : on affiche les vraies données ;
//  - non connecté : écran de connexion, avec la possibilité d'essayer la démo (`demo`).
interface EtatAuth {
  pret: boolean;
  session: Session | null;
  demo: boolean;
}

let etat: EtatAuth = { pret: false, session: null, demo: false };
const ecouteurs = new Set<() => void>();
const changer = (suite: Partial<EtatAuth>) => {
  etat = { ...etat, ...suite };
  ecouteurs.forEach((fn) => fn());
};

let initialise = false;

/** À appeler une fois au démarrage : lit la session existante puis suit ses changements. */
export async function initAuth(): Promise<void> {
  if (initialise) return;
  initialise = true;
  try {
    const { data } = await sb.auth.getSession();
    changer({ session: data.session, pret: true });
  } catch {
    changer({ session: null, pret: true });
  }
  sb.auth.onAuthStateChange((_evenement, session) => {
    // Se connecter quitte la démo ; un événement sans session (lecture initiale…) ne doit pas l'interrompre
    changer(session ? { session, demo: false } : { session });
  });
}

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Connexion par e-mail et mot de passe.
 * Renvoie { ok: true } ou { ok: false, message } avec un message volontairement générique :
 * on ne dit jamais si c'est l'e-mail ou le mot de passe qui est faux.
 */
export async function connexion(email: string, motDePasse: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const adresse = String(email || '').trim();
  if (!FORMAT_EMAIL.test(adresse)) return { ok: false, message: 'Saisis une adresse e-mail valide.' };
  if (!motDePasse) return { ok: false, message: 'Saisis ton mot de passe.' };

  const { error } = await sb.auth.signInWithPassword({ email: adresse, password: motDePasse });
  if (error) {
    // 429 : trop de tentatives ; 400 : identifiants invalides ; sinon erreur réseau
    if (error.status === 429) return { ok: false, message: 'Trop de tentatives. Réessaie dans quelques minutes.' };
    if (error.status === 400) return { ok: false, message: 'E-mail ou mot de passe incorrect.' };
    return { ok: false, message: 'Connexion impossible pour le moment. Vérifie ta connexion internet.' };
  }
  return { ok: true };
}

/** `local` : ne ferme que la session de ce téléphone (après une suppression de compte, le serveur ne connaît plus l'utilisateur). */
export async function deconnexion(local = false): Promise<void> {
  try {
    await (local ? sb.auth.signOut({ scope: 'local' }) : sb.auth.signOut());
  } catch {
    // Même sans réponse du serveur, la session locale est effacée par le client
  }
  changer({ demo: false });
}

export function entrerDemo(): void {
  changer({ demo: true });
}

export function quitterDemo(): void {
  changer({ demo: false });
}

const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};

export function useAuth(): EtatAuth {
  return useSyncExternalStore(abonner, () => etat, () => etat);
}
