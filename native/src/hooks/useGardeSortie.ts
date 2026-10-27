import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

// Le morceau de la navigation dont on a besoin (l'évènement « beforeRemove » n'est pas dans les types d'expo-router)
interface Navigation {
  addListener: (evenement: 'beforeRemove', rappel: (e: { preventDefault: () => void; data: { action: unknown } }) => void) => () => void;
  dispatch: (action: unknown) => void;
}

/**
 * Garde d'un écran de saisie : si ce qui est saisi (`valeur`) a changé depuis l'ouverture, quitter l'écran (retour, glissement iOS) demande confirmation au lieu de perdre la saisie.
 * `valeur` est comparée à sa toute première valeur non nulle (null = pas encore prête, par exemple une fiche en cours de chargement).
 * Renvoie `autoriser` : à appeler juste avant de quitter l'écran soi-même (après un enregistrement réussi), pour ne pas se demander à soi-même.
 */
export function useGardeSortie(valeur: unknown): () => void {
  const navigation = useNavigation() as unknown as Navigation;
  const depart = useRef<string | null>(null);
  const libre = useRef(false);
  const courante = valeur == null ? null : JSON.stringify(valeur);
  if (depart.current === null && courante !== null) depart.current = courante;
  const modifie = depart.current !== null && courante !== depart.current;

  useEffect(() => {
    if (!modifie) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (libre.current) return;
      e.preventDefault();
      Alert.alert('Abandonner la saisie ?', 'Ce que tu viens de saisir ne sera pas enregistré.', [
        { text: 'Continuer', style: 'cancel' },
        { text: 'Abandonner', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [modifie, navigation]);

  return () => {
    libre.current = true;
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
