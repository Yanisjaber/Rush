<script>
  import Bloc from '../components/Bloc.svelte';
  import CarteChaleur from '../components/charts/CarteChaleur.svelte';
  import { casesRegularite } from '../data/synthese.js';

  let { contexte, taille = 'm' } = $props();
  const cases = $derived(casesRegularite(contexte.seances));
</script>

<Bloc titre="Régularité">
  <CarteChaleur {cases} etiquette="Carte des jours d'entraînement sur 12 semaines" />
</Bloc>
