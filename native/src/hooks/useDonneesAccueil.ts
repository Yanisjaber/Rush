import { useCallback, useEffect, useMemo, useState } from 'react';
import { donneesDemoAccueil, famillesDe, type DonneesAccueil } from '@/data/accueil';
import { chargerAccueil } from '@/data/chargement';
import { definirFamilles } from '@/stores/menu';
import { useAuth } from '@/stores/auth';

// Les données de l'Accueil : la démo (générée, sans compte) ou celles du compte connecté (lecture seule, via Supabase).
// Au premier chargement `chargement` est vrai ; ensuite, `recharger` (tirer pour actualiser) garde les données affichées.
export function useDonneesAccueil(): {
  donnees: DonneesAccueil | null;
  chargement: boolean;
  actualisation: boolean;
  demo: boolean;
  recharger: () => Promise<void>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const donneesDemo = useMemo(() => (demo ? donneesDemoAccueil(new Date()) : null), [demo]);
  const [reel, setReel] = useState<{ userId: string; donnees: DonneesAccueil } | null>(null);
  const [actualisation, setActualisation] = useState(false);

  const charger = useCallback(async () => {
    if (!userId) return;
    try {
      const donnees = await chargerAccueil(userId);
      setReel({ userId, donnees });
    } catch (e) {
      // chargerAccueil ne lève pas ; on se protège quand même d'un échec inattendu pour ne jamais laisser l'écran bloqué
      console.error('[app/accueil]', e instanceof Error ? e.name : 'erreur');
      setReel({ userId, donnees: { ...donneesDemoAccueil(), seances: [], dernieres: [], metriques: [], objectifs: [], planifiees: [], puissance: [], force: { series: [], programmes: [] }, hyrox: { tests: [], objectif: null }, profil: null, erreur: 'Impossible de charger tes données.' } });
    }
  }, [userId]);

  useEffect(() => {
    if (!demo) void charger();
  }, [demo, charger]);

  // Les données d'un autre compte ne doivent jamais s'afficher : on ne garde que celles de l'utilisateur courant
  const donnees = demo ? donneesDemo : reel && reel.userId === userId ? reel.donnees : null;

  useEffect(() => {
    // La démo garde l'ordre fixe du site (course, vélo, muscu, hyrox) ; un vrai compte suit ses sports choisis puis ses données
    if (donnees) definirFamilles(demo ? ['course', 'velo', 'muscu', 'hyrox'] : famillesDe(donnees));
  }, [donnees, demo]);

  const recharger = useCallback(async () => {
    setActualisation(true);
    try {
      if (!demo) await charger();
    } finally {
      setActualisation(false);
    }
  }, [demo, charger]);

  return { donnees, chargement: !donnees, actualisation, demo, recharger };
}
