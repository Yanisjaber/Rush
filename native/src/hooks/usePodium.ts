import { useEffect, useMemo, useState } from 'react';
import { chargerPodium } from '@/data/acces/api';
import type { CleSignal, EntreeCourbe } from '@/data/bilan/records';
import { useAuth } from '@/stores/auth';
import { auChangementDEcarts, useVersionEcarts } from '@/stores/ecarts';

// Le podium (jusqu'à 30 séances) de la durée touchée sur la courbe, pour la puissance ou un autre signal.
// Demandé au serveur seulement quand le doigt s'arrête sur une durée (250 ms), pour ne pas faire une requête par point pendant qu'on fait glisser le doigt ; gardé en mémoire cinq minutes.
// Rend null tant que la liste n'est pas là : l'écran montre alors les trois séances de la courbe.
const DUREE_CACHE = 5 * 60 * 1000;
const ATTENTE_MS = 250;
const cache = new Map<string, { data: EntreeCourbe[]; a: number }>();
const cleCache = (userId: string, signal: CleSignal, duree: number, annee: number | null): string => `${userId}|${signal}|${duree}|${annee ?? 'tout'}`;
auChangementDEcarts(() => cache.clear()); // une donnée écartée change les records : on relit

/** `annee` : l'année de la période choisie, ou null pour « Tous temps ». */
export function usePodium(signal: CleSignal, duree: number | null, annee: number | null): EntreeCourbe[] | null {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const versionEcarts = useVersionEcarts();
  const [, rafraichir] = useState(0);

  useEffect(() => {
    if (!userId || duree == null) return;
    const cle = cleCache(userId, signal, duree, annee);
    const c = cache.get(cle);
    if (c && Date.now() - c.a < DUREE_CACHE) return;
    let annule = false;
    const minuterie = setTimeout(() => {
      void (async () => {
        try {
          const r = await chargerPodium(signal, duree, annee ?? undefined);
          if (annule || !r.data) return;
          cache.set(cle, { data: r.data, a: Date.now() });
          rafraichir((n) => n + 1);
        } catch {
          // Sans le podium complet, l'écran garde les trois séances de la courbe
        }
      })();
    }, ATTENTE_MS);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, [userId, signal, duree, annee, versionEcarts]);

  return userId && duree != null ? (cache.get(cleCache(userId, signal, duree, annee))?.data ?? null) : null;
}
