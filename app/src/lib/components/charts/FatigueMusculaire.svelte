<script>
  // Fatigue de chaque groupe musculaire (et de chaque muscle sur le corps) : plus c'est foncé, plus c'est fatigué.
  // groupes : [{ groupe, nom, pct, zone, heures }] · muscles : { [slug]: { nom, groupe, pct } } (pct : % d'une grosse journée, null si pas de repère)
  import SilhouetteCorps from './SilhouetteCorps.svelte';
  import { texteDelai } from '../../analyse/fatigue-musculaire.js';
  let { groupes = [], muscles = {} } = $props();

  // Le corps attend « pct » partout : on passe 0 quand on n'a pas de repère (muscle gris)
  const pourLeCorps = $derived(Object.fromEntries(Object.entries(muscles).map(([k, m]) => [k, { ...m, pct: m.pct ?? 0 }])));
</script>

<div class="fatigue">
  <div class="corps"><SilhouetteCorps muscles={pourLeCorps} etiquette="Fatigue de chaque muscle" /></div>
  <ul class="liste">
    {#each groupes as g (g.groupe)}
      <li class="z-{g.zone.cle}">
        <span class="ligne"><span class="nom">{g.nom}</span><b>{g.pct == null ? '—' : `${g.pct} %`}</b></span>
        <span class="barre" aria-hidden="true"><span style:width="{Math.min(g.pct ?? 0, 130) / 1.3}%"></span></span>
        <span class="etat">{g.zone.libelle}{g.pct != null ? ` · ${texteDelai(g.heures)}` : ' (il faut au moins 5 journées de ce groupe)'}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .fatigue {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    align-items: stretch;
  }
  .corps {
    height: clamp(360px, 36vw, 480px);
    padding: 16px 8px 8px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .liste {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .ligne {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 15px;
  }
  .nom {
    font-weight: 600;
  }
  .ligne b {
    font-family: var(--police-titre);
    font-variant-numeric: tabular-nums;
  }
  .barre {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--trait-fort);
    overflow: hidden;
  }
  .barre span {
    display: block;
    height: 100%;
    background: var(--sport-muscu);
  }
  .etat {
    font-size: 13px;
    color: var(--texte-doux);
  }
  @media (max-width: 760px) {
    .fatigue {
      grid-template-columns: 1fr;
    }
  }
</style>
