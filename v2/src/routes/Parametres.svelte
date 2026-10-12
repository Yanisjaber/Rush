<script>
  import Bloc from '../lib/components/Bloc.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import { auth, deconnexion } from '../lib/stores/auth.svelte.js';
  import { theme, choisirTheme } from '../lib/stores/theme.svelte.js';
  import { disposition, demanderEdition, reinitialiserAuto } from '../lib/stores/disposition.svelte.js';
  import { aller } from '../lib/routeur.svelte.js';

  let { demo = false } = $props();

  const email = $derived(demo ? 'Compte de démonstration' : auth.session?.user?.email || '');

  function modifierAccueil() {
    demanderEdition();
    aller('/');
  }
  async function revenirAuto() {
    await reinitialiserAuto();
    aller('/');
  }
</script>

<div class="page">
  <header class="barre">
    <a class="retour" href="#/" aria-label="Retour à l'accueil">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      Accueil
    </a>
    {#if demo}<span class="etiquette-demo">Mode démo</span>{/if}
  </header>

  <h1 class="titre">Paramètres</h1>

  <div class="sections">
    <Bloc titre="Mon accueil">
      <p class="aide">
        Choisis quels widgets s'affichent, dans quel ordre et à quelle taille.
        {#if disposition.auto}Aujourd'hui, ton accueil est <strong>automatique</strong> : il s'adapte à tes sports.{:else}Ton accueil est <strong>personnalisé</strong>.{/if}
      </p>
      <div class="actions">
        <Bouton onclick={modifierAccueil}>Personnaliser mon accueil</Bouton>
        {#if !disposition.auto}<Bouton variante="texte" onclick={revenirAuto}>Revenir à l'accueil automatique</Bouton>{/if}
      </div>
    </Bloc>

    <Bloc titre="Apparence">
      <p class="aide">Le thème sombre est celui de l'app. Le thème clair est plus lisible en plein soleil.</p>
      <div class="segment" role="group" aria-label="Thème">
        <button type="button" aria-pressed={theme.choix === 'sombre'} onclick={() => choisirTheme('sombre')}>Sombre</button>
        <button type="button" aria-pressed={theme.choix === 'clair'} onclick={() => choisirTheme('clair')}>Clair</button>
      </div>
    </Bloc>

    <Bloc titre="Compte">
      <dl class="compte">
        <dt>Connecté en tant que</dt>
        <dd>{email}</dd>
      </dl>
      <div class="actions">
        {#if demo}
          <Bouton variante="discret" href="./">Se connecter</Bouton>
        {:else}
          <Bouton variante="discret" onclick={deconnexion}>Se déconnecter</Bouton>
        {/if}
      </div>
    </Bloc>

    <Bloc titre="Bientôt">
      <ul class="bientot">
        <li>Connexions Strava et Garmin</li>
        <li>Profil sportif : FTP, FC max, poids</li>
        <li>Mes sports et mes objectifs</li>
      </ul>
    </Bloc>
  </div>
</div>

<style>
  .barre {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 0 12px;
  }
  .retour {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--cible);
    padding-right: 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
  }
  .retour:hover {
    color: var(--texte);
  }
  .etiquette-demo {
    padding: 6px 10px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    font-size: 12px;
    color: var(--texte-doux);
  }
  h1 {
    font-size: clamp(36px, 6vw, 48px);
    line-height: 1;
    margin: 12px 0 28px;
  }
  /* Les réglages restent en colonne lisible, même sur un très grand écran */
  h1,
  .sections {
    max-width: 760px;
  }
  .sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .aide {
    margin-bottom: 16px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .aide strong {
    color: var(--texte);
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .segment {
    display: inline-flex;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    overflow: hidden;
  }
  .segment button {
    min-height: var(--cible);
    padding: 0 24px;
    background: transparent;
    border: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .segment button[aria-pressed='true'] {
    background: var(--texte);
    color: var(--fond);
  }
  .compte {
    margin-bottom: 16px;
  }
  .compte dt {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .compte dd {
    margin-top: 4px;
    font-size: 16px;
    word-break: break-all;
  }
  .bientot {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 15px;
    color: var(--texte-doux);
  }
</style>
