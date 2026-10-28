// Suppression du compte : même déroulé que sur le site (fonction serveur « delete-account », en 3 étapes). Logique pure : l'appel réseau est passé en paramètre.
//   1. préparation : retrait de l'accès Strava, comptage de ce qu'il faut effacer ;
//   2. données effacées par petits lots (c'est ce qui fait avancer la barre) ;
//   3. suppression du compte lui-même.

export const MOT_CONFIRMATION = 'SUPPRIMER';

export interface ReponseFonction {
  ok: boolean;
  statut: number;
  data: Record<string, unknown> | null;
}
export type AppelFonction = (corps: Record<string, unknown>) => Promise<ReponseFonction>;
export type Progres = (avancee: { pct: number; texte: string }) => void;
export type ResultatSuppression = { ok: true } | { ok: false; message: string };

const ECHEC_DEBUT = "La suppression a échoué. Rien n'a été supprimé : réessaie, ou demande à Yanis.";
const ECHEC_EN_COURS = "La suppression s'est interrompue. Une partie de tes données a peut-être déjà été effacée : relance la suppression pour terminer, ou demande à Yanis.";

/** Le mot tapé suffit-il à confirmer ? (exactement « SUPPRIMER », espaces autour ignorés) */
export const confirmationValide = (texte: string): boolean => texte.trim() === MOT_CONFIRMATION;

export async function supprimerCompteAvec(appeler: AppelFonction, confirmation: string, onProgres: Progres = () => {}): Promise<ResultatSuppression> {
  if (confirmation !== MOT_CONFIRMATION) return { ok: false, message: `Tape exactement ${MOT_CONFIRMATION} pour confirmer.` };

  onProgres({ pct: 2, texte: 'Préparation…' });
  const prep = await appeler({ confirmation, etape: 'preparer' });
  if (!prep.ok) {
    if (prep.statut === 404) return { ok: false, message: "La suppression n'est pas encore activée sur le serveur. Demande à Yanis." };
    return { ok: false, message: ECHEC_DEBUT };
  }

  // Ancien serveur (sans étapes) : il a déjà tout supprimé en un appel, pas de total renvoyé
  const total = Number(prep.data?.total);
  if (Number.isFinite(total)) {
    let restant = total;
    let essaisSansAvancer = 0;
    for (let tour = 0; restant > 0; tour++) {
      if (tour > 2000) return { ok: false, message: ECHEC_EN_COURS }; // garde-fou : jamais de boucle sans fin
      onProgres({ pct: 5 + Math.round(((total - restant) / total) * 90), texte: 'Suppression de tes données…' });
      const lot = await appeler({ confirmation, etape: 'purger' });
      if (!lot.ok) return { ok: false, message: ECHEC_EN_COURS };
      const reste = Number(lot.data?.restant);
      if (!Number.isFinite(reste)) return { ok: false, message: ECHEC_EN_COURS };
      essaisSansAvancer = reste >= restant ? essaisSansAvancer + 1 : 0;
      if (essaisSansAvancer >= 3) return { ok: false, message: ECHEC_EN_COURS }; // ça n'avance plus : on s'arrête
      restant = reste;
    }
    onProgres({ pct: 97, texte: 'Suppression du compte…' });
    const fin = await appeler({ confirmation, etape: 'supprimer' });
    if (!fin.ok) return { ok: false, message: ECHEC_EN_COURS };
  }
  onProgres({ pct: 100, texte: 'Terminé' });
  return { ok: true };
}
