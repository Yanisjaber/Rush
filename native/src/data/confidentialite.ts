// Texte de la politique de confidentialité affiché dans l'app (Paramètres › Confidentialité).
// Source de vérité : docs/POLITIQUE_CONFIDENTIALITE.md. Quand on change l'un, on change l'autre, et on met à jour DATE_MAJ.

export const DATE_MAJ = '13 novembre 2026';
export const CONTACT = 'yanisjaber23@gmail.com';

export type SectionConfidentialite = {
  id: string;
  titre: string;
  /** Un paragraphe par entrée */
  paragraphes?: string[];
  /** Une puce par entrée */
  puces?: string[];
  /** Section dépliée à l'ouverture de l'écran */
  ouverte?: boolean;
};

export const SECTIONS: SectionConfidentialite[] = [
  {
    id: 'qui',
    titre: "Qui est derrière l'app",
    paragraphes: [
      "Rush est un projet personnel, géré par Yanis. Pas de publicité, pas de revente de données, pas de suivi de ton comportement. Rush est réservé aux personnes de 15 ans ou plus.",
    ],
  },
  {
    id: 'enregistre',
    titre: 'Ce qui est enregistré',
    puces: [
      'Ton compte : adresse e-mail et mot de passe (transformé en empreinte illisible : personne ne peut le relire).',
      'Tes séances : durée, distance, dénivelé, cardio, puissance, courbes, parcours GPS quand l’activité en a un.',
      'Ton sommeil et ta forme, quand tu les saisis ou quand une nuit a été importée.',
      'Ton suivi de santé, si tu le renseignes : ressenti, maladie, blessure, alcool, voyage, cycle, poids et mesures, nutrition. Rien n’est obligatoire.',
      'Ton profil : prénom, poids, fréquence cardiaque max, seuils, zones, et ta photo de profil si tu en ajoutes une (stockée dans un espace privé, visible de toi seul).',
      'Tes entraînements de force, tes tests Hyrox, tes objectifs, cycles, notes et jours de repos.',
      'Tes réglages : disposition de l’accueil, préférences.',
      'Ta conversation avec le Coach IA et ce qu’il retient pour t’aider.',
    ],
    paragraphes: [
      'Une grande partie de ces données touche à la santé (cardio, sommeil, poids, blessures, maladie, cycle). Ce sont des données sensibles : elles servent à t’afficher tes chiffres et à faire fonctionner le Coach, ne sont jamais vendues, et tu peux les supprimer à tout moment.',
    ],
  },
  {
    id: 'coach',
    titre: 'Le Coach IA',
    ouverte: true,
    puces: [
      'Pour te répondre, le Coach envoie un résumé de tes données d’entraînement (séances, charge, objectifs) à Anthropic, l’entreprise qui fournit le modèle d’IA. Les catégories de santé (cycle, corps, nutrition, événements…) ne partent que si tu les as autorisées.',
      'Ce résumé est fait de chiffres agrégés, sans ton nom, ni ton e-mail, ni ton identifiant. Ton message, lui, est transmis tel que tu l’écris : évite d’y mettre ce que tu ne veux pas partager.',
      'Au premier usage, un écran d’accord t’explique ce qui part et pourquoi. Tu peux couper une catégorie ou retirer ton accord quand tu veux.',
      'Ta conversation et la mémoire du Coach sont stockées chez Supabase, liées à ton compte. « Effacer » supprime la conversation et la mémoire.',
      'Chez Anthropic, par défaut, les échanges passés par l’API sont supprimés de leurs serveurs sous 30 jours et ne servent pas à entraîner leurs modèles.',
      'Les conseils du Coach sont des suggestions d’entraînement, pas un avis médical. En cas de douleur, de malaise ou de doute, consulte un professionnel de santé.',
      'Il y a un plafond de messages par jour et par compte.',
    ],
  },
  {
    id: 'stockage',
    titre: 'Où et qui y accède',
    puces: [
      'Les données sont stockées chez Supabase (hébergeur de la base de données), dans un centre de données en Allemagne (Francfort, Union européenne).',
      'Les e-mails de connexion et de confirmation partent par Brevo, qui reçoit ton adresse e-mail pour les transmettre, rien d’autre.',
      'Une règle de sécurité garantit que chaque compte ne voit que ses propres lignes.',
      'Yanis administre l’app et a, comme tout administrateur, un accès technique à la base.',
    ],
  },
  {
    id: 'services',
    titre: 'Les services connectés',
    puces: [
      'Strava (si tu le connectes) : l’app lit tes activités pour les afficher. Tu peux déconnecter Strava à tout moment, ou retirer l’app depuis strava.com.',
      'Garmin : aucune connexion pour l’instant. Seules les nuits déjà importées s’affichent.',
      'Hevy (si tu importes un export) : le fichier est lu sur ton appareil, seules les séances de force sont enregistrées.',
      'Open Dossard (si tu lies ta licence) : l’app interroge leur site avec ton numéro de licence.',
      'Cartes : pour afficher le parcours d’une sortie, l’app utilise Apple Plans sur iPhone (et Google Maps sur Android). Le fournisseur voit ton adresse IP et la zone affichée.',
    ],
  },
  {
    id: 'traceurs',
    titre: 'Traceurs',
    paragraphes: [
      'Aucun cookie publicitaire, aucun outil de mesure d’audience. Ton téléphone garde ta session de connexion et quelques préférences (thème, accueil) pour que l’app fonctionne.',
    ],
  },
  {
    id: 'droits',
    titre: 'Tes droits',
    puces: [
      'Récupérer tes données : « Exporter mes données » donne un fichier avec tes séances, ta santé, ta force, tes cycles, notes et réglages (pas les courbes brutes, les fichiers GPX ni les jetons de connexion).',
      'Corriger : tout ce que tu as saisi se modifie dans l’app.',
      'Tout supprimer : « Supprimer mon compte », immédiat et définitif.',
    ],
    paragraphes: ['Pour toute autre demande, écris à Yanis (voir « Contact »).'],
  },
  {
    id: 'duree',
    titre: 'Combien de temps',
    paragraphes: [
      'Tant que ton compte existe. Quand tu le supprimes, tes données sont effacées de la base. Des sauvegardes de l’hébergeur peuvent en garder une trace quelque temps.',
    ],
  },
];
