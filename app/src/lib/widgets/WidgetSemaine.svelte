<script>
  import Bloc from '../components/Bloc.svelte';
  import { ouvrirApercu } from '../stores/apercu.svelte.js';
  import { semaineCourante } from '../data/synthese.js';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS, couleurSport } from '../sports.js';
  import { formatDuree } from '../utils/format.js';

  let { contexte, taille = 'l' } = $props();
  const jours = $derived(semaineCourante(contexte.seances));
  const nomFamille = (f) => (SPORTS[f] || SPORTS.autre).court;
  const nbSeances = $derived(jours.reduce((n, j) => n + j.seances.length, 0));
</script>

<Bloc titre="Cette semaine">
  <div class="semaine" aria-label="{nbSeances} séance{nbSeances > 1 ? 's' : ''} cette semaine">
    {#each jours as j (j.iso)}
      <div class="jour" class:aujourdhui={j.aujourdhui} class:futur={j.futur}>
        <div class="tete">
          <span class="nomjour">{j.jour}</span>
          <span class="num titre">{j.num}</span>
        </div>
        <div class="contenu">
          {#each j.seances.slice(0, 2) as s (s.id)}
            {@const famille = familleAffichage(s.sport)}
            <a class="seance" href="#/seance/{s.id}" onclick={(e) => { e.preventDefault(); ouvrirApercu(s); }} style:background={couleurSport(famille)}>
              <span class="type">{nomFamille(famille)}</span>
              <span class="duree">{formatDuree(s.moving_time)}</span>
            </a>
          {/each}
          {#if j.seances.length > 2}<span class="plus">+{j.seances.length - 2}</span>{/if}
          {#if !j.seances.length}<span class="repos">{j.futur ? '' : 'Repos'}</span>{/if}
        </div>
      </div>
    {/each}
  </div>
</Bloc>

<style>
  .semaine {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
  }
  .jour {
    min-width: 0;
  }
  .tete {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: var(--rayon) var(--rayon) 0 0;
    background: var(--surface-2);
  }
  .aujourdhui .tete {
    background: var(--texte);
    color: var(--fond);
  }
  .nomjour {
    font-size: 11px;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .num {
    font-size: 22px;
    line-height: 1;
    letter-spacing: 0;
  }
  .contenu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 92px;
    padding: 4px 0 0;
  }
  .seance {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: var(--rayon-s);
    color: var(--encre-sur-couleur);
  }
  .type {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
  }
  .duree {
    font-size: 12px;
  }
  .plus,
  .repos {
    font-size: 12px;
    color: var(--texte-doux);
    padding: 4px 10px;
  }
  @media (max-width: 700px) {
    .semaine {
      grid-template-columns: repeat(7, minmax(44px, 1fr));
      overflow-x: auto;
    }
  }
</style>
