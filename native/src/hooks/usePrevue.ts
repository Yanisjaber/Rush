import { useEffect, useState } from 'react';
import { donneesDemoAccueil } from '@/data/accueil/accueil';
import { chargerPrevue } from '@/data/acces/api';
import { prevueCompleteDemo, useVersionAjouts } from '@/stores/ajouts';
import { useAuth } from '@/stores/auth';
import type { PrevueComplete } from '@/data/types';

interface Etat {
  prevue: PrevueComplete | null;
  chargement: boolean;
  erreur: string;
}

const initial: Etat = { prevue: null, chargement: true, erreur: '' };

// Une séance prévue ou une compétition avec toutes ses colonnes : la démo ou le compte connecté. Elle se relit après chaque modification ou suppression
// (le numéro de version des ajouts change), donc l'écran de lecture est toujours à jour en revenant du formulaire.
export function usePrevue(id: string): Etat {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const version = useVersionAjouts();
  const [etat, setEtat] = useState<Etat>(initial);

  useEffect(() => {
    let annule = false;
    if (!id) return setEtat({ ...initial, chargement: false });
    if (demo) {
      const p = prevueCompleteDemo(id, donneesDemoAccueil(new Date()).planifiees);
      setEtat({ prevue: p, chargement: false, erreur: p ? '' : 'Séance introuvable.' });
      return;
    }
    if (!userId) return;
    void (async () => {
      const r = await chargerPrevue(userId, id);
      if (annule) return;
      setEtat({ prevue: r.data, chargement: false, erreur: r.data ? '' : r.erreur || 'Séance introuvable.' });
    })();
    return () => {
      annule = true;
    };
  }, [id, userId, demo, version]);

  return etat;
}
