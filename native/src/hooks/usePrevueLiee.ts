import { useEffect, useState } from 'react';
import { chargerPlanifiees, chargerPrevue } from '@/data/acces/api';
import { choisirPrevue } from '@/data/calendrier/analyse/plan';
import type { PrevueAnalyse } from '@/data/calendrier/analyse/plan';
import { useAuth } from '@/stores/auth';
import type { Seance } from '@/data/types';

// La séance du calendrier à laquelle cette sortie répond : même jour, même sport, la durée la plus proche (voir choisirPrevue), lue avec sa structure (blocs, zones).
// `chargee` passe à vrai quand la lecture est finie, même sans séance prévue : l'analyse attend ce moment pour ne pas se refaire en deux temps.
export function usePrevueLiee(seance: Seance | null): { prevue: PrevueAnalyse | null; chargee: boolean } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [etat, setEtat] = useState<{ prevue: PrevueAnalyse | null; chargee: boolean }>({ prevue: null, chargee: false });
  const id = seance?.id ?? null;
  const jour = seance ? String(seance.start_date_local).slice(0, 10) : null;
  const sport = seance?.sport ?? null;
  const duree = seance?.moving_time ?? null;

  useEffect(() => {
    if (!id || !jour || !sport) return;
    if (!userId) return setEtat({ prevue: null, chargee: true });
    let annule = false;
    void (async () => {
      const liste = await chargerPlanifiees(userId, jour, jour);
      const choisie = liste.data ? choisirPrevue({ sport, start_date_local: `${jour}T12:00:00`, moving_time: duree }, liste.data) : null;
      // La liste ne contient pas toujours la structure complète : on relit la séance choisie en entier
      const complete = choisie ? await chargerPrevue(userId, choisie.id) : null;
      if (annule) return;
      setEtat({ prevue: complete?.data ?? choisie ?? null, chargee: true });
    })();
    return () => {
      annule = true;
    };
  }, [id, jour, sport, duree, userId]);

  return etat;
}
