// Les sports choisis par l'utilisateur (et leurs sous-disciplines), réactifs. Stockés dans user_preferences (colonnes `sports` et `disciplines`) ;
// en démo, ou si les colonnes n'existent pas encore, dans le navigateur (l'app marche dans tous les cas).
import { sb } from '../supabase.js';
import { nettoyerSports } from '../data/sports-choisis.js';
import { nettoyerDisciplines } from '../data/disciplines.js';

export const sportsChoisis = $state({ pret: false, liste: null, disciplines: {}, stockage: 'local' });

const cleSports = (uid) => `rush-sports-${uid}`;
const cleDisciplines = (uid) => `rush-disciplines-${uid}`;

function lireLocal(cle) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    return null;
  }
}

function ecrireLocal(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch (e) {
    /* stockage indisponible : on garde seulement la mémoire */
  }
}

/** Charge les sports et disciplines choisis (base de données, sinon navigateur). `liste` reste null si on ne les a jamais demandés. */
export async function chargerSportsChoisis(uid) {
  sportsChoisis.stockage = 'local';
  if (uid && uid !== 'demo') {
    const r = await sb.from('user_preferences').select('sports,disciplines').eq('user_id', uid).maybeSingle();
    if (!r.error) {
      // On calcule dans des variables locales : relire `sportsChoisis` juste après l'avoir écrit relancerait, à l'infini,
      // tout effet Svelte qui appelle cette fonction.
      const liste = nettoyerSports(r.data?.sports);
      sportsChoisis.stockage = 'base';
      sportsChoisis.liste = liste;
      sportsChoisis.disciplines = nettoyerDisciplines(r.data?.disciplines, liste || []);
      sportsChoisis.pret = true;
      return;
    }
  }
  const liste = nettoyerSports(lireLocal(cleSports(uid)));
  sportsChoisis.liste = liste;
  sportsChoisis.disciplines = nettoyerDisciplines(lireLocal(cleDisciplines(uid)), liste || []);
  sportsChoisis.pret = true;
}

/**
 * Enregistre les sports choisis et leurs disciplines (celles d'un sport décoché disparaissent).
 * Renvoie { ok, local } ; en cas d'échec en ligne, le choix reste valable sur cet appareil.
 */
export async function enregistrerSportsChoisis(uid, brut, disciplinesBrutes = {}) {
  const liste = nettoyerSports(brut) || [];
  const disciplines = nettoyerDisciplines(disciplinesBrutes, liste);
  ecrireLocal(cleSports(uid), liste);
  ecrireLocal(cleDisciplines(uid), disciplines);
  sportsChoisis.liste = liste;
  sportsChoisis.disciplines = disciplines;
  if (!uid || uid === 'demo' || sportsChoisis.stockage !== 'base') return { ok: true, local: true };
  const r = await sb.from('user_preferences').upsert({ user_id: uid, sports: liste, disciplines }, { onConflict: 'user_id' });
  if (r.error) {
    console.error('[app/sports]', r.error.code || '');
    sportsChoisis.stockage = 'local';
    return { ok: true, local: true };
  }
  return { ok: true, local: false };
}
