import { useCallback, useEffect, useRef, useState } from 'react';
import { demanderAnalyseSortie, lireAnalyseSortie } from '@/data/acces/api/coach';
import { ERREURS_SANS_REESSAI } from '@/data/coach/fil';
import type { SignauxAnalyse } from '@/data/calendrier/signaux-analyse';
import { useAuth } from '@/stores/auth';

// L'état de l'analyse du coach pour une sortie. À l'ouverture on lit seulement ce qui a déjà été écrit (gratuit) ;
// l'appel au coach (qui coûte un peu) ne part que sur un toucher de « Demander l'analyse ».
export type EtatAnalyse =
  | { etape: 'lecture' }
  | { etape: 'vide' }
  | { etape: 'ecriture'; ancien: string[] | null }
  | { etape: 'ok'; paragraphes: string[] }
  | { etape: 'erreur'; message: string; reessayer: boolean; ancien: string[] | null };

export function useAnalyseSortie(activityId: string | null): { etat: EtatAnalyse; demander: (signaux: SignauxAnalyse) => void } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [etat, setEtat] = useState<EtatAnalyse>({ etape: 'lecture' });
  const vivant = useRef(true);
  const enCours = useRef(false);
  useEffect(() => {
    vivant.current = true;
    return () => {
      vivant.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !activityId) return;
    setEtat({ etape: 'lecture' });
    void (async () => {
      const gardee = await lireAnalyseSortie(userId, activityId);
      if (vivant.current) setEtat(gardee ? { etape: 'ok', paragraphes: gardee } : { etape: 'vide' });
    })();
  }, [userId, activityId]);

  const demander = useCallback((s: SignauxAnalyse) => {
    if (!activityId || enCours.current) return;
    enCours.current = true;
    setEtat((e) => ({ etape: 'ecriture', ancien: e.etape === 'ok' ? e.paragraphes : e.etape === 'ecriture' || e.etape === 'erreur' ? e.ancien : null }));
    void (async () => {
      const r = await demanderAnalyseSortie(activityId, s);
      enCours.current = false;
      if (!vivant.current) return;
      setEtat((e) => {
        if (r.ok) return { etape: 'ok', paragraphes: r.paragraphes };
        return { etape: 'erreur', message: r.message, reessayer: !ERREURS_SANS_REESSAI.includes(r.code), ancien: e.etape === 'ecriture' ? e.ancien : null };
      });
    })();
  }, [activityId]);

  return { etat, demander };
}
