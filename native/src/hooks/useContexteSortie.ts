import { useEffect, useState } from 'react';
import { donneesDemoAccueil } from '@/data/accueil/accueil';
import { chargerPlanifiees, chargerSeances } from '@/data/acces/api';
import { dateIsoLocale } from '@/data/outils/format';
import { useVersionAjouts } from '@/stores/ajouts';
import { useAuth } from '@/stores/auth';
import type { Seance } from '@/data/types';

// Ce qu'il faut autour d'une sortie pour la page 4 : les sorties des 200 derniers jours (pour trouver celles qui lui ressemblent)
// et les jours déjà occupés par une séance prévue (pour ne pas proposer par-dessus). Chargé en silence : la page 4 attend, les autres pages ne dépendent pas de lui.
export function useContexteSortie(seance: Seance | null): { historique: Seance[] | null; joursOccupes: string[] } {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const version = useVersionAjouts(); // un ajout au calendrier (la proposition validée) relit les jours occupés
  const [historique, setHistorique] = useState<Seance[] | null>(null);
  const [joursOccupes, setJoursOccupes] = useState<string[]>([]);
  const id = seance?.id ?? null;
  const jour = seance ? String(seance.start_date_local).slice(0, 10) : null;

  useEffect(() => {
    if (!id || !jour) return;
    if (demo) {
      setHistorique(donneesDemoAccueil(new Date()).seances);
      setJoursOccupes([]);
      return;
    }
    if (!userId) return;
    let annule = false;
    void (async () => {
      const fin = new Date(`${jour}T12:00:00`);
      fin.setDate(fin.getDate() + 3);
      const [h, p] = await Promise.all([chargerSeances(userId, 200, 400), chargerPlanifiees(userId, jour, dateIsoLocale(fin))]);
      if (annule) return;
      // Une lecture ratée laisse la page 4 absente plutôt que de la remplir avec des demi-données
      setHistorique(h.data ?? null);
      setJoursOccupes((p.data ?? []).map((x) => String(x.date).slice(0, 10)));
    })();
    return () => {
      annule = true;
    };
  }, [id, jour, userId, demo, version]);

  return { historique, joursOccupes };
}
