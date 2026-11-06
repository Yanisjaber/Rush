import { useSyncExternalStore } from 'react';
import { lireAccesCoach } from '@/data/acces/api/coach';

// L'accès au Coach (liste blanche : table coach_acces). L'onglet n'existe que si ce compte y a droit.
// Tant que la lecture n'est pas finie, ou en cas d'erreur, ou en démo : pas d'accès, l'onglet reste caché.
let acces = false;
let utilisateur: string | null = null;
const ecouteurs = new Set<() => void>();
const changer = (valeur: boolean) => {
  if (valeur === acces) return;
  acces = valeur;
  ecouteurs.forEach((fn) => fn());
};

/** Ce compte a-t-il droit au Coach ? */
export function useAccesCoach(): boolean {
  return useSyncExternalStore(
    (suite) => {
      ecouteurs.add(suite);
      return () => ecouteurs.delete(suite);
    },
    () => acces,
    () => false,
  );
}

/** À appeler quand le compte change (connexion, déconnexion). `null` = personne de connecté, ou démo. */
export async function chargerAccesCoach(userId: string | null): Promise<void> {
  utilisateur = userId;
  changer(false);
  if (!userId) return;
  const ok = await lireAccesCoach(userId);
  // Entre-temps le compte a pu changer : on ne garde que la réponse du compte courant
  if (utilisateur === userId) changer(ok);
}
