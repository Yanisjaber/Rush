// Routeur minimal à base de hash (#/catalogue). Suffisant pour GitHub Pages, sans configuration serveur.
function lireChemin() {
  const brut = (location.hash || '').replace(/^#/, '');
  const chemin = brut.split('?')[0];
  return chemin || '/';
}

export const route = $state({ chemin: lireChemin() });

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.chemin = lireChemin();
  });
}

export function aller(chemin) {
  location.hash = chemin;
}

/** Le mode démo (?demo dans l'adresse) affiche l'app avec des données d'exemple, sans connexion. */
export function modeDemo() {
  return new URLSearchParams(location.search).has('demo');
}
