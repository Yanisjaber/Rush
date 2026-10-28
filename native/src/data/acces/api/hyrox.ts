import { sb } from '../supabase';
import type { ObjectifHyrox, TestHyrox } from '../../types';
import { resultat, type Resultat } from './commun';

const COLONNES_HYROX = 'id,date,label,kind,segments,total_s,source,activity_id,notes';

export async function chargerTestsHyrox(userId: string): Promise<Resultat<TestHyrox[]>> {
  const r = await sb.from('hyrox_tests').select(COLONNES_HYROX).eq('user_id', userId).order('date', { ascending: false }).limit(200);
  return resultat(r, 'Impossible de charger tes tests Hyrox.');
}

export async function chargerObjectifHyrox(userId: string): Promise<Resultat<ObjectifHyrox | null>> {
  const r = await sb.from('hyrox_objectif').select('total_s,segments').eq('user_id', userId).maybeSingle();
  return resultat(r, 'Impossible de charger ton objectif Hyrox.');
}
