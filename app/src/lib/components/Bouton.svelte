<script>
  // Un bouton ou un lien d'action. Toujours au moins 44 px de haut (cible tactile).
  // variante : 'principal' (aplat clair), 'discret' (contour), 'texte' (souligné),
  // 'sur-dossard' et 'sur-dossard-contour' (à poser sur le dossard).
  let { variante = 'principal', href = '', type = 'button', onclick, children } = $props();
</script>

{#if href}
  <a class="bouton {variante}" {href} {onclick}>{@render children?.()}</a>
{:else}
  <button class="bouton {variante}" {type} {onclick}>{@render children?.()}</button>
{/if}

<style>
  .bouton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--cible);
    padding: 0 20px;
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: var(--rayon);
    font-family: var(--police-texte);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .principal {
    background: var(--texte);
    color: var(--fond);
  }
  /* À poser sur le dossard : inverse des couleurs du dossard, donc toujours lisible */
  .sur-dossard {
    background: var(--dossard-texte);
    color: var(--dossard-fond);
  }
  /* Bouton secondaire à poser sur le dossard : un contour aux couleurs du dossard (le « discret » normal serait invisible sur fond clair) */
  .sur-dossard-contour {
    background: transparent;
    color: var(--dossard-texte);
    box-shadow: inset 0 0 0 2px var(--dossard-texte);
  }
  .discret {
    background: transparent;
    color: var(--texte);
    border-color: var(--trait-fort);
    font-weight: 600;
  }
  .texte {
    background: transparent;
    color: var(--texte-doux);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 4px;
    padding: 0 8px;
  }
</style>
