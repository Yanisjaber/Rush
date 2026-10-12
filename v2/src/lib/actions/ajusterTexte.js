// Action Svelte : réduit la taille du texte d'un élément pour qu'il tienne sur une seule ligne
// dans la largeur disponible, sans jamais dépasser `max` (taille idéale sur grand écran).
// Utile pour les grands chiffres du dossard (J-63, PUSH, 1h13'42"…) quel que soit l'écran.
//
// Usage : <div use:ajusterTexte={{ max: 150, valeur }}>{valeur}</div>
// (`valeur` sert à relancer le calcul quand le texte change)

export function ajusterTexte(noeud, options = {}) {
  let { max = 150, min = 28 } = options;

  function ajuster() {
    noeud.style.fontSize = `${max}px`;
    const dispo = noeud.clientWidth;
    const voulu = noeud.scrollWidth; // largeur réelle du texte à la taille idéale
    if (dispo > 0 && voulu > dispo) {
      noeud.style.fontSize = `${Math.max(min, Math.floor((max * dispo) / voulu))}px`;
    }
  }

  ajuster();

  // Recalcule quand la largeur du conteneur change (rotation du téléphone, redimensionnement…)
  const observateur = new ResizeObserver(ajuster);
  if (noeud.parentElement) observateur.observe(noeud.parentElement);

  return {
    update(nouvelles) {
      ({ max = 150, min = 28 } = nouvelles || {});
      ajuster();
    },
    destroy() {
      observateur.disconnect();
    },
  };
}
