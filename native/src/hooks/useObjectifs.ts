import { useCallback } from 'react';
import { creerObjectifAnnuel, modifierObjectifAnnuel, supprimerObjectifAnnuel, type ValeursObjectif } from '@/data/acces/api';
import { objectifsChanges } from '@/stores/objectifs';
import { useAuth } from '@/stores/auth';

// Les écritures d'objectifs annuels (créer, modifier, supprimer). Chaque écriture prévient le Bilan, qui recharge ses objectifs.
// Chaque fonction renvoie un message d'erreur, vide quand tout s'est bien passé.
export function useEcrituresObjectifs(): {
  creer: (annee: number, v: ValeursObjectif) => Promise<string>;
  modifier: (id: string, v: ValeursObjectif) => Promise<string>;
  supprimer: (id: string) => Promise<string>;
} {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const creer = useCallback(
    async (annee: number, v: ValeursObjectif) => {
      if (!userId) return 'Reconnecte-toi.';
      const r = await creerObjectifAnnuel(userId, annee, v);
      if (!r.erreur) objectifsChanges();
      return r.erreur;
    },
    [userId],
  );
  const modifier = useCallback(
    async (id: string, v: ValeursObjectif) => {
      if (!userId) return 'Reconnecte-toi.';
      const r = await modifierObjectifAnnuel(userId, id, v);
      if (!r.erreur) objectifsChanges();
      return r.erreur;
    },
    [userId],
  );
  const supprimer = useCallback(
    async (id: string) => {
      if (!userId) return 'Reconnecte-toi.';
      const r = await supprimerObjectifAnnuel(userId, id);
      if (!r.erreur) objectifsChanges();
      return r.erreur;
    },
    [userId],
  );
  return { creer, modifier, supprimer };
}
