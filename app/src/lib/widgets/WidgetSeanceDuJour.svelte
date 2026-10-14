<script>
  import Dossard from '../components/Dossard.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { menu } from '../stores/menu.svelte.js';
  import { construireAdresse } from '../data/adresses.js';
  import { familleAffichage } from '../data/familles.js';
  import { programmeDuJour, resumeProgramme } from '../data/force.js';
  import { formatDateLongue, dateIsoLocale } from '../utils/format.js';

  // Le dossard de la séance de force du jour. Dans l'ordre :
  //  1. une séance de muscu PRÉVUE aujourd'hui au calendrier : on l'affiche, avec le programme qu'on lui a relié (s'il y en a un) ;
  //  2. sinon le programme qui suit celui de ta dernière séance (PUSH, PULL, LEGS, PUSH…) ;
  //  3. sinon on propose d'enregistrer une séance.
  let { contexte } = $props();
  const jour = formatDateLongue(dateIsoLocale());
  const aujourdhui = dateIsoLocale();

  // Séance de muscu prévue aujourd'hui (ni compétition, ni autre sport) et son programme relié
  const prevue = $derived(contexte.planifiees.find((p) => p.date === aujourdhui && p.category !== 'competition' && familleAffichage(p.sport) === 'muscu') || null);
  const programmeLie = $derived(prevue?.programme_id ? contexte.force.programmes.find((p) => p.id === prevue.programme_id) || null : null);
  const voirPrevue = $derived(prevue ? construireAdresse({ sport: menu.filtre, page: '/calendrier', q: { prevue: prevue.id } }) : '');

  const prog = $derived(programmeLie || programmeDuJour(contexte.force.programmes, contexte.toutesSeances));
  const resume = $derived(prog ? resumeProgramme(prog) : null);
  const detailProgramme = $derived(resume ? `${resume.exercices} exercice${resume.exercices > 1 ? 's' : ''} · ${resume.series} séries · environ ${resume.minutes} min` : '');
</script>

<div class="cadre">
  {#if prevue}
    <!-- Séance prévue aujourd'hui : on la montre (avec son programme si elle en a un) ; « Voir » ouvre la séance prévue dans le calendrier -->
    <Dossard
      etiquette="Séance du jour · prévue"
      nom={jour}
      valeur={programmeLie ? programmeLie.name : prevue.name}
      detail={programmeLie ? detailProgramme : Number(prevue.duration) > 0 ? `${prevue.duration} min · sans programme relié` : 'Sans programme relié'}
    >
      <div class="actions">
        <Bouton variante="sur-dossard" href={programmeLie ? `#/force/seance/${programmeLie.id}` : '#/force/demarrer'}>{programmeLie ? 'Démarrer la séance' : 'Enregistrer la séance'}</Bouton>
        <Bouton variante="sur-dossard-contour" href={voirPrevue}>Voir</Bouton>
      </div>
    </Dossard>
  {:else if prog}
    <Dossard etiquette="Séance du jour" nom={jour} valeur={prog.name} detail={detailProgramme}>
      <div class="actions"><Bouton variante="sur-dossard" href={`#/force/seance/${prog.id}`}>Démarrer la séance</Bouton></div>
    </Dossard>
  {:else}
    <Dossard etiquette="Séance du jour" nom={jour} valeur="—" detail="Pas de programme à suivre ? Enregistre ta séance : chrono, exercices, séries et charges.">
      <div class="actions"><Bouton variante="sur-dossard" href="#/force/demarrer">Enregistrer une séance</Bouton></div>
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
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
</style>
