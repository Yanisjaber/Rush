// Liens d'authentification envoyés par e-mail par Supabase (invitation, mot de passe oublié) :
// ils arrivent dans le « fragment » de l'adresse (#access_token=…&refresh_token=…&type=invite).
// Fonctions pures : on lit et on valide, sans toucher au réseau ni à l'écran.

const JETON_ACCES = /^[A-Za-z0-9_-]{8,4000}\.[A-Za-z0-9_-]{8,4000}\.[A-Za-z0-9_-]{0,4000}$/; // forme d'un JWT
const JETON_RENOUVELLEMENT = /^[A-Za-z0-9_-]{6,500}$/;
const TYPES = ['invite', 'recovery'];

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
