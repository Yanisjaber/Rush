<script>
  import Bloc from '../components/Bloc.svelte';
  import Tuile from '../components/Tuile.svelte';
  import MiniBarres from '../components/MiniBarres.svelte';
  import { tonnageParSemaine } from '../data/force.js';
  import { formatNombre } from '../utils/format.js';

  // compact : tuile pour téléphone (chiffre clé + mini histogramme), le grand graphique est dans l'analyse
  let { contexte, compact = false } = $props();
  const t = $derived(tonnageParSemaine(contexte.force.series));
  const maximum = $derived(Math.max(1, ...t.parSemaine));
  const aDesDonnees = $derived(t.parSemaine.some((v) => v > 0));
</script>

{#if compact}
  <Tuile
    titre="Tonnage / semaine"
    valeur={aDesDonnees ? formatNombre(t.derniere) : '—'}
    unite={aDesDonnees ? 'kg' : ''}
    note={aDesDonnees ? (t.ecartPct != null ? `${t.ecartPct > 0 ? '+' : ''}${t.ecartPct} % vs moyenne` : '12 dernières semaines') : 'Pas encore de séries'}
  >
    {#if aDesDonnees}<MiniBarres valeurs={t.parSemaine.slice(-8)} etiquette="Tonnage par semaine sur 8 semaines" />{/if}
  </Tuile>
{:else}
<Bloc titre="Tonnage par semaine" remplir>
  {#if aDesDonnees}
    <div class="entete">
      <span class="valeur titre">{formatNombre(t.derniere)}<span class="unite">kg</span></span>
      {#if t.ecartPct != null}
        <span class="badge" class:mieux={t.ecartPct >= 0}>{t.ecartPct > 0 ? '+' : ''}{t.ecartPct} % vs moyenne</span>
      {/if}
      <span class="periode">12 dernières semaines</span>
    </div>
    <div class="barres" role="img" aria-label="Tonnage soulevé par semaine sur 12 semaines">
      {#each t.parSemaine as v, i}
        <span class="colonne" class:derniere={i === t.parSemaine.length - 1}>
          <span class="barre" style:height="{(v / maximum) * 100}%"></span>
        </span>
      {/each}
    </div>
    <p class="note">Tonnage = répétitions × charge, additionné sur 7 jours glissants.</p>
  {:else}
    <p class="vide">Pas encore de séries enregistrées. Démarre une séance pour voir ton tonnage.</p>
  {/if}
</Bloc>
{/if}

<style>
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 14px;
    margin-bottom: 14px;
  }
  .valeur {
    font-size: 40px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .unite {
    margin-left: 4px;
    font-family: var(--police-texte);
    font-size: 16px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  .badge {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 9px;
    border-radius: var(--rayon-rond);
    background: var(--surface-2);
    color: var(--texte-doux);
  }
  .badge.mieux {
    background: color-mix(in srgb, var(--ok) 16%, transparent);
    color: var(--ok);
  }
  .periode {
    margin-left: auto;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .barres {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    flex: 1; /* le graphique prend toute la hauteur disponible de la carte */
    min-height: 120px;
    border-bottom: 1px solid var(--trait);
  }
  .colonne {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    opacity: 0.55;
  }
  .colonne.derniere {
    opacity: 1;
  }
  .barre {
    display: block;
    width: 100%;
    min-height: 2px;
    background: var(--sport-muscu);
    border-radius: 3px 3px 0 0;
  }
  .note,
  .vide {
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .vide {
    margin-top: 0;
    font-size: 14px;
  }
</style>
