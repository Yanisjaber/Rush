<script>
  // Un chiffre clé : étiquette, grande valeur, unité et note optionnelle.
  import Source from './Source.svelte';
  let { etiquette = '', valeur = '', unite = '', note = '', couleur = '', source = '' } = $props();
</script>

<div class="stat">
  <div class="etiquette">{etiquette}{#if source} <Source type={source} />{/if}</div>
  <div class="valeur titre" style:color={couleur || null}>
    {valeur}{#if unite}<span class="unite">{unite}</span>{/if}
  </div>
  {#if note}<div class="note">{note}</div>{/if}
</div>

<style>
  .etiquette {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .valeur {
    margin-top: 4px;
    font-size: 40px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .unite {
    margin-left: 4px;
    font-family: var(--police-texte);
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0;
    color: var(--texte-doux);
  }
  .note {
    margin-top: 6px;
    font-size: 13px;
    color: var(--texte-doux);
  }
</style>
