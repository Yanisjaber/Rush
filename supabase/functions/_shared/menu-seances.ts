// ============================================================
// Menu des séances que le coach IA a le droit de proposer (docs/ia/CADRAGE_IA.md).
//
// Claude CHOISIT dans cette liste et ajuste la durée : il n'invente pas de blocs. Le code calcule la charge de ce
// choix (TSS estimé = heures × TSS par heure du type). L'utilisateur ne voit pas ce menu : il change une séance
// en parlant au chat. Les zones restent en « Z2 » (jamais en watts : elles se recalculent à l'affichage).
//
// Départ : l'endurance (vélo, course, natation). Muscu et Hyrox viendront plus tard (autre type de charge : RIR, volume).
// Les TSS par heure sont des valeurs de départ (ordres de grandeur classiques : Z2 ≈ 50, seuil ≈ 90-95, VO2 ≈ 105-120),
// à affiner avec les vraies séances de l'utilisateur.
// ============================================================

export type FamilleCoach = 'velo' | 'course' | 'natation';
export type Zone = 1 | 2 | 3 | 4 | 5;

export interface TypeSeance {
  /** Clé stable que renvoie le modèle (liste fermée) */
  cle: string;
  nom: string;
  zone: Zone;
  /** Séance « dure » : seuil, VO2, fractionné, côtes. Sert à la règle « pas deux séances dures d'affilée ». */
  dure: boolean;
  /** Charge d'une heure de ce type */
  tssParHeure: number;
  minMinutes: number;
  maxMinutes: number;
}

export const FAMILLES_COACH: readonly FamilleCoach[] = ['velo', 'course', 'natation'];

export const MENU: Record<FamilleCoach, readonly TypeSeance[]> = {
  velo: [
    { cle: 'recuperation', nom: 'Récupération', zone: 1, dure: false, tssParHeure: 30, minMinutes: 30, maxMinutes: 90 },
    { cle: 'endurance', nom: 'Endurance', zone: 2, dure: false, tssParHeure: 50, minMinutes: 45, maxMinutes: 240 },
    { cle: 'tempo', nom: 'Tempo', zone: 3, dure: false, tssParHeure: 70, minMinutes: 45, maxMinutes: 150 },
    { cle: 'seuil', nom: 'Seuil', zone: 4, dure: true, tssParHeure: 95, minMinutes: 45, maxMinutes: 120 },
    { cle: 'vo2max', nom: 'VO2max', zone: 5, dure: true, tssParHeure: 120, minMinutes: 45, maxMinutes: 90 },
    { cle: 'sortie_longue', nom: 'Sortie longue', zone: 2, dure: false, tssParHeure: 55, minMinutes: 150, maxMinutes: 360 },
  ],
  course: [
    { cle: 'footing_recuperation', nom: 'Footing de récupération', zone: 1, dure: false, tssParHeure: 35, minMinutes: 20, maxMinutes: 60 },
    { cle: 'footing_facile', nom: 'Footing facile', zone: 2, dure: false, tssParHeure: 50, minMinutes: 30, maxMinutes: 90 },
    { cle: 'sortie_longue', nom: 'Sortie longue', zone: 2, dure: false, tssParHeure: 60, minMinutes: 75, maxMinutes: 180 },
    { cle: 'tempo', nom: 'Tempo', zone: 3, dure: false, tssParHeure: 80, minMinutes: 30, maxMinutes: 90 },
    { cle: 'seuil', nom: 'Seuil', zone: 4, dure: true, tssParHeure: 95, minMinutes: 30, maxMinutes: 75 },
    { cle: 'fractionne', nom: 'Fractionné', zone: 5, dure: true, tssParHeure: 105, minMinutes: 30, maxMinutes: 75 },
    { cle: 'cotes', nom: 'Côtes', zone: 5, dure: true, tssParHeure: 100, minMinutes: 30, maxMinutes: 75 },
  ],
  natation: [
    { cle: 'technique', nom: 'Technique', zone: 1, dure: false, tssParHeure: 30, minMinutes: 20, maxMinutes: 75 },
    { cle: 'endurance', nom: 'Endurance', zone: 2, dure: false, tssParHeure: 50, minMinutes: 30, maxMinutes: 90 },
    { cle: 'seuil', nom: 'Seuil', zone: 4, dure: true, tssParHeure: 85, minMinutes: 30, maxMinutes: 75 },
    { cle: 'vitesse', nom: 'Vitesse', zone: 5, dure: true, tssParHeure: 95, minMinutes: 20, maxMinutes: 60 },
  ],
};

/** Durée absolue maximale d'une séance, même si l'utilisateur la demande (plafond de sécurité, non réglable). */
export const PLAFOND_MINUTES: Record<FamilleCoach, number> = { velo: 360, course: 180, natation: 120 };

export function estFamilleCoach(x: unknown): x is FamilleCoach {
  return typeof x === 'string' && (FAMILLES_COACH as readonly string[]).includes(x);
}

/** Le type du menu pour un sport et une clé, ou null (clé inconnue : jamais acceptée). */
export function typeSeance(sport: unknown, cle: unknown): TypeSeance | null {
  if (!estFamilleCoach(sport) || typeof cle !== 'string') return null;
  return MENU[sport].find((t) => t.cle === cle) ?? null;
}

/** Charge estimée d'une séance de ce type et de cette durée (arrondie au point). */
export function tssEstime(type: TypeSeance, minutes: number): number {
  return Math.round((minutes / 60) * type.tssParHeure);
}

/** Les clés du menu d'un sport, pour le schéma JSON donné au modèle (liste fermée). */
export function clesDuMenu(sport: FamilleCoach): string[] {
  return MENU[sport].map((t) => t.cle);
}
