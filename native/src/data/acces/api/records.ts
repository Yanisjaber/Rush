import { sb } from '../supabase';
import { courbeDeLignes, sortieVeloDeLigne, type LigneCourbe, type LigneVelo, type PointCourbe, type SortieVelo } from '../../bilan/records.ts';
import { resultat, type Resultat } from './commun';

// Les sorties à vélo avec leurs colonnes de records basiques, et la courbe de puissance : les fonctions SQL rpc_sorties_velo et rpc_courbe_puissance ne renvoient que le compte connecté.
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

/** La courbe de puissance (trois meilleures séances par durée) d'une année (« 2026 »), ou de tout l'historique sans année. */
export async function chargerCourbePuissance(annee?: number): Promise<Resultat<PointCourbe[]>> {
  const r = await sb.rpc('rpc_courbe_puissance', annee ? { p_debut: `${annee}-01-01`, p_fin: `${annee}-12-31` } : {});
  const res = resultat<LigneCourbe[]>(r, 'Impossible de charger ta courbe de puissance.');
  return res.data ? { data: courbeDeLignes(res.data), erreur: '' } : { data: null, erreur: res.erreur };
}
