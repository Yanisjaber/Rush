// Thème de l'app (sombre par défaut, clair en option), mémorisé dans le navigateur.
// La clé est la même que celle du catalogue : un seul réglage pour toute la v2.
const CLE = 'coachia-v2-theme';

function lire() {
  try {
    return localStorage.getItem(CLE) === 'clair' ? 'clair' : 'sombre';
  } catch (e) {
    return 'sombre';
  }
}

export const theme = $state({ choix: lire() });

function appliquer() {
  document.documentElement.dataset.theme = theme.choix === 'clair' ? 'light' : 'dark';
}

export function choisirTheme(choix) {
  theme.choix = choix === 'clair' ? 'clair' : 'sombre';
  appliquer();
  try {
    localStorage.setItem(CLE, theme.choix);
  } catch (e) {
    /* stockage indisponible : le choix vaut pour cette session seulement */
  }
}
