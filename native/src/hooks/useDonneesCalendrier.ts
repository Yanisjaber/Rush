import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { donneesDemoAccueil } from '@/data/accueil';
import { chargerAnnotations, chargerPlanifiees, chargerSeancesPeriode } from '@/data/api';
import { bornesGrille } from '@/data/calendrier';
import { annotationsDemo } from '@/data/demo';
import { useAuth } from '@/stores/auth';
import type { Note, Prevue, Seance } from '@/data/types';

export interface DonneesCalendrier {
  seances: Seance[];
  planifiees: Prevue[]; // séances prévues, hors compétitions
  objectifs: Prevue[]; // compétitions
  notes: Note[];
  repos: string[];
}

const vide: DonneesCalendrier = { seances: [], planifiees: [], objectifs: [], notes: [], repos: [] };

// Les données d'un mois affiché (la grille déborde sur les mois voisins) : la démo ou le compte connecté (lecture seule).
export function useDonneesCalendrier(annee: number, mois: number): {
  donnees: DonneesCalendrier;
  chargement: boolean;
  erreur: string;
  actualisation: boolean;
  recharger: () => Promise<void>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const { debut, fin } = bornesGrille(annee, mois);
  const cle = `${userId}|${debut}|${fin}`;

  const demoDonnees = useMemo((): DonneesCalendrier | null => {
    if (!demo) return null;
    const maintenant = new Date();
    const d = donneesDemoAccueil(maintenant);
    const a = annotationsDemo(maintenant);
    const dans = (iso: string) => iso >= debut && iso <= fin;
    const prevues = d.planifiees.filter((p) => dans(p.date));
    return {
      seances: d.seances.filter((s) => dans(String(s.start_date_local).slice(0, 10))),
      planifiees: prevues.filter((p) => p.category !== 'competition'),
      objectifs: prevues.filter((p) => p.category === 'competition'),
      notes: a.notes.filter((n) => n.from_date <= fin && n.to_date >= debut),
      repos: a.repos.filter((r) => dans(r)),
    };
  }, [demo, debut, fin]);

  const [reel, setReel] = useState<{ cle: string; donnees: DonneesCalendrier; erreur: string } | null>(null);
  const [actualisation, setActualisation] = useState(false);
  const numeroRequete = useRef(0);

  const charger = useCallback(async () => {
    if (!userId) return;
    const numero = ++numeroRequete.current;
    const [s, p, a] = await Promise.all([chargerSeancesPeriode(userId, debut, fin), chargerPlanifiees(userId, debut, fin), chargerAnnotations(userId, debut, fin)]);
    if (numero !== numeroRequete.current) return; // une requête plus récente a pris le relais (on a changé de mois entre-temps)
    const prevues = p.data ?? [];
    setReel({
      cle,
      donnees: {
        seances: s.data ?? [],
        planifiees: prevues.filter((x) => x.category !== 'competition'),
        objectifs: prevues.filter((x) => x.category === 'competition'),
        notes: a.data?.notes ?? [],
        repos: a.data?.repos ?? [],
      },
      erreur: s.erreur || p.erreur || a.erreur,
    });
  }, [userId, debut, fin, cle]);

  useEffect(() => {
    if (!demo) void charger();
  }, [demo, charger]);

  const recharger = useCallback(async () => {
    setActualisation(true);
    try {
      if (!demo) await charger();
    } finally {
      setActualisation(false);
    }
  }, [demo, charger]);

  // Les données d'un autre mois ou d'un autre compte ne s'affichent jamais : on garde seulement celles de la clé courante
  const pret = demo ? demoDonnees : reel && reel.cle === cle ? reel.donnees : null;
  return { donnees: pret ?? vide, chargement: !pret, erreur: demo ? '' : reel && reel.cle === cle ? reel.erreur : '', actualisation, recharger };
}
