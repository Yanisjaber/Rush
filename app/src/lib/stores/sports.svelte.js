// Les sports choisis par l'utilisateur, réactifs. Stockés dans user_preferences (colonne `sports`) ;
// en démo, ou si la colonne n'existe pas encore, dans le navigateur (l'app marche dans tous les cas).
// La colonne `disciplines` du compte n'est plus lue ni écrite (les disciplines ont été retirées de l'app, 20 oct.).
import { sb } from '../supabase.js';
import { nettoyerSports } from '../data/sports-choisis.js';

export const sportsChoisis = $state({ pret: false, liste: null, stockage: 'local' });

const cleSports = (uid) => `rush-sports-${uid}`;

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

/** Charge les sports choisis (base de données, sinon navigateur). `liste` reste null si on ne les a jamais demandés. */
export async function chargerSportsChoisis(uid) {
  sportsChoisis.stockage = 'local';
  if (uid && uid !== 'demo') {
    const r = await sb.from('user_preferences').select('sports').eq('user_id', uid).maybeSingle();
    if (!r.error) {
      // On calcule dans des variables locales : relire `sportsChoisis` juste après l'avoir écrit relancerait, à l'infini,
      // tout effet Svelte qui appelle cette fonction.
      const liste = nettoyerSports(r.data?.sports);
      sportsChoisis.stockage = 'base';
      sportsChoisis.liste = liste;
      sportsChoisis.pret = true;
      return;
    }
  }
  sportsChoisis.liste = nettoyerSports(lireLocal(cleSports(uid)));
  sportsChoisis.pret = true;
}

/**
 * Enregistre les sports choisis. N'écrit que la colonne `sports` (jamais le thème, la disposition ni les disciplines).
 * Renvoie { ok, local } ; en cas d'échec en ligne, le choix reste valable sur cet appareil.
 */
export async function enregistrerSportsChoisis(uid, brut) {
  const liste = nettoyerSports(brut) || [];
  ecrireLocal(cleSports(uid), liste);
  sportsChoisis.liste = liste;
  if (!uid || uid === 'demo' || sportsChoisis.stockage !== 'base') return { ok: true, local: true };
  const r = await sb.from('user_preferences').upsert({ user_id: uid, sports: liste }, { onConflict: 'user_id' });
  if (r.error) {
    console.error('[app/sports]', r.error.code || '');
    sportsChoisis.stockage = 'local';
    return { ok: true, local: true };
  }
  return { ok: true, local: false };
}
