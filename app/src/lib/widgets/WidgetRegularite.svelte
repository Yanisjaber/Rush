<script>
  import Bloc from '../components/Bloc.svelte';
  import CarteChaleur from '../components/charts/CarteChaleur.svelte';
  import { casesRegularite, joursActifs } from '../data/synthese.js';

  let { contexte, taille = 'm' } = $props();
  const cases = $derived(casesRegularite(contexte.seances));
  const actifs = $derived(joursActifs(contexte.seances));
</script>

<Bloc titre="Régularité">
  <CarteChaleur {cases} etiquette="Carte des jours d'entraînement sur 12 semaines" />
  <p class="resume">
    <strong>{actifs}</strong> jour{actifs > 1 ? 's' : ''} d'entraînement sur 12 semaines. Chaque case est un jour, la couleur est le sport.
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
