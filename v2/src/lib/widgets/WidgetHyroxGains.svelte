<script>
  import Bloc from '../components/Bloc.svelte';
  import { ciblesSegments, ecartsParSegment, formatEcart } from '../data/hyrox.js';

  // Pour chaque station : l'écart entre ton dernier test et ton objectif. Orange = temps à gagner, vert = déjà tenu.
  let { contexte } = $props();
  const test = $derived(contexte.hyrox.tests[0] || null);
  const cibles = $derived(ciblesSegments(contexte.hyrox.objectif, test));
  const ecarts = $derived(ecartsParSegment(test, cibles, 'station'));
  const echelle = $derived(Math.max(10, ...ecarts.map((e) => Math.abs(e.ecart))));
</script>

<Bloc titre="Où gagner du temps">
  {#if ecarts.length}
    <p class="legende">Écart entre ton test et ton objectif, station par station.</p>
    <ul class="liste">
      {#each ecarts as e (e.cle)}
        <li>
          <span class="nom">{e.nom}</span>
          <span class="piste" role="img" aria-label={`${e.nom} : ${formatEcart(e.ecart)}`}>
            <span class="centre"></span>
            {#if e.ecart > 0}
              <span class="barre perdu" style:left="50%" style:width="{(e.ecart / echelle) * 50}%"></span>
            {:else if e.ecart < 0}
              <span class="barre gagne" style:right="50%" style:width="{(-e.ecart / echelle) * 50}%"></span>
            {/if}
          </span>
          <span class="valeur" class:perdu={e.ecart > 0} class:gagne={e.ecart < 0}>{formatEcart(e.ecart)}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="vide">
      {test ? "Fixe un objectif de temps dans " : "Saisis un test et fixe un objectif dans "}<a href="#/hyrox">ta page Hyrox</a> pour voir où gagner du temps.
    </p>
  {/if}
</Bloc>

<style>
  .legende {
    margin: -6px 0 14px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  li {
    display: grid;
    grid-template-columns: minmax(96px, 150px) 1fr 54px;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .nom {
    line-height: 1.25;
  }
  .piste {
    position: relative;
    height: 10px;
  }
  .centre {
    position: absolute;
    left: 50%;
    top: -3px;
    bottom: -3px;
    border-left: 1px solid var(--trait-fort);
  }
  .barre {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 3px;
  }
  .barre.perdu {
    background: var(--sport-course);
  }
  .barre.gagne {
    background: var(--ok);
  }
  .valeur {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--texte-doux);
  }
  .valeur.perdu {
    color: var(--alerte);
  }
  .valeur.gagne {
    color: var(--ok);
  }
  .vide {
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  a {
    color: var(--texte);
  }
</style>
