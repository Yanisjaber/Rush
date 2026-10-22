import { useCallback } from 'react';
import { creerNoteJour, creerPrevue, modifierNoteJour, poserRepos, retirerRepos, supprimerNoteJour } from '@/data/api';
import type { LigneNote, LignePrevue } from '@/data/ajouts';
import { ajoutsChanges, ajouterNoteDemo, ajouterPrevueDemo, modifierNoteDemo, poserReposDemo, retirerReposDemo, supprimerNoteDemo } from '@/stores/ajouts';
import { useAuth } from '@/stores/auth';

// De quoi ajouter au calendrier une séance prévue, une compétition ou une note : en mémoire dans la démo, dans la base pour un compte connecté.
// Chaque fonction renvoie un message d'erreur, vide quand tout s'est bien passé ; le calendrier se recharge tout seul après un ajout.
export function useAjouts(): {
  creerPrevue: (ligne: LignePrevue) => Promise<string>;
  creerNote: (ligne: LigneNote) => Promise<string>;
  modifierNote: (id: string, ligne: LigneNote) => Promise<string>;
  supprimerNote: (id: string) => Promise<string>;
  /** Pose (`pose` vrai) ou retire un jour de repos. */
  basculerRepos: (iso: string, pose: boolean) => Promise<string>;
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
  const modifier = useCallback(
    async (id: string, ligne: LigneNote) => {
      if (demo) {
        modifierNoteDemo(id, ligne);
        return '';
      }
      if (!userId) return 'Reconnecte-toi.';
      const r = await modifierNoteJour(userId, id, ligne);
      if (!r.erreur) ajoutsChanges();
      return r.erreur;
    },
    [demo, userId],
  );
  const supprimer = useCallback(
    async (id: string) => {
      if (demo) {
        supprimerNoteDemo(id);
        return '';
      }
      if (!userId) return 'Reconnecte-toi.';
      const r = await supprimerNoteJour(userId, id);
      if (!r.erreur) ajoutsChanges();
      return r.erreur;
    },
    [demo, userId],
  );
  const repos = useCallback(
    async (iso: string, pose: boolean) => {
      if (demo) {
        if (pose) poserReposDemo(iso);
        else retirerReposDemo(iso);
        return '';
      }
      if (!userId) return 'Reconnecte-toi.';
      const r = pose ? await poserRepos(userId, iso) : await retirerRepos(userId, iso);
      if (!r.erreur) ajoutsChanges();
      return r.erreur;
    },
    [demo, userId],
  );
  return { creerPrevue: prevue, creerNote: note, modifierNote: modifier, supprimerNote: supprimer, basculerRepos: repos };
}
