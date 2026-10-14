<script>
  import Dossard from '../components/Dossard.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { programmeDuJour, resumeProgramme } from '../data/force.js';
  import { formatDateLongue, dateIsoLocale } from '../utils/format.js';

  // Le dossard de la séance de force du jour : le programme qui suit celui de ta dernière séance.
  let { contexte } = $props();
  const prog = $derived(programmeDuJour(contexte.force.programmes, contexte.toutesSeances));
  const resume = $derived(prog ? resumeProgramme(prog) : null);
  const jour = formatDateLongue(dateIsoLocale());
</script>

<div class="cadre">
  {#if prog}
    <Dossard
      etiquette="Séance du jour"
      nom={jour}
      valeur={prog.name}
      detail={`${resume.exercices} exercice${resume.exercices > 1 ? 's' : ''} · ${resume.series} séries · environ ${resume.minutes} min`}
    >
      <div class="action"><Bouton variante="sur-dossard" href={`#/force/seance/${prog.id}`}>Démarrer la séance</Bouton></div>
    </Dossard>
  {:else}
    <Dossard etiquette="Séance du jour" nom={jour} valeur="—" detail="Pas de programme à suivre ? Enregistre ta séance : chrono, exercices, séries et charges.">
      <div class="action"><Bouton variante="sur-dossard" href="#/force/demarrer">Enregistrer une séance</Bouton></div>
    </Dossard>
  {/if}
</div>

<style>
  .cadre {
    height: 100%;
  }
  .cadre :global(.dossard) {
    height: 100%;
  }
  .action {
    margin-top: 14px;
  }
</style>
