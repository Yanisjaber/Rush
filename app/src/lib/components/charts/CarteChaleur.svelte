<script>
  // Carte de chaleur de la régularité : une case par jour, la couleur est celle du sport.
  // cases : [{ couleur, intensite }]   (intensite : 0 = jour sans séance, puis 1, 2, 3)
  // L'ordre est jour par jour, semaine par semaine, rangée par rangée (comme dans les maquettes).
  // reperes : ajoute les lettres des jours à gauche (L M M J V S D) et les semaines au-dessus (S-11 … S-1, S0 = semaine en cours).
  let { cases = [], colonnes = 12, etiquette = 'Régularité', reperes = false } = $props();

  const opacites = [1, 0.35, 0.6, 1];
  const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  // Beaucoup de semaines : un repère sur quelques-uns seulement (en comptant depuis la semaine en cours), pour ne pas les serrer
  const pas = $derived(colonnes <= 12 ? 1 : colonnes <= 26 ? 3 : 4);
  const repereSemaine = (i) => {
    const recul = colonnes - 1 - i;
    return recul % pas !== 0 ? '' : recul === 0 ? 'S0' : `S-${recul}`;
  };
</script>

{#snippet cellule(c)}
  <span
    class="case"
    style:background={c.vide ? 'transparent' : c.intensite ? c.couleur : 'var(--surface-2)'}
    style:opacity={c.intensite ? opacites[c.intensite] ?? 1 : 1}
  ></span>
{/snippet}

<div
  class="grille"
  class:dense={colonnes > 26}
  class:large={reperes}
  role="img"
  aria-label={etiquette}
  style:grid-template-columns={reperes ? `16px repeat(${colonnes}, minmax(0, 1fr))` : `repeat(${colonnes}, minmax(0, 1fr))`}
>
  {#if reperes}
    <span aria-hidden="true"></span>
    {#each { length: colonnes } as _, i}
      <span class="semaine" aria-hidden="true">{repereSemaine(i)}</span>
    {/each}
    {#each JOURS as jour, r}
      <span class="jour" aria-hidden="true">{jour}</span>
      {#each cases.slice(r * colonnes, (r + 1) * colonnes) as c}{@render cellule(c)}{/each}
    {/each}
  {:else}
    {#each cases as c}{@render cellule(c)}{/each}
  {/if}
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
  /* Beaucoup de semaines (6 ou 12 mois) : espacement et coins plus fins pour que les cases restent lisibles */
  .dense {
    gap: 2px;
  }
  .dense .case {
    border-radius: 2px;
  }
  /* Avec les repères (page d'analyse) : la grille prend toute la largeur, les cases sont des rectangles de hauteur fixe
     (des carrés rempliraient l'écran en 3 mois) */
  .large .case {
    aspect-ratio: auto;
    height: 28px;
  }
  .semaine,
  .jour {
    font-size: 10px;
    line-height: 1;
    color: var(--texte-doux);
    white-space: nowrap;
  }
  /* Le repère est centré sur sa colonne et peut déborder sur les colonnes voisines (leurs repères sont vides) */
  .semaine {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    overflow: visible;
    padding-bottom: 2px;
  }
  .jour {
    align-self: center;
  }
</style>
