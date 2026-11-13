import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chargerAnnotations, chargerCycles, chargerPlanifiees, chargerSeancesPeriode, chargerSeriesPeriode } from '@/data/acces/api';
import { assemblerDonnees, bornesGrille, type DonneesCalendrier } from '@/data/calendrier/calendrier';
import { useAuth } from '@/stores/auth';
import { useVersionAjouts } from '@/stores/ajouts';
import { useVersionEcarts } from '@/stores/ecarts';
import { useVersionCycles } from '@/stores/cycles';

export type { DonneesCalendrier };

const vide: DonneesCalendrier = { seances: [], planifiees: [], objectifs: [], notes: [], repos: [], cycles: [], series: [] };

// Les données d'un mois affiché (la grille déborde sur les mois voisins) : le compte connecté (lecture seule).
export function useDonneesCalendrier(annee: number, mois: number): {
  donnees: DonneesCalendrier;
  chargement: boolean;
  erreur: string;
  actualisation: boolean;
  recharger: () => Promise<void>;
} {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { debut, fin } = bornesGrille(annee, mois);
  // Change à chaque création, modification ou suppression de cycle, et à chaque ajout (séance prévue, compétition, note) : on recharge
  const version = useVersionCycles() + useVersionAjouts() + useVersionEcarts(); // une donnée écartée change les chiffres du calendrier
  const cle = `${userId}|${debut}|${fin}`;

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
    void charger();
  }, [charger]);

  const recharger = useCallback(async () => {
    setActualisation(true);
    try {
      await charger();
    } finally {
      setActualisation(false);
    }
  }, [charger]);

  // Les données d'un autre mois ou d'un autre compte ne s'affichent jamais : on garde seulement celles de la clé courante
  const pret = reel && reel.cle === cle ? reel.donnees : null;
  return { donnees: pret ?? vide, chargement: !pret, erreur: reel && reel.cle === cle ? reel.erreur : '', actualisation, recharger };
}
