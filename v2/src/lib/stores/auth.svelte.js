// État d'authentification, réactif (Svelte 5 : `$state` dans un fichier .svelte.js).
// `auth.pret` passe à true une fois la session (éventuelle) lue ; `auth.session` est null si déconnecté.
import { sb } from '../supabase.js';
import { route } from '../routeur.svelte.js';
import { lireLienAuth, messageLienErreur, validerMotDePasse, validerInscription } from '../data/lien-auth.js';
import { appeler } from '../data/integrations.js';
import { chargerProfilComplet, enregistrerProfil } from '../data/api.js';

// definirMdp : true quand l'utilisateur arrive par un lien d'invitation ou de réinitialisation : il doit choisir un mot de passe.
// erreurLien : message à afficher si ce lien est expiré ou refusé.
export const auth = $state({ pret: false, session: null, definirMdp: false, erreurLien: '' });

let abonne = false;

/** À appeler une fois au démarrage : lit la session existante puis suit ses changements. */
export async function initAuth() {
  if (abonne) return;
  abonne = true;
  await traiterLien();
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

/**
 * Lien reçu par e-mail (invitation ou mot de passe oublié) : Supabase met les jetons dans le fragment de l'adresse.
 * Le client est configuré sans détection automatique : on lit le lien nous-mêmes, on le valide, puis on ouvre la session.
 */
async function traiterLien() {
  const lien = lireLienAuth(location.hash);
  if (!lien) return;
  // On vide l'adresse tout de suite : un jeton ne doit pas rester visible, ni dans l'historique du navigateur.
  history.replaceState(null, '', location.pathname + location.search);
  route.chemin = '/';
  if (lien.erreur) {
    auth.erreurLien = messageLienErreur(lien.erreur);
    return;
  }
  const { error } = await sb.auth.setSession({ access_token: lien.accessToken, refresh_token: lien.refreshToken });
  // On vérifie auprès du serveur que le jeton est réellement valable (et pas seulement bien formé)
  const verif = error ? null : await sb.auth.getUser();
  if (error || !verif?.data?.user) {
    await sb.auth.signOut();
    auth.erreurLien = messageLienErreur('invalide');
    return;
  }
  if (lien.type === 'signup') {
    // Compte tout juste confirmé : il a déjà choisi son mot de passe, on recopie seulement son prénom et son nom dans le profil.
    await completerProfilInscription(verif.data.user);
    return;
  }
  auth.definirMdp = true;
}

/** Recopie prénom et nom (saisis à l'inscription, gardés dans les métadonnées du compte) dans user_profiles, une seule fois. */
async function completerProfilInscription(user) {
  try {
    const m = user?.user_metadata || {};
    const prenom = typeof m.first_name === 'string' ? m.first_name.slice(0, 60) : '';
    const nom = typeof m.last_name === 'string' ? m.last_name.slice(0, 60) : '';
    if (!prenom && !nom) return;
    const { data } = await chargerProfilComplet(user.id);
    const extras = data?.extras && typeof data.extras === 'object' ? data.extras : {};
    if (extras.first_name || extras.last_name) return;
    const complet = [prenom, nom].filter(Boolean).join(' ');
    await enregistrerProfil(user.id, { display_name: prenom || complet }, { ...extras, first_name: prenom, last_name: nom, full_name: complet });
  } catch (_e) {
    /* non bloquant : il pourra remplir son profil à la main */
  }
}

/**
 * « Créer un compte » : inscription par e-mail et mot de passe, avec confirmation par e-mail.
 * La réponse est toujours la même, que l'adresse existe déjà ou non (Supabase renvoie un faux succès dans ce cas) :
 * on ne révèle jamais qui a un compte.
 */
export async function inscription({ prenom, nom, email, motDePasse, consentement }) {
  const adresse = String(email || '').trim();
  if (!FORMAT_EMAIL.test(adresse)) return { ok: false, message: 'Saisis une adresse e-mail valide.' };
  const v = validerInscription({ prenom, nom, motDePasse, email: adresse, consentement });
  if (!v.ok) return v;
  const { error } = await sb.auth.signUp({
    email: adresse,
    password: motDePasse,
    options: {
      emailRedirectTo: `${location.origin}${location.pathname}`,
      data: { first_name: v.prenom, last_name: v.nom, display_name: v.prenom },
    },
  });
  if (error) {
    if (error.status === 429) return { ok: false, message: "Trop d'inscriptions en peu de temps. Réessaie dans quelques minutes." };
    if (error.code === 'weak_password') return { ok: false, message: 'Le serveur trouve ce mot de passe trop faible. Allonge-le ou varie les caractères.' };
    if (error.status === 422 || error.status === 400) return { ok: false, message: "Inscription refusée. Vérifie l'adresse e-mail et le mot de passe." };
    return { ok: false, message: "Inscription impossible pour le moment. Vérifie ta connexion internet." };
  }
  return { ok: true, message: "Si cette adresse n'a pas encore de compte, un e-mail de confirmation vient de partir : clique sur le lien dedans (regarde aussi les indésirables). Si tu as déjà un compte, aucun e-mail n'est envoyé : connecte-toi, ou utilise « Mot de passe oublié »." };
}

/** Enregistre un nouveau mot de passe pour l'utilisateur connecté. Renvoie { ok: true } ou { ok: false, message }. */
export async function changerMotDePasse(motDePasse, confirmation) {
  const v = validerMotDePasse(motDePasse, confirmation, auth.session?.user?.email || '');
  if (!v.ok) return v;
  const { error } = await sb.auth.updateUser({ password: motDePasse });
  if (error) {
    if (error.code === 'same_password') return { ok: false, message: "Choisis un mot de passe différent de l'ancien." };
    if (error.code === 'weak_password') return { ok: false, message: 'Le serveur trouve ce mot de passe trop faible. Allonge-le ou varie les caractères.' };
    if (error.status === 429) return { ok: false, message: 'Trop de tentatives. Réessaie dans quelques minutes.' };
    return { ok: false, message: "Impossible d'enregistrer le mot de passe pour le moment. Réessaie." };
  }
  auth.definirMdp = false;
  return { ok: true };
}

/**
 * « Mot de passe oublié » : demande l'envoi d'un e-mail. La réponse est toujours la même, que le compte existe ou non
 * (sinon on permettrait de deviner qui a un compte). Seule une erreur de limite d'envoi est signalée.
 */
export async function demanderReinitialisation(email) {
  const adresse = String(email || '').trim();
  if (!FORMAT_EMAIL.test(adresse)) return { ok: false, message: 'Saisis une adresse e-mail valide.' };
  const { error } = await sb.auth.resetPasswordForEmail(adresse, { redirectTo: `${location.origin}${location.pathname}` });
  if (error?.status === 429) return { ok: false, message: "Un e-mail vient déjà de partir. Attends quelques minutes avant d'en redemander un." };
  return { ok: true, message: 'Si ce compte existe, un e-mail vient de partir. Clique sur le lien dedans (valable une heure).' };
}

/**
 * Supprime définitivement le compte et toutes les données (fonction serveur delete-account).
 * `confirmation` doit valoir exactement « SUPPRIMER ». Renvoie { ok: true } ou { ok: false, message }.
 * En cas de succès : on efface aussi ce que la v2 garde dans ce navigateur, puis on ferme la session.
 */
export async function supprimerCompte(confirmation) {
  if (confirmation !== 'SUPPRIMER') return { ok: false, message: 'Tape exactement SUPPRIMER pour confirmer.' };
  const r = await appeler('delete-account', { confirmation });
  if (!r.ok) {
    if (r.statut === 404) return { ok: false, message: "La suppression n'est pas encore activée sur le serveur. Demande à Yanis." };
    return { ok: false, message: 'La suppression a échoué. Rien n\'a été supprimé : réessaie, ou demande à Yanis.' };
  }
  try {
    for (const cle of Object.keys(localStorage)) if (cle.startsWith('coachia-v2-')) localStorage.removeItem(cle);
  } catch (_e) {
    /* stockage indisponible : rien à effacer */
  }
  await sb.auth.signOut({ scope: 'local' });
  auth.session = null;
  return { ok: true };
}
