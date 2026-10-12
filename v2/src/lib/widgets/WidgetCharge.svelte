<script>
  import Bloc from '../components/Bloc.svelte';
  import BarresEmpilees from '../components/charts/BarresEmpilees.svelte';
  import { chargeParSemaine, conditionHebdo } from '../data/synthese.js';
  import { SPORTS } from '../sports.js';

  let { contexte, taille = 'l' } = $props();
  const charge = $derived(chargeParSemaine(contexte.seances));
  const condition = $derived(conditionHebdo(contexte.metriques));
  const nomFamille = (f) => (SPORTS[f] || SPORTS.autre).court;
</script>

<Bloc titre="Charge d'entraînement">
  {#if charge.series.length}
    <BarresEmpilees
      series={charge.series}
      etiquettes={charge.etiquettes}
      ligne={condition}
      hauteur={taille === 'xl' ? 260 : 220}
      etiquette="Charge par semaine et par sport sur 12 semaines, avec la courbe de condition"
    />
    <ul class="legende">
      {#each charge.series as s}
        <li><span class="pastille" style:background={s.couleur}></span>{nomFamille(s.nom)}</li>
      {/each}
      {#if condition.length}<li><span class="trait"></span>Condition</li>{/if}
    </ul>
  {:else}
    <p class="vide">Pas encore de séance sur les 12 dernières semaines.</p>
  {/if}
</Bloc>

<style>
  .legende {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .legende li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pastille {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .trait {
    width: 16px;
    height: 3px;
    background: var(--texte);
    border-radius: 2px;
  }
  .vide {
    color: var(--texte-doux);
  }
</style>
