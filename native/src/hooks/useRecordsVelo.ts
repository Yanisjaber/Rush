import { useEffect, useState } from 'react';
import { chargerProfil, chargerSortiesVelo } from '@/data/acces/api';
import type { SortieVelo } from '@/data/bilan/records';
import { useAuth } from '@/stores/auth';

// Les sorties à vélo avec les colonnes des records, et ton poids (pour les W/kg). Chargés quand `actif` passe à vrai (l'onglet Records d'un sport vélo est ouvert),
// puis gardés en mémoire cinq minutes pour ne pas recharger à chaque changement d'onglet. Sans compte (démo), il n'y en a pas : l'écran n'affiche que les records de volume.
const DUREE_CACHE = 5 * 60 * 1000;
let cache: { userId: string; sorties: SortieVelo[]; poids: number | null; a: number } | null = null;

export function useRecordsVelo(actif: boolean): { sorties: SortieVelo[]; poids: number | null; chargement: boolean; erreur: string } {
  const { session, demo } = useAuth();
  const userId = !demo ? (session?.user.id ?? null) : null;
  const [etat, setEtat] = useState<{ userId: string; sorties: SortieVelo[]; poids: number | null } | null>(cache && cache.userId === userId ? cache : null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!actif || !userId) return;
    if (cache && cache.userId === userId && Date.now() - cache.a < DUREE_CACHE) {
      setEtat(cache);
      return;
    }
    let annule = false;
    setChargement(true);
    void (async () => {
      try {
        const [s, p] = await Promise.all([chargerSortiesVelo(), chargerProfil(userId)]);
        if (annule) return;
        if (s.data) {
          cache = { userId, sorties: s.data, poids: p.data?.weight ?? null, a: Date.now() };
          setEtat(cache);
          setErreur('');
        } else setErreur(s.erreur);
      } catch {
        if (!annule) setErreur('Impossible de charger tes sorties à vélo.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [actif, userId]);

  return { sorties: etat && etat.userId === userId ? etat.sorties : [], poids: etat && etat.userId === userId ? etat.poids : null, chargement, erreur };
}
