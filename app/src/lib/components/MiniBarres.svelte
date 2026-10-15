<script>
  // Mini histogramme pour les tuiles compactes (téléphone). La dernière barre est pleine, les autres atténuées.
  // `valeurs` : des nombres ≥ 0 ; `max` : la valeur d'une barre pleine hauteur (par défaut, la plus grande).
  let { valeurs = [], max = 0, couleur = 'var(--sport-muscu)', etiquette = '' } = $props();
  const maximum = $derived(max > 0 ? max : Math.max(1, ...valeurs));
</script>

<div class="mini" role="img" aria-label={etiquette || undefined} aria-hidden={etiquette ? undefined : 'true'}>
  {#each valeurs as v, i}
    <span class="col" class:derniere={i === valeurs.length - 1}>
      <span class="barre" style:height="{Math.max(v > 0 ? 6 : 2, (v / maximum) * 100)}%" style:background={couleur}></span>
    </span>
  {/each}
</div>

<style>
  .mini {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 30px;
  }
  .col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    opacity: 0.4;
  }
  .col.derniere {
    opacity: 1;
  }
  .barre {
    display: block;
    width: 100%;
    border-radius: 2px 2px 0 0;
  }
</style>
