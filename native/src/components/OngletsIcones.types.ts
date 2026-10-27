// Types communs des onglets en icônes (la version iOS native et la version de repli les partagent).
export type IconeOnglet = 'resume' | 'rythme' | 'records';

export interface OngletIcone<T extends string> {
  cle: T;
  nom: string;
  icone: IconeOnglet;
}

export interface PropsOngletsIcones<T extends string> {
  onglets: OngletIcone<T>[];
  actuel: T;
  onChoisir: (cle: T) => void;
  /** Phrase lue par VoiceOver pour la rangée. */
  etiquette: string;
}
