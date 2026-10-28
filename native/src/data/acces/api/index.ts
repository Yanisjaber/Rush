// Accès aux données Supabase. Port de app/src/lib/data/api.js, découpé par thème (un fichier par thème ci-dessous).
// La RLS garantit que chaque utilisateur ne lit que ses propres lignes ; on filtre quand même explicitement par user_id
// (défense en profondeur, et requêtes plus lisibles).
//
// RÈGLES :
//  - JAMAIS de select('*') sur `activities` : la table contient de très grosses colonnes
//    (streams_gz, streams_blob, gpx_blob, gpx_content, power_curve…). On liste les colonnes utiles.
//  - Toutes les fonctions renvoient { data, erreur } ; `erreur` est un message court en français,
//    jamais le texte brut de l'erreur de la base.
//
// Les écrans importent tout d'ici (`@/data/acces/api`) : ce fichier ne fait que ré-exporter les modules.
export type { Resultat } from './commun';
export { invaliderRetouches } from './retouches-cache';
export * from './seances';
export * from './forme';
export * from './prevues';
export * from './notes';
export * from './sorties';
export * from './cycles';
export * from './bilan';
export * from './force';
export * from './hyrox';
export * from './sante';
export * from './reglages';
export * from './compte';
