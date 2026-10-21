<script>
  // Tuile compacte pour téléphone : un titre, un chiffre clé, une note et (en dessous) une mini visualisation.
  // Deux tuiles tiennent côte à côte sur un iPhone. Tout est affiché en texte brut : Svelte échappe le HTML.
  let { titre = '', valeur = '', unite = '', note = '', children } = $props();
</script>

<section class="tuile" aria-label={titre}>
  <h3 class="titre-tuile">{titre}</h3>
  <div class="valeur titre">{valeur}{#if unite}<span class="unite">{unite}</span>{/if}</div>
  {#if note}<p class="note">{note}</p>{/if}
  {#if children}<div class="visuel">{@render children()}</div>{/if}
</section>

<style>
  .tuile {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 118px;
    padding: 12px 14px;
    background: color-mix(in srgb, var(--surface) var(--surface-verre), transparent);
    box-shadow: inset 0 0 0 1px var(--trait);
    border-radius: var(--rayon);
    overflow: hidden;
  }
  .titre-tuile {
    margin: 0;
    font-family: var(--police-texte);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--texte-doux);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 26px; /* place du bouton « › » posé dans le coin par l'accueil */
  }
  .valeur {
    margin-top: 6px;
    font-size: 28px;
    line-height: 1.1;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .unite {
    margin-left: 3px;
    font-family: var(--police-texte);
    font-size: 12px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  .note {
    margin: 2px 0 0;
    font-size: 12px;
    line-height: 1.35;
    color: var(--texte-doux);
  }
  .visuel {
    margin-top: auto;
    padding-top: 8px;
  }
</style>
