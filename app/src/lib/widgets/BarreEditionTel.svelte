<script>
  // Mode Personnaliser sur téléphone : les widgets gardent exactement leur forme finale (aucune barre d'outils dessus).
  // On touche un widget pour le sélectionner, et cette barre fixe, juste au-dessus du menu du bas, permet de le retirer.
  // Pour le déplacer, on le maintient et on le glisse (voir Accueil.svelte).
  let { nom = '', onRetirer } = $props();
</script>

<div class="barre-edition-tel" role="toolbar" aria-label="Widget sélectionné">
  {#if nom}
    <span class="nom titre">{nom}</span>
    <button type="button" class="retirer" aria-label="Retirer {nom}" onclick={onRetirer}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      <span>Retirer</span>
    </button>
  {:else}
    <span class="aide">Touche un widget pour le retirer. Maintiens-le et glisse pour le déplacer.</span>
  {/if}
</div>

<style>
  .barre-edition-tel {
    display: none;
  }
  @media (max-width: 760px) {
    .barre-edition-tel {
      position: fixed;
      left: 0;
      right: 0;
      bottom: var(--hauteur-barre-bas);
      z-index: 39; /* juste sous le menu du bas */
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 52px;
      padding: 4px 12px;
      box-sizing: border-box;
      background: var(--surface);
      border-top: 1px solid var(--trait-fort);
    }
  }
  .nom {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .aide {
    font-size: 13px;
    color: var(--texte-doux);
  }
  button {
    -webkit-tap-highlight-color: transparent;
    flex: none;
    min-width: var(--cible);
    height: var(--cible);
    padding: 0 10px;
    gap: 6px;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    color: var(--texte);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .retirer {
    color: var(--danger);
  }
</style>
