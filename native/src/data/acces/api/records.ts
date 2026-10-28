import { sb } from '../supabase';
import { sortieVeloDeLigne, type LigneVelo, type SortieVelo } from '../../bilan/records.ts';
import { resultat, type Resultat } from './commun';

// Les sorties à vélo avec leurs colonnes de records (courbe de puissance, énergie) : la fonction SQL rpc_sorties_velo ne renvoie que le compte connecté.
const TAILLE_PAGE = 1000; // l'API renvoie au plus 1000 lignes par requête : on lit par pages
const PAGES_MAX = 20; // garde-fou : 20 000 sorties

export async function chargerSortiesVelo(): Promise<Resultat<SortieVelo[]>> {
  const toutes: SortieVelo[] = [];
  for (let page = 0; page < PAGES_MAX; page++) {
    const r = await sb.rpc('rpc_sorties_velo').range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1);
    const res = resultat<LigneVelo[]>(r, 'Impossible de charger tes sorties à vélo.');
    if (res.erreur || !res.data) return { data: null, erreur: res.erreur || 'Impossible de charger tes sorties à vélo.' };
    toutes.push(...res.data.map(sortieVeloDeLigne));
    if (res.data.length < TAILLE_PAGE) return { data: toutes, erreur: '' };
  }
  return { data: null, erreur: 'Tes sorties à vélo sont trop nombreuses pour être chargées en entier.' };
}
