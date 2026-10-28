import { useCallback, useEffect, useMemo, useState } from 'react';
import { enregistrerMesureSante, supprimerMesureSante } from '@/data/acces/api';
import { remplacerSaisie, resoudreMesures, type LigneMesure, type MesuresParJour } from '@/data/sante/sante-catalogue';
import { useAuth } from '@/stores/auth';
import { saisirMesureDemo, useMesuresDemo } from '@/stores/mesures-demo';
import { chargerMesures, mesuresDuCompte, poserMesures, useEtatMesures } from '@/stores/mesures-sante';

// Les mesures de santé du compte (ressenti, événements, corps, nutrition, appareils), démo ou compte connecté.
// L'état est PARTAGÉ entre tous les écrans (voir stores/mesures-sante.ts) : une saisie met à jour tous les écrans ouverts, sans nouveau téléchargement.
// `mesures` : une valeur par jour et par mesure (la source la plus prioritaire). `enregistrer(date, mesure, valeur)` : saisie à la main ; null efface.
export function useMesuresSante(): {
  lignes: LigneMesure[];
  mesures: MesuresParJour;
  chargement: boolean;
  erreur: string;
  demo: boolean;
  enregistrer: (date: string, metric: string, valeur: number | null) => Promise<boolean>;
  recharger: () => Promise<void>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const demoLignes = useMesuresDemo();
  const partage = useEtatMesures();
  const [erreurSaisie, setErreurSaisie] = useState('');

  // Premier chargement : seulement si ce compte n'a pas déjà été chargé par un autre écran
  useEffect(() => {
    if (!demo && userId && !mesuresDuCompte(userId).charge) void chargerMesures(userId);
  }, [demo, userId]);

  // Les mesures d'un autre compte ne s'affichent jamais
  const lot = demo ? { lignes: demoLignes, erreur: '' } : userId && partage.userId === userId && partage.charge ? partage : null;
  const lignes = lot?.lignes ?? [];
  const mesures = useMemo(() => resoudreMesures(lignes), [lignes]);

  const recharger = useCallback(async () => {
    if (!demo && userId) await chargerMesures(userId);
  }, [demo, userId]);

  const enregistrer = useCallback(
    async (date: string, metric: string, valeur: number | null): Promise<boolean> => {
      setErreurSaisie('');
      if (demo) {
        saisirMesureDemo(date, metric, valeur);
        return true;
      }
      if (!userId) return false;
      // Si les mesures ne sont pas encore arrivées, on les attend : sinon le chargement écraserait la saisie
      if (!mesuresDuCompte(userId).charge) await chargerMesures(userId);
      // On met l'écran à jour tout de suite ; si la base refuse, on revient en arrière et on le dit
      const avant = mesuresDuCompte(userId).lignes;
      const apres = remplacerSaisie(avant, date, metric, valeur);
      if (apres === avant && valeur != null) {
        setErreurSaisie('Valeur non valide.');
        return false;
      }
      poserMesures({ userId, lignes: apres, erreur: '', charge: true });
      const r = valeur == null ? await supprimerMesureSante(userId, date, metric) : await enregistrerMesureSante(userId, date, metric, valeur);
      if (r.erreur) {
        // On ne défait que CETTE saisie (pas les autres faites entre-temps)
        poserMesures({ userId, lignes: remplacerPar(mesuresDuCompte(userId).lignes, avant, date, metric), erreur: '', charge: true });
        setErreurSaisie(r.erreur);
        return false;
      }
      return true;
    },
    [demo, userId],
  );

  return { lignes, mesures, chargement: !demo && !lot, erreur: erreurSaisie || lot?.erreur || '', demo, enregistrer, recharger };
}

/** Remet la saisie manuelle d'un jour et d'une mesure comme elle était dans `avant`, en laissant le reste de `courantes` intact. */
function remplacerPar(courantes: LigneMesure[], avant: LigneMesure[], date: string, metric: string): LigneMesure[] {
  const memeCase = (l: LigneMesure) => l.date === date && l.metric === metric && l.source === 'manual';
  return [...courantes.filter((l) => !memeCase(l)), ...avant.filter(memeCase)];
}
