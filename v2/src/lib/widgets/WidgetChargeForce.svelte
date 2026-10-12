<script>
  import Bloc from '../components/Bloc.svelte';
  import { seancesForce } from '../data/synthese.js';

  // La force qui soutient le Hyrox (sled, farmers, lunges, wall balls) : combien de séances par semaine.
  let { contexte } = $props();
  const force = $derived(seancesForce(contexte.toutesSeances, 4));
</script>

<Bloc couleur="var(--sport-hybride)">
  <div class="etiquette">Charge de force</div>
  <div class="valeur titre">{String(force.moyenne).replace('.', ',')}<span class="unite">/sem.</span></div>
  <p class="note">
    {force.total ? `${force.total} séance${force.total > 1 ? 's' : ''} de force sur les 4 dernières semaines.` : 'Aucune séance de force sur les 4 dernières semaines.'}
  </p>
</Bloc>

<style>
  .etiquette {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .valeur {
    margin-top: 8px;
    font-size: 72px;
    line-height: 0.9;
    letter-spacing: -0.03em;
  }
  .unite {
    margin-left: 6px;
    font-size: 24px;
    letter-spacing: 0;
  }
  .note {
    margin-top: 12px;
    font-size: 13px;
    line-height: 1.4;
  }
</style>
