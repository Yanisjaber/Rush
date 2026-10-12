<script>
  import Bloc from '../components/Bloc.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { theme, choisirTheme } from '../stores/theme.svelte.js';
  import { disposition, demanderEdition, reinitialiserAuto } from '../stores/disposition.svelte.js';
  import { aller } from '../routeur.svelte.js';

  // Onglet Préférences : accueil personnalisable et apparence.
  function modifierAccueil() {
    demanderEdition();
    aller('/');
  }
  async function revenirAuto() {
    await reinitialiserAuto();
    aller('/');
  }
</script>

<div class="onglet">
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
</div>

<style>
  .onglet {
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
</style>
