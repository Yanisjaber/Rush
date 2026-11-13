import { useEffect, useState } from 'react';
import { chargerObjectifHyrox, chargerTestsHyrox } from '@/data/acces/api';
import type { ObjectifHyrox, TestHyrox } from '@/data/types';
import { useAuth } from '@/stores/auth';

// Les tests et courses Hyrox (table hyrox_tests) et l'objectif de temps pour le Bilan de l'Hyrox : une lecture quand l'onglet Hyrox est ouvert (`actif`), gardée cinq minutes.
// L'accueil les reçoit déjà dans son contexte ; le Bilan, lui, ne charge que les activités.
const DUREE_CACHE = 5 * 60 * 1000;
const cache = new Map<string, { tests: TestHyrox[]; objectif: ObjectifHyrox | null; a: number }>();
const VIDE: TestHyrox[] = [];

export function useTestsHyrox(actif: boolean): { tests: TestHyrox[]; objectif: ObjectifHyrox | null; chargement: boolean } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
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
        const [t, o] = await Promise.all([chargerTestsHyrox(userId), chargerObjectifHyrox(userId)]);
        if (annule) return;
        cache.set(userId, { tests: t.data ?? [], objectif: o.data ?? null, a: Date.now() });
        rafraichir((n) => n + 1);
      } catch {
        // pas de tests : le Bilan garde les séances seules
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [userId, actif]);

  if (!actif) return { tests: VIDE, objectif: null, chargement: false };
  const lu = userId ? cache.get(userId) : undefined;
  return { tests: lu?.tests ?? VIDE, objectif: lu?.objectif ?? null, chargement };
}
