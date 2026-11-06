// ============================================================
// Coût d'un appel au modèle, en millionièmes de dollar (docs/ia/CADRAGE_IA.md).
//
// Sert au plafond de dépense global (coupe-circuit) : on estime par EXCÈS. Un modèle inconnu est compté au tarif d'Opus,
// et une lecture de cache est comptée comme une entrée normale (le vrai tarif est plus bas) : la facture réelle est toujours
// inférieure ou égale à ce qu'on compte.
//
// Prix de l'API en dollars par million de tokens (table du 6 oct. 2026). 1 $ par million de tokens = 1 millionième de $ par token,
// donc ces nombres sont aussi des « micro-dollars par token ».
// ============================================================
import type { Usage } from './modele.ts';

export const PRIX: Record<string, { entree: number; sortie: number }> = {
  'claude-haiku-5-5': { entree: 0.1, sortie: 0.5 },
  'claude-sonnet-5-5': { entree: 2, sortie: 10 },
  'claude-opus-5-5': { entree: 4, sortie: 20 },
};

const PRIX_PAR_DEFAUT = PRIX['claude-opus-5-5'];

/** Écriture dans le cache : 1,25 fois le prix d'entrée (tarif habituel du cache de prompt de 5 minutes) */
const FACTEUR_ECRITURE_CACHE = 1.25;

export function coutMicroUsd(modele: string, u: Usage): number {
  const p = Object.hasOwn(PRIX, modele) ? PRIX[modele] : PRIX_PAR_DEFAUT;
  const brut = (u.entree + u.cacheLecture + u.cacheEcriture * FACTEUR_ECRITURE_CACHE) * p.entree + u.sortie * p.sortie;
  return Math.max(0, Math.ceil(brut));
}
