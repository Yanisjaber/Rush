import { dateIsoLocale } from '../../outils/format';
import { sb } from '../supabase';
import { valeurValide, type LigneMesure } from '../../sante/sante-catalogue';
import type { Nuit } from '../../types';
import { resultat, type Reponse, type Resultat } from './commun';

// ---------------------------------------------------------------------------
// Sommeil (nuits Garmin déjà importées)
// ---------------------------------------------------------------------------

// Colonnes de garmin_sleep, sans `hr_stream` (gros JSON, chargé seulement à l'ouverture d'une nuit)
const COLONNES_SOMMEIL =
  'date,bedtime,wake_time,total_sec,deep_sec,light_sec,rem_sec,awake_sec,awake_count,restless_count,avg_stress,avg_heart_rate,resting_heart_rate,body_battery_change,hrv_avg,hrv_status,resp_avg,resp_min,resp_max,spo2_avg,score,score_qualifier,segments';

/** Nuits Garmin des N derniers jours (la plus récente d'abord). */
export async function chargerSommeil(userId: string, jours = 90): Promise<Resultat<Nuit[]>> {
  const r = await sb.from('garmin_sleep').select(COLONNES_SOMMEIL).eq('user_id', userId).order('date', { ascending: false }).limit(jours);
  return resultat<Nuit[]>(r as Reponse, 'Impossible de charger ton sommeil.');
}

/** FC minute par minute d'UNE nuit ([minute, bpm]) : colonne lourde, chargée seulement quand on ouvre le détail. */
export async function chargerFcNuit(userId: string, date: string): Promise<Resultat<[number, number][]>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { data: null, erreur: 'Date invalide.' };
  const r = await sb.from('garmin_sleep').select('hr_stream').eq('user_id', userId).eq('date', date).maybeSingle();
  const res = resultat<{ hr_stream?: unknown }>(r as Reponse, 'Impossible de charger la FC de cette nuit.');
  const flux = res.data?.hr_stream;
  return { data: Array.isArray(flux) ? (flux as [number, number][]) : null, erreur: res.erreur };
}

// ---------------------------------------------------------------------------
// Données de santé (table health_metrics) : ressenti, événements, corps, nutrition, mesures d'appareils
// ---------------------------------------------------------------------------

/** Les mesures de santé des N derniers jours (toutes sources : la priorité se règle ensuite avec resoudreMesures). */
export async function chargerMesuresSante(userId: string, jours = 120): Promise<Resultat<LigneMesure[]>> {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);
  const r = await sb
    .from('health_metrics')
    .select('date,metric,value,source')
    .eq('user_id', userId)
    .gte('date', dateIsoLocale(depuis))
    .order('date', { ascending: false })
    .limit(8000);
  return resultat<LigneMesure[]>(r, 'Impossible de charger tes données de santé.');
}

/** Enregistre (ou remplace) une mesure saisie à la main pour un jour. La valeur est vérifiée avec le catalogue avant tout envoi. */
export async function enregistrerMesureSante(userId: string, date: string, metric: string, brut: unknown): Promise<{ erreur: string }> {
  const value = valeurValide(metric, brut);
  if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: 'Valeur non valide.' };
  const r = await sb.from('health_metrics').upsert({ user_id: userId, date, metric, value, source: 'manual' }, { onConflict: 'user_id,date,metric,source' });
  if (r.error) {
    console.error('[app/api] mesure', r.error.code || '');
    return { erreur: "Impossible d'enregistrer cette donnée de santé." };
  }
  return { erreur: '' };
}

/** Efface une mesure saisie à la main (jamais celles d'un appareil). */
export async function supprimerMesureSante(userId: string, date: string, metric: string): Promise<{ erreur: string }> {
  const r = await sb.from('health_metrics').delete().eq('user_id', userId).eq('date', date).eq('metric', metric).eq('source', 'manual');
  if (r.error) {
    console.error('[app/api] mesure', r.error.code || '');
    return { erreur: "Impossible d'effacer cette donnée." };
  }
  return { erreur: '' };
}
