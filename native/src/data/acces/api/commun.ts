// Briques communes à tous les modules d'accès aux données : la forme des réponses, la lecture d'une réponse Supabase,
// la vérification d'un UUID et les listes de colonnes partagées par plusieurs modules.

export interface Resultat<T> {
  data: T | null;
  erreur: string;
}

export const COLONNES_SEANCE =
  'id,strava_id,source,name,sport,start_date_local,moving_time,distance_km,total_elevation_gain,avg_heartrate,avg_watts,np,tss,category';

export const COLONNES_PLANIFIEE = 'id,name,date,sport,duration,tss,category,km,start_date_local,rpe,d_plus,notes,structure,gpx_name';

export interface Reponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

export function resultat<T>(reponse: Reponse, message: string): Resultat<T> {
  if (reponse.error) {
    // On ne journalise jamais le texte brut de l'erreur (il peut contenir des détails de la base), seulement son code
    console.error('[app/api]', message, reponse.error.code || '');
    return { data: null, erreur: message };
  }
  return { data: reponse.data as T, erreur: '' };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COLONNES_NOTE = 'id,type,text,color,from_date,to_date,details';
