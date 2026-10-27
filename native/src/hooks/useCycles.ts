import { useCallback, useEffect, useState } from 'react';
import { chargerTousCycles, creerCycle, modifierCycle, supprimerCycle } from '@/data/api';
import type { FormulaireCycle } from '@/data/cycles';
import type { Cycle } from '@/data/types';
import { creerCycleDemo, cyclesChanges, cyclesDemo, modifierCycleDemo, supprimerCycleDemo, useVersionCycles } from '@/stores/cycles';
import { useAuth } from '@/stores/auth';

// Tous les cycles de l'utilisateur (la démo ou le compte connecté) et de quoi en créer, en modifier, en supprimer. Chaque écriture prévient le calendrier,
// qui recharge ses bandes. Les cycles sont triés du plus récent au plus ancien.
export function useCycles(): {
  cycles: Cycle[];
  chargement: boolean;
  erreur: string;
  creer: (f: FormulaireCycle) => Promise<string>;
  modifier: (id: string, f: FormulaireCycle) => Promise<string>;
  supprimer: (id: string) => Promise<string>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const version = useVersionCycles();
  const [etat, setEtat] = useState<{ cycles: Cycle[]; chargement: boolean; erreur: string }>({ cycles: [], chargement: true, erreur: '' });

  useEffect(() => {
    let annule = false;
    if (demo) {
      setEtat({ cycles: [...cyclesDemo()].sort((a, b) => b.from_date.localeCompare(a.from_date)), chargement: false, erreur: '' });
      return;
    }
    if (!userId) return;
    void (async () => {
      const r = await chargerTousCycles(userId);
      if (!annule) setEtat({ cycles: r.data ?? [], chargement: false, erreur: r.erreur });
    })();
    return () => {
      annule = true;
    };
  }, [demo, userId, version]);

  const { creer, modifier, supprimer } = useEcrituresCycles();
  return { ...etat, creer, modifier, supprimer };
}

// Les écritures de cycles seules (créer, modifier, supprimer), sans charger la liste : pour un écran qui n'a besoin que d'écrire (l'aperçu d'un cycle).
export function useEcrituresCycles(): {
  creer: (f: FormulaireCycle) => Promise<string>;
  modifier: (id: string, f: FormulaireCycle) => Promise<string>;
  supprimer: (id: string) => Promise<string>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  // Chaque écriture renvoie un message d'erreur, vide quand tout s'est bien passé
  const creer = useCallback(
    async (f: FormulaireCycle) => {
      if (demo) return creerCycleDemo(f) ? '' : 'Impossible de créer ce cycle.';
      if (!userId) return 'Reconnecte-toi.';
      const r = await creerCycle(userId, f);
      if (!r.erreur) cyclesChanges();
      return r.erreur;
    },
    [demo, userId],
  );
  const modifier = useCallback(
    async (id: string, f: FormulaireCycle) => {
      if (demo) return modifierCycleDemo(id, f) ? '' : 'Cycle introuvable.';
      if (!userId) return 'Reconnecte-toi.';
      const r = await modifierCycle(userId, id, f);
      if (!r.erreur) cyclesChanges();
      return r.erreur;
    },
    [demo, userId],
  );
  const supprimer = useCallback(
    async (id: string) => {
      if (demo) {
        supprimerCycleDemo(id);
        return '';
      }
      if (!userId) return 'Reconnecte-toi.';
      const r = await supprimerCycle(userId, id);
      if (!r.erreur) cyclesChanges();
      return r.erreur;
    },
    [demo, userId],
  );
  return { creer, modifier, supprimer };
}
