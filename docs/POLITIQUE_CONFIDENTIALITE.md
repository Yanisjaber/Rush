# Politique de confidentialité de Rush (brouillon à valider)

Source de vérité du texte. Reprend la page du site (`app/src/lib/parametres/Confidentialite.svelte`, mise à jour le 28 oct. 2026) et ajoute ce qui manquait : le Coach IA, la photo de profil et l'app mobile.
Les points encore marqués **[À VÉRIFIER]** sont à confirmer avant publication. Ce n'est pas un avis juridique.

---

**Dernière mise à jour : 13 novembre 2026**

## Qui est derrière l'app

Rush est un projet personnel, géré par Yanis. Pas de publicité, pas de revente de données, pas de suivi de ton comportement. Rush existe en application mobile (et en site web) : même compte, mêmes données, mêmes règles.

## Ce qui est enregistré

- **Ton compte** : adresse e-mail et mot de passe (transformé en empreinte illisible : personne ne peut le relire).
- **Tes séances** : durée, distance, dénivelé, cardio, puissance, courbes, parcours GPS quand l'activité en a un.
- **Ton sommeil et ta forme**, quand tu les saisis ou quand une nuit a été importée.
- **Ton suivi de santé**, si tu le renseignes : ressenti, maladie, blessure, alcool, voyage, cycle, poids et mesures, nutrition. Rien n'est obligatoire.
- **Ton profil** : prénom, poids, fréquence cardiaque max, seuils, zones, et ta **photo de profil** si tu en ajoutes une (stockée dans un espace privé, visible de toi seul).
- **Tes entraînements** de force, tes tests Hyrox, tes objectifs, cycles, notes, jours de repos.
- **Tes réglages** : disposition de l'accueil, préférences.
- **Ta conversation avec le Coach IA** et ce qu'il retient de toi pour t'aider (voir plus bas).

Une grande partie de ces données touche à la santé (cardio, sommeil, poids, blessures, maladie, cycle). Ce sont des données sensibles : elles servent à t'afficher tes chiffres et à faire fonctionner le Coach, ne sont jamais vendues, et tu peux les supprimer à tout moment.

## Le Coach IA

- Pour te répondre, le Coach envoie un **résumé de tes données d'entraînement** (séances, charge, objectifs) à **Anthropic**, l'entreprise qui fournit le modèle d'IA. Les catégories de santé (cycle, corps, nutrition, événements…) ne partent **que si tu les as autorisées**.
- Ce résumé est fait de **chiffres agrégés, sans ton nom, ni ton e-mail, ni ton identifiant**. Ton message, lui, est transmis tel que tu l'écris : évite d'y mettre des informations que tu ne veux pas partager.
- Au premier usage, un **écran d'accord** t'explique ce qui part et pourquoi. Tu peux couper une catégorie ou retirer ton accord quand tu veux : le Coach continue alors avec les données restantes, ou s'arrête si tu retires tout.
- Ta conversation et la mémoire du Coach sont stockées chez Supabase, liées à ton compte. Le bouton « Effacer » supprime la conversation et la mémoire.
- Les conseils du Coach sont des **suggestions d'entraînement**, pas un avis médical. En cas de douleur, de malaise ou de doute, consulte un professionnel de santé.
- Il y a un plafond de messages par jour et par compte.
- **Chez Anthropic** : par défaut, les échanges passés par l'API sont supprimés de leurs serveurs sous 30 jours, et ne servent pas à entraîner leurs modèles (conditions commerciales d'Anthropic, page « How long do you store my organization's data », mise à jour du 1er juillet 2026). *À relire si Anthropic change ses conditions.*

## Où et qui y accède

- Les données sont stockées chez **Supabase** (hébergeur de la base de données), dans un centre de données en **Allemagne (Francfort, Union européenne)**.
- Les e-mails de connexion et de confirmation partent par **Brevo**, qui reçoit ton adresse e-mail pour les transmettre, rien d'autre.
- Une règle de sécurité garantit que **chaque compte ne voit que ses propres lignes**.
- Yanis administre l'app et a, comme tout administrateur, un accès technique à la base.

## Les services connectés

- **Strava** (si tu le connectes) : l'app lit tes activités pour les afficher. Tu peux déconnecter Strava à tout moment ou retirer l'app depuis strava.com.
- **Garmin** : aucune connexion pour l'instant. Seules les nuits déjà importées s'affichent.
- **Hevy** (si tu importes un export) : le fichier est lu sur ton appareil, seules les séances de force sont enregistrées.
- **Open Dossard** (si tu lies ta licence) : l'app interroge leur site avec ton numéro de licence.
- **Cartes** : pour afficher le parcours d'une sortie, l'app utilise **Apple Plans** sur iPhone (et **Google Maps** sur Android, quand l'app Android sortira). Le fournisseur voit ton adresse IP et la zone affichée.

## Traceurs

Aucun cookie publicitaire, aucun outil de mesure d'audience. Ton téléphone garde ta session de connexion et quelques préférences (thème, accueil) pour que l'app fonctionne. **[À VÉRIFIER]** si on ajoute un suivi des plantages (tâche prévue), le dire ici.

## Tes droits

- **Récupérer tes données** : Paramètres › « Exporter mes données » (fichier avec tes séances, santé, force, Hyrox, cycles, notes, réglages ; pas les courbes brutes, les GPX, ni les jetons).
- **Corriger** : tout ce que tu as saisi se modifie dans l'app.
- **Tout supprimer** : « Supprimer mon compte et mes données », immédiat et définitif.
- Autre demande : écris à Yanis.

## Combien de temps

Tant que ton compte existe. Quand tu le supprimes, tes données sont effacées de la base. Des sauvegardes de l'hébergeur peuvent en garder une trace quelque temps.

## Âge minimum

Rush est réservé aux personnes de **15 ans ou plus** (âge à partir duquel un jeune peut consentir seul au traitement de ses données en France). En dessous, il faut l'accord d'un parent, et l'app n'est pas faite pour ça.

## Contact

Une question, une demande d'accès, de correction ou de suppression ? Écris à Yanis : yanisjaber23@gmail.com. *(Une adresse dédiée à Rush remplacera celle-ci quand le domaine sera pris, en fin de projet : tâche « E-mails de confirmation ».)*
