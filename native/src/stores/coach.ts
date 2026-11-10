import { useSyncExternalStore } from 'react';
import { lireAccesCoach } from '@/data/acces/api/coach';

// L'accès au Coach (liste blanche : table coach_acces). L'onglet n'existe que si ce compte y a droit.
// Tant que la lecture n'est pas finie, ou en cas d'erreur, ou en démo : pas d'accès, l'onglet reste caché.
let acces = false;
let lu = false; // la lecture de l'accès est finie (ou a dépassé le délai) pour le compte courant
let utilisateur: string | null = null;
let enCours: Promise<void> | null = null;
const DELAI_MAX_MS = 2500; // au-delà, on affiche l'app sans attendre (l'onglet apparaîtra à la réponse)
const ecouteurs = new Set<() => void>();
const prevenir = () => ecouteurs.forEach((fn) => fn());
const changer = (valeur: boolean) => {
  if (valeur === acces) return;
  acces = valeur;
  prevenir();
};
const marquerLu = (valeur: boolean) => {
  if (valeur === lu) return;
  lu = valeur;
  prevenir();
};
const abonner = (suite: () => void) => {
  ecouteurs.add(suite);
  return () => {
    ecouteurs.delete(suite);
  };
};

/** La lecture de l'accès est-elle terminée ? Les onglets attendent ce moment : si l'onglet Coach apparaissait après coup, la barre se reconstruirait et l'Accueil se rechargerait. */
export function useAccesCoachLu(): boolean {
  return useSyncExternalStore(abonner, () => lu, () => true);
}

/** Ce compte a-t-il droit au Coach ? */
export function useAccesCoach(): boolean {
  return useSyncExternalStore(abonner, () => acces, () => false);
}

/** À appeler quand le compte change (connexion, déconnexion). `null` = personne de connecté, ou démo. */
export function chargerAccesCoach(userId: string | null): Promise<void> {
  // Même compte déjà lu ou en cours de lecture : rien à refaire (sinon l'accès repasserait à « non » un instant)
  if (userId === utilisateur && (enCours || userId === null) && lu) return enCours ?? Promise.resolve();
  if (userId === utilisateur && enCours) return enCours;
  utilisateur = userId;
  changer(false);
  if (!userId) {
    enCours = null;
    marquerLu(true);
    return Promise.resolve();
  }
  marquerLu(false);
  const delai = setTimeout(() => {
    if (utilisateur === userId) marquerLu(true);
  }, DELAI_MAX_MS);
  const p = (async () => {
    const ok = await lireAccesCoach(userId);
    clearTimeout(delai);
    // Entre-temps le compte a pu changer : on ne garde que la réponse du compte courant
    if (utilisateur === userId) {
      changer(ok);
      marquerLu(true);
    }
  })();
  enCours = p;
  return p;
}
