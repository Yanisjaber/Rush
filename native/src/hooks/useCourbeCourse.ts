import { useEffect, useMemo, useState } from 'react';
import { chargerCourbeCourse, chargerPodiumCourse } from '@/data/acces/api';
import type { EntreeCourbe, PointCourbe } from '@/data/bilan/records';
import { courbeCourseDeLignes, signalServeur, type CleCourbeCourse } from '@/data/bilan/records-course';
import { useAuth } from '@/stores/auth';
import { auChangementDEcarts, useVersionEcarts } from '@/stores/ecarts';

// Les courbes de records de la course à pied (allure par distance, distance par durée, FC par durée) : tous temps et année choisie, puis le classement du point touché.
// Chargées quand on ouvre l'onglet Records de la course ou qu'on change de signal, gardées en mémoire cinq minutes.
const DUREE_CACHE = 5 * 60 * 1000;
const ATTENTE_MS = 250;
const cache = new Map<string, { data: PointCourbe[]; a: number }>();
const cachePodium = new Map<string, { data: EntreeCourbe[]; a: number }>();
const cleCache = (userId: string, signal: CleCourbeCourse, annee: number | undefined): string => `${userId}|${signal}|${annee ?? 'tout'}`;
const VIDE: PointCourbe[] = [];
auChangementDEcarts(() => {
  cache.clear();
  cachePodium.clear();
}); // une donnée écartée change les records : on relit

export function useCourbeCourse(signal: CleCourbeCourse, annee: number, actif: boolean): { courbeTout: PointCourbe[]; courbeAnnee: PointCourbe[]; chargement: boolean; erreur: string } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const versionEcarts = useVersionEcarts();
  const [, rafraichir] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!actif || !userId) return;
    let annule = false;
    void (async () => {
      const manque = [undefined, annee].filter((a) => {
        const c = cache.get(cleCache(userId, signal, a));
        return !c || Date.now() - c.a > DUREE_CACHE;
      });
      if (!manque.length) return;
      setChargement(true);
      try {
        for (const a of manque) {
          const r = await chargerCourbeCourse(signal, a);
          if (annule) return;
          if (!r.data) {
            setErreur(r.erreur);
            return;
          }
          cache.set(cleCache(userId, signal, a), { data: r.data, a: Date.now() });
        }
        setErreur('');
        rafraichir((n) => n + 1);
      } catch {
        if (!annule) setErreur('Impossible de charger cette courbe.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [actif, userId, signal, annee, versionEcarts]);

  if (!actif || !userId) return { courbeTout: VIDE, courbeAnnee: VIDE, chargement: false, erreur: '' };
  return {
    courbeTout: cache.get(cleCache(userId, signal, undefined))?.data || VIDE,
    courbeAnnee: cache.get(cleCache(userId, signal, annee))?.data || VIDE,
    chargement,
    erreur,
  };
}

/** Le classement (jusqu'à 30 séances) d'une distance ou d'une durée touchée sur la courbe : demandé au serveur quand le doigt s'arrête (250 ms), gardé cinq minutes. Null tant qu'il n'est pas là. `annee` : null pour « Tous temps ». */
export function usePodiumCourse(signal: CleCourbeCourse, cle: number | null, annee: number | null): EntreeCourbe[] | null {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const versionEcarts = useVersionEcarts();
  const [, rafraichir] = useState(0);

  useEffect(() => {
    if (!userId || cle == null) return;
    const k = `${cleCache(userId, signal, annee ?? undefined)}|${cle}`;
    const c = cachePodium.get(k);
    if (c && Date.now() - c.a < DUREE_CACHE) return;
    let annule = false;
    const minuterie = setTimeout(() => {
      void (async () => {
        try {
          const r = await chargerPodiumCourse(signal, cle, annee ?? undefined);
          if (annule || !r.data) return;
          cachePodium.set(k, { data: r.data, a: Date.now() });
          rafraichir((n) => n + 1);
        } catch {
          // Sans le classement complet, l'écran garde les trois séances de la courbe
        }
      })();
    }, ATTENTE_MS);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, [userId, signal, cle, annee, versionEcarts]);

  if (!userId || cle == null) return null;
  return cachePodium.get(`${cleCache(userId, signal, annee ?? undefined)}|${cle}`)?.data ?? null;
}
