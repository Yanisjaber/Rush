import { useCallback, useEffect, useMemo, useState } from 'react';
import { chargerMesuresSante, enregistrerMesureSante, supprimerMesureSante } from '@/data/api';
import { remplacerSaisie, resoudreMesures, type LigneMesure, type MesuresParJour } from '@/data/sante-catalogue';
import { useAuth } from '@/stores/auth';
import { saisirMesureDemo, useMesuresDemo } from '@/stores/mesures-demo';

// Les mesures de santé du compte (ressenti, événements, corps, nutrition, appareils), démo ou compte connecté.
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
  const [reel, setReel] = useState<{ userId: string; lignes: LigneMesure[]; erreur: string } | null>(null);
  const [erreurSaisie, setErreurSaisie] = useState('');

  const charger = useCallback(async () => {
    if (!userId) return;
    const r = await chargerMesuresSante(userId, 120);
    setReel({ userId, lignes: r.data ?? [], erreur: r.erreur });
  }, [userId]);

  useEffect(() => {
    if (!demo) void charger();
  }, [demo, charger]);

  // Les mesures d'un autre compte ne s'affichent jamais
  const lot = demo ? { lignes: demoLignes, erreur: '' } : reel && reel.userId === userId ? reel : null;
  const lignes = lot?.lignes ?? [];
  const mesures = useMemo(() => resoudreMesures(lignes), [lignes]);

  const enregistrer = useCallback(
    async (date: string, metric: string, valeur: number | null): Promise<boolean> => {
      setErreurSaisie('');
      if (demo) {
        saisirMesureDemo(date, metric, valeur);
        return true;
      }
      if (!userId) return false;
      // On met l'écran à jour tout de suite ; si la base refuse, on revient en arrière et on le dit
      const avant = reel && reel.userId === userId ? reel.lignes : [];
      const apres = remplacerSaisie(avant, date, metric, valeur);
      if (apres === avant && valeur != null) {
        setErreurSaisie('Valeur non valide.');
        return false;
      }
      setReel({ userId, lignes: apres, erreur: '' });
      const r = valeur == null ? await supprimerMesureSante(userId, date, metric) : await enregistrerMesureSante(userId, date, metric, valeur);
      if (r.erreur) {
        setReel({ userId, lignes: avant, erreur: '' });
        setErreurSaisie(r.erreur);
        return false;
      }
      return true;
    },
    [demo, userId, reel],
  );

  return { lignes, mesures, chargement: !demo && !lot, erreur: erreurSaisie || lot?.erreur || '', demo, enregistrer, recharger: charger };
}
