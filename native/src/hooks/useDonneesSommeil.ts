import { useCallback, useEffect, useMemo, useState } from 'react';
import { chargerSommeil } from '@/data/acces/api';
import { sommeilDemo } from '@/data/demo/demo';
import type { Nuit } from '@/data/types';
import { useAuth } from '@/stores/auth';

// Les nuits de l'onglet Santé (démo ou compte connecté, lecture seule).
export function useDonneesSommeil(): {
  nuits: Nuit[];
  chargement: boolean;
  erreur: string;
  actualisation: boolean;
  demo: boolean;
  userId: string | null;
  recharger: () => Promise<void>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const demoNuits = useMemo(() => (demo ? sommeilDemo(new Date(), 90) : null), [demo]);
  const [reel, setReel] = useState<{ userId: string; nuits: Nuit[]; erreur: string } | null>(null);
  const [actualisation, setActualisation] = useState(false);

  const charger = useCallback(async () => {
    if (!userId) return;
    const r = await chargerSommeil(userId, 90);
    setReel({ userId, nuits: r.data ?? [], erreur: r.erreur });
  }, [userId]);

  useEffect(() => {
    if (!demo) void charger();
  }, [demo, charger]);

  const recharger = useCallback(async () => {
    setActualisation(true);
    try {
      if (!demo) await charger();
    } finally {
      setActualisation(false);
    }
  }, [demo, charger]);

  // Les nuits d'un autre compte ne s'affichent jamais
  const lot = demo ? { nuits: demoNuits ?? [], erreur: '' } : reel && reel.userId === userId ? reel : null;
  return { nuits: lot?.nuits ?? [], chargement: !lot, erreur: lot?.erreur ?? '', actualisation, demo, userId, recharger };
}
