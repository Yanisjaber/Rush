<script>
  import Bloc from '../components/Bloc.svelte';
  import { seancesForce } from '../data/synthese.js';

  let { contexte, taille = 'm' } = $props();
  const force = $derived(seancesForce(contexte.toutesSeances));
  const maximum = $derived(Math.max(3, ...force.parSemaine));
</script>

<Bloc titre="Séances de force">
  {#if force.total}
    <div class="chiffres">
      <div>
        <div class="valeur titre">{force.serie}</div>
        <div class="legende">semaine{force.serie > 1 ? 's' : ''} de suite</div>
      </div>
      <div>
        <div class="valeur titre">{String(force.moyenne).replace('.', ',')}</div>
        <div class="legende">séance{force.moyenne >= 2 ? 's' : ''} par semaine</div>
      </div>
    </div>
    <div class="barres" role="img" aria-label="Nombre de séances de force par semaine sur 12 semaines">
      {#each force.parSemaine as n, i}
        <span class="colonne" class:derniere={i === force.parSemaine.length - 1}>
          <span class="barre" style:height="{(n / maximum) * 100}%"></span>
        </span>
      {/each}
    </div>
    <p class="note">Séances de musculation sur 12 semaines.</p>
  {:else}
    <p class="vide">Aucune séance de musculation sur les 12 dernières semaines.</p>
  {/if}
</Bloc>

<style>
  .chiffres {
    display: flex;
    gap: 32px;
    margin-bottom: 16px;
  }
  .valeur {
    font-size: 40px;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--sport-muscu);
  }
  .legende {
    margin-top: 4px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .barres {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 80px;
    border-bottom: 1px solid var(--trait);
  }
  .colonne {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    opacity: 0.55;
  }
  .colonne.derniere {
    opacity: 1;
  }
  .barre {
    display: block;
    width: 100%;
    min-height: 2px;
    background: var(--sport-muscu);
    border-radius: 3px 3px 0 0;
  }
  .note,
  .vide {
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .vide {
    margin-top: 0;
    font-size: 14px;
  }
</style>
