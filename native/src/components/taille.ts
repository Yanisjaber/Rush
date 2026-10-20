import { createContext, useContext } from 'react';
import type { Taille } from '@/data/types';

// La taille d'un widget est celle de sa BOÎTE, en points, quoi qu'il affiche :
// XS = une ligne fine (60 pt), S = une demi-ligne (une demi-largeur), M = une ligne entière, L = deux lignes. Le contenu s'adapte à la boîte, jamais l'inverse.
export const HAUTEUR_LIGNE = 160;
export const ECART_LIGNES = 12;
export const HAUTEUR_FINE = 60;
export const HAUTEURS: Record<Taille, number> = { xs: HAUTEUR_FINE, s: HAUTEUR_LIGNE, m: HAUTEUR_LIGNE, l: 320 };

/** La taille donnée au widget par la grille (null : hors grille). */
export const ContexteTaille = createContext<Taille | null>(null);

/** Style à mettre à la racine d'un widget pour qu'il remplisse sa boîte (rien hors grille). */
export function useRemplir(): { height: '100%' } | undefined {
  return useContext(ContexteTaille) ? { height: '100%' } : undefined;
}
