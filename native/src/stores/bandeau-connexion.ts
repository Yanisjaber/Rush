import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

// Le message « connecte une app » de l'accueil, une fois fermé, ne revient plus : on le retient sur le téléphone (une clé par compte, rien en base).
const cle = (userId: string) => `rush-bandeau-connexion-${userId}`;

/** `ferme` : null tant qu'on n'a pas lu le choix (le message n'apparaît donc pas une demi-seconde pour rien). */
export function useBandeauConnexion(userId: string | null): { ferme: boolean | null; fermer: () => void } {
  const [ferme, setFerme] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let annule = false;
    SecureStore.getItemAsync(cle(userId))
      .then((v) => !annule && setFerme(v === '1'))
      .catch(() => !annule && setFerme(false)); // lecture impossible : le message s'affiche, l'utilisateur peut le fermer
    return () => {
      annule = true;
    };
  }, [userId]);

  const fermer = useCallback(() => {
    setFerme(true);
    if (userId) void SecureStore.setItemAsync(cle(userId), '1').catch(() => {});
  }, [userId]);

  return { ferme, fermer };
}
