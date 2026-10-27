import { usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

/**
 * Garde d'un écran de saisie : si ce qui est saisi (`valeur`) a changé depuis l'ouverture, quitter l'écran (retour de l'en-tête, glissement iOS) demande confirmation au lieu de perdre la saisie.
 * `valeur` est comparée à sa toute première valeur non nulle (null = pas encore prête, par exemple une fiche en cours de chargement).
 * Renvoie `autoriser` : à appeler juste avant de quitter l'écran soi-même (après un enregistrement réussi), pour ne pas se demander à soi-même.
 * On passe par usePreventRemove (et non par un simple écouteur « beforeRemove ») : seul lui bloque le bouton retour natif d'iOS.
 */
export function useGardeSortie(valeur: unknown): () => void {
  const depart = useRef<string | null>(null);
  const [leve, setLeve] = useState(false); // vrai une fois la garde levée (abandon confirmé ou enregistrement réussi)
  const courante = valeur == null ? null : JSON.stringify(valeur);
  if (depart.current === null && courante !== null) depart.current = courante;
  const modifie = depart.current !== null && courante !== depart.current;

  const disablePrevention = usePreventRemove(modifie && !leve, ({ repeat }) => {
    Alert.alert('Abandonner la saisie ?', 'Ce que tu viens de saisir ne sera pas enregistré.', [
      { text: 'Continuer', style: 'cancel' },
      {
        text: 'Abandonner',
        style: 'destructive',
        onPress: () => {
          setLeve(true);
          repeat();
        },
      },
    ]);
  });

  return () => {
    setLeve(true);
    disablePrevention();
  };
}

/** Pour une feuille (fenêtre) qui n'est pas un écran : demande confirmation avant de fermer si la saisie a changé, sinon ferme tout de suite. */
export function fermerAvecGarde(modifie: boolean, fermer: () => void): void {
  if (!modifie) return fermer();
  Alert.alert('Abandonner les modifications ?', 'Ce que tu viens de changer ne sera pas enregistré.', [
    { text: 'Continuer', style: 'cancel' },
    { text: 'Abandonner', style: 'destructive', onPress: fermer },
  ]);
}
