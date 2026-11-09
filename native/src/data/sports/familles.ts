// Rapproche les types de sport bruts (ceux de Strava, stockés dans activities.sport)
// des sports de l'app (voir theme/sports.ts) : un sport = une famille = une couleur.
// Port de app/src/lib/data/familles.js.

import { CATALOGUE } from './catalogue-sports.ts';
import { filtreGarde } from './filtre.ts';

// La famille de chaque type vient du catalogue (data/catalogue-sports.ts). Un type sans famille (ski, aviron, randonnée, tennis…) est « autre » :
// c'est l'onglet « Autres », où chaque sous-sport garde son nom, son dessin et sa couleur.
// La marche est écartée de l'accueil, voir sansMarche (api.ts).
const FAMILLES: Record<string, string> = Object.fromEntries(CATALOGUE.filter((s) => s.famille !== 'autre').map((s) => [s.type, s.famille]));

/** Famille d'un type de sport brut. Tout ce qui n'est pas une variante d'un sport proposé (ski, aviron, randonnée, tennis…) devient « autre ». */
export function familleSport(typeBrut: unknown): string {
  // Object.hasOwn : on ignore les propriétés héritées d'un objet ('constructor', '__proto__'…)
  return typeof typeBrut === 'string' && Object.hasOwn(FAMILLES, typeBrut) ? FAMILLES[typeBrut] : 'autre';
}

/** La famille d'un type de sport brut, pour les graphiques et les filtres (le vélo de route, le VTT et le gravel sont du vélo ; le trail est de la course). */
export const familleAffichage = familleSport;

/** Les types Strava que comptent les widgets de ski de fond (rangés dans « Autres ») : le ski de fond, le ski à roulettes et le ski hors-piste, pas le ski alpin ni le snowboard. */
export const SKI_DE_FOND: readonly string[] = ['NordicSki', 'RollerSki', 'BackcountrySki'];

/** Une séance passe-t-elle le filtre de sport ? Un ou plusieurs sports cochés (« course+velo ») ; « tout » garde tout. */
export function garderSeance(seance: { sport?: string } | null | undefined, filtre = 'tout'): boolean {
  return filtreGarde(filtre, familleSport(seance?.sport));
}
