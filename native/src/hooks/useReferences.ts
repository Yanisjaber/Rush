import { useEffect, useState } from 'react';
import { chargerProfil } from '@/data/acces/api';
import { memoireReferences } from '@/data/acces/references-memoire';
import type { Reference } from '@/data/calendrier/structure';
import { useAuth } from '@/stores/auth';

// Les références de l'utilisateur pour traduire les pourcentages d'une séance en watts, battements ou allures : sa FTP et sa FC max (profil).
// Sans profil rempli, la structure utilise ses valeurs par défaut (250 W, 190 bpm, 4:00/km, 1:40/100 m).
// Les références se lisent UNE fois par compte puis restent en mémoire : chaque ticket du chat (il y en a un par séance dépliée) les demande, et une requête réseau
// à chaque ouverture faisait traîner l'affichage (le ticket s'affichait, puis se redessinait quand la réponse arrivait).
const memoire = memoireReferences;

export function useReferences(): Reference {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const [ref, setRef] = useState<Reference>(demo ? { ftp: 250, hrMax: 196 } : (userId ? memoire.get(userId) : undefined) ?? {});
  useEffect(() => {
    if (demo || !userId || memoire.has(userId)) return;
    let annule = false;
    void chargerProfil(userId).then((r) => {
      if (!r.data) return;
      const lues = { ftp: r.data.ftp ?? null, hrMax: r.data.hr_max ?? null };
      memoire.set(userId, lues);
      if (!annule) setRef(lues);
    });
    return () => {
      annule = true;
    };
  }, [demo, userId]);
  return ref;
}
