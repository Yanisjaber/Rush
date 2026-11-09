import { useCallback, useEffect, useRef, useState } from 'react';
import { donneesDemoAccueil } from '@/data/accueil/accueil';
import { changerDonneeEcartee, chargerSeance, chargerTours, chargerTrace } from '@/data/acces/api';
import { apercuDeTrace } from '@/data/calendrier/apercu-import';
import type { ColonneEcart } from '@/data/calendrier/donnees-ecartees';
import { activitesBilanDemo, toursDemo } from '@/data/demo/demo';
import { seanceDeLaDemo, useVersionAjouts } from '@/stores/ajouts';
import { useAuth } from '@/stores/auth';
import { ecartsChanges } from '@/stores/ecarts';
import type { CourbesSortie } from '@/data/outils/courbes-sortie';
import type { Seance, Tour } from '@/data/types';

interface Etat {
  seance: Seance | null;
  /** Null tant qu'ils ne sont pas chargés ou s'ils n'ont pas pu l'être (voir erreurTours). */
  tours: Tour[] | null;
  chargement: boolean;
  chargementTours: boolean;
  erreur: string;
  erreurTours: string;
  /** La carte et le profil d'altitude ; null sans GPS, ou tant qu'ils ne sont pas chargés. */
  trace: ApercuTrace | null;
  chargementTrace: boolean;
  erreurTrace: string;
  /** Les courbes (vitesse, cœur, altitude, cadence) ; null sans flux stockés. */
  courbes: CourbesSortie | null;
}

type ApercuTrace = NonNullable<ReturnType<typeof apercuDeTrace>>;

const initial: Etat = { seance: null, tours: null, chargement: true, chargementTours: false, erreur: '', erreurTours: '', trace: null, chargementTrace: false, erreurTrace: '', courbes: null };

/** L'état de la séance, et de quoi écarter (ou remettre) une de ses données : renvoie un message d'erreur, vide si tout s'est bien passé. */
export interface RetourSeance extends Etat {
  basculerDonnee: (colonne: ColonneEcart, ecartee: boolean) => Promise<string>;
}

// Une séance et ses tours : la démo ou le compte connecté. La séance s'affiche dès qu'elle est là, les tours arrivent après
// (ils passent par Strava : c'est plus lent, et ça peut échouer sans gêner le reste).
export function useSeance(id: string): RetourSeance {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const version = useVersionAjouts(); // une modification ou une suppression d'activité fait relire la fiche
  const [etat, setEtat] = useState<Etat>(initial);
  const idLu = useRef(id);

  useEffect(() => {
    let annule = false;
    // On repart d'un état vide seulement pour une autre séance ; une relecture après modification garde la fiche affichée
    if (idLu.current !== id) {
      idLu.current = id;
      setEtat(initial);
    }
    if (demo) {
      // Les sorties de l'historique de six ans (celles du Bilan, du classement des records) ne sont pas dans les 84 jours de l'accueil : on les cherche seulement si l'identifiant en vient
      const base = id.startsWith('demo-bilan-') ? activitesBilanDemo(new Date()) : donneesDemoAccueil(new Date()).seances;
      const s = seanceDeLaDemo(id, base);
      setEtat({ ...initial, seance: s, chargement: false, tours: s ? toursDemo(s) : null, erreur: s ? '' : 'Séance introuvable.' });
      return;
    }
    if (!userId) return;
    void (async () => {
      const r = await chargerSeance(userId, id);
      if (annule) return;
      if (!r.data) return setEtat({ ...initial, chargement: false, erreur: r.erreur || 'Séance introuvable.' });
      const s = r.data;
      // La carte : demandée en même temps que les tours, sans jamais bloquer la fiche (une sortie sans GPS n'a simplement pas de carte)
      const traceDemandee = chargerTrace(userId, id, s.strava_id).then((t) => {
        if (annule) return;
        const apercu = t.data ? apercuDeTrace(t.data) : null;
        setEtat((e) => ({ ...e, chargementTrace: false, trace: apercu, courbes: t.courbes, erreurTrace: t.erreur }));
      });
      // Pas de tours pour une séance saisie à la main : rien à demander à Strava
      if (!s.strava_id) {
        setEtat({ ...initial, seance: s, chargement: false, chargementTrace: true, erreurTours: "Cette séance ne vient pas de Strava : ses tours ne sont pas disponibles." });
        return void (await traceDemandee);
      }
      setEtat({ ...initial, seance: s, chargement: false, chargementTours: true, chargementTrace: true });
      const t = await chargerTours(id);
      if (annule) return;
      setEtat((e) => ({ ...e, chargementTours: false, tours: t.data, erreurTours: t.erreur }));
      await traceDemandee;
    })();
    return () => {
      annule = true;
    };
  }, [id, userId, demo, version]);

  // On change l'écran tout de suite, puis la base ; si la base refuse, on remet l'ancien état. En démo, rien n'est écrit (le changement dure le temps de l'écran).
  const basculerDonnee = useCallback(
    async (colonne: ColonneEcart, ecartee: boolean): Promise<string> => {
      const poser = (valeur: boolean | null | undefined) => setEtat((e) => (e.seance ? { ...e, seance: { ...e.seance, [colonne]: valeur } } : e));
      const avant = etat.seance?.[colonne];
      poser(ecartee);
      if (demo) return '';
      if (!userId) {
        poser(avant);
        return 'Reconnecte-toi.';
      }
      const r = await changerDonneeEcartee(userId, id, colonne, ecartee);
      if (r.erreur) {
        poser(avant);
        return r.erreur;
      }
      ecartsChanges(); // la charge, les records et le niveau se recalculent : les autres écrans relisent
      return '';
    },
    [demo, userId, id, etat.seance],
  );

  return { ...etat, basculerDonnee };
}
