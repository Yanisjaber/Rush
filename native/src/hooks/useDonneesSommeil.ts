import { useCallback, useEffect, useMemo, useState } from 'react';
import { chargerSommeil } from '@/data/acces/api';
import type { Nuit } from '@/data/types';
import { useAuth } from '@/stores/auth';

// Les nuits de l'onglet Santé (lecture seule).
export function useDonneesSommeil(): {
  nuits: Nuit[];
  chargement: boolean;
  erreur: string;
  actualisation: boolean;
  userId: string | null;
  recharger: () => Promise<void>;
  rechargerSilencieux: () => Promise<void>;
} {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [reel, setReel] = useState<{ userId: string; nuits: Nuit[]; erreur: string } | null>(null);
  const [actualisation, setActualisation] = useState(false);

  const charger = useCallback(async () => {
    if (!userId) return;
    const r = await chargerSommeil(userId, 90);
    setReel({ userId, nuits: r.data ?? [], erreur: r.erreur });
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const recharger = useCallback(async () => {
    setActualisation(true);
    try {
      await charger();
    } finally {
      setActualisation(false);
    }
  }, [charger]);

  // Les nuits d'un autre compte ne s'affichent jamais
  const lot = reel && reel.userId === userId ? reel : null;
  return { nuits: lot?.nuits ?? [], chargement: !lot, erreur: lot?.erreur ?? '', actualisation, userId, recharger, rechargerSilencieux: charger };
}
