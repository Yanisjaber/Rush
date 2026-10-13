<script>
  import Bloc from '../components/Bloc.svelte';
  import StatCle from '../components/StatCle.svelte';
  import { formeActuelle } from '../data/synthese.js';

  let { contexte, taille = 'm' } = $props();
  const forme = $derived(formeActuelle(contexte.metriques));
  const signe = (n) => `${n > 0 ? '+' : ''}${n}`;
</script>

<Bloc titre="Forme">
  {#if forme}
    <div class="stats">
      <StatCle etiquette="Forme" valeur={signe(forme.tsb)} note={forme.libelle} couleur={forme.tsb >= 5 ? 'var(--ok)' : ''} />
      {#if taille !== 's'}
        <StatCle etiquette="Condition" valeur={String(forme.ctl)} />
        <StatCle etiquette="Fatigue" valeur={String(forme.atl)} />
      {/if}
    </div>
  {:else}
    <p class="vide">Pas encore de données de forme.</p>
  {/if}
</Bloc>

<style>
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 28px;
  }
  .vide {
    color: var(--texte-doux);
  }
</style>
