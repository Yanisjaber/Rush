import { useSyncExternalStore } from 'react';
import { chargerMesuresSante } from '@/data/api';
import type { LigneMesure } from '@/data/sante-catalogue';

// Les mesures de santé du compte connecté, partagées par TOUS les écrans de Santé : une saisie dans le check-in, le corps ou la nutrition
// met à jour l'écran principal tout de suite, et un même chargement sert tout le monde (avant, chaque écran avait son état et son téléchargement).
// Les lignes gardent l'identifiant du compte : celles d'un autre compte ne sont jamais montrées.
export interface EtatMesures {
  userId: string | null;
  lignes: LigneMesure[];
  erreur: string;
  /** Vrai une fois qu'un premier chargement (réussi ou non) est terminé pour ce compte. */
  charge: boolean;
}

let etat: EtatMesures = { userId: null, lignes: [], erreur: '', charge: false };
const ecouteurs = new Set<() => void>();
let enCours: { userId: string; promesse: Promise<void> } | null = null;

const abonner = (fn: () => void) => {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
};
const lire = (): EtatMesures => etat;

/** Remplace l'état et prévient les écrans. */
export function poserMesures(suivant: EtatMesures) {
  etat = suivant;
  ecouteurs.forEach((fn) => fn());
}

/** Les mesures déjà chargées pour ce compte (ou un état vide si ce n'est pas le bon compte). */
export const mesuresDuCompte = (userId: string): EtatMesures => (etat.userId === userId ? etat : { userId, lignes: [], erreur: '', charge: false });

/** Charge (ou recharge) les mesures du compte. Deux appels en même temps partagent le même téléchargement. */
export function chargerMesures(userId: string): Promise<void> {
  if (enCours && enCours.userId === userId) return enCours.promesse;
  const promesse = (async () => {
    const r = await chargerMesuresSante(userId, 120);
    // En cas d'échec on garde ce qu'on avait déjà pour ce compte : mieux vaut des données un peu vieilles qu'un écran vide
    const avant = mesuresDuCompte(userId);
    poserMesures({ userId, lignes: r.erreur ? avant.lignes : (r.data ?? []), erreur: r.erreur, charge: true });
  })();
  const suivi = { userId, promesse };
  enCours = suivi;
  const fini = () => {
    if (enCours === suivi) enCours = null;
  };
  void promesse.then(fini, fini);
  return promesse;
}

export const useEtatMesures = (): EtatMesures => useSyncExternalStore(abonner, lire, lire);
