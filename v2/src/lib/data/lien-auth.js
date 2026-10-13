// Liens d'authentification envoyés par e-mail par Supabase (invitation, mot de passe oublié) :
// ils arrivent dans le « fragment » de l'adresse (#access_token=…&refresh_token=…&type=invite).
// Fonctions pures : on lit et on valide, sans toucher au réseau ni à l'écran.

const JETON_ACCES = /^[A-Za-z0-9_-]{8,4000}\.[A-Za-z0-9_-]{8,4000}\.[A-Za-z0-9_-]{0,4000}$/; // forme d'un JWT
const JETON_RENOUVELLEMENT = /^[A-Za-z0-9_-]{6,500}$/;
const TYPES = ['invite', 'recovery', 'signup']; // signup : lien de confirmation après « Créer un compte »

/**
 * Lit le fragment de l'adresse. Renvoie :
 *  - { type: 'invite' | 'recovery', accessToken, refreshToken } pour un lien valide ;
 *  - { erreur: 'expire' | 'invalide' } si Supabase signale un lien expiré ou refusé (#error=…) ;
 *  - null si ce n'est pas un lien d'authentification (par exemple une route #/calendrier).
 * Un fragment qui commence par « #/ » est une route de l'app : on ne le touche jamais.
 */
export function lireLienAuth(hash) {
  const brut = String(hash || '');
  if (!brut.startsWith('#') || brut.startsWith('#/') || brut.length > 8000) return null;
  const p = new URLSearchParams(brut.slice(1));
  if (p.has('error') || p.has('error_code')) {
    return { erreur: p.get('error_code') === 'otp_expired' ? 'expire' : 'invalide' };
  }
  const type = p.get('type');
  const accessToken = p.get('access_token') || '';
  const refreshToken = p.get('refresh_token') || '';
  if (!TYPES.includes(type) || !JETON_ACCES.test(accessToken) || !JETON_RENOUVELLEMENT.test(refreshToken)) return null;
  return { type, accessToken, refreshToken };
}

/** Message affiché quand le lien est expiré ou refusé. */
export function messageLienErreur(erreur) {
  return erreur === 'expire'
    ? "Ce lien a expiré (ils ne durent qu'une heure). Demande-en un nouveau avec « Mot de passe oublié ? »."
    : "Ce lien n'est pas valable. Demande-en un nouveau avec « Mot de passe oublié ? ».";
}

export const MDP_MIN = 10;
export const MDP_MAX = 72; // limite de l'algorithme de hachage côté serveur (bcrypt)

/**
 * Valide un nouveau mot de passe et sa confirmation.
 * Renvoie { ok: true } ou { ok: false, message }.
 */
export function validerMotDePasse(motDePasse, confirmation, email = '') {
  const mdp = String(motDePasse ?? '');
  if (mdp.length < MDP_MIN) return { ok: false, message: `Au moins ${MDP_MIN} caractères.` };
  if (mdp.length > MDP_MAX) return { ok: false, message: `${MDP_MAX} caractères maximum.` };
  if (!mdp.trim()) return { ok: false, message: 'Le mot de passe ne peut pas être fait que d\'espaces.' };
  if (/^(\d+)$/.test(mdp)) return { ok: false, message: 'Ajoute des lettres : des chiffres seuls se devinent trop vite.' };
  const debut = String(email).split('@')[0].toLowerCase();
  if (debut.length >= 3 && mdp.toLowerCase().includes(debut)) return { ok: false, message: 'Ne mets pas ton adresse e-mail dans ton mot de passe.' };
  if (mdp !== confirmation) return { ok: false, message: 'Les deux mots de passe ne sont pas identiques.' };
  return { ok: true };
}

/** Nettoie un prénom ou un nom : espaces réduits, caractères de contrôle retirés. */
export function nettoyerNom(valeur) {
  // eslint-disable-next-line no-control-regex
  return String(valeur ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
}

const NOM_MAX = 60;

/**
 * Valide le formulaire « Créer un compte » (hors format de l'e-mail, vérifié par le store).
 * Renvoie { ok: true, prenom, nom } (valeurs nettoyées) ou { ok: false, champ, message } :
 * `champ` (prenom, nom, mdp, consentement) dit sous quel champ afficher l'erreur.
 */
export function validerInscription({ prenom, nom, motDePasse, email = '', consentement }) {
  const p = nettoyerNom(prenom);
  const n = nettoyerNom(nom);
  if (!p) return { ok: false, champ: 'prenom', message: 'Saisis ton prénom.' };
  if (p.length > NOM_MAX) return { ok: false, champ: 'prenom', message: `${NOM_MAX} caractères maximum.` };
  if (!n) return { ok: false, champ: 'nom', message: 'Saisis ton nom.' };
  if (n.length > NOM_MAX) return { ok: false, champ: 'nom', message: `${NOM_MAX} caractères maximum.` };
  const v = validerMotDePasse(motDePasse, motDePasse, email);
  if (!v.ok) return { ok: false, champ: 'mdp', message: v.message };
  if (consentement !== true) return { ok: false, champ: 'consentement', message: 'Coche la case pour accepter la politique de confidentialité.' };
  return { ok: true, prenom: p, nom: n };
}
