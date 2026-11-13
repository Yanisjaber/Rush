import { useCallback, useEffect, useState } from 'react';
import { donneesAccueilVides, famillesDe, type DonneesAccueil } from '@/data/accueil/accueil';
import { chargerAccueil } from '@/data/acces/chargement';
import { definirSources } from '@/stores/menu';
import { useSportsEtat } from '@/stores/sports';
import { useAuth } from '@/stores/auth';
import { useVersionEcarts } from '@/stores/ecarts';
import { marquerAccueilCharge } from '@/stores/chargement';

// Les données de l'Accueil : celles du compte connecté (lecture seule, via Supabase).
// Au premier chargement `chargement` est vrai ; ensuite, `recharger` (tirer pour actualiser) garde les données affichées.
export function useDonneesAccueil(): {
  donnees: DonneesAccueil | null;
  chargement: boolean;
  actualisation: boolean;
  recharger: () => Promise<void>;
} {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const sports = useSportsEtat();
  const versionEcarts = useVersionEcarts(); // les totaux et la charge changent quand une donnée est écartée
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
      setReel({ userId, donnees: donneesAccueilVides('Impossible de charger tes données.') });
    }
  }, [userId]);

  // `sports.version` change quand on coche ou décoche un sport : on recharge pour recomposer l'Accueil
  useEffect(() => {
    void charger();
  }, [charger, sports.version, versionEcarts]);

  // Les données d'un autre compte ne doivent jamais s'afficher : on ne garde que celles de l'utilisateur courant
  const donnees = reel && reel.userId === userId ? reel.donnees : null;

  useEffect(() => {
    // Les sources suivent les sports choisis puis les données du compte
    if (!donnees) return;
    definirSources(famillesDe({ ...donnees, sportsChoisis: null }), donnees.sportsChoisis);
  }, [donnees]);

  // Dit à l'écran de chargement que l'Accueil est rempli : il peut s'effacer
  useEffect(() => {
    if (donnees) marquerAccueilCharge(true);
  }, [donnees]);

  const recharger = useCallback(async () => {
    setActualisation(true);
    try {
      await charger();
    } finally {
      setActualisation(false);
    }
  }, [charger]);

  return { donnees, chargement: !donnees, actualisation, recharger };
}
