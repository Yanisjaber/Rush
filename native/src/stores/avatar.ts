import { useEffect, useSyncExternalStore } from 'react';
import { chargerUrlAvatar } from '@/data/acces/api/avatar';
import { useAuth } from '@/stores/auth';

// La photo de profil, partagée entre le rond de l'en-tête et l'écran Identité : une photo changée se voit tout de suite partout.
// Le lien est signé et expire au bout d'une heure : on le relit s'il a plus de 45 minutes.
interface EtatAvatar {
  userId: string | null;
  url: string | null;
  lu: number;
}

const VALIDITE_MS = 45 * 60 * 1000;
let etat: EtatAvatar = { userId: null, url: null, lu: 0 };
const ecouteurs = new Set<() => void>();
const changer = (suite: EtatAvatar) => {
  etat = suite;
  ecouteurs.forEach((fn) => fn());
};

let enCours: string | null = null;

/** Lit la photo du compte (sans refaire la requête si elle est récente). */
export async function chargerAvatar(userId: string): Promise<void> {
  if (etat.userId === userId && Date.now() - etat.lu < VALIDITE_MS) return;
  if (enCours === userId) return;
  enCours = userId;
  try {
    const url = await chargerUrlAvatar(userId);
    changer({ userId, url, lu: Date.now() });
  } catch {
    // Pas de réseau : on garde ce qu'on affichait, sans photo en repli
  } finally {
    enCours = null;
  }
}

/** Après un envoi ou un retrait : met à jour l'affichage sans attendre une relecture. */
export function definirAvatar(userId: string, url: string | null): void {
  changer({ userId, url, lu: Date.now() });
}

/** La photo du compte connecté (null : pas de photo, silhouette), et lance sa lecture si besoin. Jamais de photo en démo. */
export function useAvatar(): string | null {
  const { session, demo } = useAuth();
  const userId = !demo ? session?.user.id ?? null : null;
  const courant = useSyncExternalStore(
    (fn) => {
      ecouteurs.add(fn);
      return () => ecouteurs.delete(fn);
    },
    () => etat,
  );
  useEffect(() => {
    if (userId) void chargerAvatar(userId);
  }, [userId]);
  // Le compte a changé (déconnexion puis autre compte) : jamais la photo de l'ancien
  return userId && courant.userId === userId ? courant.url : null;
}
