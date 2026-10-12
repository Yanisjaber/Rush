<script>
  // Un bloc de contenu. Sans `couleur`, c'est une surface sombre ; avec `couleur`
  // (par exemple la couleur d'un sport), c'est un aplat de couleur, texte foncé dessus.
  let { titre = '', couleur = '', compact = false, children, actions } = $props();
</script>

<section class="bloc" class:plein={!!couleur} class:compact style:background={couleur || null}>
  {#if titre || actions}
    <div class="entete">
      {#if titre}<h2 class="titre">{titre}</h2>{/if}
      {@render actions?.()}
    </div>
  {/if}
  {@render children?.()}
</section>

<style>
  .bloc {
    box-sizing: border-box;
    min-width: 0;
    padding: 24px 26px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  .bloc.compact {
    padding: 16px 18px;
  }
  /* Sur un aplat de couleur, le texte et le texte « doux » deviennent de l'encre foncée :
     les composants enfants qui utilisent --texte-doux restent lisibles. */
  .bloc.plein {
    color: var(--encre-sur-couleur);
    --texte-doux: var(--encre-sur-couleur);
  }
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--e2);
    margin-bottom: var(--e4);
  }
  h2 {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0;
  }
  .compact h2 {
    font-size: 17px;
  }
</style>
