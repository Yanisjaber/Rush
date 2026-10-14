<script>
  import GraphiqueLignes from './GraphiqueLignes.svelte';
  import { formatKg } from '../../utils/format.js';

  // Progression du 1RM estimé : des ONGLETS pour choisir le groupe musculaire, un menu déroulant pour choisir l'exercice de ce
  // groupe, et UN seul graphique visible (la page reste courte même avec 6 groupes).
  //  groupes : [{ groupe, nom, exercices: [{ cle, nom, etiquettes (dates), valeurs (1RM estimé par séance), rm (dernier), record }] }]
  //  Les exercices d'un groupe arrivent du plus pratiqué au moins pratiqué : le premier est proposé d'abord.
  let { groupes = [] } = $props();

  let groupeChoisi = $state('');
  let exoChoisi = $state({}); // exercice retenu pour chaque groupe (on le garde quand on change d'onglet)
  // Si le groupe ou l'exercice choisi n'existe plus (autre période, autre filtre), on retombe sur le premier
  const courant = $derived(groupes.find((g) => g.groupe === groupeChoisi) || groupes[0]);
  const exo = $derived(courant ? courant.exercices.find((e) => e.cle === exoChoisi[courant.groupe]) || courant.exercices[0] : null);
  const idMenu = `exo-${Math.random().toString(36).slice(2, 8)}`;
</script>

{#if courant && exo}
  {#if groupes.length > 1}
    <div class="onglets" role="group" aria-label="Groupe musculaire">
      {#each groupes as g (g.groupe)}
        <button type="button" aria-pressed={courant.groupe === g.groupe} onclick={() => (groupeChoisi = g.groupe)}>{g.nom}</button>
      {/each}
    </div>
  {/if}
  <div class="barre">
    {#if courant.exercices.length > 1}
      <label for={idMenu}>Exercice</label>
      <select id={idMenu} value={exo.cle} onchange={(e) => (exoChoisi[courant.groupe] = e.currentTarget.value)}>
        {#each courant.exercices as e (e.cle)}<option value={e.cle}>{e.nom}</option>{/each}
      </select>
    {:else}
      <span class="seul">{exo.nom}</span>
    {/if}
    <span class="chiffres">1RM estimé <strong>{formatKg(exo.rm)} kg</strong> · record <strong>{formatKg(exo.record)} kg</strong></span>
  </div>
  <GraphiqueLignes
    etiquettes={exo.etiquettes}
    series={[{ nom: exo.nom, couleur: 'var(--sport-muscu)', valeurs: exo.valeurs }]}
    etiquette={`Progression du 1RM estimé : ${exo.nom} (${courant.nom})`}
  />
{/if}

<style>
  .onglets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 14px;
  }
  .onglets button {
    min-height: var(--cible);
    padding: 0 16px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    background: transparent;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .onglets button[aria-pressed='true'] {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
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
  select:focus-visible,
  .onglets button:focus-visible {
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
