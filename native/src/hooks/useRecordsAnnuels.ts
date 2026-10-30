import { useEffect, useMemo, useState } from 'react';
import { chargerCourbePuissance } from '@/data/acces/api';
import type { RecordsAnnee } from '@/data/bilan/niveau-annees';
import { recordsDeCourbe } from '@/data/bilan/niveau-annees-affichage';
import { recordsVeloDemo } from '@/data/demo/demo';
import { useAuth } from '@/stores/auth';

// Les meilleures puissances de chaque année (5, 20 et 60 minutes), pour le sélecteur de records de la page Progrès du vélo.
// Une lecture par année (la courbe de puissance de l'année), faite quand la page est ouverte (`actif`), puis gardée cinq minutes. En démo, des exemples.
const DUREE_CACHE = 5 * 60 * 1000;
const cache = new Map<string, { records: RecordsAnnee[]; a: number }>();
const VIDE: RecordsAnnee[] = [];

/** `annees` : les années à lire (de la première sortie vélo à aujourd'hui). */
export function useRecordsAnnuels(annees: readonly number[], actif: boolean): { records: RecordsAnnee[]; chargement: boolean } {
  const { session, demo } = useAuth();
  const userId = !demo ? (session?.user.id ?? null) : null;
  const cleAnnees = annees.join(',');
  const cle = userId ? `${userId}|${cleAnnees}` : '';
  const [, rafraichir] = useState(0);
  const [chargement, setChargement] = useState(false);
  const exemple = useMemo(() => (demo && actif ? recordsVeloDemo(new Date()) : null), [demo, actif]);
  const recordsDemo = useMemo(() => (exemple ? annees.map((an) => recordsDeCourbe(an, exemple.courbe(an, 1))) : null), [exemple, cleAnnees]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId || !actif || !annees.length) return;
    const dejaLu = cache.get(cle);
    if (dejaLu && Date.now() - dejaLu.a < DUREE_CACHE) return;
    let annule = false;
    setChargement(true);
    void (async () => {
      try {
        const lectures = await Promise.all(annees.map((an) => chargerCourbePuissance(an)));
        if (annule) return;
        // Une lecture qui échoue donne une année sans record plutôt qu'un écran vide
        cache.set(cle, { records: annees.map((an, i) => recordsDeCourbe(an, lectures[i].data ?? [])), a: Date.now() });
        rafraichir((n) => n + 1);
      } catch {
        // pas de records : le sélecteur n'apparaît pas
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [userId, actif, cle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!actif) return { records: VIDE, chargement: false };
  if (recordsDemo) return { records: recordsDemo, chargement: false };
  return { records: (userId && cache.get(cle)?.records) || VIDE, chargement };
}
