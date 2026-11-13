import { useEffect, useMemo, useState } from 'react';
import { chargerConditionComplete } from '@/data/acces/api';
import { conditionParSemaine, type PointCondition } from '@/data/bilan/forme-longue';
import { useAuth } from '@/stores/auth';
import { auChangementDEcarts, useVersionEcarts } from '@/stores/ecarts';

// La condition (CTL) de toute l'histoire du compte, semaine par semaine, pour la courbe de forme du Progrès.
// Chargée à l'ouverture de l'onglet, gardée cinq minutes (une donnée écartée change la charge : on relit).
const DUREE_CACHE = 5 * 60 * 1000;
const cache = new Map<string, { semaines: PointCondition[]; a: number }>();
auChangementDEcarts(() => cache.clear());

export function useConditionLongue(actif: boolean): { semaines: PointCondition[]; chargement: boolean; erreur: string } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const versionEcarts = useVersionEcarts();
  const [reel, setReel] = useState<{ userId: string; semaines: PointCondition[]; erreur: string } | null>(null);

  useEffect(() => {
    if (!actif || !userId) return;
    const connu = cache.get(userId);
    if (connu && Date.now() - connu.a < DUREE_CACHE) {
      setReel({ userId, semaines: connu.semaines, erreur: '' });
      return;
    }
    let annule = false;
    void (async () => {
      try {
        const r = await chargerConditionComplete(userId);
        if (annule) return;
        const semaines = conditionParSemaine(r.data ?? []);
        if (r.data) cache.set(userId, { semaines, a: Date.now() });
        setReel({ userId, semaines, erreur: r.erreur });
      } catch {
        if (!annule) setReel({ userId, semaines: [], erreur: 'Impossible de charger ta forme.' });
      }
    })();
    return () => {
      annule = true;
    };
  }, [actif, userId, versionEcarts]);

  // Les données d'un autre compte ne s'affichent jamais
  const lot = useMemo(() => (reel && reel.userId === userId ? reel : null), [reel, userId]);
  return { semaines: lot?.semaines ?? [], chargement: actif && !lot, erreur: lot?.erreur ?? '' };
}
