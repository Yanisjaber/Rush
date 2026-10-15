<script>
  import Bloc from '../components/Bloc.svelte';
  import Tuile from '../components/Tuile.svelte';
  import MiniBarres from '../components/MiniBarres.svelte';
  import { chargeMuscuRecente } from '../analyse/charge-muscu.js';

  // Charge de musculation : répétitions × (poids ÷ ton 1RM de l'exercice), sur 7 jours glissants.
  // Le badge compare à ton habitude ; la barre en couleur est la semaine en cours.
  // compact : tuile pour téléphone (chiffre clé + mini histogramme), le grand graphique est dans l'analyse
  let { contexte, compact = false } = $props();
  const c = $derived(chargeMuscuRecente(contexte.force.series));
  const maximum = $derived(Math.max(1, ...c.parSemaine));
  const aDesDonnees = $derived(c.parSemaine.some((v) => v > 0));
  const pct = $derived(c.ratio == null ? null : Math.round((c.ratio - 1) * 100));
</script>

{#if compact}
  <Tuile
    titre="Charge muscu"
    valeur={aDesDonnees ? String(c.derniere) : '—'}
    unite={aDesDonnees ? 'pts' : ''}
    note={aDesDonnees ? (pct != null ? `${pct > 0 ? '+' : ''}${pct} % vs habitude` : '7 derniers jours') : 'Aucune série récente'}
  >
    {#if aDesDonnees}<MiniBarres valeurs={c.parSemaine.slice(-8)} etiquette="Charge de musculation par semaine sur 8 semaines" />{/if}
  </Tuile>
{:else}
<Bloc titre="Charge musculation" remplir>
  {#if aDesDonnees}
    <div class="entete">
      <span class="valeur titre">{c.derniere}<span class="unite">pts</span></span>
      {#if pct != null}
        <span class="badge" class:mieux={c.zone.cle === 'ok'} class:haut={c.zone.cle === 'attention' || c.zone.cle === 'danger'}>{pct > 0 ? '+' : ''}{pct} % vs habitude</span>
      {/if}
      <span class="periode">12 dernières semaines</span>
    </div>
    <div class="barres" role="img" aria-label="Charge de musculation par semaine sur 12 semaines">
      {#each c.parSemaine as v, i}
        <span class="colonne" class:derniere={i === c.parSemaine.length - 1}>
          <span class="barre" style:height="{(v / maximum) * 100}%"></span>
        </span>
      {/each}
    </div>
    <p class="note">{c.zone.cle === 'inconnu' ? 'Pas encore assez d\'historique pour te comparer à ton habitude.' : `Charge ${c.zone.libelle}.`}</p>
  {:else}
    <p class="vide">Aucune série sur les 12 dernières semaines. Enregistre une séance pour voir ta charge.</p>
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
  .badge.haut {
    background: color-mix(in srgb, var(--alerte) 16%, transparent);
    color: var(--alerte);
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
