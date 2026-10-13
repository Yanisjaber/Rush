<script>
  // Texte de la politique de confidentialité : ce que Coach IA enregistre, où, qui y accède, et comment récupérer ou
  // supprimer ses données. Utilisé dans Paramètres › Confidentialité et sur la page publique #/confidentialite.
  // La date de mise à jour est à changer à chaque modification du texte.
  export const DATE_MAJ = '13 octobre 2026';
</script>

<p class="maj">Dernière mise à jour : {DATE_MAJ}</p>

<div class="texte">
  <section>
    <h2>Qui est derrière l'app</h2>
    <p>Coach IA est un projet personnel, géré par Yanis. Ce n'est pas une entreprise : pas de publicité, pas de revente de données, pas de suivi de ton comportement.</p>
  </section>

  <section>
    <h2>Ce qui est enregistré</h2>
    <ul>
      <li><strong>Ton compte</strong> : ton adresse e-mail et ton mot de passe (le mot de passe est transformé en une empreinte illisible : personne ne peut le relire).</li>
      <li><strong>Tes séances</strong> : durée, distance, dénivelé, cardio, puissance, courbes, et le parcours GPS quand ton activité en a un.</li>
      <li><strong>Ton sommeil</strong> et ta forme, si tu connectes Garmin.</li>
      <li><strong>Ton profil</strong> : poids, fréquence cardiaque max, seuils, zones.</li>
      <li><strong>Tes entraînements de force</strong> (programmes, exercices, séries, charges), tes <strong>tests Hyrox</strong>, tes objectifs, tes notes, tes jours de repos.</li>
      <li><strong>Tes réglages</strong> : la disposition de ton accueil, tes préférences.</li>
    </ul>
    <p>Une partie de ces données touche à la santé (cardio, sommeil, poids). Elles sont traitées avec le même soin que le reste et ne servent qu'à t'afficher tes propres chiffres.</p>
  </section>

  <section>
    <h2>Où et qui y accède</h2>
    <ul>
      <li>Les données sont stockées chez <strong>Supabase</strong>, le service qui héberge la base de données de l'app.</li>
      <li>Une règle de sécurité dans la base garantit que <strong>chaque compte ne voit que ses propres lignes</strong>. Un autre utilisateur de l'app ne peut pas lire les tiennes.</li>
      <li>Yanis administre l'app et a, comme tout administrateur, un accès technique à la base. Si tu as une question sur l'usage de tes données, demande-lui directement.</li>
    </ul>
  </section>

  <section>
    <h2>Les services connectés</h2>
    <ul>
      <li><strong>Strava</strong> (si tu le connectes) : l'app lit tes activités pour les afficher. Tu peux déconnecter Strava à tout moment dans Paramètres › Connexions, ou retirer l'app depuis tes réglages sur strava.com.</li>
      <li><strong>Garmin</strong> (si tu le connectes) : le sommeil est récupéré par un petit programme que fait tourner Yanis.</li>
      <li><strong>Open Dossard</strong> (si tu lies ta licence) : l'app interroge leur site avec ton numéro de licence pour afficher tes résultats.</li>
      <li><strong>OpenStreetMap</strong> : pour afficher une carte, ton navigateur télécharge des images de carte sur leurs serveurs, qui voient donc ton adresse IP et la zone affichée.</li>
    </ul>
  </section>

  <section>
    <h2>Cookies et traceurs</h2>
    <p>Aucun cookie publicitaire, aucun outil de mesure d'audience. Ton navigateur garde seulement ta session de connexion et quelques préférences (thème, disposition de l'accueil) pour que l'app fonctionne.</p>
  </section>

  <section>
    <h2>Tes droits</h2>
    <ul>
      <li><strong>Récupérer tes données</strong> : Paramètres › Général › « Exporter mes données » te donne un fichier avec tout.</li>
      <li><strong>Corriger</strong> : tout ce que tu as saisi se modifie dans l'app.</li>
      <li><strong>Tout supprimer</strong> : Paramètres › Général › « Supprimer mon compte et mes données ». C'est immédiat et définitif.</li>
    </ul>
    <p>Pour toute autre demande, contacte Yanis directement.</p>
  </section>

  <section>
    <h2>Combien de temps</h2>
    <p>Tant que ton compte existe. Quand tu le supprimes, tes données sont effacées de la base. Des sauvegardes de l'hébergeur peuvent en garder une trace quelque temps avant de s'effacer à leur tour.</p>
  </section>
</div>

<style>
  .maj {
    margin: 0 0 20px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .texte {
    max-width: 720px;
  }
  .texte :global(section:first-child) {
    border-top: 0;
    padding-top: 0;
  }
  section {
    padding: 22px 0;
    border-top: 1px solid var(--trait);
  }
  h2 {
    margin: 0 0 10px;
    font-size: 20px;
  }
  p,
  li {
    font-size: 15px;
    line-height: 1.6;
    color: var(--texte-doux);
  }
  p {
    margin: 0 0 10px;
  }
  ul {
    margin: 0 0 10px;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  strong {
    color: var(--texte);
    font-weight: 600;
  }
</style>
