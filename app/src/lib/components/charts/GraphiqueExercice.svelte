<script>
  import GraphiqueLignes from './GraphiqueLignes.svelte';
  import { formatKg } from '../../utils/format.js';

  // Progression du 1RM estimé d'UN exercice d'un groupe musculaire, avec un menu déroulant pour choisir l'exercice.
  //  exercices : [{ cle, nom, etiquettes (dates), valeurs (1RM estimé par séance), rm (dernier), record }] : le plus pratiqué en premier
  //  groupe : nom du groupe (pour l'étiquette du menu et l'accessibilité)
  let { exercices = [], groupe = '' } = $props();

  let choix = $state('');
  // Si l'exercice choisi n'existe plus (autre période, autre filtre), on retombe sur le premier
  const courant = $derived(exercices.find((e) => e.cle === choix) || exercices[0]);
  const idMenu = `exo-${Math.random().toString(36).slice(2, 8)}`;
</script>

{#if courant}
  <div class="barre">
    {#if exercices.length > 1}
      <label for={idMenu}>Exercice</label>
      <select id={idMenu} value={courant.cle} onchange={(e) => (choix = e.currentTarget.value)}>
        {#each exercices as e (e.cle)}<option value={e.cle}>{e.nom}</option>{/each}
      </select>
    {:else}
      <span class="seul">{courant.nom}</span>
    {/if}
    <span class="chiffres">1RM estimé <strong>{formatKg(courant.rm)} kg</strong> · record <strong>{formatKg(courant.record)} kg</strong></span>
  </div>
  <GraphiqueLignes
    etiquettes={courant.etiquettes}
    series={[{ nom: courant.nom, couleur: 'var(--sport-muscu)', valeurs: courant.valeurs }]}
    etiquette={`Progression du 1RM estimé : ${courant.nom} (${groupe})`}
  />
{/if}

<style>
  .barre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 12px;
  }
  label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  select {
    min-height: 44px;
    max-width: 100%;
    padding: 0 12px;
    font: inherit;
    font-weight: 600;
    color: var(--texte);
    background: var(--surface-2);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
  }
  select:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .seul {
    font-weight: 600;
  }
  .chiffres {
    margin-left: auto;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .chiffres strong {
    color: var(--texte);
  }
</style>
