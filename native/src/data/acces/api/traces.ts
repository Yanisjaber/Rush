import { SUPABASE_URL } from '@/config';
import { courbesDepuisFlux, courbesDepuisStreams, type CourbesSortie } from '../../outils/courbes-sortie';
import { traceDepuisReponse, traceDepuisStreams, type TraceBrute } from '../../outils/trace-sortie';
import { sb } from '../supabase';
import { UUID, type Resultat } from './commun';

/**
 * La trace d'une sortie réalisée (positions, altitude, distance) et ses courbes (vitesse, cœur, cadence…).
 * - Une sortie Strava : on la demande à la fonction « strava-trace » (la synchro ne garde pas les positions ; seul le serveur parle à Strava, aucun jeton ne passe par l'app).
 * - Une sortie importée (fichier FIT, GPX, TCX) : ses flux sont déjà dans la base (`streams_gz`).
 * Pas de GPS (salle, piscine, home-trainer) : data null et erreur vide. Une erreur ne bloque jamais l'écran, seulement la carte.
 */
export async function chargerTrace(userId: string, id: string, stravaId: string | number | null | undefined): Promise<Resultat<TraceBrute | null> & { courbes: CourbesSortie | null }> {
  if (!UUID.test(String(id))) return { data: null, courbes: null, erreur: 'Séance introuvable.' };
  if (!stravaId) {
    const r = await sb.from('activities').select('streams_gz').eq('user_id', userId).eq('id', id).maybeSingle();
    if (r.error) return { data: null, courbes: null, erreur: 'Impossible de charger la carte.' };
    const gz = (r.data as { streams_gz?: string | null } | null)?.streams_gz;
    return { data: traceDepuisStreams(gz), courbes: courbesDepuisStreams(gz), erreur: '' };
  }
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { data: null, courbes: null, erreur: 'Reconnecte-toi pour voir la carte.' };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/strava-trace`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: id }),
    });
    if (res.status === 429) return { data: null, courbes: null, erreur: 'Strava limite les demandes : la carte reviendra dans quelques minutes.' };
    if (!res.ok) return { data: null, courbes: null, erreur: 'La carte est indisponible pour le moment.' };
    const corps = await res.json().catch(() => null);
    return { data: traceDepuisReponse(corps), courbes: courbesDepuisFlux((corps as { courbes?: unknown } | null)?.courbes), erreur: '' };
  } catch {
    return { data: null, courbes: null, erreur: 'La carte est indisponible pour le moment.' };
  }
}
