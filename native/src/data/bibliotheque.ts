// La bibliothèque de widgets (mode édition) : les widgets qu'on peut ajouter, rangés par sport (la catégorie du registre), filtrés par une recherche.
// Calculs purs, sans écran (testés dans tests/bibliotheque.test.ts).
import { WIDGETS, type IdWidget } from './registre.ts';

/** L'ordre des rayons : les sports d'abord, puis ce qui vaut pour tous. Une catégorie absente de la liste passe après, par ordre alphabétique. */
export const RAYONS = ['Course à pied', 'Vélo', 'Natation', 'Musculation', 'Hyrox', 'Charge et forme', 'Séances', 'Objectifs', 'Volume'] as const;

/** Minuscules sans accents : « Vélo » et « velo » se valent dans la recherche. */
export function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export interface Rayon {
  categorie: string;
  ids: string[];
}

/** Les widgets `ids` rangés par rayon ; `requete` garde ceux dont le nom, la description ou la catégorie contiennent tous ses mots. */
export function rangerBibliotheque(ids: string[], requete = ''): Rayon[] {
  const mots = normaliser(requete).split(/\s+/).filter(Boolean);
  const parCategorie = new Map<string, string[]>();
  for (const id of ids) {
    const def = (WIDGETS as Record<string, (typeof WIDGETS)[IdWidget]>)[id];
    if (!def) continue;
    const foin = normaliser(`${def.nom} ${def.description} ${def.categorie}`);
    if (!mots.every((m) => foin.includes(m))) continue;
    parCategorie.set(def.categorie, [...(parCategorie.get(def.categorie) ?? []), id]);
  }
  const rang = (c: string) => {
    const i = (RAYONS as readonly string[]).indexOf(c);
    return i < 0 ? RAYONS.length : i;
  };
  return [...parCategorie.entries()]
    .sort((a, b) => rang(a[0]) - rang(b[0]) || a[0].localeCompare(b[0], 'fr'))
    .map(([categorie, liste]) => ({ categorie, ids: liste }));
}
