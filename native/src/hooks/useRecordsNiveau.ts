import { useEffect, useMemo, useState } from 'react';
import { chargerTopRecordsNiveau } from '@/data/acces/api';
import type { ActiviteBilan } from '@/data/bilan/bilan';
import { DUREES_COURSE, DUREES_VELO, recordLonguesSorties, recordsDesLignes, recordsNatation, type LigneTop, type RecordDate } from '@/data/bilan/records-niveau';
import { useAuth } from '@/stores/auth';
import { auChangementDEcarts, useVersionEcarts } from '@/stores/ecarts';

// Les records qui comptent dans le niveau trimestre par trimestre : puissance du vélo, allure de la course et de la natation, plus longue sortie (voir data/bilan/records-niveau.ts).
// Le serveur donne les 5 meilleures séances du vélo et de la course ; la natation et les plus longues sorties se calculent sur les séances déjà chargées.
// Chargés à l'ouverture de l'onglet Progrès, gardés cinq minutes. En cas d'échec, le niveau se calcule sans les records de puissance et d'allure (heures et charge seulement).
const DUREE_CACHE = 5 * 60 * 1000;
const cache = new Map<string, { velo: LigneTop[]; course: LigneTop[]; a: number }>();
auChangementDEcarts(() => cache.clear()); // une donnée écartée change les records : on relit

export function useRecordsNiveau(actif: boolean, toutes: readonly ActiviteBilan[]): { records: RecordDate[] | null; chargement: boolean } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const versionEcarts = useVersionEcarts();
  const [lignes, setLignes] = useState<{ velo: LigneTop[]; course: LigneTop[] } | null>(null);
  const [termine, setTermine] = useState(false);

  useEffect(() => {
    if (!actif || !userId) return;
    const connu = cache.get(userId);
    if (connu && Date.now() - connu.a < DUREE_CACHE) {
      setLignes({ velo: connu.velo, course: connu.course });
      setTermine(true);
      return;
    }
    let annule = false;
    setTermine(false);
    void (async () => {
      try {
        const r = await chargerTopRecordsNiveau();
        if (annule) return;
        if (r.data) {
          cache.set(userId, { ...r.data, a: Date.now() });
          setLignes(r.data);
        } else setLignes(null); // échec : on passe sans ces records
      } catch {
        if (!annule) setLignes(null);
      } finally {
        if (!annule) setTermine(true);
      }
    })();
    return () => {
      annule = true;
    };
  }, [actif, userId, versionEcarts]);

  const records = useMemo<RecordDate[] | null>(() => {
    if (!actif || !termine) return null;
    return [
      ...(lignes ? recordsDesLignes('velo', 'w', lignes.velo, DUREES_VELO) : []),
      ...(lignes ? recordsDesLignes('course', 'allure', lignes.course, DUREES_COURSE) : []),
      ...recordLonguesSorties(toutes, 'velo'),
      ...recordLonguesSorties(toutes, 'course'),
      ...recordsNatation(toutes),
    ];
  }, [actif, termine, lignes, toutes]);

  return { records, chargement: actif && !termine };
}
