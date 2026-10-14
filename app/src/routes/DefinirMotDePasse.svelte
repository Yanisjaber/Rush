<script>
  import Champ from '../lib/components/Champ.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import { auth, changerMotDePasse, deconnexion } from '../lib/stores/auth.svelte.js';
  import { MDP_MIN } from '../lib/data/lien-auth.js';

  // Choisir ou changer son mot de passe. Deux cas :
  //  - on arrive par un lien reçu par e-mail (invitation, mot de passe oublié) : auth.definirMdp vaut true ;
  //  - on est déjà connecté et on veut en changer (#/mot-de-passe).
  const arrivee = $derived(auth.definirMdp);
  let mdp = $state('');
  let confirmation = $state('');
  let message = $state('');
  let fait = $state(false);
  let enCours = $state(false);

  async function envoyer(e) {
    e.preventDefault();
    if (enCours) return;
    message = '';
    enCours = true;
    const r = await changerMotDePasse(mdp, confirmation);
    enCours = false;
    mdp = '';
    confirmation = '';
    if (!r.ok) return (message = r.message);
    fait = true;
  }
</script>

<main class="page-mdp">
  <form class="formulaire" onsubmit={envoyer}>
    <div class="marque"><span class="logo titre">R</span><span class="nom">Rush</span></div>
    {#if fait}
      <h1 class="titre">C'est fait.</h1>
      <p class="aide" role="status">Ton mot de passe est enregistré. Tu pourras l'utiliser à ta prochaine connexion.</p>
      <Bouton href="#/">Aller à mon accueil</Bouton>
    {:else}
      <h1 class="titre">{arrivee ? 'Choisis ton mot de passe' : 'Changer mon mot de passe'}</h1>
      <p class="aide">{MDP_MIN} caractères au moins. Une phrase facile à retenir marche très bien.</p>
      <Champ id="nouveau-mdp" label="Nouveau mot de passe" type="password" autocomplete="new-password" bind:valeur={mdp} requis />
      <Champ id="confirmation-mdp" label="Confirme-le" type="password" autocomplete="new-password" bind:valeur={confirmation} requis />
      {#if message}<p class="erreur" role="alert">{message}</p>{/if}
      <Bouton type="submit">{enCours ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      {#if arrivee}
        <Bouton variante="texte" onclick={deconnexion}>Me déconnecter</Bouton>
      {:else}
        <Bouton variante="texte" href="#/parametres">Annuler</Bouton>
      {/if}
    {/if}
  </form>
</main>

<style>
  .page-mdp {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    box-sizing: border-box;
  }
  .formulaire {
    width: min(420px, 100%);
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 28px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  .marque {
    display: flex;
    align-items: center;
    gap: 12px;
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
    font-weight: 700;
  }
  h1 {
    font-size: 28px;
    line-height: 1.1;
  }
  .aide {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .erreur {
    margin: 0;
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    font-size: 14px;
  }
</style>
