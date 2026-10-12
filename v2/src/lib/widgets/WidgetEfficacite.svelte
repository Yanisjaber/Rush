<script>
  import Bloc from '../components/Bloc.svelte';
  import CourbeLissee from '../components/charts/CourbeLissee.svelte';
  import { efficaciteCourse } from '../data/synthese.js';
  import { formatAllure } from '../utils/format.js';

  let { contexte, taille = 'm' } = $props();
  const eff = $derived(efficaciteCourse(contexte.toutesSeances, contexte.hrMax));
  // Une allure plus basse (en s/km) est plus rapide : on inverse pour que « mieux » monte sur le graphique
  const valeurs = $derived(eff ? eff.points.map((p) => -p.allure) : []);
</script>

<Bloc titre="Allure à cardio égal">
  {#if eff}
    <div class="entete">
      <span class="allure titre">{formatAllure(eff.allureActuelle)}</span>
      <span class="variation" class:mieux={eff.amelioration > 0}>
        {eff.amelioration > 0 ? '+' : ''}{eff.amelioration.toString().replace('.', ',')} % en 12 semaines
      </span>
    </div>
    <CourbeLissee
      {valeurs}
      couleur="var(--sport-course)"
      hauteur={taille === 'l' ? 150 : 110}
      etiquette="Allure en endurance à cardio égal sur 12 semaines"
    />
    <p class="note">Sorties de plus de 3 km à 60–80 % de ta fréquence cardiaque max, regroupées par semaine.</p>
  {:else}
    <p class="vide">Il faut au moins trois semaines de sorties faciles avec cardio pour tracer ton efficacité.</p>
  {/if}
</Bloc>

<style>
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }
  .allure {
    font-size: 30px;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .variation {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 9px;
    border-radius: var(--rayon-rond);
    background: var(--surface-2);
    color: var(--texte-doux);
  }
  .variation.mieux {
    background: color-mix(in srgb, var(--ok) 16%, transparent);
    color: var(--ok);
  }
  .note,
  .vide {
    margin-top: 12px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .vide {
    margin-top: 0;
  }
</style>
