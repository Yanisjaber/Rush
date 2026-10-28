import { dateIsoLocale } from '../../outils/format';
import { sb } from '../supabase';
import type { ProgrammeForce, SerieForce } from '../../types';
import { resultat, type Resultat } from './commun';

const COLONNES_SERIE = 'id,activity_id,date,exercise_key,exercise_name,muscle_group,position,set_no,reps,weight_kg';
const COLONNES_PROGRAMME = 'id,name,exercises,notes,created_at';

// La colonne « rir » (répétitions en réserve) vient d'une migration : tant qu'elle n'est pas en base, on lit sans elle.
let rirDisponible = true;
const colonnesSerie = () => COLONNES_SERIE + (rirDisponible ? ',rir' : '');
const colonneRirAbsente = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /\brir\b/i.test(String(e.message || '')));

/**
 * Séries des N derniers jours (les plus récentes d'abord), 10 ans par défaut : les records se cherchent dans tout l'historique.
 * Supabase ne renvoie qu'un certain nombre de lignes par requête (1000 par défaut) : on lit par pages, jusqu'à `limite` séries.
 * Le tri a un second critère (id) pour que les pages ne se chevauchent pas quand plusieurs séries ont la même date.
 */
export async function chargerSeriesForce(userId: string, jours = 3650, limite = 5000): Promise<Resultat<SerieForce[]>> {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);
  const PAGE = 1000;
  const lignes: SerieForce[] = [];
  const lirePage = (debut: number) =>
    sb
      .from('strength_sets')
      .select(colonnesSerie())
      .eq('user_id', userId)
      .gte('date', dateIsoLocale(depuis))
      .order('date', { ascending: false })
      .order('id', { ascending: true })
      .range(debut, Math.min(debut + PAGE, limite) - 1);
  for (let debut = 0; debut < limite; debut += PAGE) {
    let r = await lirePage(debut);
    if (r.error && rirDisponible && colonneRirAbsente(r.error)) {
      rirDisponible = false; // pas encore de colonne rir : on relit sans
      r = await lirePage(debut);
    }
    if (r.error) return resultat(r, 'Impossible de charger ton carnet de force.');
    const page = (r.data as unknown as SerieForce[]) || [];
    lignes.push(...page);
    if (page.length < PAGE) break; // dernière page
  }
  return { data: lignes, erreur: '' };
}

export async function chargerProgrammes(userId: string): Promise<Resultat<ProgrammeForce[]>> {
  const r = await sb.from('strength_programs').select(COLONNES_PROGRAMME).eq('user_id', userId).order('created_at', { ascending: true }).limit(100);
  return resultat(r, 'Impossible de charger tes programmes.');
}

/** Les séries de force faites sur une période (seulement leur date : le calendrier n'en compte que le nombre par jour). */
export async function chargerSeriesPeriode(userId: string, debutIso: string, finIso: string): Promise<Resultat<{ date: string }[]>> {
  const r = await sb.from('strength_sets').select('date').eq('user_id', userId).gte('date', debutIso).lte('date', finIso).limit(3000);
  return resultat(r, 'Impossible de charger tes séries de force.');
}
