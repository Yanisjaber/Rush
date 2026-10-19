// Opérations pures sur une liste de widgets pendant le mode édition : elles renvoient toujours une NOUVELLE liste (ou la même si rien ne change).
import { existe, WIDGETS, type IdWidget, type WidgetPlace } from './registre.ts';
import type { Taille } from './types.ts';

/** Échange le widget `index` avec son voisin (sens -1 : monter, 1 : descendre). Hors limites : rien ne bouge. */
export function deplacerDans(liste: WidgetPlace[], index: number, sens: -1 | 1): WidgetPlace[] {
  const cible = index + sens;
  if (index < 0 || index >= liste.length || cible < 0 || cible >= liste.length) return liste;
  const copie = liste.map((w) => ({ ...w }));
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  return copie;
}

export const retirerDe = (liste: WidgetPlace[], id: string): WidgetPlace[] => liste.filter((w) => w.id !== id);

/** Ajoute un widget à la fin, à sa taille par défaut ; un identifiant inconnu ou déjà présent est ignoré. */
export function ajouterA(liste: WidgetPlace[], id: string): WidgetPlace[] {
  if (!existe(id) || liste.some((w) => w.id === id)) return liste;
  return [...liste, { id, taille: WIDGETS[id as IdWidget].taille }];
}

/** Change la taille d'un widget, si elle fait partie de celles qu'il accepte. */
export function taillerDans(liste: WidgetPlace[], id: string, taille: Taille): WidgetPlace[] {
  if (!existe(id) || !(WIDGETS[id as IdWidget].tailles as readonly Taille[]).includes(taille)) return liste;
  return liste.map((w) => (w.id === id ? { ...w, taille } : w));
}
