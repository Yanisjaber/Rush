import { useEffect, useMemo, useState } from 'react';
import { chargerPiliersCourse } from '@/data/acces/api';
import type { LignePiliersCourse } from '@/data/bilan/piliers-course';
import { piliersCourseDemo } from '@/data/demo/records-course-demo';
import { useAuth } from '@/stores/auth';
import { auChangementDEcarts, useVersionEcarts } from '@/stores/ecarts';

// Les mesures par année du niveau global de la course (meilleurs temps et distances de l'année) : une seule lecture (la fonction SQL rpc_piliers_course),
// faite quand la page Progrès de la course est ouverte (`actif`), puis gardée cinq minutes. En démo, elles sont calculées sur les streams des courses d'exemple.
const DUREE_CACHE = 5 * 60 * 1000;
const cache = new Map<string, { lignes: LignePiliersCourse[]; a: number }>();
const VIDE: LignePiliersCourse[] = [];
auChangementDEcarts(() => cache.clear()); // une donnée écartée change le niveau : on relit

export function usePiliersCourse(actif: boolean): { lignes: LignePiliersCourse[]; chargement: boolean } {
  const { session, demo } = useAuth();
  const userId = !demo ? (session?.user.id ?? null) : null;
  const versionEcarts = useVersionEcarts();
  const [, rafraichir] = useState(0);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (!userId || !actif) return;
    const dejaLu = cache.get(userId);
    if (dejaLu && Date.now() - dejaLu.a < DUREE_CACHE) return;
    let annule = false;
    setChargement(true);
    void (async () => {
      try {
        const r = await chargerPiliersCourse();
        if (annule) return;
        cache.set(userId, { lignes: r.data ?? [], a: Date.now() });
        rafraichir((n) => n + 1);
      } catch {
        // pas de mesures : la page garde l'ancien écran
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [userId, actif, versionEcarts]);

  const exemple = useMemo(() => (demo && actif ? piliersCourseDemo(new Date()) : null), [demo, actif]);
  if (exemple) return { lignes: exemple, chargement: false };
  if (!actif || !userId) return { lignes: VIDE, chargement: false };
  return { lignes: cache.get(userId)?.lignes || VIDE, chargement };
}
