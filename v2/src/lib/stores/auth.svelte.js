// État d'authentification, réactif (Svelte 5 : `$state` dans un fichier .svelte.js).
// `auth.pret` passe à true une fois la session (éventuelle) lue ; `auth.session` est null si déconnecté.
import { sb } from '../supabase.js';

export const auth = $state({ pret: false, session: null });

let abonne = false;

/** À appeler une fois au démarrage : lit la session existante puis suit ses changements. */
export async function initAuth() {
  if (abonne) return;
  abonne = true;
  const { data } = await sb.auth.getSession();
  auth.session = data.session;
  auth.pret = true;
  sb.auth.onAuthStateChange((_evenement, session) => {
    auth.session = session;
  });
}

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Connexion par e-mail et mot de passe.
 * Renvoie { ok: true } ou { ok: false, message } avec un message volontairement générique :
 * on ne dit jamais si c'est l'e-mail ou le mot de passe qui est faux.
 */
export async function connexion(email, motDePasse) {
  const adresse = String(email || '').trim();
  if (!FORMAT_EMAIL.test(adresse)) return { ok: false, message: 'Saisis une adresse e-mail valide.' };
  if (!motDePasse) return { ok: false, message: 'Saisis ton mot de passe.' };

  const { error } = await sb.auth.signInWithPassword({ email: adresse, password: motDePasse });
  if (error) {
    // 429 : trop de tentatives ; sinon identifiants invalides ou erreur réseau
    if (error.status === 429) return { ok: false, message: 'Trop de tentatives. Réessaie dans quelques minutes.' };
    if (error.status === 400) return { ok: false, message: 'E-mail ou mot de passe incorrect.' };
    return { ok: false, message: 'Connexion impossible pour le moment. Vérifie ta connexion internet.' };
  }
  return { ok: true };
}

export async function deconnexion() {
  await sb.auth.signOut();
}
