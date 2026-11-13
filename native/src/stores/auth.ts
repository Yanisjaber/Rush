import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { sb } from '@/data/acces/supabase';

// État d'authentification. Trois situations :
//  - pas encore lu (`pret` faux) : on affiche un écran d'attente ;
//  - connecté (`session`) : on affiche les vraies données ;
//  - non connecté : écran de connexion.
interface EtatAuth {
  pret: boolean;
  session: Session | null;
}

let etat: EtatAuth = { pret: false, session: null };
const ecouteurs = new Set<() => void>();
const changer = (suite: Partial<EtatAuth>) => {
  etat = { ...etat, ...suite };
  ecouteurs.forEach((fn) => fn());
};

let initialise = false;

// Après la validation du code d'inscription, la session existe déjà, mais on retient son affichage le temps de montrer
// l'écran « Bienvenue, dossard n° … » : sinon l'app basculerait sur l'Accueil sans que cet écran n'apparaisse.
let retenir = false;
let sessionRetenue: Session | null = null;

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
    if (retenir) {
      sessionRetenue = session;
      return;
    }
    changer({ session });
  });
}

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Connexion par e-mail et mot de passe.
 * Renvoie { ok: true } ou { ok: false, message } avec un message volontairement générique :
 * on ne dit jamais si c'est l'e-mail ou le mot de passe qui est faux.
 */
export async function connexion(email: string, motDePasse: string): Promise<{ ok: true } | { ok: false; message: string; nonActive?: boolean }> {
  const adresse = String(email || '').trim();
  if (!FORMAT_EMAIL.test(adresse)) return { ok: false, message: 'Saisis une adresse e-mail valide.' };
  if (!motDePasse) return { ok: false, message: 'Saisis ton mot de passe.' };

  const { error } = await sb.auth.signInWithPassword({ email: adresse, password: motDePasse });
  if (error) {
    // Compte créé mais pas encore activé par le code : on le dit (le mot de passe, lui, était bon)
    if (error.code === 'email_not_confirmed') return { ok: false, message: "Ton compte n'est pas encore activé. Entre le code reçu par e-mail.", nonActive: true };
    // 429 : trop de tentatives ; 400 : identifiants invalides ; sinon erreur réseau
    if (error.status === 429) return { ok: false, message: 'Trop de tentatives. Réessaie dans quelques minutes.' };
    if (error.status === 400) return { ok: false, message: 'E-mail ou mot de passe incorrect.' };
    return { ok: false, message: 'Connexion impossible pour le moment. Vérifie ta connexion internet.' };
  }
  return { ok: true };
}

type Resultat = { ok: true } | { ok: false; message: string };

/**
 * Crée le compte. Supabase envoie alors un e-mail avec un code à 8 chiffres (modèle « Confirm signup », variable Token).
 * Le compte n'existe vraiment qu'une fois le code validé (`verifierCode`).
 * Les règles du mot de passe sont vérifiées par l'écran (`evaluerMotDePasse`) ; Supabase les recontrôle.
 */
export async function inscription(email: string, motDePasse: string): Promise<Resultat> {
  const adresse = String(email || '').trim();
  if (!FORMAT_EMAIL.test(adresse)) return { ok: false, message: 'Saisis une adresse e-mail valide.' };
  if (!motDePasse) return { ok: false, message: 'Choisis un mot de passe.' };
  const { data, error } = await sb.auth.signUp({ email: adresse, password: motDePasse });
  if (error) {
    if (error.status === 429) return { ok: false, message: 'Trop de demandes. Réessaie dans quelques minutes.' };
    if (error.code === 'weak_password') return { ok: false, message: 'Ce mot de passe est trop faible. Choisis-en un plus long ou plus varié.' };
    if (error.code === 'user_already_exists') return { ok: false, message: 'Un compte existe déjà avec cet e-mail. Connecte-toi.' };
    return { ok: false, message: 'Création impossible pour le moment. Vérifie ta connexion internet.' };
  }
  // Adresse déjà inscrite : Supabase ne renvoie pas d'erreur (pour ne pas révéler qui a un compte) mais une liste d'identités vide
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, message: 'Un compte existe déjà avec cet e-mail. Connecte-toi.' };
  }
  return { ok: true };
}

/** Longueur du code reçu par e-mail : réglage Supabase « Email OTP length » (8). */
export const LONGUEUR_CODE = 8;

/** Valide le code à 8 chiffres reçu par e-mail. En cas de succès : le numéro de dossard du nouveau compte (null si illisible). */
export async function verifierCode(email: string, code: string): Promise<{ ok: true; numero: number | null } | { ok: false; message: string }> {
  const adresse = String(email || '').trim();
  const jeton = String(code || '').replace(/\D/g, '');
  if (jeton.length !== LONGUEUR_CODE) return { ok: false, message: `Le code a ${LONGUEUR_CODE} chiffres.` };
  retenir = true; // la session va apparaître : on garde l'Accueil caché jusqu'à « Commencer »
  sessionRetenue = null;
  const { data, error } = await sb.auth.verifyOtp({ email: adresse, token: jeton, type: 'signup' });
  if (error || !data.session) {
    retenir = false;
    if (error?.status === 429) return { ok: false, message: 'Trop de tentatives. Réessaie dans quelques minutes.' };
    if (error && error.status !== 400 && error.status !== 403 && error.status !== 422) return { ok: false, message: 'Vérification impossible pour le moment. Vérifie ta connexion internet.' };
    return { ok: false, message: 'Code incorrect ou expiré. Vérifie les 8 chiffres, ou demande un nouveau code.' };
  }
  sessionRetenue = data.session;
  let numero: number | null = null;
  try {
    const { data: ligne } = await sb.from('dossards').select('numero').eq('user_id', data.session.user.id).maybeSingle();
    numero = typeof ligne?.numero === 'number' ? ligne.numero : null;
  } catch {
    numero = null; // l'écran de bienvenue se passe très bien de son numéro
  }
  return { ok: true, numero };
}

/** Envoie un nouveau code (le précédent n'est plus valable) */
export async function renvoyerCode(email: string): Promise<Resultat> {
  const adresse = String(email || '').trim();
  if (!FORMAT_EMAIL.test(adresse)) return { ok: false, message: 'Saisis une adresse e-mail valide.' };
  const { error } = await sb.auth.resend({ type: 'signup', email: adresse });
  if (error) {
    if (error.status === 429) return { ok: false, message: 'Un code vient d\'être envoyé. Attends un peu avant d\'en demander un autre.' };
    return { ok: false, message: 'Envoi impossible pour le moment. Vérifie ta connexion internet.' };
  }
  return { ok: true };
}

/** « Commencer » sur l'écran de bienvenue : l'app s'ouvre sur l'Accueil */
export function terminerBienvenue(): void {
  retenir = false;
  const session = sessionRetenue;
  sessionRetenue = null;
  if (session) changer({ session });
  else void sb.auth.getSession().then(({ data }) => changer({ session: data.session }));
}

/** `local` : ne ferme que la session de ce téléphone (après une suppression de compte, le serveur ne connaît plus l'utilisateur). */
export async function deconnexion(local = false): Promise<void> {
  try {
    await (local ? sb.auth.signOut({ scope: 'local' }) : sb.auth.signOut());
  } catch {
    // Même sans réponse du serveur, la session locale est effacée par le client
  }
  changer({ session: null });
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
