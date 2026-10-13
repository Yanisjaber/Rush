// Les sports choisis par l'utilisateur, réactifs. Stockés dans user_preferences.sports ;
// en démo, ou si la colonne n'existe pas encore, dans le navigateur (l'app marche dans tous les cas).
import { sb } from '../supabase.js';
import { nettoyerSports } from '../data/sports-choisis.js';

export const sportsChoisis = $state({ pret: false, liste: null, stockage: 'local' });

const cle = (uid) => `coachia-v2-sports-${uid}`;

function lireLocal(uid) {
  try {
    const brut = localStorage.getItem(cle(uid));
    return brut ? nettoyerSports(JSON.parse(brut)) : null;
  } catch (e) {
    return null;
  }
}

function ecrireLocal(uid, liste) {
  try {
    localStorage.setItem(cle(uid), JSON.stringify(liste));
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
      sportsChoisis.stockage = 'base';
      sportsChoisis.liste = nettoyerSports(r.data?.sports);
      sportsChoisis.pret = true;
      return;
    }
  }
  sportsChoisis.liste = lireLocal(uid);
  sportsChoisis.pret = true;
}

/** Enregistre les sports choisis. Renvoie { ok } ; en cas d'échec en ligne, le choix reste valable sur cet appareil. */
export async function enregistrerSportsChoisis(uid, brut) {
  const liste = nettoyerSports(brut) || [];
  ecrireLocal(uid, liste);
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
