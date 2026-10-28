import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chargerActivitesBilan, chargerObjectifsAnnuels } from '@/data/acces/api';
import { donneesPerimees, fusionnerChargement, type ObjectifAnnuel } from '@/data/bilan/bilan';
import { activitesBilanDemo } from '@/data/demo/demo';
import { objectifsDemo, useVersionObjectifs } from '@/stores/objectifs';
import { useAuth } from '@/stores/auth';
import type { Seance } from '@/data/types';

// Les données du Bilan : toutes les activités depuis la première et les objectifs annuels (démo ou compte connecté, lecture seule).
// Toutes les années sont chargées d'un coup : changer d'année affichée ne recharge rien.
// Les onglets restent ouverts en arrière-plan : en revenant sur le Bilan, on recharge si les données ont plus de cinq minutes.
// Une écriture d'objectif ne recharge que les objectifs (pas tout l'historique), et un résultat arrivé en retard n'écrase jamais un plus récent.
export function useDonneesBilan(): {
  brutes: Seance[];
  objectifs: ObjectifAnnuel[];
  chargement: boolean;
  erreur: string;
  /** Y a-t-il de quoi afficher (au moins les activités chargées une fois) ? Faux : seul le message d'erreur et « Réessayer » s'affichent. */
  pret: boolean;
  actualisation: boolean;
  recharger: () => Promise<void>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const versionObjectifs = useVersionObjectifs(); // change quand un objectif est créé, modifié ou supprimé
  const brutesDemo = useMemo(() => (demo ? activitesBilanDemo(new Date()) : null), [demo]);
  const demoDonnees = useMemo(() => (brutesDemo ? { brutes: brutesDemo, objectifs: objectifsDemo(), erreur: '', pret: true } : null), [brutesDemo, versionObjectifs]);
  const [reel, setReel] = useState<{ userId: string; brutes: Seance[]; objectifs: ObjectifAnnuel[]; erreur: string; pret: boolean } | null>(null);
  const [actualisation, setActualisation] = useState(false);
  const chargeA = useRef<number | null>(null); // quand les données ont été chargées pour la dernière fois (millisecondes)
  const sequenceTout = useRef(0); // numéro du dernier chargement complet : un résultat plus ancien est jeté
  const sequenceObjectifs = useRef(0); // idem pour les objectifs seuls
  const versionVue = useRef(versionObjectifs); // dernière version d'objectifs déjà prise en compte

  const charger = useCallback(async () => {
    if (!userId) return;
    const mien = ++sequenceTout.current;
    const objectifsAuDepart = sequenceObjectifs.current;
    let acts: Awaited<ReturnType<typeof chargerActivitesBilan>>;
    let obj: Awaited<ReturnType<typeof chargerObjectifsAnnuels>>;
    try {
      [acts, obj] = await Promise.all([chargerActivitesBilan(userId, new Date().getFullYear()), chargerObjectifsAnnuels(userId)]);
    } catch {
      acts = { data: null, erreur: 'Impossible de charger ton bilan. Vérifie ta connexion.' };
      obj = { data: null, erreur: '' };
    }
    if (mien !== sequenceTout.current) return; // un chargement plus récent a pris le relais
    // Des objectifs rechargés pendant ce temps sont plus à jour que ceux de ce chargement : on les garde
    if (objectifsAuDepart !== sequenceObjectifs.current) obj = { data: null, erreur: '' };
    // Un échec garde ce qui est déjà affiché (du même compte) au lieu de vider l'écran
    chargeA.current = Date.now();
    setReel((avant) => ({ userId, ...fusionnerChargement(avant && avant.userId === userId ? avant : null, acts, obj) }));
  }, [userId]);

  useEffect(() => {
    if (!demo) void charger();
  }, [demo, charger]);

  // Un objectif créé, modifié ou supprimé : on relit seulement les objectifs
  const chargerObjectifsSeuls = useCallback(async () => {
    if (!userId) return;
    const mien = ++sequenceObjectifs.current;
    let obj: Awaited<ReturnType<typeof chargerObjectifsAnnuels>>;
    try {
      obj = await chargerObjectifsAnnuels(userId);
    } catch {
      obj = { data: null, erreur: 'Impossible de charger tes objectifs.' };
    }
    if (mien !== sequenceObjectifs.current) return;
    setReel((avant) => (avant && avant.userId === userId ? { ...avant, objectifs: obj.data ?? avant.objectifs, erreur: obj.erreur || avant.erreur } : avant));
  }, [userId]);

  useEffect(() => {
    if (demo || versionVue.current === versionObjectifs) return;
    versionVue.current = versionObjectifs;
    void chargerObjectifsSeuls();
  }, [demo, versionObjectifs, chargerObjectifsSeuls]);

  // Retour sur l'onglet : on recharge seulement si les données sont vieilles. Premier chargement encore en cours (chargeA vide) : rien à faire.
  useFocusEffect(
    useCallback(() => {
      if (!demo && userId && chargeA.current != null && donneesPerimees(chargeA.current, Date.now())) void charger();
    }, [demo, userId, charger]),
  );

  const recharger = useCallback(async () => {
    setActualisation(true);
    try {
      if (!demo) await charger();
    } finally {
      setActualisation(false);
    }
  }, [demo, charger]);

  // Les données d'un autre compte ne s'affichent jamais
  const donnees = demo ? demoDonnees : reel && reel.userId === userId ? reel : null;
  return { brutes: donnees?.brutes ?? [], objectifs: donnees?.objectifs ?? [], chargement: !donnees, erreur: donnees?.erreur ?? '', pret: donnees?.pret ?? false, actualisation, recharger };
}
