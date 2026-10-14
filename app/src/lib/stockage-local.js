// Migration unique des réglages gardés dans le navigateur (thème, disposition de l'accueil, menu, brouillons, caches…).
// Ils portaient l'ancien nom de l'app ; ils s'appellent maintenant « rush-… ». Au premier lancement après le renommage, chaque
// ancienne clé est recopiée sous son nouveau nom (sans écraser une valeur déjà présente), puis supprimée : personne ne perd son thème,
// ses réglages ni sa séance en cours. Une fois tous les appareils passés une fois, ce fichier pourra être retiré.
const ANCIEN_PREFIXE = 'coachia-v2-';
const NOUVEAU_PREFIXE = 'rush-';

/** Renomme les clés de stockage de l'ancien préfixe vers le nouveau. Ne lève jamais d'erreur (stockage indisponible : on ne fait rien). */
export function migrerClesLocales(stockage = globalThis.localStorage) {
  let deplacees = 0;
  try {
    for (const ancienne of Object.keys(stockage).filter((k) => k.startsWith(ANCIEN_PREFIXE))) {
      const nouvelle = NOUVEAU_PREFIXE + ancienne.slice(ANCIEN_PREFIXE.length);
      const valeur = stockage.getItem(ancienne);
      if (valeur !== null && stockage.getItem(nouvelle) === null) stockage.setItem(nouvelle, valeur);
      stockage.removeItem(ancienne);
      deplacees += 1;
    }
  } catch (e) {
    /* stockage bloqué ou plein : les réglages repartiront de zéro, rien de grave */
  }
  return deplacees;
}
