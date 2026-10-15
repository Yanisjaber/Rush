<script>
  import Bloc from '../components/Bloc.svelte';
  import { resumeProgramme } from '../data/force.js';
  import { construireAdresse } from '../data/adresses.js';

  // Tes programmes de musculation (PUSH, PULL, LEGS…). Il se place à côté de la séance du jour (un quart de la largeur sur ordinateur).
  // Chaque ligne ouvre le programme dans la page Programmes (où l'on crée, modifie et démarre les séances).
  // compact : sur téléphone, un simple bouton qui ouvre cette page.
  let { contexte, compact = false } = $props();
  const programmes = $derived(contexte.force.programmes);
  const page = construireAdresse({ sport: 'muscu', sous: 'programmes' });
  const lien = (id) => construireAdresse({ sport: 'muscu', sous: 'programmes', q: { programme: id } });
  const detail = (p) => {
    const r = resumeProgramme(p);
    return `${r.exercices} exo${r.exercices > 1 ? 's' : ''}`;
  };
</script>

{#if compact}
  <a class="bouton-programmes" href={page}>
    <span class="nom titre">Programmes</span>
    {#if programmes.length}<span class="nombre">{programmes.length}</span>{/if}
    <span class="fleche" aria-hidden="true"></span>
  </a>
{:else}
  <Bloc titre="Programmes" remplir>
    {#if programmes.length}
      <ul class="liste">
        {#each programmes as p (p.id)}
          <li>
            <a class="ligne" href={lien(p.id)} aria-label={`Ouvrir le programme ${p.name}`}>
              <span class="nom-prog">{p.name}</span>
              <span class="detail">{detail(p)}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="vide">Aucun programme pour l'instant. Crée-en un pour démarrer tes séances en un geste.</p>
    {/if}
    <a class="nouveau" href={lien('nouveau')}>+ Nouveau programme</a>
  </Bloc>
{/if}

<style>
  /* Version téléphone : un bouton, pas une carte */
  .bouton-programmes {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 0 18px;
    background: var(--surface);
    border-radius: var(--rayon);
    color: var(--texte);
    -webkit-tap-highlight-color: transparent;
  }
  .bouton-programmes .nom {
    flex: 1;
    font-size: 17px;
  }
  .nombre {
    min-width: 24px;
    padding: 1px 8px;
    border-radius: var(--rayon-rond);
    background: var(--surface-2);
    color: var(--texte-doux);
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }
  .fleche {
    width: 7px;
    height: 7px;
    margin-right: 3px;
    border-top: 2px solid var(--texte-doux);
    border-right: 2px solid var(--texte-doux);
    transform: rotate(45deg);
  }

  /* Version ordinateur : une carte étroite (un quart de la largeur) */
  .liste {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .liste li + li {
    border-top: 1px solid var(--trait);
  }
  .ligne {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    min-height: 44px;
    align-items: center;
  }
  .ligne:hover .nom-prog {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .nom-prog {
    min-width: 0;
    font-size: 16px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    flex: none;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .vide {
    margin-top: 8px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .nouveau {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--cible);
    margin-top: 12px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 14px;
    font-weight: 700;
    color: var(--texte);
  }
  .nouveau:hover {
    border-color: var(--texte);
  }
</style>
