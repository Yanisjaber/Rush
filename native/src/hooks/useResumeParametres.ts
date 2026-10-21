import { useEffect, useMemo, useState } from 'react';
import { chargerConnexions, chargerProfilComplet, type ConnexionStrava } from '@/data/api';
import { donneesDemo } from '@/data/demo';
import { resumeParametres, type ResumeParametres } from '@/data/parametres';
import type { LigneProfil } from '@/data/profil';
import { useSportsChoisis } from '@/hooks/useSportsChoisis';
import { useAuth } from '@/stores/auth';
import { SPORTS, type CleSport } from '@/theme/sports';

// Le résumé de Paramètres : profil, sports cochés et statut Strava, lus une fois à l'ouverture. userId vient toujours de la session.
// En démo, rien ne part sur le réseau : le profil d'exemple, aucune connexion.
export function useResumeParametres(): { resume: ResumeParametres; chargement: boolean } {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const { choisis } = useSportsChoisis();
  const [ligne, setLigne] = useState<LigneProfil | null>(null);
  const [strava, setStrava] = useState<ConnexionStrava | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    (async () => {
      if (demo) {
        setLigne({ ...donneesDemo().profil, extras: donneesDemo().profil.extras });
        setStrava(null);
      } else if (userId) {
        const [p, c] = await Promise.all([chargerProfilComplet(userId), chargerConnexions(userId)]);
        if (annule) return;
        setLigne(p.data);
        setStrava(c.data?.strava ?? null);
      }
      if (!annule) setChargement(false);
    })();
    return () => {
      annule = true;
    };
  }, [demo, userId]);

  const resume = useMemo(
    () => resumeParametres({ ligne, nbSports: choisis?.length ?? 0, nomsSports: (choisis ?? []).map((c) => SPORTS[c as CleSport]?.court ?? c), strava }),
    [ligne, choisis, strava],
  );
  return { resume, chargement };
}
