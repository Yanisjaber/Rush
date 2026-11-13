import { useEffect, useState } from 'react';
import { chargerModeles } from '@/data/acces/api';
import type { Modele } from '@/data/calendrier/modeles';
import { useAuth } from '@/stores/auth';

// Les modèles de séance de l'utilisateur : ceux de la table activity_template.
export function useModeles(): { modeles: Modele[]; chargement: boolean; erreur: string } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [etat, setEtat] = useState<{ modeles: Modele[]; chargement: boolean; erreur: string }>({ modeles: [], chargement: true, erreur: '' });
  useEffect(() => {
    let annule = false;
    if (!userId) return;
    void (async () => {
      const r = await chargerModeles(userId);
      if (!annule) setEtat({ modeles: r.data ?? [], chargement: false, erreur: r.erreur });
    })();
    return () => {
      annule = true;
    };
  }, [userId]);
  return etat;
}
