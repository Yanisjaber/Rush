import { sb } from '../supabase.js';

// Thème de l'app (sombre par défaut, clair en option), mémorisé dans le navigateur.
// La clé est la même que celle du catalogue : un seul réglage pour toute la v2.
// Une fois connecté, le choix est aussi gardé dans le compte (table user_preferences) : il te suit d'un appareil à l'autre.
const CLE = 'coachia-v2-theme';

function lire() {
  try {
    return localStorage.getItem(CLE) === 'clair' ? 'clair' : 'sombre';
  } catch (e) {
    return 'sombre';
  }
}

export const theme = $state({ choix: lire() });
let compte = null; // identifiant de l'utilisateur connecté (null : pas de synchro, par exemple en démo)

function appliquer() {
  document.documentElement.dataset.theme = theme.choix === 'clair' ? 'light' : 'dark';
}

export function choisirTheme(choix) {
  theme.choix = choix === 'clair' ? 'clair' : 'sombre';
  appliquer();
  try {
    localStorage.setItem(CLE, theme.choix);
  } catch (e) {
    /* stockage indisponible : le choix vaut pour cette session seulement */
  }
  enregistrerDansCompte();
}

/** Enregistre le thème dans le compte (en silence : si ça échoue, le choix reste valable sur cet appareil). */
async function enregistrerDansCompte() {
  if (!compte) return;
  const r = await sb.from('user_preferences').upsert({ user_id: compte, theme: theme.choix }, { onConflict: 'user_id' });
  if (r.error) console.error('[v2/theme]', r.error.code || '');
}

/**
 * À appeler une fois connecté : si le compte a déjà un thème, il l'emporte sur celui de l'appareil ;
 * sinon on garde le choix de l'appareil (rien n'est écrit tant qu'on n'a pas changé de thème).
 */
export async function synchroniserTheme(uid) {
  compte = uid || null;
  if (!compte) return;
  const r = await sb.from('user_preferences').select('theme').eq('user_id', compte).maybeSingle();
  const choisi = r.data?.theme;
  if (!r.error && (choisi === 'clair' || choisi === 'sombre') && choisi !== theme.choix) {
    theme.choix = choisi;
    appliquer();
    try {
      localStorage.setItem(CLE, theme.choix);
    } catch (e) {
      /* idem */
    }
  }
}

/** Déconnexion : on arrête d'écrire dans le compte. */
export function oublierCompteTheme() {
  compte = null;
}
