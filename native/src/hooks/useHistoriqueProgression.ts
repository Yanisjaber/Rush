import { useEffect, useMemo, useState } from 'react';
import { chargerHistoriqueProgression, chargerSeriesForce } from '@/data/acces/api';
import { donneesDemo, seriesForceHistoriqueDemo } from '@/data/demo/demo';
import { useAuth } from '@/stores/auth';
import { useVersionEcarts } from '@/stores/ecarts';
import type { Seance, SerieForce } from '@/data/types';

/** En démo, cinq ans de séances : de quoi montrer le niveau année après année, et la flèche qui ouvre tout l'historique. */
const JOURS_DEMO = 365 * 5;

// L'historique complet dont la Progression a besoin (le niveau année après année remonte à la première séance) : l'accueil ne charge que 84 jours, et le Bilan ses activités sans cardio ni puissance.
// Démo : des séances de démo avec cardio et puissance sur deux ans (celles de secours n'en ont pas : la progression y serait toujours vide). Compte connecté : une lecture au premier affichage (`actif` faux : on attend) ;
// en cas d'échec, on se rabat sur les séances de secours. Les données d'un autre compte ne s'affichent jamais.
export function useHistoriqueProgression(secours: Seance[], actif = true): { seances: Seance[]; chargement: boolean } {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const versionEcarts = useVersionEcarts();
  const [lu, setLu] = useState<{ userId: string; seances: Seance[] | null } | null>(null);
  const seancesDemo = useMemo(() => (demo ? donneesDemo(new Date(), JOURS_DEMO).seances : null), [demo]);

  useEffect(() => {
    if (demo || !userId || !actif) return;
    let annule = false;
    chargerHistoriqueProgression(userId)
      .then((r) => {
        if (!annule) setLu({ userId, seances: r.data });
      })
      .catch(() => {
        if (!annule) setLu({ userId, seances: null });
      });
    return () => {
      annule = true;
    };
  }, [demo, userId, actif, versionEcarts]);

  if (demo) return { seances: seancesDemo ?? secours, chargement: false };
  if (!userId) return { seances: secours, chargement: false };
  if (!lu || lu.userId !== userId) return { seances: secours, chargement: actif };
  return { seances: lu.seances ?? secours, chargement: false };
}

// Le carnet de force pour le Bilan (l'accueil, lui, le reçoit déjà dans son contexte). Même logique : démo ou compte connecté, au premier affichage de l'onglet.
export function useSeriesForceProgression(actif: boolean): { series: SerieForce[]; chargement: boolean } {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const [lu, setLu] = useState<{ userId: string; series: SerieForce[] } | null>(null);
  // Calculée seulement en démo : ce générateur est lourd (~7 s sur le téléphone) et bloquait le démarrage d'un vrai compte
  const serieDemo = useMemo(() => (demo ? seriesForceHistoriqueDemo(new Date()) : []), [demo]);

  useEffect(() => {
    if (demo || !userId || !actif) return;
    let annule = false;
    chargerSeriesForce(userId)
      .then((r) => {
        if (!annule) setLu({ userId, series: r.data ?? [] });
      })
      .catch(() => {
        if (!annule) setLu({ userId, series: [] });
      });
    return () => {
      annule = true;
    };
  }, [demo, userId, actif]);

  if (demo) return { series: serieDemo, chargement: false };
  if (!userId) return { series: [], chargement: false };
  if (!lu || lu.userId !== userId) return { series: [], chargement: actif };
  return { series: lu.series, chargement: false };
}
