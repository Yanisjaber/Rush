<script>
  import Champ from '../lib/components/Champ.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import { auth, connexion, demanderReinitialisation } from '../lib/stores/auth.svelte.js';

  let email = $state('');
  let motDePasse = $state('');
  let message = $state('');
  let enCours = $state(false);
  let oubli = $state(false); // true : on demande un e-mail de réinitialisation au lieu de se connecter
  let infoOubli = $state('');

  async function reinitialiser(evenement) {
    evenement.preventDefault();
    if (enCours) return;
    message = '';
    infoOubli = '';
    enCours = true;
    const r = await demanderReinitialisation(email);
    enCours = false;
    if (r.ok) infoOubli = r.message;
    else message = r.message;
  }

  async function envoyer(evenement) {
    evenement.preventDefault();
    if (enCours) return;
    message = '';
    enCours = true;
    const r = await connexion(email, motDePasse);
    enCours = false;
    if (!r.ok) {
      message = r.message;
      motDePasse = ''; // on ne garde jamais un mot de passe refusé dans le champ
    }
    // En cas de succès, le store d'authentification change et l'app affiche l'accueil toute seule.
  }
</script>

<main class="connexion">
  <div class="gauche">
    <div class="marque">
      <span class="logo titre">CI</span>
      <span class="nom">Coach IA</span>
    </div>
    <h1 class="titre">Ton entraînement,<br />enfin lisible.</h1>
    <p class="accroche">Charge, forme, objectifs et records, pour tous tes sports, au même endroit.</p>
  </div>

  {#if oubli}
    <form class="formulaire" onsubmit={reinitialiser}>
      <h2 class="titre">Mot de passe oublié</h2>
      <p class="info">Saisis ton adresse e-mail : on t'envoie un lien pour choisir un nouveau mot de passe.</p>
      <Champ id="email-oubli" label="Adresse e-mail" type="email" autocomplete="email" bind:valeur={email} requis />
      {#if message}<p class="erreur" role="alert">{message}</p>{/if}
      {#if infoOubli}<p class="info ok" role="status">{infoOubli}</p>{/if}
      <Bouton type="submit">{enCours ? 'Envoi…' : 'Envoyer le lien'}</Bouton>
      <Bouton variante="texte" onclick={() => { oubli = false; message = ''; infoOubli = ''; }}>Retour à la connexion</Bouton>
    </form>
  {:else}
    <form class="formulaire" onsubmit={envoyer}>
      <h2 class="titre">Connexion</h2>
      {#if auth.erreurLien}<p class="erreur" role="alert">{auth.erreurLien}</p>{/if}
      <Champ id="email" label="Adresse e-mail" type="email" autocomplete="email" bind:valeur={email} requis />
      <Champ id="mdp" label="Mot de passe" type="password" autocomplete="current-password" bind:valeur={motDePasse} requis />

      {#if message}<p class="erreur" role="alert">{message}</p>{/if}

      <Bouton type="submit">{enCours ? 'Connexion…' : 'Se connecter'}</Bouton>
      <Bouton variante="texte" onclick={() => { oubli = true; message = ''; auth.erreurLien = ''; }}>Mot de passe oublié ?</Bouton>
      <Bouton variante="texte" href="?demo">Voir la démo, sans compte</Bouton>
      <Bouton variante="texte" href="#/confidentialite">Confidentialité</Bouton>
    </form>
  {/if}
</main>

<style>
  .connexion {
    min-height: 100vh;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 48px 80px;
    padding: 32px;
    box-sizing: border-box;
  }
  .gauche {
    flex: 1 1 320px;
    max-width: 520px;
  }
  .marque {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 40px;
  }
  .logo {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    border-radius: var(--rayon);
    font-size: 17px;
    letter-spacing: 0;
  }
  .nom {
    font-weight: 600;
  }
  h1 {
    font-size: clamp(40px, 7vw, 68px);
    line-height: 1;
  }
  .accroche {
    margin-top: 18px;
    font-size: 18px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .formulaire {
    flex: 1 1 320px;
    max-width: 400px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 28px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  .formulaire h2 {
    font-size: 24px;
    letter-spacing: 0;
    font-weight: 700;
  }
  .erreur {
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
    color: var(--texte);
    font-size: 14px;
    border: 1px solid var(--danger);
  }
  .info {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .info.ok {
    color: var(--ok);
  }
</style>
