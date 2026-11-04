import { useEffect, useMemo, useState } from 'react';
import { chargerPiliersAnnuels } from '@/data/acces/api';
import type { MesuresAnnee } from '@/data/bilan/piliers-niveau';
import { piliersAnnuelsDemo } from '@/data/demo/piliers-demo';
import { useAuth } from '@/stores/auth';
import { auChangementDEcarts, useVersionEcarts } from '@/stores/ecarts';

// Les mesures par année du niveau global du vélo (puissances de pointe, répétabilité, charge) : une seule lecture (la fonction SQL rpc_piliers_annuels),
// faite quand la page Progrès du vélo est ouverte (`actif`), puis gardée cinq minutes. En démo, des exemples.
const DUREE_CACHE = 5 * 60 * 1000;
const cache = new Map<string, { mesures: MesuresAnnee[]; a: number }>();
const VIDE: MesuresAnnee[] = [];
auChangementDEcarts(() => cache.clear()); // une donnée écartée change le niveau : on relit

export function usePiliersAnnuels(actif: boolean): { mesures: MesuresAnnee[]; chargement: boolean } {
  const { session, demo } = useAuth();
  const userId = !demo ? (session?.user.id ?? null) : null;
  const versionEcarts = useVersionEcarts();
  const [, rafraichir] = useState(0);
  const [chargement, setChargement] = useState(false);
  const exemple = useMemo(() => (demo && actif ? piliersAnnuelsDemo(new Date()) : null), [demo, actif]);

  useEffect(() => {
    if (!userId || !actif) return;
    const dejaLu = cache.get(userId);
    if (dejaLu && Date.now() - dejaLu.a < DUREE_CACHE) return;
    let annule = false;
    setChargement(true);
    void (async () => {
      try {
        const r = await chargerPiliersAnnuels();
        if (annule) return;
        // Une lecture qui échoue : pas de niveau global, la page garde le niveau d'endurance seul
        cache.set(userId, { mesures: r.data ?? [], a: Date.now() });
        rafraichir((n) => n + 1);
      } catch {
        // pas de mesures : la page garde l'ancien écran
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [userId, actif, versionEcarts]);

  if (!actif) return { mesures: VIDE, chargement: false };
  if (exemple) return { mesures: exemple, chargement: false };
  return { mesures: (userId && cache.get(userId)?.mesures) || VIDE, chargement };
}
