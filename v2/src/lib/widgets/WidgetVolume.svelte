<script>
  import Bloc from '../components/Bloc.svelte';
  import Anneau from '../components/charts/Anneau.svelte';
  import { repartition7Jours } from '../data/synthese.js';
  import { SPORTS } from '../sports.js';
  import { formatDuree } from '../utils/format.js';

  let { contexte, taille = 'm' } = $props();
  const rep = $derived(repartition7Jours(contexte.seances));
  const nomFamille = (f) => (SPORTS[f] || SPORTS.autre).court;
</script>

<Bloc titre="Volume, 7 derniers jours">
  {#if rep.totalSecondes}
    <div class="centre">
      <Anneau segments={rep.segments} taille={taille === 's' ? 130 : 170} etiquette="Répartition du temps d'entraînement par sport sur 7 jours">
        <div class="titre gros">{formatDuree(rep.totalSecondes)}</div>
        <div class="petit">cette semaine</div>
      </Anneau>
    </div>
    <ul class="legende">
      {#each rep.segments as s}
        <li><span class="pastille" style:background={s.couleur}></span><span class="nom">{nomFamille(s.nom)}</span><strong>{formatDuree(s.valeur)}</strong></li>
      {/each}
    </ul>
  {:else}
    <p class="vide">Aucune séance sur les 7 derniers jours.</p>
  {/if}
</Bloc>

<style>
  .centre {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }
  .gros {
    font-size: 30px;
    line-height: 1;
  }
  .petit {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .legende {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }
  .legende li {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .nom {
    flex: 1;
  }
  .pastille {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
  }
  .vide {
    color: var(--texte-doux);
  }
</style>
