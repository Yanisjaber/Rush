import { useCallback, useEffect, useRef, useState } from 'react';
import { ajouterCarteCoach, annulerCarteCoach, chargerMessagesCoach, effacerConversationCoach, envoyerMessageCoach } from '@/data/acces/api/coach';
import { appliquerEvenement, debutEnvoi, ERREURS_SANS_REESSAI, majCarte, messagesDepuisLignes } from '@/data/coach/fil';
import type { CarteSeance, MessageCoach } from '@/data/coach/types';

// Tout l'état de l'écran Coach : la conversation, l'envoi en cours, les boutons des cartes.
// La logique des événements vit dans data/coach/fil.ts (testée) ; ici on ne fait que la brancher à l'écran.
export function useCoach(userId: string | null) {
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
        setMessages((m) => appliquerEvenement(m, e));
      });
      if (vivant.current) setEnvoi(false);
    },
    [envoi],
  );

  const agirSurCarte = useCallback(async (carte: CarteSeance, action: 'ajouter' | 'annuler') => {
    if (occupeesRef.current[carte.id]) return;
    // Posé tout de suite dans la référence (l'état ne se met à jour qu'au prochain affichage) : un deuxième tap immédiat est refusé
    occupeesRef.current = { ...occupeesRef.current, [carte.id]: true };
    setOccupees((o) => ({ ...o, [carte.id]: true }));
    setErreursCarte((e) => ({ ...e, [carte.id]: '' }));
    const r = action === 'ajouter' ? await ajouterCarteCoach(carte.id) : await annulerCarteCoach(carte.id);
    occupeesRef.current = { ...occupeesRef.current, [carte.id]: false };
    if (!vivant.current) return;
    if (r.ok) {
      // Le serveur renvoie la carte à jour après un ajout ; après une annulation on la passe à « annulée » ici
      const suite: CarteSeance | null = r.carte ?? (action === 'annuler' ? { ...carte, etat: 'annulee' } : null);
      if (suite) setMessages((m) => majCarte(m, suite));
    } else {
      setErreursCarte((e) => ({ ...e, [carte.id]: r.message }));
      // Une carte refusée par les règles au moment du tap : on relit la conversation pour afficher son nouvel état et son motif
      if (action === 'ajouter') void charger();
    }
    setOccupees((o) => ({ ...o, [carte.id]: false }));
  }, [charger]);

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
    ajouter: (c: CarteSeance) => agirSurCarte(c, 'ajouter'),
    annuler: (c: CarteSeance) => agirSurCarte(c, 'annuler'),
    effacer,
    recharger: charger,
  };
}
