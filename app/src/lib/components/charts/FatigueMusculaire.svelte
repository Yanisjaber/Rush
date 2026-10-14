<script>
  // Fatigue de chaque groupe musculaire : six pastilles (le % d'une grosse journée et le délai avant d'être prêt), et sous
  // elles la courbe du groupe choisi (6 semaines passées, puis 7 jours prévus si tu ne le retravailles pas).
  // groupes : [{ groupe, nom, pct, zone, heures, courbe: { passe: [{ iso, pct }], futur: [{ iso, pct }] } | null }]
  import GraphiqueLignes from './GraphiqueLignes.svelte';
  import { texteDelai } from '../../analyse/fatigue-musculaire.js';
  let { groupes = [] } = $props();

  // Par défaut : le groupe le plus fatigué (sinon le premier qui a une courbe)
  let choix = $state(null);
  const calibres = $derived(groupes.filter((g) => g.courbe));
  const actif = $derived(calibres.find((g) => g.groupe === choix) || [...calibres].sort((a, b) => b.pct - a.pct)[0] || null);

  const courbe = $derived.by(() => {
    if (!actif) return null;
    const { passe, futur } = actif.courbe;
    const vide = passe.slice(0, -1).map(() => null);
    return {
      etiquettes: [...passe.map((p) => p.iso), ...futur.map((p) => p.iso)],
      series: [
        { nom: 'Fatigue', couleur: 'var(--sport-muscu)', valeurs: [...passe.map((p) => p.pct), ...futur.map(() => null)] },
        { nom: 'Prévue sans nouvelle séance', couleur: 'var(--sport-muscu)', pointille: true, valeurs: [...vide, passe[passe.length - 1].pct, ...futur.map((p) => p.pct)] },
      ],
      max: Math.max(110, ...passe.map((p) => p.pct + 10)),
    };
  });
</script>

<div class="fatigue">
  <ul class="pastilles">
    {#each groupes as g (g.groupe)}
      <li>
        <button type="button" class="z-{g.zone.cle}" class:actif={actif?.groupe === g.groupe} aria-pressed={actif?.groupe === g.groupe} disabled={!g.courbe} onclick={() => (choix = g.groupe)}>
          <span class="nom">{g.nom}</span>
          <span class="pct">{g.pct == null ? '—' : `${g.pct} %`}</span>
          <span class="etat">{g.pct == null ? 'pas de repère' : texteDelai(g.heures)}</span>
        </button>
      </li>
    {/each}
  </ul>

  {#if courbe}
    <GraphiqueLignes
      etiquettes={courbe.etiquettes}
      series={courbe.series}
      bandes={[
        { de: 0, a: 20, couleur: 'var(--ok)', libelle: 'Prêt' },
        { de: 75, a: 200, couleur: 'var(--danger)', libelle: 'Cuit' },
      ]}
      min={0}
      max={courbe.max}
      etiquette={`Fatigue : ${actif.nom}`}
    />
    <p class="note">{actif.nom} · en pointillés : ce qui t'attend si tu ne le retravailles pas. Il faut au moins 5 journées de travail d'un groupe pour le calibrer.</p>
  {:else}
    <p class="note">Pas encore assez de séances : il faut au moins 5 journées de travail d'un groupe pour mesurer sa fatigue.</p>
  {/if}
</div>

<style>
  .fatigue {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pastilles {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
    min-height: 44px;
    padding: 12px 6px;
    border: 1px solid transparent;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
    color: var(--texte);
    font: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  button:not(:disabled):hover {
    border-color: var(--trait-fort);
  }
  button.actif {
    border-color: var(--sport-muscu);
  }
  button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .nom {
    font-size: 13px;
    font-weight: 600;
  }
  .pct {
    font-family: var(--police-titre);
    font-size: 24px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .etat {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .z-forte .pct {
    color: var(--danger);
  }
  .z-marquee .pct {
    color: var(--alerte);
  }
  .z-frais .pct {
    color: var(--ok);
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--texte-doux);
  }
  @media (max-width: 760px) {
    .pastilles {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
