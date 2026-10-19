// Repos, notes et annotations du calendrier. Port de app/src/lib/data/annotations.js :
// pour l'instant seulement la lecture (ranger les notes par jour) ; la saisie et la validation viendront avec leur panneau.
//
// STOCKAGE :
//  - day_notes : une note sur une plage de dates { type: 'texte' | 'maladie' | 'blessure', text, color, from_date, to_date }
//  - rest_day  : un jour de repos par ligne { iso_date }
import type { Note } from './types.ts';

const COULEUR = /^#[0-9a-f]{6}$/i;

/** Notes qui recouvrent un jour donné. */
export const notesDuJour = (notes: Note[] | null | undefined, iso: string): Note[] => (notes || []).filter((n) => String(n.from_date) <= iso && iso <= String(n.to_date));

/** Une couleur de note venue de la base : on ne l'utilise que si c'est bien un #rrggbb, sinon la couleur par défaut. */
export const couleurNote = (couleur: unknown, parDefaut = '#60a5fa'): string => (typeof couleur === 'string' && COULEUR.test(couleur) ? couleur : parDefaut);

/** Le libellé d'une note : son texte, sinon son type. */
export const libelleNote = (n: Pick<Note, 'type' | 'text'>): string => n.text || (n.type === 'maladie' ? 'Maladie' : n.type === 'blessure' ? 'Blessure' : 'Note');
