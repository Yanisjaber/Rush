<script>
  import Bloc from '../components/Bloc.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { WIDGETS, estPertinent } from './registre.js';

  // Bibliothèque : les widgets qu'on peut encore ajouter à l'accueil.
  // ids : identifiants disponibles (pertinents d'abord) · familles : sports pratiqués
  let { ids = [], familles = [], onAjouter } = $props();
  let seulementMesSports = $state(false);

  const visibles = $derived(seulementMesSports ? ids.filter((id) => estPertinent(id, familles)) : ids);
</script>

<Bloc titre="Bibliothèque de widgets">
  <div class="filtres" role="group" aria-label="Filtrer la bibliothèque">
    <button type="button" aria-pressed={!seulementMesSports} onclick={() => (seulementMesSports = false)}>Tous</button>
    <button type="button" aria-pressed={seulementMesSports} onclick={() => (seulementMesSports = true)}>Pour mes sports</button>
  </div>

  {#if visibles.length}
    <ul class="liste">
      {#each visibles as id (id)}
        <li>
          <div class="texte">
            <div class="ligne">
              <span class="nom titre">{WIDGETS[id].nom}</span>
              <span class="categorie">{WIDGETS[id].categorie}</span>
            </div>
            <p class="description">{WIDGETS[id].description}</p>
          </div>
          <Bouton onclick={() => onAjouter(id)}>Ajouter</Bouton>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="vide">Tous les widgets disponibles sont déjà sur ton accueil.</p>
  {/if}
</Bloc>

<style>
  .filtres {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .filtres button {
    min-height: var(--cible);
    padding: 0 16px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    background: transparent;
    color: var(--texte-doux);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .filtres button[aria-pressed='true'] {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
  .liste {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .liste li {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    background: var(--fond);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
  }
  .texte {
    flex: 1;
    min-width: 0;
  }
  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }
  .nom {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0;
  }
  .categorie {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .description {
    margin-top: 2px;
    font-size: 13px;
    line-height: 1.4;
    color: var(--texte-doux);
  }
  .vide {
    color: var(--texte-doux);
  }
</style>
