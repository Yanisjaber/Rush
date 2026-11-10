import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { lireAccesCoach } from '@/data/acces/api/coach';

// L'accès au Coach (liste blanche : table coach_acces). L'onglet n'existe que si ce compte y a droit.
// Tant que la lecture n'est pas finie, ou en cas d'erreur, ou en démo : pas d'accès, l'onglet reste caché.
let acces = false;
let lu = false; // la lecture de l'accès est finie (ou a dépassé le délai) pour le compte courant
let utilisateur: string | null = null;
let enCours: Promise<void> | null = null;
const PAUSES_REESSAI_MS = [3000, 8000, 20000, 60000]; // si la lecture échoue : on réessaie, au lieu de conclure « pas d'accès »
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

// La dernière réponse connue est gardée sur le téléphone (par compte) : au lancement, le menu est tout de suite le bon,
// même avec un réseau lent ou coupé. Le serveur la confirme ensuite en arrière-plan.
const cleCache = (userId: string) => `rush-coach-${userId}`;
async function lireCache(userId: string): Promise<boolean | null> {
  try {
    const v = await SecureStore.getItemAsync(cleCache(userId));
    return v === 'oui' ? true : v === 'non' ? false : null;
  } catch {
    return null;
  }
}
const garderCache = (userId: string, ok: boolean) => void SecureStore.setItemAsync(cleCache(userId), ok ? 'oui' : 'non').catch(() => {});

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
    // 1. Réponse gardée : affichée tout de suite
    const gardee = await lireCache(userId);
    if (utilisateur !== userId) return;
    if (gardee !== null) {
      clearTimeout(delai);
      changer(gardee);
      marquerLu(true);
    }
    // 2. Le serveur confirme ; en cas d'échec, on réessaie quelques fois (une erreur n'est jamais un « non »)
    for (let essai = 0; ; essai++) {
      const ok = await lireAccesCoach(userId);
      if (utilisateur !== userId) return; // le compte a changé entre-temps : cette réponse ne compte plus
      if (ok !== null) {
        clearTimeout(delai);
        garderCache(userId, ok);
        changer(ok);
        marquerLu(true);
        return;
      }
      if (essai >= PAUSES_REESSAI_MS.length) return;
      await new Promise((r) => setTimeout(r, PAUSES_REESSAI_MS[essai]));
      if (utilisateur !== userId) return;
    }
  })();
  enCours = p;
  return p;
}
