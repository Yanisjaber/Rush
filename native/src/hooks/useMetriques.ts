import { useCallback, useEffect, useMemo, useState } from 'react';
import { chargerMetriques } from '@/data/api';
import { donneesDemo } from '@/data/demo';
import type { Metrique } from '@/data/types';
import { useAuth } from '@/stores/auth';

// Les métriques de charge quotidiennes (condition, fatigue, forme) d'un écran qui n'a pas besoin de tout l'Accueil (démo ou compte connecté).
export function useMetriques(): { metriques: Metrique[]; chargement: boolean; recharger: () => Promise<void> } {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const metriquesDemo = useMemo(() => (demo ? donneesDemo(new Date()).metriques : null), [demo]);
  const [reel, setReel] = useState<{ userId: string; metriques: Metrique[] } | null>(null);

  const charger = useCallback(async () => {
    if (!userId) return;
    const r = await chargerMetriques(userId, 90);
    setReel({ userId, metriques: r.data ?? [] });
  }, [userId]);

  useEffect(() => {
    if (!demo) void charger();
  }, [demo, charger]);

  // Les métriques d'un autre compte ne s'affichent jamais
  const metriques = demo ? (metriquesDemo ?? []) : reel && reel.userId === userId ? reel.metriques : [];
  return { metriques, chargement: !demo && !(reel && reel.userId === userId), recharger: charger };
}
