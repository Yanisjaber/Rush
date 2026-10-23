import { useEffect, useState } from 'react';
import { chargerModeles } from '@/data/api';
import { modelesDemo } from '@/data/demo-modeles';
import type { Modele } from '@/data/modeles';
import { useAuth } from '@/stores/auth';

// Les modèles de séance de l'utilisateur : ceux de l'exemple en démo, ceux de la table activity_template sur un compte.
export function useModeles(): { modeles: Modele[]; chargement: boolean; erreur: string } {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const [etat, setEtat] = useState<{ modeles: Modele[]; chargement: boolean; erreur: string }>({ modeles: [], chargement: true, erreur: '' });
  useEffect(() => {
    let annule = false;
    if (demo) {
      setEtat({ modeles: modelesDemo(), chargement: false, erreur: '' });
      return;
    }
    if (!userId) return;
    void (async () => {
      const r = await chargerModeles(userId);
      if (!annule) setEtat({ modeles: r.data ?? [], chargement: false, erreur: r.erreur });
    })();
    return () => {
      annule = true;
    };
  }, [demo, userId]);
  return etat;
}
