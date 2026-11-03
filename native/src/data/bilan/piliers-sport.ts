// Le niveau global d'un sport, sans le vélo (course à pied, musculation) : quatre piliers notés de 0 à 100, et leur moyenne. Même idée que le vélo (voir piliers-niveau.ts) :
//  - une note existe toujours : calculée avec ce qui est mesuré, puis RÉDUITE de la part qui manque (la « preuve », de 0 à 1) ;
//  - le score global est la moyenne des 4 notes, seulement si au moins 3 piliers sur 4 ont toutes leurs preuves (sinon l'année n'a pas de score : « — ») ;
//  - la meilleure année se cherche parmi celles qui ont un score.
// Ce fichier ne contient que la mécanique commune ; les piliers de chaque sport sont dans piliers-course.ts et piliers-muscu.ts. Fonctions pures, sans réseau.
import { PILIERS_MINI_GLOBAL } from './piliers-niveau.ts';

export interface PilierSport {
  cle: string;
  /** Le nom entier (VoiceOver). */
  nom: string;
  /** Le nom sur la carte de chaleur : 4 colonnes tiennent sur un téléphone avec des noms de 7 lettres au plus. */
  abrege: string;
  explication: string;
}

export interface AnneeSport {
  an: number;
  /** Une note de 0 à 100 par pilier : jamais vide. */
  piliers: Record<string, number>;
  /** À quel point chaque note est appuyée par des mesures (1 = toutes les mesures demandées). */
  preuves: Record<string, number>;
  /** La moyenne des 4 piliers, arrondie ; null quand moins de `PILIERS_MINI_GLOBAL` piliers ont toutes leurs preuves. */
  global: number | null;
  nbPiliers: number;
}

export interface NiveauGlobalSport {
  piliers: readonly PilierSport[];
  annees: AnneeSport[];
  /** La dernière année. */
  actuel: AnneeSport;
  /** L'année qui a le plus haut score global (à défaut d'année avec un score, l'année actuelle). */
  meilleur: AnneeSport;
}

export interface EntreeAnnee {
  an: number;
  notes: Record<string, number>;
  preuves: Record<string, number>;
}

/** Assemble les années : le score global et le nombre de piliers prouvés. Null sans année. */
export function assemblerNiveau(piliers: readonly PilierSport[], entrees: readonly EntreeAnnee[]): NiveauGlobalSport | null {
  if (!entrees.length) return null;
  const annees = [...entrees]
    .sort((a, b) => a.an - b.an)
    .map((e): AnneeSport => {
      const complets = piliers.filter((p) => (e.preuves[p.cle] ?? 0) >= 1).length;
      const notes = Object.fromEntries(piliers.map((p) => [p.cle, e.notes[p.cle] ?? 0]));
      const moyenne = piliers.reduce((t, p) => t + notes[p.cle], 0) / piliers.length;
      return { an: e.an, piliers: notes, preuves: Object.fromEntries(piliers.map((p) => [p.cle, e.preuves[p.cle] ?? 0])), global: complets >= PILIERS_MINI_GLOBAL ? Math.round(moyenne) : null, nbPiliers: complets };
    });
  const actuel = annees[annees.length - 1];
  const meilleur = annees.reduce((m, a) => ((a.global ?? -1) > (m.global ?? -1) ? a : m), annees.filter((a) => a.global !== null)[0] ?? actuel);
  return { piliers, annees, actuel, meilleur };
}

/** La moyenne des notes présentes (les `null` sont ignorés) ; 0 sans note. */
export const moyenneNotes = (notes: (number | null)[]): number => {
  const v = notes.filter((n): n is number => n !== null);
  return v.length ? v.reduce((t, x) => t + x, 0) / v.length : 0;
};

/** Une somme pondérée de parts mesurées, ramenée au poids des parts qui existent (une part sans mesure ne compte pas) ; 0 sans part. */
export function moyennePonderee(parts: [poids: number, note: number][]): number {
  const poids = parts.reduce((t, [w]) => t + w, 0);
  return poids > 0 ? parts.reduce((t, [w, n]) => t + w * n, 0) / poids : 0;
}

/** Les jours de l'année couverts par les données : de max(1er janvier, premier jour connu) à min(31 décembre, aujourd'hui), les deux comprises ; 0 si l'année n'a pas commencé. */
export function joursCouverts(an: number, premierJour: string | null, maintenant: Date): number {
  const jour = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
  const debut = Math.max(jour(`${an}-01-01`), premierJour ? jour(premierJour) : -Infinity);
  const fin = Math.min(jour(`${an}-12-31`), jour(`${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}`));
  return Math.max(0, fin - debut + 1);
}
