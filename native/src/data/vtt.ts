// VTT : le profil de terrain des sorties (dénivelé par kilomètre). Calculs purs, sans écran (testés dans tests/vtt.test.ts).
// Le dénivelé par semaine, les kilomètres, les meilleures sorties et la préparation sont dans trail.ts : ils servent au trail comme au VTT.
import { familleBarre } from './familles.ts';
import { indexSemaine } from './synthese.ts';
import type { Seance } from './types.ts';

export type Terrain = 'roulant' | 'vallonne' | 'montagneux';

export const NOM_TERRAIN: Record<Terrain, string> = { roulant: 'Roulant', vallonne: 'Vallonné', montagneux: 'Montagneux' };

/** Repères indicatifs, en mètres de dénivelé positif par kilomètre : moins de 15 = roulant, de 15 à 30 = vallonné, au-delà = montagneux. */
export const SEUILS_TERRAIN = { vallonne: 15, montagneux: 30 } as const;

export const terrainDe = (ratio: number): Terrain => (ratio >= SEUILS_TERRAIN.montagneux ? 'montagneux' : ratio >= SEUILS_TERRAIN.vallonne ? 'vallonne' : 'roulant');

export interface SortieTerrain {
  id: string;
  nom: string | null;
  date: string;
  km: number;
  dPlus: number;
  /** Mètres de dénivelé positif par kilomètre (une décimale). */
  ratio: number;
  terrain: Terrain;
}

export interface ProfilTerrain {
  /** Du plus récent au plus ancien. */
  sorties: SortieTerrain[];
  /** Le dénivelé par kilomètre sur l'ensemble des sorties (total du D+ ÷ total des km), en m/km ; null sans sortie. */
  moyenne: number | null;
  terrain: Terrain | null;
  comptes: Record<Terrain, number>;
}

/**
 * Le profil de terrain de tes sorties de VTT des 12 dernières semaines. On ne garde que les sorties d'au moins 3 km dont le dénivelé est renseigné
 * (un D+ de zéro compte : c'est une sortie roulante) ; une sortie sans dénivelé connu n'est pas comptée comme plate.
 */
export function profilTerrain(seances: Seance[], nbSemaines = 12, aujourdhui: Date = new Date()): ProfilTerrain {
  const sorties = seances
    .filter((s) => {
      const i = indexSemaine(s.start_date_local, aujourdhui);
      return familleBarre(s.sport) === 'vtt' && s.moving_time > 0 && Number(s.distance_km) >= 3 && s.total_elevation_gain != null && Number(s.total_elevation_gain) >= 0 && i >= 0 && i < nbSemaines;
    })
    .sort((a, b) => String(b.start_date_local).localeCompare(String(a.start_date_local)))
    .map((s): SortieTerrain => {
      const km = Number(s.distance_km);
      const dPlus = Number(s.total_elevation_gain);
      const ratio = Math.round((dPlus / km) * 10) / 10;
      return { id: s.id, nom: s.name, date: String(s.start_date_local).slice(0, 10), km, dPlus, ratio, terrain: terrainDe(ratio) };
    });
  const comptes: Record<Terrain, number> = { roulant: 0, vallonne: 0, montagneux: 0 };
  for (const s of sorties) comptes[s.terrain] += 1;
  const km = sorties.reduce((t, s) => t + s.km, 0);
  const dPlus = sorties.reduce((t, s) => t + s.dPlus, 0);
  const moyenne = km > 0 ? Math.round((dPlus / km) * 10) / 10 : null;
  return { sorties, moyenne, terrain: moyenne == null ? null : terrainDe(moyenne), comptes };
}
