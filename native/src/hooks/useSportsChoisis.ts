import { useCallback, useEffect, useRef, useState } from 'react';
import { chargerDisciplinesChoisies, chargerSportsChoisis, enregistrerSportsChoisis } from '@/data/api';
import { nettoyerDisciplines, type DisciplinesChoisies } from '@/data/disciplines';
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
  const { demo: sportsDemo, demoDisciplines, version } = useSportsEtat();
  const sportsEtatDemoDisciplines = useRef(demoDisciplines);
  sportsEtatDemoDisciplines.current = demoDisciplines;
  const [choisis, setChoisis] = useState<string[] | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplinesChoisies>({});
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const famillesRef = useRef(familles);
  famillesRef.current = familles;

  useEffect(() => {
    let annule = false;
    (async () => {
      const liste = demo ? sportsDemo : userId ? nettoyerSports((await chargerSportsChoisis(userId)).data) : null;
      const brutes = demo ? sportsEtatDemoDisciplines.current : userId ? (await chargerDisciplinesChoisies(userId)).data : null;
      if (annule) return;
      // Une liste choisie est la vérité ; sinon on montre cochés les sports que les séances font apparaître
      const coches = liste && liste.length ? liste : sportsCoches(liste, famillesRef.current);
      setChoisis(coches);
      setDisciplines(nettoyerDisciplines(brutes, coches));
    })();
    return () => {
      annule = true;
    };
    // `version` : on relit après chaque changement de sports (fait ici ou depuis un autre écran), sinon cette copie serait périmée.
    // sportsDemo : relu à ces moments seulement, pour ne pas écraser une saisie en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, userId, version]);

  /** Les disciplines après avoir touché `cle` (ajoutée ou retirée) pour ce sport. */
  const disciplinesApres = useCallback(
    (sport: string, cle: string): DisciplinesChoisies => {
      const actuelles = disciplines[sport] ?? [];
      return { ...disciplines, [sport]: actuelles.includes(cle) ? actuelles.filter((c) => c !== cle) : [...actuelles, cle] };
    },
    [disciplines],
  );

  /** Enregistre la liste. Renvoie true si c'est fait. */
  const appliquer = useCallback(
    async (liste: string[], discs: DisciplinesChoisies = disciplines): Promise<boolean> => {
      if (envoi) return false;
      const propre = nettoyerSports(liste) ?? [];
      // Les disciplines d'un sport décoché disparaissent
      const propres = nettoyerDisciplines(discs, propre);
      setErreur('');
      if (demo) {
        definirSportsDemo(propre, propres);
        definirSportsCoches(propre);
        setChoisis(propre);
        setDisciplines(propres);
        return true;
      }
      if (!userId) return false;
      setEnvoi(true);
      const r = await enregistrerSportsChoisis(userId, propre, propres);
      setEnvoi(false);
      if (r.erreur) {
        setErreur(r.erreur);
        return false;
      }
      setChoisis(propre);
      setDisciplines(propres);
      definirSportsCoches(propre); // la barre change tout de suite ; l'Accueil se recharge ensuite en arrière-plan
      sportsModifies();
      return true;
    },
    [demo, userId, envoi, disciplines],
  );

  return { choisis, setChoisis, disciplines, setDisciplines, disciplinesApres, erreur, envoi, appliquer, demo };
}
