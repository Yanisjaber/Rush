import { Component, type ReactNode } from 'react';

// Un garde-fou : si ses enfants plantent à l'affichage, il montre `repli` à la place. On s'en sert pour les sélecteurs natifs (date, heure, fichier) : tant que l'app n'a pas
// été reconstruite avec le module natif correspondant, l'écran reste utilisable avec le sélecteur de secours au lieu de s'effondrer.
export class RepliSiErreur extends Component<{ repli: ReactNode; children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false };
  static getDerivedStateFromError() {
    return { erreur: true };
  }
  componentDidCatch(erreur: unknown) {
    console.warn('[sélecteur natif] indisponible, repli :', erreur instanceof Error ? erreur.message : String(erreur));
  }
  render() {
    return this.state.erreur ? this.props.repli : this.props.children;
  }
}
