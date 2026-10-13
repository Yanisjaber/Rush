<script>
  // Page publique « Confidentialité » (#/confidentialite), lisible sans connexion : on la lit avant de se créer un compte.
  // Une fois connecté, la même chose est dans Paramètres › Confidentialité.
  import Texte from '../lib/parametres/Confidentialite.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  const connecte = $derived(!!auth.session);
</script>

<main class="page">
  <p class="retour"><a href={connecte ? '#/parametres/confidentialite' : '#/'}>← Retour</a></p>
  <h1 class="titre">Confidentialité</h1>
  <Texte />
</main>

<style>
  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 20px 64px;
  }
  .retour {
    margin: 0 0 16px;
    font-size: 14px;
  }
  .retour a {
    color: var(--texte-doux);
  }
  h1 {
    margin-bottom: 14px;
    font-size: clamp(34px, 6vw, 48px);
    line-height: 1;
  }
</style>
