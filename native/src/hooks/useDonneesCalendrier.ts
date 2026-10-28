import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { donneesDemoAccueil } from '@/data/accueil/accueil';
import { chargerAnnotations, chargerCycles, chargerPlanifiees, chargerSeancesPeriode, chargerSeriesPeriode } from '@/data/acces/api';
import { assemblerDonnees, bornesGrille, type DonneesCalendrier } from '@/data/calendrier/calendrier';
import { annotationsDemo, seriesForceDemo } from '@/data/demo/demo';
import { useAuth } from '@/stores/auth';
import { notesDeLaDemo, prevuesDeLaDemo, reposDeLaDemo, sortiesAjoutees, useVersionAjouts } from '@/stores/ajouts';
import { cyclesDemo, useVersionCycles } from '@/stores/cycles';

export type { DonneesCalendrier };

const vide: DonneesCalendrier = { seances: [], planifiees: [], objectifs: [], notes: [], repos: [], cycles: [], series: [] };

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
  // Change à chaque création, modification ou suppression de cycle, et à chaque ajout (séance prévue, compétition, note) : on recharge
  const version = useVersionCycles() + useVersionAjouts();
  const cle = `${userId}|${debut}|${fin}`;

  const demoDonnees = useMemo((): DonneesCalendrier | null => {
    if (!demo) return null;
    const maintenant = new Date();
    const d = donneesDemoAccueil(maintenant);
    const a = annotationsDemo(maintenant);
    const dans = (iso: string) => iso >= debut && iso <= fin;
    // Les séances prévues, compétitions et notes ajoutées pendant la démo s'ajoutent à celles de l'exemple
    const prevues = prevuesDeLaDemo(d.planifiees).filter((p) => dans(p.date));
    return {
      seances: [...d.seances, ...sortiesAjoutees()].filter((s) => dans(String(s.start_date_local).slice(0, 10))),
      planifiees: prevues.filter((p) => p.category !== 'competition'),
      objectifs: prevues.filter((p) => p.category === 'competition'),
      notes: notesDeLaDemo(a.notes).filter((n) => n.from_date <= fin && n.to_date >= debut),
      repos: reposDeLaDemo(a.repos).filter((r) => dans(r)),
      cycles: cyclesDemo().filter((c) => c.from_date <= fin && c.to_date >= debut),
      series: seriesForceDemo(maintenant).filter((x) => dans(String(x.date).slice(0, 10))).map((x) => ({ date: x.date })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, debut, fin, version]);

  const [reel, setReel] = useState<{ cle: string; donnees: DonneesCalendrier; erreur: string } | null>(null);
  const [actualisation, setActualisation] = useState(false);
  const numeroRequete = useRef(0);
  const dernier = useRef<{ cle: string; donnees: DonneesCalendrier } | null>(null); // les dernières données reçues, pour ne pas les perdre si un rechargement échoue

  const charger = useCallback(async () => {
    if (!userId) return;
    const numero = ++numeroRequete.current;
    const [s, p, a, c, f] = await Promise.all([chargerSeancesPeriode(userId, debut, fin), chargerPlanifiees(userId, debut, fin), chargerAnnotations(userId, debut, fin), chargerCycles(userId, debut, fin), chargerSeriesPeriode(userId, debut, fin)]);
    if (numero !== numeroRequete.current) return; // une requête plus récente a pris le relais (on a changé de mois entre-temps)
    // Si une requête échoue, on garde ce qu'on affichait déjà pour ce mois (voir assemblerDonnees)
    const precedent = dernier.current?.cle === cle ? dernier.current.donnees : null;
    const { donnees, erreur } = assemblerDonnees(precedent, s, p, a, c, f);
    dernier.current = { cle, donnees };
    setReel({ cle, donnees, erreur });
  }, [userId, debut, fin, cle, version]);

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
