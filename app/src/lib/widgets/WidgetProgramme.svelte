<script>
  import Bloc from '../components/Bloc.svelte';
  import { programmeDuJour } from '../data/force.js';
  import { formatKg } from '../utils/format.js';

  // Le contenu du programme du jour : exercice, séries × répétitions, charge.
  let { contexte } = $props();
  const prog = $derived(programmeDuJour(contexte.force.programmes, contexte.toutesSeances));
  const exercices = $derived(Array.isArray(prog?.exercises) ? prog.exercises : []);
</script>

<Bloc titre={prog ? `Au programme : ${prog.name.toLowerCase()}` : 'Au programme'}>
  {#if exercices.length}
    <ol class="liste">
      {#each exercices as e, i}
        <li>
          <span class="rang">{i + 1}</span>
          <span class="nom">{e.name}</span>
          <span class="series">{e.sets} × {e.reps}</span>
          <span class="charge">{e.weight ? `${formatKg(e.weight)} kg` : 'poids du corps'}</span>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="vide">Aucun programme pour l'instant. <a href="#/muscu/programmes">Crée ton premier programme</a>.</p>
  {/if}
</Bloc>

<style>
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: 22px 1fr auto auto;
    align-items: baseline;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--trait);
    font-size: 14px;
  }
  li:first-child {
    border-top: 0;
  }
  .rang {
    color: var(--texte-doux);
    font-size: 12px;
  }
  .series {
    color: var(--texte-doux);
    font-variant-numeric: tabular-nums;
  }
  .charge {
    min-width: 76px;
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .vide {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .vide a {
    color: var(--texte);
  }
</style>
