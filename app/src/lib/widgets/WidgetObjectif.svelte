<script>
  import Dossard from '../components/Dossard.svelte';
  import { formatDateLongue, formatKm, joursAvant } from '../utils/format.js';

  let { contexte, taille = 'm' } = $props();
  const objectif = $derived(contexte.objectifs[0] || null);
  const jours = $derived(objectif ? joursAvant(objectif.date) : null);
  const detail = $derived(
    objectif
      ? `${formatDateLongue(objectif.date)}${objectif.km ? ` · ${formatKm(objectif.km, 2)} km` : ''}${objectif.duration ? ` · objectif ${objectif.duration} min` : ''}`
      : "Ajoute une compétition pour voir ton compte à rebours.",
  );
</script>

<div class="cadre">
  {#if objectif}
    <Dossard etiquette="Prochain objectif" nom={objectif.name} valeur={`J-${jours}`} {detail} />
  {:else}
    <Dossard compact etiquette="Prochain objectif" nom="Aucun objectif" valeur="" {detail} />
  {/if}
</div>

<style>
  .cadre {
    height: 100%;
  }
  .cadre :global(.dossard) {
    height: 100%;
  }
</style>
