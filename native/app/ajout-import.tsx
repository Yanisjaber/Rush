import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ApercuImport } from '@/components/ApercuImport';
import { Alert, Text } from 'react-native';
import { EcranAjout } from '@/components/EcranAjout';
import { apercuImport, type ApercuImport as Apercu } from '@/data/apercu-import';
import { cleDuType, formulaireSortieVide, validerSortie } from '@/data/ajouts';
import { formatDateCourte, dateIsoLocale } from '@/data/format';
import { donneesAEcrire, lireActivite, TAILLE_MAX_IMPORT, versChamps, type ActiviteImportee, type ChampsImport, type DonneesImport } from '@/data/import-activite';
import { nomDeFichier } from '@/data/gpx';
import { useAjouts } from '@/hooks/useAjouts';
import { garderImport, viderImport } from '@/stores/import-en-attente';
import { useMenu } from '@/stores/menu';
import { SPORTS, type CleSport } from '@/theme/sports';
import { useDateAjout } from '@/hooks/useDateAjout';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Importer une activité déjà faite depuis un fichier .fit, .gpx ou .tcx (montre, Garmin Connect, Strava, Wahoo…). On lit le fichier, puis on ouvre « Activité déjà faite »
// avec les champs remplis : l'utilisateur relit, corrige si besoin, et enregistre. Rien n'est écrit tant qu'il n'a pas validé.
export default function EcranAjoutImport() {
  const p = usePalette();
  const router = useRouter();
  const dateDepart = useDateAjout();
  const { creerSortie } = useAjouts();
  const { filtre, familles } = useMenu();
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  // Le fichier lu, en attente d'un choix dans la fenêtre d'aperçu (Enregistrer, Modifier ou Annuler)
  const [lu, setLu] = useState<{ activite: ActiviteImportee; donnees: DonneesImport; date: string; champs: ChampsImport; type: string; apercu: Apercu } | null>(null);
  const [erreurApercu, setErreurApercu] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  // Le sélecteur de fichiers du système. Le module est chargé au moment du choix : tant que l'app n'a pas été reconstruite avec, on le dit clairement.
  async function choisir() {
    setErreur('');
    let selecteur: typeof import('expo-document-picker');
    try {
      selecteur = await import('expo-document-picker');
    } catch {
      return Alert.alert('Nouvelle version nécessaire', "Le choix d'un fichier demande de reconstruire l'app avec son module natif.");
    }
    setEnCours(true);
    try {
      const r = await selecteur.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (r.canceled || !r.assets?.length) return;
      const fichier = r.assets[0];
      if (fichier.size != null && fichier.size > TAILLE_MAX_IMPORT) return setErreur('Le fichier est trop gros (5 Mo maximum).');
      const octets = new Uint8Array(await (await fetch(fichier.uri)).arrayBuffer());
      const lecture = lireActivite(octets);
      if (!lecture.ok) return setErreur(lecture.erreur);
      const { date, champs } = versChamps(lecture.activite);
      const donnees = donneesAEcrire(lecture.activite, nomDeFichier(fichier.name));
      garderImport(donnees); // utile si on choisit « Modifier » : l'écran de saisie les reprend
      const type = champs.type ?? formulaireSortieVide(filtre, familles).type; // sport du fichier, sinon celui de la barre du haut
      setErreurApercu('');
      setLu({ activite: lecture.activite, donnees, date: date ?? dateDepart, champs, type, apercu: apercuImport(lecture.activite, type) });
    } catch {
      setErreur('Impossible de lire ce fichier.');
    } finally {
      setEnCours(false);
    }
  }

  const nomSport = (type: string) => SPORTS[cleDuType(type) as CleSport].nom;

  // « Enregistrer » dans la fenêtre : la même vérification et la même écriture que la saisie à la main
  async function enregistrer() {
    if (!lu || enregistrement) return;
    const formulaire = { ...formulaireSortieVide(filtre, familles), ...lu.champs, type: lu.type };
    const r = validerSortie(formulaire, lu.date, dateIsoLocale(new Date()), nomSport(lu.type), lu.donnees);
    if (!r.ok) return setErreurApercu(r.erreur);
    setEnregistrement(true);
    const e = await creerSortie(r.ligne);
    setEnregistrement(false);
    if (e) return setErreurApercu(e);
    viderImport();
    router.back();
  }

  // « Modifier » : le formulaire « Activité déjà faite », rempli. « replace » : en revenant en arrière on retombe sur le calendrier, pas sur ce choix de fichier.
  const modifier = () => lu && router.replace({ pathname: '/ajout-sortie', params: { date: lu.date, import: '1', ...lu.champs } });
  const annuler = () => {
    viderImport();
    router.back();
  };

  return (
    <EcranAjout bouton="Choisir un fichier" enCours={enCours} erreur={erreur} onValider={() => void choisir()}>
      <Text style={[typo.corps, { color: p.texte }]}>Choisis un fichier .fit, .gpx ou .tcx exporté par ta montre ou ton appli (Garmin, Strava, Wahoo, Coros…).</Text>
      <Text style={[typo.petit, { color: p.texteDoux }]}>
        On lit le sport, le jour et l'heure, la durée, la distance, le dénivelé et la FC moyenne quand le fichier les contient. Tu les vérifies et tu les corriges sur l'écran suivant avant d'enregistrer.
      </Text>
      {lu ? (
        <ApercuImport
          ouvert
          apercu={lu.apercu}
          sport={cleDuType(lu.type)}
          nomSport={nomSport(lu.type)}
          quand={`${formatDateCourte(lu.date)}${lu.champs.heure ? ` · ${lu.champs.heure}` : ''}`}
          km={lu.activite.distanceKm}
          enCours={enregistrement}
          erreur={erreurApercu}
          onEnregistrer={() => void enregistrer()}
          onModifier={modifier}
          onAnnuler={annuler}
        />
      ) : null}
    </EcranAjout>
  );
}
