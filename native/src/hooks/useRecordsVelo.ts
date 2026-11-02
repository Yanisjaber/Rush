import { useEffect, useMemo, useState } from 'react';
import { chargerCourbePuissance, chargerProfil, chargerSortiesVelo } from '@/data/acces/api';
import type { PointCourbe, SortieVelo } from '@/data/bilan/records';
import { recordsVeloDemo } from '@/data/demo/demo';
import { useAuth } from '@/stores/auth';
import { auChangementDEcarts, useVersionEcarts } from '@/stores/ecarts';

// Les données de l'onglet Records du vélo : les sorties (records basiques), la courbe de puissance de tous les temps et celle de l'année choisie, et ton poids (pour les W/kg).
// Chargées quand `actif` passe à vrai (l'onglet Records du Cyclisme est ouvert), puis gardées en mémoire cinq minutes pour ne pas recharger à chaque changement d'onglet.
// En démo, ce sont des sorties et une courbe d'exemple (rien n'est chargé).
const DUREE_CACHE = 5 * 60 * 1000;
interface Donnees {
  userId: string;
  sorties: SortieVelo[];
  poids: number | null;
  courbeTout: PointCourbe[];
  /** La courbe de chaque année déjà demandée. */
  courbeAnnee: Record<number, PointCourbe[]>;
  a: number;
}
let cache: Donnees | null = null;
auChangementDEcarts(() => {
  cache = null; // une donnée écartée change les records : on relit tout
});

export function useRecordsVelo(actif: boolean, annee: number): { sorties: SortieVelo[]; poids: number | null; courbeTout: PointCourbe[]; courbeAnnee: PointCourbe[]; chargement: boolean; erreur: string } {
  const { session, demo } = useAuth();
  const userId = !demo ? (session?.user.id ?? null) : null;
  const [donnees, setDonnees] = useState<Donnees | null>(cache && cache.userId === userId ? cache : null);
  const versionEcarts = useVersionEcarts();
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const exemple = useMemo(() => {
    if (!demo) return null;
    const e = recordsVeloDemo(new Date());
    return { ...e, tout: e.courbe(), parAnnee: new Map<number, PointCourbe[]>() };
  }, [demo]);

  useEffect(() => {
    if (!actif || !userId) return;
    let annule = false;
    void (async () => {
      try {
        let courant = cache && cache.userId === userId && Date.now() - cache.a < DUREE_CACHE ? cache : null;
        if (!courant) {
          setChargement(true);
          const [s, c, p] = await Promise.all([chargerSortiesVelo(), chargerCourbePuissance(), chargerProfil(userId)]);
          if (annule) return;
          if (!s.data || !c.data) {
            setErreur(s.erreur || c.erreur);
            return;
          }
          courant = { userId, sorties: s.data, poids: p.data?.weight ?? null, courbeTout: c.data, courbeAnnee: {}, a: Date.now() };
          cache = courant;
        }
        if (!courant.courbeAnnee[annee]) {
          setChargement(true);
          const c = await chargerCourbePuissance(annee);
          if (annule) return;
          if (!c.data) {
            setErreur(c.erreur);
            return;
          }
          courant = { ...courant, courbeAnnee: { ...courant.courbeAnnee, [annee]: c.data } };
          cache = courant;
        }
        setErreur('');
        setDonnees(courant);
      } catch {
        if (!annule) setErreur('Impossible de charger tes records à vélo.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [actif, userId, annee, versionEcarts]);

  if (exemple) {
    if (!exemple.parAnnee.has(annee)) exemple.parAnnee.set(annee, exemple.courbe(annee));
    return { sorties: exemple.sorties, poids: exemple.poids, courbeTout: exemple.tout, courbeAnnee: exemple.parAnnee.get(annee) ?? [], chargement: false, erreur: '' };
  }
  const ici = donnees && donnees.userId === userId ? donnees : null;
  return { sorties: ici?.sorties ?? [], poids: ici?.poids ?? null, courbeTout: ici?.courbeTout ?? [], courbeAnnee: ici?.courbeAnnee[annee] ?? [], chargement, erreur };
}
