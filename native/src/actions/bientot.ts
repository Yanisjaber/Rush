import { Alert } from 'react-native';

// Pour les boutons dont l'écran n'existe pas encore en natif (démarrer une séance, ouvrir un programme…).
// On le dit franchement plutôt que de laisser un bouton qui ne fait rien.
export function bientot(quoi = 'Cet écran') {
  Alert.alert('Bientôt', `${quoi} arrive dans une prochaine étape de l'app.`);
}
