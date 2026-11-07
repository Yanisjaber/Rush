import { useCallback, useEffect, useRef, useState } from 'react';
import { ajouterCarteCoach, annulerCarteCoach, chargerMessagesCoach, effacerConversationCoach, envoyerMessageCoach } from '@/data/acces/api/coach';
import { lireAction, type ActionApp } from '@/data/coach/actions';
import { appliquerEvenement, debutEnvoi, ERREURS_SANS_REESSAI, majCarte, messagesDepuisLignes } from '@/data/coach/fil';
import { cartePlanExemple, PREFIXE_EXEMPLE } from '@/data/coach/exemple-plan';
import { estPlanning, type Carte, type MessageCoach } from '@/data/coach/types';
import { dateIsoLocale } from '@/data/outils/format';
import { ajoutsChanges } from '@/stores/ajouts';

// Tout l'état de l'écran Coach : la conversation, l'envoi en cours, les boutons des cartes.
// La logique des événements vit dans data/coach/fil.ts (testée) ; ici on ne fait que la brancher à l'écran.
// `surAction` exécute les actions sans danger du coach (ouvrir un écran…) : le serveur les envoie, l'écran les fait, parmi une liste blanche.
export function useCoach(userId: string | null, surAction?: (a: ActionApp) => void) {
  const [messages, setMessages] = useState<MessageCoach[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  // Le dernier envoi a échoué pour une raison qui ne s'arrange pas en réessayant (plafond du jour, accord manquant…)
  const [sansReessai, setSansReessai] = useState(false);
  // Les cartes dont une action est en cours, et le message d'erreur de chacune
  const [occupees, setOccupees] = useState<Record<string, boolean>>({});
  const [erreursCarte, setErreursCarte] = useState<Record<string, string>>({});
  // Les actions lisent « occupées » par une référence : deux taps rapprochés ne partent pas deux fois
  const occupeesRef = useRef<Record<string, boolean>>({});
  const vivant = useRef(true);
  const surActionRef = useRef(surAction);
  surActionRef.current = surAction;
  useEffect(() => {
    vivant.current = true;
    return () => {
      vivant.current = false;
    };
  }, []);

  const charger = useCallback(async () => {
    if (!userId) {
      setMessages([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    const r = await chargerMessagesCoach(userId);
    if (!vivant.current) return;
    if (r.data) {
      // Un envoi peut être en cours pendant un rechargement : on ne l'écrase pas
      setMessages((actuel) => (actuel.some((m) => m.enCours) ? actuel : messagesDepuisLignes(r.data ?? [])));
      setErreur('');
    } else setErreur(r.erreur);
    setChargement(false);
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const envoyer = useCallback(
    async (texte: string) => {
      const propre = texte.trim();
      if (!propre || envoi) return;
      setEnvoi(true);
      setSansReessai(false);
      setMessages((m) => debutEnvoi(m, propre, `local-${Date.now()}`));
      await envoyerMessageCoach(propre, (e) => {
        if (!vivant.current) return;
        if (e.type === 'erreur') setSansReessai(ERREURS_SANS_REESSAI.includes(e.code));
        if (e.type === 'action') {
          // Relue contre la liste blanche : une action inconnue ou mal formée ne fait rien
          const action = lireAction(e.nom, e.params);
          if (action) surActionRef.current?.(action);
        }
        setMessages((m) => appliquerEvenement(m, e));
      });
      if (vivant.current) setEnvoi(false);
    },
    [envoi],
  );

  const agirSurCarte = useCallback(async (carte: Carte, action: 'ajouter' | 'annuler') => {
    if (occupeesRef.current[carte.id]) return;
    // Posé tout de suite dans la référence (l'état ne se met à jour qu'au prochain affichage) : un deuxième tap immédiat est refusé
    occupeesRef.current = { ...occupeesRef.current, [carte.id]: true };
    setOccupees((o) => ({ ...o, [carte.id]: true }));
    setErreursCarte((e) => ({ ...e, [carte.id]: '' }));
    const fin = () => {
      occupeesRef.current = { ...occupeesRef.current, [carte.id]: false };
      if (vivant.current) setOccupees((o) => ({ ...o, [carte.id]: false }));
    };

    // Mode développement : une carte d'essai ne part jamais au serveur, on joue les états pour voir l'écran
    if (__DEV__ && carte.id.startsWith(PREFIXE_EXEMPLE)) {
      await new Promise((r) => setTimeout(r, 700));
      fin();
      if (!vivant.current) return;
      const suite: Carte = estPlanning(carte)
        ? { ...carte, etat: action === 'ajouter' ? 'ajoutee' : 'annulee', ...(action === 'annuler' ? { annulation: { annulees: carte.lignes.length, ignorees: 0 } } : {}) }
        : { ...carte, etat: action === 'ajouter' ? 'ajoutee' : 'annulee' };
      setMessages((m) => majCarte(m, suite));
      return;
    }

    const r = action === 'ajouter' ? await ajouterCarteCoach(carte.id) : await annulerCarteCoach(carte.id);
    fin();
    if (!vivant.current) return;
    if (r.ok) {
      // Le serveur renvoie la carte à jour après un ajout ; après une annulation on la passe à « annulée » ici (avec le bilan, pour un plan)
      const annulee: Carte = estPlanning(carte) ? { ...carte, etat: 'annulee', ...(r.bilan ? { annulation: r.bilan } : {}) } : { ...carte, etat: 'annulee' };
      const suite: Carte | null = r.carte ?? (action === 'annuler' ? annulee : null);
      if (suite) setMessages((m) => majCarte(m, suite));
      // Le calendrier a changé (séance ajoutée, plan appliqué ou défait) : il se recharge
      ajoutsChanges();
    } else {
      setErreursCarte((e) => ({ ...e, [carte.id]: r.message }));
      // Une carte refusée par les règles au moment du tap : on relit la conversation pour afficher son nouvel état et son motif
      if (action === 'ajouter') void charger();
    }
  }, [charger]);

  /** Mode développement : pose une carte de plan d'exemple dans le fil, sans serveur ni modèle (pour voir l'écran) */
  const insererExemple = useCallback(() => {
    if (!__DEV__) return;
    const jour = dateIsoLocale(new Date());
    setMessages((m) => [
      ...m,
      { id: `${PREFIXE_EXEMPLE}msg-${Date.now()}`, role: 'assistant', texte: "(Carte d'essai, rien n'est enregistré.) Aïe. Voilà ce que je change, tu valides ou pas.", cartes: [cartePlanExemple(jour, `${PREFIXE_EXEMPLE}${Date.now()}`)] },
    ]);
  }, []);

  const effacer = useCallback(async () => {
    if (!userId) return false;
    const r = await effacerConversationCoach(userId);
    if (!vivant.current) return r.ok;
    if (r.ok) {
      setMessages([]);
      setErreur('');
    } else setErreur(r.erreur);
    return r.ok;
  }, [userId]);

  return {
    messages,
    chargement,
    erreur,
    envoi,
    sansReessai,
    occupees,
    erreursCarte,
    envoyer,
    ajouter: (c: Carte) => agirSurCarte(c, 'ajouter'),
    annuler: (c: Carte) => agirSurCarte(c, 'annuler'),
    insererExemple: __DEV__ ? insererExemple : undefined,
    effacer,
    recharger: charger,
  };
}
