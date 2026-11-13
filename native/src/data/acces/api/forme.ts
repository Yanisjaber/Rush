import { dateIsoLocale } from '../../outils/format';
import { sb } from '../supabase';
import type { Metrique, PointPuissance } from '../../types';
import { resultat, type Resultat } from './commun';

const COLONNES_METRIQUES = 'iso_date,tss,ctl,atl,tsb,duration_min,activity_count';

/** Métriques de charge quotidiennes (CTL, ATL, TSB) sur les N derniers jours. */
export async function chargerMetriques(userId: string, jours = 90): Promise<Resultat<Metrique[]>> {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);
  const r = await sb
    .from('daily_metrics')
    .select(COLONNES_METRIQUES)
    .eq('user_id', userId)
    .gte('iso_date', dateIsoLocale(depuis))
    .order('iso_date', { ascending: true })
    .limit(400);
  return resultat(r, 'Impossible de charger ta forme.');
}

/**
 * Courbe de puissance (vélo) : meilleures puissances par durée, sur 90 jours et sur toute la vie.
 * On ne garde que des durées standard (5 s, 15 s, 30 s, 1, 5, 10, 20, 60 min).
 */
const DUREES_PUISSANCE = [5, 15, 30, 60, 300, 600, 1200, 3600];
export async function chargerPuissance(userId: string): Promise<Resultat<PointPuissance[]>> {
  const r = await sb
    .from('power_profile')
    .select('duration_s,watts_90d,watts_alltime')
    .eq('user_id', userId)
    .in('duration_s', DUREES_PUISSANCE)
    .order('duration_s', { ascending: true });
  return resultat(r, 'Impossible de charger ta courbe de puissance.');
}

const TAILLE_PAGE_CONDITION = 1000; // l'API renvoie au plus 1000 lignes par requête : on lit par pages
const PAGES_MAX_CONDITION = 12; // garde-fou : environ 30 ans de jours

/** La condition (CTL) de chaque jour, depuis le début : pour la courbe de forme du Progrès (par pages de 1 000 jours). */
export async function chargerConditionComplete(userId: string): Promise<Resultat<Pick<Metrique, 'iso_date' | 'ctl'>[]>> {
  const tout: Pick<Metrique, 'iso_date' | 'ctl'>[] = [];
  for (let page = 0; page < PAGES_MAX_CONDITION; page++) {
    const r = await sb
      .from('daily_metrics')
      .select('iso_date,ctl')
      .eq('user_id', userId)
      .order('iso_date', { ascending: true })
      .range(page * TAILLE_PAGE_CONDITION, (page + 1) * TAILLE_PAGE_CONDITION - 1);
    const res = resultat<Pick<Metrique, 'iso_date' | 'ctl'>[]>(r, 'Impossible de charger ta forme.');
    if (!res.data) return { data: null, erreur: res.erreur };
    tout.push(...res.data);
    if (res.data.length < TAILLE_PAGE_CONDITION) return { data: tout, erreur: '' };
  }
  return { data: tout, erreur: '' };
}
