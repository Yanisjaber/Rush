import { useCallback, useEffect, useRef, useState } from 'react';
import { chargerSportsChoisis, enregistrerSportsChoisis } from '@/data/api';
import { nettoyerSports, sportsCoches } from '@/data/sports-choisis';
import { useAuth } from '@/stores/auth';
import { definirSportsCoches, useMenu } from '@/stores/menu';
import { definirSportsDemo, sportsModifies, useSportsEtat } from '@/stores/sports';

// Les sports cochés du compte (sports choisis + sports que les séances révèlent) et leur enregistrement.
// `appliquer` écrit en base (ou en mémoire en démo) puis prévient l'Accueil. userId vient toujours de la session.
export function useSportsChoisis() {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const { familles } = useMenu();
  const { demo: sportsDemo, version } = useSportsEtat();
  const [choisis, setChoisis] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [lectureEchouee, setLectureEchouee] = useState(false); // la liste enregistrée n'a pas pu être lue : on n'écrit rien par-dessus
  const [envoi, setEnvoi] = useState(false);
  const famillesRef = useRef(familles);
  famillesRef.current = familles;

  useEffect(() => {
    let annule = false;
    (async () => {
      const lue = demo || !userId ? null : await chargerSportsChoisis(userId);
      if (annule) return;
      const liste = demo ? sportsDemo : lue ? nettoyerSports(lue.data) : null;
      setLectureEchouee(!!lue?.erreur);
      setErreur(lue?.erreur ?? '');
      // Une liste choisie est la vérité ; sinon on montre cochés les sports que les séances font apparaître
      setChoisis(liste && liste.length ? liste : sportsCoches(liste, famillesRef.current));
    })();
    return () => {
      annule = true;
    };
    // `version` : on relit après chaque changement de sports (fait ici ou depuis un autre écran), sinon cette copie serait périmée.
    // sportsDemo : relu à ces moments seulement, pour ne pas écraser une saisie en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, userId, version]);

  /** Enregistre la liste. Renvoie true si c'est fait. */
  const appliquer = useCallback(
    async (liste: string[]): Promise<boolean> => {
      if (envoi || lectureEchouee) return false;
      const propre = nettoyerSports(liste) ?? [];
      setErreur('');
      if (demo) {
        definirSportsDemo(propre);
        definirSportsCoches(propre);
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
      definirSportsCoches(propre); // la barre change tout de suite ; l'Accueil se recharge ensuite en arrière-plan
      sportsModifies();
      return true;
    },
    [demo, userId, envoi, lectureEchouee],
  );

  return { choisis, setChoisis, erreur, envoi, appliquer, demo, lectureEchouee };
}
