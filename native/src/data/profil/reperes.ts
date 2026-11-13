// L'évaluation physiologique de la page Profil : les 8 domaines et leurs repères (VO2max, FTP, VMA, squat…).
// Chaque repère a une valeur de référence = 100 : le meilleur niveau mondial du même sexe (« 100 = Pogačar ») ; 0 = 0.
// La note d'un repère est une règle de trois sur cette référence (voir evaluation.ts). Données pures, sans réseau.
//
// `statut` : « verifiee » quand la référence vient d'une source retrouvée et lue ; « a_confirmer » quand c'est un ordre
// de grandeur d'élite que je n'ai pas pu rattacher à une source primaire. Liste et sources : docs/native/EVALUATION_PROFIL.md.

export type DomaineCle = 'cardio' | 'endurance' | 'puissance' | 'explosivite' | 'force' | 'endurance_musc' | 'composition' | 'recuperation';

/** D'où vient la valeur : calculée sur les séances, mesurée par une montre (nuits), ou saisie à la main (test, labo, balance). */
export type Origine = 'seances' | 'montre' | 'test';

export interface Domaine {
  cle: DomaineCle;
  nom: string;
  /** Poids dans le niveau : la performance compte double, le corps et la récupération simple. */
  poids: number;
  /** Où se pose le point sur le mannequin de face (mètres : X = gauche de la personne, Y = hauteur depuis le sol). */
  point: { x: number; y: number };
}

export const DOMAINES: Domaine[] = [
  { cle: 'cardio', nom: 'Cardio-respiratoire', poids: 2, point: { x: 0.06, y: 1.3 } },
  { cle: 'endurance', nom: 'Endurance', poids: 2, point: { x: -0.1, y: 1.36 } },
  { cle: 'puissance', nom: 'Puissance et vitesse', poids: 2, point: { x: -0.1, y: 0.72 } },
  { cle: 'explosivite', nom: 'Explosivité', poids: 2, point: { x: 0.12, y: 0.38 } },
  { cle: 'force', nom: 'Force', poids: 2, point: { x: -0.25, y: 1.22 } },
  { cle: 'endurance_musc', nom: 'Endurance musculaire', poids: 2, point: { x: 0.0, y: 1.06 } },
  { cle: 'composition', nom: 'Composition corporelle', poids: 1, point: { x: 0.15, y: 0.98 } },
  { cle: 'recuperation', nom: 'Récupération', poids: 1, point: { x: 0.0, y: 1.68 } },
];

export interface Reference {
  homme: number;
  femme: number;
  /** Qui détient la référence (ou d'où vient l'ordre de grandeur). */
  qui: string;
  source: string;
  statut: 'verifiee' | 'a_confirmer';
}

export interface DefRepere {
  cle: string;
  domaine: DomaineCle;
  nom: string;
  unite: string;
  decimales: number;
  /** haut : plus c'est haut, mieux c'est ; bas : l'inverse (FC au repos, temps de sprint, masse grasse). */
  sens: 'haut' | 'bas';
  origine: Origine;
  /** Mesure de la table `health_metrics` pour une saisie à la main (voir le catalogue de santé). */
  mesure?: string;
  ref: Reference;
  /** Comment mesurer (affiché sous la saisie). */
  aide?: string;
  /** Pas encore calculé par l'app : affiché « bientôt », jamais compté. */
  aVenir?: boolean;
}

const r = (homme: number, femme: number, qui: string, source: string, statut: Reference['statut']): Reference => ({ homme, femme, qui, source, statut });

export const REPERES: DefRepere[] = [
  // --- Cardio-respiratoire -------------------------------------------------------------------------------------------
  { cle: 'vo2max', domaine: 'cardio', nom: 'VO2max', unite: 'ml/kg/min', decimales: 1, sens: 'haut', origine: 'seances', mesure: 'test_vo2max',
    ref: r(97.5, 78.6, 'O. Svendsen / J. Benoit', 'topendsports.com, records de VO2max mesurés', 'verifiee'),
    aide: 'Estimée depuis ta PMA ou ta VMA ; un test en labo (ou la valeur de ta montre) la remplace.' },
  { cle: 'fc_repos', domaine: 'cardio', nom: 'FC au repos', unite: 'bpm', decimales: 0, sens: 'bas', origine: 'montre',
    ref: r(28, 32, 'M. Induráin (28 bpm rapportés)', 'Polar, BikeRadar ; valeur femme non trouvée', 'a_confirmer'),
    aide: 'Médiane de tes nuits des 30 derniers jours (montre) ; sinon ta saisie dans Physiologie.' },
  { cle: 'hrv', domaine: 'cardio', nom: 'HRV (rMSSD)', unite: 'ms', decimales: 0, sens: 'haut', origine: 'montre',
    ref: r(150, 150, "Ordre de grandeur d'athlètes d'endurance élites", 'à sourcer', 'a_confirmer'),
    aide: 'Médiane de tes nuits des 30 derniers jours (montre) ; sinon ta saisie dans Physiologie.' },
  { cle: 'recup_fc', domaine: 'cardio', nom: 'Récupération cardiaque (1 min)', unite: 'bpm', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_recup_fc',
    ref: r(60, 60, "Ordre de grandeur d'athlètes d'endurance élites", 'à sourcer', 'a_confirmer'),
    aide: 'Après un effort maximal, combien de battements tu perds en 1 minute, debout et immobile.' },
  { cle: 'sv1', domaine: 'cardio', nom: 'Seuil ventilatoire 1', unite: '% VO2max', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_sv1_pct',
    ref: r(80, 80, 'Athlètes élites (SV1 vers 75-80 %)', 'à sourcer', 'a_confirmer'), aide: 'Donné par un test d’effort en labo.' },
  { cle: 'sv2', domaine: 'cardio', nom: 'Seuil ventilatoire 2', unite: '% VO2max', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_sv2_pct',
    ref: r(92, 92, 'Athlètes élites (SV2 vers 88-92 %)', 'à sourcer', 'a_confirmer'), aide: 'Donné par un test d’effort en labo.' },

  // --- Endurance ----------------------------------------------------------------------------------------------------
  { cle: 'ftp', domaine: 'endurance', nom: 'FTP', unite: 'W/kg', decimales: 2, sens: 'haut', origine: 'seances',
    ref: r(7.0, 5.7, 'T. Pogačar (~7 W/kg sur 40 min, 2024) / Coggan « world class »', 'BikeRadar 2024 ; table de Coggan (reprise par Rouvy)', 'a_confirmer'),
    aide: '95 % de ta meilleure puissance sur 20 min, divisé par ton poids ; sinon ta FTP saisie.' },
  { cle: 'cp', domaine: 'endurance', nom: 'Puissance critique', unite: 'W/kg', decimales: 2, sens: 'haut', origine: 'seances',
    ref: r(7.0, 5.7, 'Même référence que la FTP', 'voir FTP', 'a_confirmer'), aide: 'Modèle à deux paramètres sur tes meilleurs efforts de 3 à 20 min.' },
  { cle: 'vitesse_seuil', domaine: 'endurance', nom: 'Vitesse sur 1 h (course)', unite: 'km/h', decimales: 1, sens: 'haut', origine: 'seances',
    ref: r(21.33, 18.93, 'Record de l’heure : M. Farah 21 330 m / S. Hassan 18 930 m (2020)', 'World Athletics', 'verifiee'),
    aide: 'Ta meilleure distance courue en 1 h ; sinon ta vitesse seuil saisie.' },
  { cle: 'seuil_fc', domaine: 'endurance', nom: 'Seuil en % de la FC max', unite: '%', decimales: 0, sens: 'haut', origine: 'test',
    ref: r(93, 93, 'Athlètes élites (seuil vers 90-93 % de la FC max)', 'à sourcer', 'a_confirmer'), aide: 'Ta FC au seuil divisée par ta FC max (Physiologie).' },
  { cle: 'natation_seuil', domaine: 'endurance', nom: 'Allure natation (séance de 1 km et plus)', unite: 'km/h', decimales: 2, sens: 'haut', origine: 'seances',
    ref: r(6.2, 5.87, 'Record du 1 500 m : B. Wiffen 14:30.67 / K. Ledecky 15:20.48', 'World Aquatics', 'a_confirmer'),
    aide: 'Ta séance de natation d’au moins 1 km la plus rapide (allure moyenne).' },
  { cle: 'durabilite', domaine: 'endurance', nom: 'Durabilité', unite: '%', decimales: 0, sens: 'haut', origine: 'seances',
    ref: r(100, 100, 'Aucune perte de puissance après 2 h', 'à sourcer', 'a_confirmer'), aide: 'Ce que tu gardes de ta puissance après 2 h d’effort.', aVenir: true },

  // --- Puissance et vitesse -----------------------------------------------------------------------------------------
  { cle: 'pma', domaine: 'puissance', nom: 'PMA (5 min)', unite: 'W/kg', decimales: 2, sens: 'haut', origine: 'seances',
    ref: r(7.6, 6.61, 'Table de Coggan, « world class » 5 min', 'Coggan & Allen, Training and Racing with a Power Meter', 'a_confirmer'),
    aide: 'Ta meilleure puissance tenue 5 min, divisée par ton poids.' },
  { cle: 'vma', domaine: 'puissance', nom: 'VMA', unite: 'km/h', decimales: 1, sens: 'haut', origine: 'seances',
    ref: r(24.7, 22.2, 'Record du 3 000 m : J. Ingebrigtsen 7:17.55 / Wang Junxia 8:06.11', 'World Athletics', 'a_confirmer'),
    aide: 'Ta meilleure vitesse tenue 6 min en course ; sinon ta VMA saisie.' },
  { cle: 'p5s', domaine: 'puissance', nom: 'Sprint 5 s', unite: 'W/kg', decimales: 1, sens: 'haut', origine: 'seances',
    ref: r(24.0, 19.4, 'Table de Coggan, « world class » 5 s', 'Coggan & Allen', 'a_confirmer'), aide: 'Ta meilleure puissance sur 5 s, divisée par ton poids.' },
  { cle: 'p1min', domaine: 'puissance', nom: 'Puissance 1 min', unite: 'W/kg', decimales: 1, sens: 'haut', origine: 'seances',
    ref: r(11.5, 9.3, 'Table de Coggan, « world class » 1 min', 'Coggan & Allen', 'a_confirmer'), aide: 'Ta meilleure puissance sur 1 min, divisée par ton poids.' },
  { cle: 'wprime', domaine: 'puissance', nom: 'W’ (réserve anaérobie)', unite: 'kJ', decimales: 1, sens: 'haut', origine: 'seances',
    ref: r(35, 25, 'Ordre de grandeur de coureurs élites', 'à sourcer', 'a_confirmer'), aide: 'Calculé avec la puissance critique ; sinon ta valeur saisie.' },
  { cle: 'sprint30', domaine: 'puissance', nom: 'Sprint 30 m', unite: 's', decimales: 2, sens: 'bas', origine: 'test', mesure: 'test_sprint30_s',
    ref: r(3.7, 4.1, 'Sprinteurs mondiaux (passage aux 30 m)', 'à sourcer', 'a_confirmer'), aide: 'Départ arrêté, chronométré (cellules ou un ami avec un chrono).' },
  { cle: 'nat100', domaine: 'puissance', nom: '100 m nage libre', unite: 's', decimales: 1, sens: 'bas', origine: 'test', mesure: 'test_nat100_s',
    ref: r(46.4, 51.71, 'Records du monde : Pan Zhanle 46.40 / S. Sjöström 51.71', 'World Aquatics', 'a_confirmer'), aide: 'Ton meilleur 100 m chronométré en bassin.' },

  // --- Explosivité --------------------------------------------------------------------------------------------------
  { cle: 'cmj', domaine: 'explosivite', nom: 'Saut vertical (CMJ)', unite: 'cm', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_cmj_cm',
    ref: r(75, 55, 'Athlètes de sports explosifs de haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Mains sur les hanches, flexion puis saut : hauteur du saut (appli de saut ou tapis).' },
  { cle: 'saut_longueur', domaine: 'explosivite', nom: 'Saut en longueur sans élan', unite: 'cm', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_saut_long_cm',
    ref: r(371, 300, 'A. Tvervaag 3,71 m (1968) ; valeur femme non trouvée', 'topendsports.com', 'a_confirmer'), aide: 'Pieds joints, sans élan : du bord de départ au talon le plus proche.' },

  // --- Force (rapportée au poids du corps) --------------------------------------------------------------------------
  { cle: 'squat', domaine: 'force', nom: 'Squat (1RM / poids)', unite: '× poids', decimales: 2, sens: 'haut', origine: 'test', mesure: 'test_rm_squat_kg',
    ref: r(3.5, 2.8, 'Haltérophiles et powerlifters de haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Ta charge max sur 1 répétition ; sinon estimée depuis tes séries (formule d’Epley).' },
  { cle: 'developpe_couche', domaine: 'force', nom: 'Développé couché (1RM / poids)', unite: '× poids', decimales: 2, sens: 'haut', origine: 'test', mesure: 'test_rm_dc_kg',
    ref: r(2.3, 1.4, 'Powerlifters de haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Ta charge max sur 1 répétition ; sinon estimée depuis tes séries.' },
  { cle: 'souleve_de_terre', domaine: 'force', nom: 'Soulevé de terre (1RM / poids)', unite: '× poids', decimales: 2, sens: 'haut', origine: 'test', mesure: 'test_rm_sdt_kg',
    ref: r(4.0, 3.0, 'Powerlifters de haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Ta charge max sur 1 répétition ; sinon estimée depuis tes séries.' },
  { cle: 'developpe_militaire', domaine: 'force', nom: 'Développé militaire (1RM / poids)', unite: '× poids', decimales: 2, sens: 'haut', origine: 'test', mesure: 'test_rm_dm_kg',
    ref: r(1.4, 0.9, 'Athlètes de force de haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Ta charge max sur 1 répétition ; sinon estimée depuis tes séries.' },
  { cle: 'tractions', domaine: 'force', nom: 'Tractions (max)', unite: 'rép.', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_tractions',
    ref: r(40, 20, 'Gymnastes et grimpeurs de haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Prise pronation, bras tendus en bas, menton au-dessus de la barre, sans élan.' },
  { cle: 'pompes', domaine: 'force', nom: 'Pompes (max)', unite: 'rép.', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_pompes',
    ref: r(100, 60, 'Ordre de grandeur de très haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Corps gainé, poitrine à un poing du sol, sans pause.' },
  { cle: 'prehension', domaine: 'force', nom: 'Force de préhension', unite: 'kg', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_prehension_kg',
    ref: r(80, 50, 'Athlètes de force de haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Main dominante, avec un dynamomètre.' },

  // --- Endurance musculaire -----------------------------------------------------------------------------------------
  { cle: 'gainage', domaine: 'endurance_musc', nom: 'Gainage (planche)', unite: 's', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_gainage_s',
    ref: r(600, 600, 'Plafond fixé à 10 min (les records du monde durent des heures)', 'choix Rush', 'a_confirmer'), aide: 'Sur les avant-bras, corps aligné, jusqu’à ce que le bassin tombe.' },
  { cle: 'squats_1min', domaine: 'endurance_musc', nom: 'Squats en 1 min', unite: 'rép.', decimales: 0, sens: 'haut', origine: 'test', mesure: 'test_squats_1min',
    ref: r(60, 55, 'Ordre de grandeur de très haut niveau', 'à sourcer', 'a_confirmer'), aide: 'Cuisses parallèles au sol à chaque répétition.' },

  // --- Composition corporelle ---------------------------------------------------------------------------------------
  { cle: 'masse_grasse', domaine: 'composition', nom: 'Masse grasse', unite: '%', decimales: 1, sens: 'bas', origine: 'test', mesure: 'masse_grasse_pct',
    ref: r(6, 14, 'Athlètes d’endurance élites', 'à sourcer', 'a_confirmer'), aide: 'Balance à impédance ou pince : la dernière mesure de l’onglet Santé.' },
  { cle: 'tour_taille', domaine: 'composition', nom: 'Tour de taille / taille', unite: '', decimales: 2, sens: 'bas', origine: 'test', mesure: 'tour_taille_cm',
    ref: r(0.4, 0.4, 'Athlètes élites (rapport taille / hauteur vers 0,40)', 'à sourcer', 'a_confirmer'), aide: 'Tour de taille au nombril, divisé par ta taille (Identité).' },
  { cle: 'part_muscle', domaine: 'composition', nom: 'Part de muscle', unite: '%', decimales: 0, sens: 'haut', origine: 'test', mesure: 'masse_musculaire_kg',
    ref: r(50, 42, 'Athlètes élites', 'à sourcer', 'a_confirmer'), aide: 'Masse musculaire (balance) divisée par ton poids.' },

  // --- Récupération -------------------------------------------------------------------------------------------------
  { cle: 'sommeil', domaine: 'recuperation', nom: 'Sommeil moyen (30 j)', unite: 'h', decimales: 1, sens: 'haut', origine: 'montre',
    ref: r(9, 9, 'Recommandation pour les athlètes : 8 à 10 h', 'à sourcer', 'a_confirmer'), aide: 'La moyenne de tes nuits des 30 derniers jours.' },
  { cle: 'hrv_tendance', domaine: 'recuperation', nom: 'Tendance HRV (7 j / 60 j)', unite: '%', decimales: 0, sens: 'haut', origine: 'montre',
    ref: r(110, 110, 'Méthode Rush : 10 % au-dessus de ta référence = 100', 'choix Rush', 'a_confirmer'), aide: 'Ta HRV des 7 derniers jours comparée à celle des 60 derniers.' },
  { cle: 'regularite', domaine: 'recuperation', nom: 'Régularité (28 j)', unite: 'jours', decimales: 0, sens: 'haut', origine: 'seances',
    ref: r(24, 24, 'Pros : 6 jours d’entraînement par semaine', 'à sourcer', 'a_confirmer'), aide: 'Nombre de jours avec au moins une séance sur les 28 derniers.' },
];

export const domaineDe = (cle: DomaineCle): Domaine => DOMAINES.find((d) => d.cle === cle) as Domaine;
export const reperesDu = (cle: DomaineCle): DefRepere[] => REPERES.filter((r) => r.domaine === cle);
