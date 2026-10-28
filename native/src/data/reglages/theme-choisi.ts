// Le thème choisi dans Paramètres : « sombre » ou « clair ». Fonctions pures (testées dans tests/theme-choisi.test.ts), sans écran.
export type ChoixTheme = 'sombre' | 'clair';

/** Ce qu'on a lu sur le téléphone : un choix valide, ou null (rien de choisi, ou une valeur inconnue). */
export function lireChoixTheme(valeur: unknown): ChoixTheme | null {
  return valeur === 'sombre' || valeur === 'clair' ? valeur : null;
}

/** Le nom du schéma de couleurs de React Native pour un choix. */
export function schemaDe(choix: ChoixTheme): 'dark' | 'light' {
  return choix === 'clair' ? 'light' : 'dark';
}
