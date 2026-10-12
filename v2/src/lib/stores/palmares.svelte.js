// Palmarès Open Dossard partagé par la page Compétitions et l'onglet Connexions : licence liée et résultats officiels.
import { chargerPalmares, lireLicence, ecrireLicence, lireCachePalmares, ecrireCachePalmares } from '../data/od-api.js';
import { palmaresDemo } from '../data/demo.js';

export const palmares = $state({ utilisateur: null, licence: null, officiels: [], chargement: false, erreur: '' });

/** Charge la licence et le palmarès de cet utilisateur : le cache s'affiche tout de suite, le réseau rafraîchit ensuite. */
export async function initialiserPalmares(userId, demo = false) {
  if (!userId) return;
  if (palmares.utilisateur !== userId) {
    // On change de compte : rien ne doit rester de l'ancien
    Object.assign(palmares, { utilisateur: userId, licence: null, officiels: [], erreur: '' });
    if (demo) {
      const d = palmaresDemo();
      palmares.licence = d.licence;
      palmares.officiels = d.resultats;
      return;
    }
    palmares.licence = lireLicence(userId);
    palmares.officiels = palmares.licence ? lireCachePalmares(userId) : [];
  }
  if (!demo) await rafraichirPalmares(userId);
}

/** Recharge le palmarès depuis le serveur. En cas d'échec, on garde ce qui est affiché (cache). */
export async function rafraichirPalmares(userId) {
  if (!palmares.licence) return;
  palmares.chargement = true;
  const r = await chargerPalmares(palmares.licence.id);
  palmares.chargement = false;
  if (r.erreur) return (palmares.erreur = r.erreur);
  palmares.erreur = '';
  palmares.officiels = r.data;
  ecrireCachePalmares(userId, r.data);
}

/** Lie une licence (choisie dans la recherche) puis charge son palmarès. */
export async function lierLicence(userId, licence, demo = false) {
  palmares.licence = licence;
  palmares.officiels = [];
  if (demo) {
    palmares.officiels = palmaresDemo().resultats;
    return;
  }
  ecrireLicence(userId, licence);
  await rafraichirPalmares(userId);
}

export function delierLicence(userId) {
  palmares.licence = null;
  palmares.officiels = [];
  palmares.erreur = '';
  ecrireLicence(userId, null);
  ecrireCachePalmares(userId, null);
}
