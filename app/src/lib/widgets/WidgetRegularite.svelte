<script>
  import Bloc from '../components/Bloc.svelte';
  import CarteChaleur from '../components/charts/CarteChaleur.svelte';
  import NoteAncien from '../components/NoteAncien.svelte';
  import { casesRegularite, joursActifs, ancreSeances } from '../data/synthese.js';

  let { contexte, taille = 'm' } = $props();
  // Aucune séance sur les 12 dernières semaines : on montre les 12 semaines jusqu'à ta dernière séance, en le disant
  const ancre = $derived(ancreSeances(contexte.seances));
  const cases = $derived(casesRegularite(contexte.seances, 12, ancre.date));
  const actifs = $derived(joursActifs(contexte.seances, 12, ancre.date));
</script>

<Bloc titre="Régularité">
  {#if ancre.ancien}<NoteAncien derniere={ancre.derniere} suite="Voici les 12 semaines jusqu'à cette séance." />{/if}
  <CarteChaleur {cases} etiquette="Carte des jours d'entraînement sur 12 semaines" />
  <p class="resume">
    <strong>{actifs}</strong> jour{actifs > 1 ? 's' : ''} d'entraînement sur 12 semaines{ancre.ancien ? ' avant cette séance' : ''}. Chaque case est un jour, la couleur est le sport.
  </p>
</Bloc>

<style>
  .resume {
    margin-top: 14px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .resume strong {
    color: var(--texte);
  }
</style>
