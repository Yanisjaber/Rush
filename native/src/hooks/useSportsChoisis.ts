import { useCallback, useEffect, useRef, useState } from 'react';
import { chargerSportsChoisis, enregistrerSportsChoisis } from '@/data/api';
import { nettoyerSports, sportsCoches } from '@/data/sports-choisis';
import { useAuth } from '@/stores/auth';
import { useMenu } from '@/stores/menu';
import { definirSportsDemo, sportsModifies, useSportsEtat } from '@/stores/sports';

// Les sports cochés du compte (sports choisis + sports que les séances révèlent) et leur enregistrement.
// `appliquer` écrit en base (ou en mémoire en démo) puis prévient l'Accueil. userId vient toujours de la session.
export function useSportsChoisis() {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const { familles } = useMenu();
  const { demo: sportsDemo } = useSportsEtat();
  const [choisis, setChoisis] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const famillesRef = useRef(familles);
  famillesRef.current = familles;

  useEffect(() => {
    let annule = false;
    (async () => {
      const liste = demo ? sportsDemo : userId ? nettoyerSports((await chargerSportsChoisis(userId)).data) : null;
      if (!annule) setChoisis(sportsCoches(liste, famillesRef.current));
    })();
    return () => {
      annule = true;
    };
    // sportsDemo : relu seulement au chargement, pour ne pas écraser une saisie en cours
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, userId]);

  /** Enregistre la liste. Renvoie true si c'est fait. */
  const appliquer = useCallback(
    async (liste: string[]): Promise<boolean> => {
      if (envoi) return false;
      const propre = nettoyerSports(liste) ?? [];
      setErreur('');
      if (demo) {
        definirSportsDemo(propre);
        setChoisis(propre);
        return true;
      }
      if (!userId) return false;
      setEnvoi(true);
      const r = await enregistrerSportsChoisis(userId, propre);
      setEnvoi(false);
      if (r.erreur) {
        setErreur(r.erreur);
        return false;
      }
      setChoisis(propre);
      sportsModifies();
      return true;
    },
    [demo, userId, envoi],
  );

  return { choisis, setChoisis, erreur, envoi, appliquer, demo };
}
