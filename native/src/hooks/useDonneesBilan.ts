import { useCallback, useEffect, useMemo, useState } from 'react';
import { chargerActivitesBilan, chargerObjectifsAnnuels } from '@/data/api';
import type { ObjectifAnnuel } from '@/data/bilan';
import { activitesBilanDemo, objectifsAnnuelsDemo } from '@/data/demo';
import { useAuth } from '@/stores/auth';
import type { Seance } from '@/data/types';

// Les données du Bilan : toutes les activités depuis la première et les objectifs annuels (démo ou compte connecté, lecture seule).
// Toutes les années sont chargées d'un coup : changer d'année affichée ne recharge rien.
export function useDonneesBilan(): {
  brutes: Seance[];
  objectifs: ObjectifAnnuel[];
  chargement: boolean;
  erreur: string;
  actualisation: boolean;
  recharger: () => Promise<void>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const demoDonnees = useMemo(() => (demo ? { brutes: activitesBilanDemo(new Date()), objectifs: objectifsAnnuelsDemo(new Date()), erreur: '' } : null), [demo]);
  const [reel, setReel] = useState<{ userId: string; brutes: Seance[]; objectifs: ObjectifAnnuel[]; erreur: string } | null>(null);
  const [actualisation, setActualisation] = useState(false);

  const charger = useCallback(async () => {
    if (!userId) return;
    const [acts, obj] = await Promise.all([chargerActivitesBilan(userId, new Date().getFullYear()), chargerObjectifsAnnuels(userId)]);
    setReel({ userId, brutes: acts.data ?? [], objectifs: obj.data ?? [], erreur: acts.erreur || obj.erreur });
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

  // Les données d'un autre compte ne s'affichent jamais
  const donnees = demo ? demoDonnees : reel && reel.userId === userId ? reel : null;
  return { brutes: donnees?.brutes ?? [], objectifs: donnees?.objectifs ?? [], chargement: !donnees, erreur: donnees?.erreur ?? '', actualisation, recharger };
}
