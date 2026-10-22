import { useEffect, useState } from 'react';
import { donneesDemoAccueil } from '@/data/accueil';
import { chargerSeance, chargerTours } from '@/data/api';
import { toursDemo } from '@/data/demo';
import { useAuth } from '@/stores/auth';
import type { Seance, Tour } from '@/data/types';

interface Etat {
  seance: Seance | null;
  /** Null tant qu'ils ne sont pas chargés ou s'ils n'ont pas pu l'être (voir erreurTours). */
  tours: Tour[] | null;
  chargement: boolean;
  chargementTours: boolean;
  erreur: string;
  erreurTours: string;
}

const initial: Etat = { seance: null, tours: null, chargement: true, chargementTours: false, erreur: '', erreurTours: '' };

// Une séance et ses tours : la démo ou le compte connecté (lecture seule). La séance s'affiche dès qu'elle est là, les tours arrivent après
// (ils passent par Strava : c'est plus lent, et ça peut échouer sans gêner le reste).
export function useSeance(id: string): Etat {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const [etat, setEtat] = useState<Etat>(initial);

  useEffect(() => {
    let annule = false;
    setEtat(initial);
    if (demo) {
      const s = donneesDemoAccueil(new Date()).seances.find((x) => x.id === id) ?? null;
      setEtat({ ...initial, seance: s, chargement: false, tours: s ? toursDemo(s) : null, erreur: s ? '' : 'Séance introuvable.' });
      return;
    }
    if (!userId) return;
    void (async () => {
      const r = await chargerSeance(userId, id);
      if (annule) return;
      if (!r.data) return setEtat({ ...initial, chargement: false, erreur: r.erreur || 'Séance introuvable.' });
      const s = r.data;
      // Pas de tours pour une séance saisie à la main : rien à demander à Strava
      if (!s.strava_id) return setEtat({ ...initial, seance: s, chargement: false, erreurTours: "Cette séance ne vient pas de Strava : ses tours ne sont pas disponibles." });
      setEtat({ ...initial, seance: s, chargement: false, chargementTours: true });
      const t = await chargerTours(id);
      if (annule) return;
      setEtat((e) => ({ ...e, chargementTours: false, tours: t.data, erreurTours: t.erreur }));
    })();
    return () => {
      annule = true;
    };
  }, [id, userId, demo]);

  return etat;
}
