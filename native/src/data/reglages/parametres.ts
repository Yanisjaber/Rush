// Le résumé de la page Paramètres : ce que chaque tuile affiche (une valeur clé et une jauge « rempli sur total »), calculé à partir du profil,
// des sports cochés et du statut Strava. Fonctions pures, sans réseau, testées. Les zones restent recalculées, jamais stockées.
import { calculerAge, referenceCardio, sectionParId, valeursDepuis, type LigneProfil } from './profil.ts';

export interface Tuile {
  /** La valeur clé en gros (« 19 », « 196 », « 2/3 ») ; « — » si rien n'est renseigné. */
  valeur: string;
  unite?: string;
  /** Une courte précision (« 1,80 m · 72 kg »), vide si rien à dire. */
  note: string;
  /** Combien de champs importants sont renseignés, sur combien : dessine les points de complétion. */
  remplis: number;
  total: number;
}

export interface Connexion {
  /** « connecte », « erreur » ou « absente » : la couleur de la pastille. */
  etat: 'connecte' | 'erreur' | 'absente';
  note: string;
}

export interface ResumeParametres {
  prenom: string;
  profil: Tuile;
  physiologie: Tuile;
  zones: Tuile;
  sports: Tuile;
  connexions: Connexion;
}

interface Entree {
  ligne: LigneProfil | null | undefined;
  nbSports: number;
  /** Les deux premiers noms de sports cochés (« Course, Vélo »), pour la note. */
  nomsSports?: string[];
  strava: { last_sync_status: string | null; athlete_name: string | null } | null;
}

const rempli = (v: string | boolean | undefined) => typeof v === 'string' && v.trim() !== '';

/** Les champs de l'identité et de la physiologie qui comptent pour la complétion (pas tous : un profil « complet » n'a pas besoin des records de natation). */
const CLES_IDENTITE = ['first_name', 'birth_date', 'sex', 'height', 'weight'];
const CLES_PHYSIO = ['hr_max', 'rhr', 'lthr', 'ftp', 'vma'];

export function resumeParametres({ ligne, nbSports, nomsSports = [], strava }: Entree): ResumeParametres {
  const identite = valeursDepuis(ligne, sectionParId('identite') as NonNullable<ReturnType<typeof sectionParId>>);
  const physio = valeursDepuis(ligne, sectionParId('physiologie') as NonNullable<ReturnType<typeof sectionParId>>);
  const age = calculerAge(identite.birth_date);
  const taille = rempli(identite.height) ? `${identite.height} cm` : '';
  const poids = rempli(identite.weight) ? `${String(identite.weight).replace('.', ',')} kg` : '';

  const profil: Tuile = {
    valeur: age != null ? String(age) : rempli(identite.first_name) ? String(identite.first_name) : '—',
    unite: age != null ? 'ans' : undefined,
    note: [taille, poids].filter(Boolean).join(' · '),
    remplis: CLES_IDENTITE.filter((c) => rempli(identite[c])).length,
    total: CLES_IDENTITE.length,
  };

  const ftp = rempli(physio.ftp) ? `FTP ${physio.ftp} W` : '';
  const vma = rempli(physio.vma) ? `VMA ${String(physio.vma).replace('.', ',')}` : '';
  const physiologie: Tuile = {
    valeur: rempli(physio.hr_max) ? String(physio.hr_max) : '—',
    unite: rempli(physio.hr_max) ? 'bpm max' : undefined,
    note: [ftp, vma].filter(Boolean).join(' · '),
    remplis: CLES_PHYSIO.filter((c) => rempli(physio[c])).length,
    total: CLES_PHYSIO.length,
  };

  // Trois modèles de zones : puissance (FTP), cardio (FC au seuil ou estimée depuis la FC max), allure (vitesse seuil)
  const prets = [
    { nom: 'Puissance', ok: Number(physio.ftp) > 0 },
    { nom: 'Cardio', ok: referenceCardio({ lthr: physio.lthr, hr_max: physio.hr_max }) != null },
    { nom: 'Allure', ok: Number(ligne?.extras?.threshold_speed) > 0 },
  ];
  const zones: Tuile = {
    valeur: prets.some((x) => x.ok) ? `${prets.filter((x) => x.ok).length}/3` : '—',
    note: prets.filter((x) => x.ok).map((x) => x.nom).join(' · '),
    remplis: prets.filter((x) => x.ok).length,
    total: 3,
  };

  const sports: Tuile = {
    valeur: nbSports > 0 ? String(nbSports) : '—',
    unite: nbSports > 1 ? 'sports' : nbSports === 1 ? 'sport' : undefined,
    note: nomsSports.slice(0, 2).join(' · ') + (nomsSports.length > 2 ? ' …' : ''),
    remplis: nbSports > 0 ? 1 : 0,
    total: 1,
  };

  const connexions: Connexion = !strava
    ? { etat: 'absente', note: 'Strava non connecté' }
    : strava.last_sync_status === 'error'
      ? { etat: 'erreur', note: 'Strava : erreur de synchro' }
      : { etat: 'connecte', note: strava.athlete_name ? `Strava · ${strava.athlete_name}` : 'Strava connecté' };

  return { prenom: rempli(identite.first_name) ? String(identite.first_name) : '', profil, physiologie, zones, sports, connexions };
}
