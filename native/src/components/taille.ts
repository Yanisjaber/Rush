import { createContext, useContext } from 'react';
import type { Taille } from '@/data/types';
import type { Palette } from '@/theme/couleurs';

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

/**
 * Le premier widget d'une page prend le look « dossard » (fond clair, liseré de la couleur du sport de la page, points d'attache).
 * Null : widget ordinaire. `couleur` : celle du liseré. `base` : la palette du thème (avant inversion), posée par la boîte :
 * le cadre en tire le fond et les points d'attache du dossard.
 */
export const ContexteHeros = createContext<{ couleur: string; base?: Palette } | null>(null);
