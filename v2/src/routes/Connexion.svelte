<script>
  import Champ from '../lib/components/Champ.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import Dialogue from '../lib/components/Dialogue.svelte';
  import { auth, connexion, demanderReinitialisation, inscription } from '../lib/stores/auth.svelte.js';

  let email = $state('');
  let motDePasse = $state('');
  let message = $state('');
  let enCours = $state(false);
  let oubli = $state(false); // true : on demande un e-mail de réinitialisation au lieu de se connecter
  let infoOubli = $state('');
  let creer = $state(false); // true : formulaire « Créer un compte »
  let prenom = $state('');
  let nom = $state('');
  let consentement = $state(false);
  let popup = $state(false); // pop-up « e-mail envoyé » après une inscription réussie
  let popupExiste = $state(false); // pop-up « cette adresse a déjà un compte »
  let erreurs = $state({}); // erreur par champ : prenom, nom, email, mdp, consentement

  async function creerCompte(evenement) {
    evenement.preventDefault();
    if (enCours) return;
    message = '';
    erreurs = {};
    enCours = true;
    const r = await inscription({ prenom, nom, email, motDePasse, consentement });
    enCours = false;
    if (r.ok && r.existe) {
      popupExiste = true;
    } else if (r.ok) {
      popup = true;
      motDePasse = ''; // inscription réussie : on ne garde pas le mot de passe en mémoire
      prenom = '';
      nom = '';
      consentement = false;
    } else if (r.champ) erreurs = { [r.champ]: r.message };
    else message = r.message;
  }

  /** « Cette adresse a déjà un compte » : on ferme et on revient à la connexion (e-mail déjà rempli). */
  function versConnexion() {
    popupExiste = false;
    creer = false;
    message = '';
    erreurs = {};
  }

  /** Idem, mais direct vers « Mot de passe oublié ». */
  function versOubli() {
    versConnexion();
    oubli = true;
  }

  /** Ferme la pop-up et revient à l'écran de connexion (l'e-mail reste rempli). */
  function fermerPopup() {
    popup = false;
    creer = false;
  }

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
    if (!r.ok) message = r.message; // on garde la saisie pour que tu puisses la corriger (l'œil sert à vérifier)
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

  {#if creer}
    <form class="formulaire" novalidate onsubmit={creerCompte}>
      <h2 class="titre">Créer un compte</h2>
      <Champ id="prenom" label="Prénom" autocomplete="given-name" maxlength={60} bind:valeur={prenom} erreur={erreurs.prenom} requis />
      <Champ id="nom" label="Nom" autocomplete="family-name" maxlength={60} bind:valeur={nom} erreur={erreurs.nom} requis />
      <Champ id="email-creation" label="Adresse e-mail" type="email" autocomplete="email" bind:valeur={email} erreur={erreurs.email} requis />
      <Champ id="mdp-creation" label="Mot de passe (10 caractères minimum)" type="password" autocomplete="new-password" bind:valeur={motDePasse} erreur={erreurs.mdp} requis />
      <label class="consentement">
        <input type="checkbox" bind:checked={consentement} required />
        <span>J'ai lu la <a href="#/confidentialite" target="_blank" rel="noopener">politique de confidentialité</a> et je l'accepte.</span>
      </label>
      {#if erreurs.consentement}<p class="erreur-champ" role="alert">{erreurs.consentement}</p>{/if}
      {#if message}<p class="erreur" role="alert">{message}</p>{/if}
      <Bouton type="submit">{enCours ? 'Création…' : 'Créer mon compte'}</Bouton>
      <Bouton variante="texte" onclick={() => { creer = false; message = ''; erreurs = {}; }}>J'ai déjà un compte</Bouton>
    </form>
  {:else if oubli}
    <form class="formulaire" novalidate onsubmit={reinitialiser}>
      <h2 class="titre">Mot de passe oublié</h2>
      <p class="info">Saisis ton adresse e-mail : on t'envoie un lien pour choisir un nouveau mot de passe.</p>
      <Champ id="email-oubli" label="Adresse e-mail" type="email" autocomplete="email" bind:valeur={email} requis />
      {#if message}<p class="erreur" role="alert">{message}</p>{/if}
      {#if infoOubli}<p class="info ok" role="status">{infoOubli}</p>{/if}
      <Bouton type="submit">{enCours ? 'Envoi…' : 'Envoyer le lien'}</Bouton>
      <Bouton variante="texte" onclick={() => { oubli = false; message = ''; infoOubli = ''; }}>Retour à la connexion</Bouton>
    </form>
  {:else}
    <form class="formulaire" novalidate onsubmit={envoyer}>
      <h2 class="titre">Connexion</h2>
      {#if auth.erreurLien}<p class="erreur" role="alert">{auth.erreurLien}</p>{/if}
      <Champ id="email" label="Adresse e-mail" type="email" autocomplete="email" bind:valeur={email} requis />
      <Champ id="mdp" label="Mot de passe" type="password" autocomplete="current-password" bind:valeur={motDePasse} requis />

      {#if message}<p class="erreur" role="alert">{message}</p>{/if}

      <Bouton type="submit">{enCours ? 'Connexion…' : 'Se connecter'}</Bouton>
      <Bouton variante="discret" onclick={() => { creer = true; message = ''; auth.erreurLien = ''; }}>Créer un compte</Bouton>
      <!-- deux liens côte à côte quand il y a la place, l'un sous l'autre sinon -->
      <div class="liens">
        <Bouton variante="texte" onclick={() => { oubli = true; message = ''; auth.erreurLien = ''; }}>Mot de passe oublié ?</Bouton>
        <Bouton variante="texte" href="#/confidentialite">Confidentialité</Bouton>
      </div>
      <Bouton variante="texte" href="?demo">Voir la démo, sans compte</Bouton>
    </form>
  {/if}
</main>

<Dialogue ouvert={popup} titre="Vérifie ta boîte mail" onfermer={fermerPopup}>
  {#snippet icone()}
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7.5l8.5 6 8.5-6" /></svg>
  {/snippet}
  <p class="pop-texte">Un e-mail de confirmation vient de partir. Clique sur le lien dedans pour activer ton compte.</p>
  <p class="pop-note">Rien dans ta boîte ? Regarde dans les indésirables.</p>
  <button type="button" class="pop-bouton" onclick={fermerPopup}>J'ai compris</button>
</Dialogue>

<Dialogue ouvert={popupExiste} titre="Tu as déjà un compte" onfermer={versConnexion}>
  {#snippet icone()}
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4.5 20c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" /></svg>
  {/snippet}
  <p class="pop-texte">L'adresse <span class="pop-email">{email}</span> est déjà inscrite sur Coach IA.</p>
  <p class="pop-note">Connecte-toi avec ton mot de passe. Tu l'as oublié ? On t'envoie un lien pour en choisir un nouveau.</p>
  <button type="button" class="pop-bouton" onclick={versConnexion}>Me connecter</button>
  <button type="button" class="pop-lien" onclick={versOubli}>Mot de passe oublié ?</button>
</Dialogue>

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
  .liens {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0 4px;
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
  .erreur-champ {
    margin: -8px 0 0;
    font-size: 13px;
    color: var(--danger);
  }
  .pop-texte {
    margin: 0;
    font-weight: 600;
  }
  .pop-bouton {
    min-height: 48px;
    margin-top: 6px;
    border: 0;
    border-radius: var(--rayon-l);
    background: var(--dossard-texte);
    color: var(--dossard-fond);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .pop-bouton:hover {
    filter: brightness(1.25);
  }
  .pop-bouton:focus-visible {
    outline: 3px solid var(--sport-course);
    outline-offset: 2px;
  }
  .pop-email {
    word-break: break-all;
    color: #e85d0c;
  }
  .pop-lien {
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--dossard-texte);
    font: inherit;
    font-size: 14px;
    text-decoration: underline;
    cursor: pointer;
  }
  .pop-lien:focus-visible {
    outline: 3px solid var(--sport-course);
    outline-offset: 2px;
  }
  .pop-note {
    margin: 0;
    font-size: 14px;
    color: #4a4f5a;
  }
  .consentement {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .consentement input {
    flex: none;
    width: 24px;
    height: 24px;
    margin: 0;
    accent-color: var(--accent, currentColor);
  }
  .consentement a {
    color: var(--texte);
    /* zone tactile de 44 px sans changer la mise en page */
    display: inline-block;
    padding: 10px 0;
    margin: -10px 0;
  }
  .info.ok {
    color: var(--ok);
  }
</style>
