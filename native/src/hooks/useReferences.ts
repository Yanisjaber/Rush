import { useEffect, useState } from 'react';
import { chargerProfil } from '@/data/api';
import type { Reference } from '@/data/structure';
import { useAuth } from '@/stores/auth';

// Les références de l'utilisateur pour traduire les pourcentages d'une séance en watts, battements ou allures : sa FTP et sa FC max (profil).
// Sans profil rempli, la structure utilise ses valeurs par défaut (250 W, 190 bpm, 4:00/km, 1:40/100 m).
export function useReferences(): Reference {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const [ref, setRef] = useState<Reference>(demo ? { ftp: 250, hrMax: 196 } : {});
  useEffect(() => {
    if (demo || !userId) return;
    let annule = false;
    void chargerProfil(userId).then((r) => {
      if (!annule && r.data) setRef({ ftp: r.data.ftp ?? null, hrMax: r.data.hr_max ?? null });
    });
    return () => {
      annule = true;
    };
  }, [demo, userId]);
  return ref;
}
