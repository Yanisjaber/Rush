import { SUPABASE_URL } from '@/config';
import { courbesDepuisStreams, type CourbesSortie } from '../../outils/courbes-sortie';
import { traceDepuisReponse, traceDepuisStreams, type TraceBrute } from '../../outils/trace-sortie';
import { sb } from '../supabase';
import { UUID, type Resultat } from './commun';

/**
 * La trace d'une sortie réalisée (positions, altitude, distance).
 * - Une sortie Strava : on la demande à la fonction « strava-trace » (la synchro ne garde pas les positions ; seul le serveur parle à Strava, aucun jeton ne passe par l'app).
 * - Une sortie importée (fichier FIT, GPX, TCX) : ses flux sont déjà dans la base (`streams_gz`).
 * Pas de GPS (salle, piscine, home-trainer) : data null et erreur vide. Une erreur ne bloque jamais l'écran, seulement la carte.
 */
export async function chargerTrace(userId: string, id: string, stravaId: string | number | null | undefined): Promise<Resultat<TraceBrute | null>> {
  if (!UUID.test(String(id))) return { data: null, erreur: 'Séance introuvable.' };
  if (!stravaId) {
    const r = await sb.from('activities').select('streams_gz').eq('user_id', userId).eq('id', id).maybeSingle();
    if (r.error) return { data: null, erreur: 'Impossible de charger la carte.' };
    return { data: traceDepuisStreams((r.data as { streams_gz?: string | null } | null)?.streams_gz), erreur: '' };
  }
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { data: null, erreur: 'Reconnecte-toi pour voir la carte.' };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/strava-trace`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: id }),
    });
    if (res.status === 429) return { data: null, erreur: 'Strava limite les demandes : la carte reviendra dans quelques minutes.' };
    if (!res.ok) return { data: null, erreur: 'La carte est indisponible pour le moment.' };
    return { data: traceDepuisReponse(await res.json().catch(() => null)), erreur: '' };
  } catch {
    return { data: null, erreur: 'La carte est indisponible pour le moment.' };
  }
}

/** Les courbes d'une sortie (vitesse, cœur, altitude, cadence, puissance) : lues dans les flux stockés ; null s'il n'y en a pas (jamais bloquant). */
export async function chargerCourbes(userId: string, id: string): Promise<CourbesSortie | null> {
  if (!UUID.test(String(id))) return null;
  const r = await sb.from('activities').select('streams_gz').eq('user_id', userId).eq('id', id).maybeSingle();
  if (r.error) return null;
  return courbesDepuisStreams((r.data as { streams_gz?: string | null } | null)?.streams_gz);
}
