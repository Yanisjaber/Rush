import { useCallback, useEffect, useMemo, useState } from 'react';
import { chargerProfilComplet, enregistrerProfil } from '@/data/api';
import { donneesDemo } from '@/data/demo';
import { sectionParId, validerSection, valeursDepuis, versPayload, type LigneProfil, type Section } from '@/data/profil';
import { useAuth } from '@/stores/auth';

type Valeurs = Record<string, string | boolean>;

// Une section du profil (Identité, Physiologie) : chargement, saisie, validation, enregistrement.
// En démo rien n'est écrit : la ligne locale est simplement mise à jour. userId vient toujours de la session.
export function useProfilSection(id: string) {
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const section = useMemo<Section | null>(() => sectionParId(id), [id]);
  const [ligne, setLigne] = useState<LigneProfil | null>(null);
  const [valeurs, setValeurs] = useState<Valeurs>({});
  const [initial, setInitial] = useState('');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState('');

  const appliquer = useCallback(
    (l: LigneProfil | null) => {
      if (!section) return;
      const v = valeursDepuis(l, section);
      setLigne(l ?? { extras: {} });
      setValeurs(v);
      setInitial(JSON.stringify(v));
    },
    [section],
  );

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur('');
      if (demo) {
        appliquer({ ...donneesDemo().profil }); // mêmes extras que la tuile de l'écran Paramètres
      } else if (userId) {
        const r = await chargerProfilComplet(userId);
        if (annule) return;
        if (r.erreur) setErreur(r.erreur);
        else appliquer(r.data);
      }
      if (!annule) setChargement(false);
    })();
    return () => {
      annule = true;
    };
  }, [demo, userId, appliquer]);

  const modifier = useCallback((cle: string, valeur: string | boolean) => {
    setValeurs((v) => ({ ...v, [cle]: valeur }));
    setMessage('');
  }, []);

  const enregistrer = useCallback(async () => {
    if (!section || envoi || !ligne) return; // sans profil chargé, on n'écrit rien (ça écraserait les vraies valeurs)
    setMessage('');
    setErreur('');
    const { propres, erreurs: e } = validerSection(section, valeurs);
    setErreurs(e);
    if (Object.keys(e).length) return;
    setEnvoi(true);
    const { colonnes, extras } = versPayload(section, propres, ligne?.extras);
    const r = demo ? { data: { ...ligne, ...colonnes, extras } as LigneProfil, erreur: '' } : userId ? await enregistrerProfil(userId, colonnes, extras) : { data: null, erreur: 'Reconnecte-toi.' };
    setEnvoi(false);
    if (r.erreur) {
      setErreur(r.erreur);
      return;
    }
    appliquer(r.data);
    setMessage('Enregistré.');
  }, [section, envoi, valeurs, ligne, demo, userId, appliquer]);

  const sale = initial !== '' && JSON.stringify(valeurs) !== initial;
  return { section, ligne, valeurs, chargement, erreur, erreurs, envoi, message, sale, modifier, enregistrer, demo };
}
