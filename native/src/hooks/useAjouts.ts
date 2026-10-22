import { useCallback } from 'react';
import { creerNoteJour, creerPrevue } from '@/data/api';
import type { LigneNote, LignePrevue } from '@/data/ajouts';
import { ajoutsChanges, ajouterNoteDemo, ajouterPrevueDemo } from '@/stores/ajouts';
import { useAuth } from '@/stores/auth';

// De quoi ajouter au calendrier une séance prévue, une compétition ou une note : en mémoire dans la démo, dans la base pour un compte connecté.
// Chaque fonction renvoie un message d'erreur, vide quand tout s'est bien passé ; le calendrier se recharge tout seul après un ajout.
export function useAjouts(): {
  creerPrevue: (ligne: LignePrevue) => Promise<string>;
  creerNote: (ligne: LigneNote) => Promise<string>;
} {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const prevue = useCallback(
    async (ligne: LignePrevue) => {
      if (demo) {
        ajouterPrevueDemo(ligne);
        return '';
      }
      if (!userId) return 'Reconnecte-toi.';
      const r = await creerPrevue(userId, ligne);
      if (!r.erreur) ajoutsChanges();
      return r.erreur;
    },
    [demo, userId],
  );
  const note = useCallback(
    async (ligne: LigneNote) => {
      if (demo) {
        ajouterNoteDemo(ligne);
        return '';
      }
      if (!userId) return 'Reconnecte-toi.';
      const r = await creerNoteJour(userId, ligne);
      if (!r.erreur) ajoutsChanges();
      return r.erreur;
    },
    [demo, userId],
  );
  return { creerPrevue: prevue, creerNote: note };
}
