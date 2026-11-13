import { useCallback, useEffect, useState } from 'react';
import { chargerMetriques } from '@/data/acces/api';
import type { Metrique } from '@/data/types';
import { useAuth } from '@/stores/auth';
import { useVersionEcarts } from '@/stores/ecarts';

// Les métriques de charge quotidiennes (condition, fatigue, forme) d'un écran qui n'a pas besoin de tout l'Accueil .
export function useMetriques(): { metriques: Metrique[]; chargement: boolean; erreur: string; recharger: () => Promise<void> } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const versionEcarts = useVersionEcarts(); // la charge change quand une donnée est écartée
  const [reel, setReel] = useState<{ userId: string; metriques: Metrique[]; erreur: string } | null>(null);

  const charger = useCallback(async () => {
    if (!userId) return;
    const r = await chargerMetriques(userId, 90);
    setReel({ userId, metriques: r.data ?? [], erreur: r.erreur });
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger, versionEcarts]);

  // Les métriques d'un autre compte ne s'affichent jamais
  const metriques = reel && reel.userId === userId ? reel.metriques : [];
  const lot = reel && reel.userId === userId ? reel : null;
  return { metriques, chargement: !lot, erreur: lot?.erreur ?? '', recharger: charger };
}
