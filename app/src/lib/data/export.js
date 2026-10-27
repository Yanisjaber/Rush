// Export de toutes les données de l'utilisateur en un fichier JSON (sauvegarde et droit à la portabilité).
// On lit uniquement ses propres lignes (la RLS l'impose de toute façon). Les colonnes lourdes (courbes brutes, fichiers GPX)
// et les jetons de connexion ne sont jamais exportés.
import { sb } from '../supabase.js';

const TABLES = [
  ['profil', 'user_profiles', '*'],
  ['seances', 'activities', 'id,strava_id,source,name,sport,discipline,category,start_date_local,moving_time,elapsed_time,distance_km,total_elevation_gain,avg_speed_kmh,avg_heartrate,max_heartrate,avg_watts,max_watts,np,ftp_at_time,avg_cadence,kj,calories,tss,rpe,user_notes,planned_id,merged_into,priority,target,course_dplus,tri,stages,laps,lap_details,gpx_name,result_place,result_total,result_catev'],
  ['retouches', 'activity_edits', '*'],
  ['seances_prevues', 'activity_planned', 'id,name,date,sport,duration,tss,category,km,start_date_local,rpe,d_plus,notes,structure,priority,type'],
  ['modeles', 'activity_template', '*'],
  ['jours_repos', 'rest_day', '*'],
  ['notes', 'day_notes', '*'],
  ['objectifs_annuels', 'yearly_goals', '*'],
  ['forme_par_jour', 'daily_metrics', '*'],
  ['sommeil', 'garmin_sleep', '*'],
  ['preferences', 'user_preferences', '*'],
  ['exercices_perso', 'strength_exercises', '*'],
  ['programmes_force', 'strength_programs', '*'],
  ['series_force', 'strength_sets', '*'],
  ['tests_hyrox', 'hyrox_tests', '*'],
  ['objectif_hyrox', 'hyrox_objectif', '*'],
  ['efforts_hyrox', 'hyrox_efforts', '*'],
  ['cycles', 'training_cycles', '*'],
  ['sante', 'health_metrics', '*'],
  ['records_puissance', 'power_profile', '*'],
  ['records_puissance_par_sport', 'power_profile_sport', '*'],
];
const PAGE = 1000;
const MAX_LIGNES = 50000; // plafond de sécurité par table

/** Lit une table par pages. Une table absente ou illisible est signalée dans `avertissements` sans bloquer l'export. */
async function lireTable(userId, table, colonnes, avertissements) {
  const lignes = [];
  for (let debut = 0; debut < MAX_LIGNES; debut += PAGE) {
    const r = await sb.from(table).select(colonnes).eq('user_id', userId).range(debut, debut + PAGE - 1);
    if (r.error) {
      avertissements.push(table);
      return lignes;
    }
    lignes.push(...(r.data || []));
    if ((r.data || []).length < PAGE) return lignes;
  }
  avertissements.push(`${table} (tronquée à ${MAX_LIGNES} lignes)`); // plafond atteint : l'export n'est pas complet, on le dit
  return lignes;
}

/** Rassemble les données de l'utilisateur. Renvoie { contenu, avertissements } (contenu = objet prêt à sérialiser). */
export async function exporterMesDonnees(userId, email = '') {
  const avertissements = [];
  const contenu = { application: 'Rush', exporte_le: new Date().toISOString(), compte: { email } };
  for (const [cle, table, colonnes] of TABLES) contenu[cle] = await lireTable(userId, table, colonnes, avertissements);
  return { contenu, avertissements };
}

/** Télécharge le contenu comme fichier JSON (le fichier reste sur l'appareil : rien n'est envoyé ailleurs). */
export function telechargerJson(contenu, nom = 'rush-mes-donnees.json') {
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
