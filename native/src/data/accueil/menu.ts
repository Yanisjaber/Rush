// Règles du filtre de sport (la barre du haut). Pures : le choix lui-même vit dans stores/menu.ts.
// Port de choisirFiltre (app/src/lib/stores/menu.svelte.js) et de la règle « filtreActif » de l'Accueil.

/** Le filtre après qu'on a touché un sport : « Tous » remet à zéro, et retoucher le sport déjà choisi revient à « Tous ». */
export function filtreApres(actuel: string, choisi: string): string {
  return choisi === 'tout' || actuel === choisi ? 'tout' : choisi;
}

/** Un filtre dont le sport n'est plus dans le menu (sport retiré) retombe sur « Tous ». */
export function filtreValide(filtre: string, familles: string[]): string {
  return filtre === 'tout' || familles.includes(filtre) ? filtre : 'tout';
}
