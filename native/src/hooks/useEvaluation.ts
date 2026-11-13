import { useCallback, useEffect, useMemo, useState } from 'react';
import { chargerCourbeCourse, chargerCourbePuissance } from '@/data/acces/api';
import { normaliser } from '@/data/bilan/bilan';
import type { PointCourbe } from '@/data/bilan/records';
import { evaluer, fusionnerCourbes, type Evaluation } from '@/data/profil/evaluation';
import type { Profil } from '@/data/types';
import { useAuth } from '@/stores/auth';
import { useVersionEcarts } from '@/stores/ecarts';
import { useDonneesAccueil } from './useDonneesAccueil';
import { useDonneesBilan } from './useDonneesBilan';
import { useDonneesSommeil } from './useDonneesSommeil';
import { useMesuresSante } from './useMesuresSante';

// L'évaluation physiologique de la page Profil : on réunit le profil, les séances, les courbes de meilleurs efforts
// (vélo et course, année en cours + précédente), les nuits et les mesures de santé, puis evaluer() calcule les notes.
// `enregistrer` sert aux tests saisis à la main (même chemin que l'onglet Santé).
interface Courbes {
  userId: string;
  puissance: PointCourbe[];
  course: PointCourbe[];
}

export function useEvaluation(): {
  evaluation: Evaluation;
  profil: Profil | null;
  chargement: boolean;
  erreur: string;
  enregistrer: (date: string, metric: string, valeur: number | null) => Promise<boolean>;
  recharger: () => Promise<void>;
} {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const versionEcarts = useVersionEcarts();
  const accueil = useDonneesAccueil();
  const bilan = useDonneesBilan();
  const sommeil = useDonneesSommeil();
  const sante = useMesuresSante();
  const [courbes, setCourbes] = useState<Courbes | null>(null);
  const [erreurCourbes, setErreurCourbes] = useState('');
  const annee = new Date().getFullYear();

  useEffect(() => {
    if (!userId) return;
    let annule = false;
    void (async () => {
      try {
        const [p1, p2, c1, c2] = await Promise.all([
          chargerCourbePuissance(annee),
          chargerCourbePuissance(annee - 1),
          chargerCourbeCourse('pacedur', annee),
          chargerCourbeCourse('pacedur', annee - 1),
        ]);
        if (annule) return;
        setCourbes({ userId, puissance: fusionnerCourbes(p1.data, p2.data), course: fusionnerCourbes(c1.data, c2.data) });
        setErreurCourbes(p1.erreur || c1.erreur);
      } catch {
        if (!annule) setErreurCourbes('Impossible de charger tes meilleurs efforts.');
      }
    })();
    return () => {
      annule = true;
    };
  }, [userId, annee, versionEcarts]);

  // Les courbes d'un autre compte ne comptent jamais
  const lesCourbes = courbes && courbes.userId === userId ? courbes : null;

  const activites = useMemo(() => bilan.brutes.map((s) => normaliser(s)), [bilan.brutes]);
  const donnees = accueil.donnees;
  const evaluation = useMemo(
    () =>
      evaluer({
        profil: donnees?.profil,
        courbePuissance: lesCourbes?.puissance,
        courseParDuree: lesCourbes?.course,
        activites,
        seriesForce: donnees?.force.series,
        seances: bilan.pret ? bilan.brutes : donnees?.seances,
        mesures: sante.mesures,
        nuits: sommeil.nuits,
      }),
    [donnees, lesCourbes, activites, bilan.pret, bilan.brutes, sante.mesures, sommeil.nuits],
  );

  const { recharger: rAccueil } = accueil;
  const { recharger: rBilan } = bilan;
  const { recharger: rSommeil } = sommeil;
  const { recharger: rSante } = sante;
  const recharger = useCallback(async () => {
    await Promise.all([rAccueil(), rBilan(), rSommeil(), rSante()]);
  }, [rAccueil, rBilan, rSommeil, rSante]);

  return {
    evaluation,
    profil: donnees?.profil ?? null,
    chargement: !donnees || !lesCourbes || sante.chargement,
    erreur: donnees?.erreur || bilan.erreur || erreurCourbes || sante.erreur || '',
    enregistrer: sante.enregistrer,
    recharger,
  };
}
