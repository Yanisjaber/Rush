// Les actions que le coach peut faire exécuter à l'application SANS danger : ouvrir un écran, afficher un jour, filtrer un sport.
// C'est une LISTE BLANCHE : ce que le serveur envoie est relu ici, et tout ce qui n'est pas prévu est ignoré. Aucune de ces actions ne change une donnée.
// (Ce qui modifie le calendrier passe par une carte que l'utilisateur valide : voir CartePlanning.)

export type EcranApp = 'accueil' | 'calendrier' | 'bilan' | 'sante' | 'coach' | 'parametres';

export type ActionApp =
  | { type: 'ecran'; ecran: EcranApp }
  | { type: 'jour'; date: string }
  | { type: 'sport'; sport: string };

/** Le chemin de chaque écran dans la navigation (les mêmes écrans que la barre du bas et la roue dentée) */
export const ROUTE_ECRAN: Record<EcranApp, '/' | '/calendrier' | '/bilan' | '/sante' | '/coach' | '/parametres'> = {
  accueil: '/',
  calendrier: '/calendrier',
  bilan: '/bilan',
  sante: '/sante',
  coach: '/coach',
  parametres: '/parametres',
};

const SPORTS_FILTRABLES = ['velo', 'course', 'natation'] as const;

function dateValide(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}

/** Relit une action envoyée par le serveur ; null si elle n'est pas dans la liste blanche ou mal formée */
export function lireAction(nom: string, params: Record<string, unknown>): ActionApp | null {
  switch (nom) {
    case 'ouvrir_ecran':
      return typeof params.ecran === 'string' && Object.hasOwn(ROUTE_ECRAN, params.ecran) ? { type: 'ecran', ecran: params.ecran as EcranApp } : null;
    case 'ouvrir_calendrier':
      return dateValide(params.date) ? { type: 'jour', date: params.date } : null;
    case 'filtrer_sport':
      return typeof params.sport === 'string' && (SPORTS_FILTRABLES as readonly string[]).includes(params.sport) ? { type: 'sport', sport: params.sport } : null;
    default:
      return null;
  }
}
