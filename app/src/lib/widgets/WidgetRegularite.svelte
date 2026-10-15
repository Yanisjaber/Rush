<script>
  import Bloc from '../components/Bloc.svelte';
  import Tuile from '../components/Tuile.svelte';
  import MiniBarres from '../components/MiniBarres.svelte';
  import CarteChaleur from '../components/charts/CarteChaleur.svelte';
  import { casesRegularite } from '../data/synthese.js';

  // compact : tuile pour téléphone (jours entraînés cette semaine + les 8 dernières semaines en barres)
  let { contexte, taille = 'm', compact = false } = $props();
  const NB_SEMAINES = 12;
  const cases = $derived(casesRegularite(contexte.seances, NB_SEMAINES));
  // Jours entraînés par semaine : les cases sont rangées par jour de semaine (lundi → dimanche), puis par semaine
  const joursParSemaine = $derived(
    Array.from({ length: NB_SEMAINES }, (_, col) => {
      let n = 0;
      for (let rangee = 0; rangee < 7; rangee++) {
        const c = cases[rangee * NB_SEMAINES + col];
        if (c && !c.vide && c.intensite > 0) n++;
      }
      return n;
    }),
  );
  const cetteSemaine = $derived(joursParSemaine[NB_SEMAINES - 1]);
</script>

{#if compact}
  <Tuile titre="Régularité" valeur={String(cetteSemaine)} unite={cetteSemaine > 1 ? 'jours' : 'jour'} note="d'entraînement cette semaine">
    <MiniBarres valeurs={joursParSemaine.slice(-8)} max={7} couleur="var(--sport-muscu)" etiquette="Jours d'entraînement par semaine sur 8 semaines" />
  </Tuile>
{:else}
  <Bloc titre="Régularité">
    <CarteChaleur {cases} etiquette="Carte des jours d'entraînement sur 12 semaines" />
  </Bloc>
{/if}
