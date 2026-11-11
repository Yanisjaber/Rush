import { useEffect, useState } from 'react';
import { chargerSeances } from '@/data/acces/api';
import { typeDeSeance } from '@/data/calendrier/analyse/type-seance';
import type { SortieHistorique } from '@/data/calendrier/analyse/physio';
import { useAuth } from '@/stores/auth';
import type { Seance } from '@/data/types';

// Tes sorties des 90 derniers jours (même compte), rangées pour comparer une sortie aux précédentes du même type : voir data/calendrier/analyse/physio.ts.
export function useHistoriqueSorties(seance: Seance | null): SortieHistorique[] {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const [liste, setListe] = useState<SortieHistorique[]>([]);
  const id = seance?.id ?? null;

  useEffect(() => {
    if (!id || demo || !userId) return;
    let annule = false;
    void (async () => {
      const r = await chargerSeances(userId, 100);
      if (annule || !r.data) return;
      setListe(
        r.data.map((s) => ({
          id: s.id,
          sport: s.sport,
          type: typeDeSeance(s.name, s.moving_time),
          date: String(s.start_date_local),
          dureeS: s.moving_time,
          distanceKm: s.distance_km,
          coeurMoyen: s.avg_heartrate,
          deniveleM: s.total_elevation_gain,
        })),
      );
    })();
    return () => {
      annule = true;
    };
  }, [id, userId, demo]);

  return liste;
}
