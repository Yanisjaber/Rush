import { useEffect, useMemo, useState } from 'react';
import { chargerCourbeSignal } from '@/data/acces/api';
import type { CleSignal, PointCourbe } from '@/data/bilan/records';
import { recordsVeloDemo } from '@/data/demo/demo';
import { useAuth } from '@/stores/auth';

// La courbe d'un autre signal du vélo (FC, cadence, couple, vitesse, VAM, descente) : tous temps et année choisie.
// Chargée quand on choisit le signal, puis gardée en mémoire cinq minutes. En démo, ce sont des courbes d'exemple. Pour la puissance, rien (elle vient de useRecordsVelo).
const DUREE_CACHE = 5 * 60 * 1000;
const cache = new Map<string, { data: PointCourbe[]; a: number }>();
const cleCache = (userId: string, signal: CleSignal, annee: number | undefined): string => `${userId}|${signal}|${annee ?? 'tout'}`;
const VIDE: PointCourbe[] = [];

export function useCourbeSignal(signal: CleSignal, annee: number): { courbeTout: PointCourbe[]; courbeAnnee: PointCourbe[]; chargement: boolean; erreur: string } {
  const { session, demo } = useAuth();
  const userId = !demo ? (session?.user.id ?? null) : null;
  const actif = signal !== 'puissance';
  const [, rafraichir] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const exemple = useMemo(() => (demo && actif ? recordsVeloDemo(new Date()) : null), [demo, actif]);
  const donneesDemo = useMemo(() => (exemple ? { tout: exemple.courbeSignal(signal), annee: exemple.courbeSignal(signal, annee) } : null), [exemple, signal, annee]);

  useEffect(() => {
    if (signal === 'puissance' || !userId) return;
    let annule = false;
    void (async () => {
      const manque = [undefined, annee].filter((a) => {
        const c = cache.get(cleCache(userId, signal, a));
        return !c || Date.now() - c.a > DUREE_CACHE;
      });
      if (!manque.length) return;
      setChargement(true);
      try {
        for (const a of manque) {
          const r = await chargerCourbeSignal(signal, a);
          if (annule) return;
          if (!r.data) {
            setErreur(r.erreur);
            return;
          }
          cache.set(cleCache(userId, signal, a), { data: r.data, a: Date.now() });
        }
        setErreur('');
        rafraichir((n) => n + 1);
      } catch {
        if (!annule) setErreur('Impossible de charger cette courbe.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [userId, signal, annee]);

  if (!actif) return { courbeTout: VIDE, courbeAnnee: VIDE, chargement: false, erreur: '' };
  if (donneesDemo) return { courbeTout: donneesDemo.tout, courbeAnnee: donneesDemo.annee, chargement: false, erreur: '' };
  return {
    courbeTout: (userId && cache.get(cleCache(userId, signal, undefined))?.data) || VIDE,
    courbeAnnee: (userId && cache.get(cleCache(userId, signal, annee))?.data) || VIDE,
    chargement,
    erreur,
  };
}
