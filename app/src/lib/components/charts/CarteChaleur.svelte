<script>
  // Carte de chaleur de la régularité : une case par jour, la couleur est celle du sport.
  // cases : [{ couleur, intensite }]   (intensite : 0 = jour sans séance, puis 1, 2, 3)
  // L'ordre est jour par jour, semaine par semaine, rangée par rangée (comme dans les maquettes).
  let { cases = [], colonnes = 12, etiquette = 'Régularité' } = $props();

  const opacites = [1, 0.35, 0.6, 1];
</script>

<div class="grille" role="img" aria-label={etiquette} style:grid-template-columns="repeat({colonnes}, minmax(0, 1fr))">
  {#each cases as c}
    <span
      class="case"
      style:background={c.vide ? 'transparent' : c.intensite ? c.couleur : 'var(--surface-2)'}
      style:opacity={c.intensite ? opacites[c.intensite] ?? 1 : 1}
    ></span>
  {/each}
</div>

<style>
  .grille {
    display: grid;
    gap: 4px;
  }
  .case {
    aspect-ratio: 1;
    border-radius: 4px;
  }
</style>
