<script>
  import { formatKg, formatNombre } from '../../utils/format.js';
  import { ouvrirPanneau } from '../../routeur.svelte.js';

  // Historique d'UN exercice : toutes les séances où tu l'as fait (la plus récente d'abord), et pour chacune toutes ses séries.
  //  exo : { nom, seances: [{ id (la séance à ouvrir, ou null), date, series: [{ reps, poids }], tonnage, rm, record }] }
  // Cliquer sur une séance ouvre son résumé (le même panneau que le calendrier et les widgets : l'adresse porte ?apercu=<id>).
  let { exo } = $props();

  const date = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const t = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1); // seulement la première lettre (« Ven. 2 oct. 2026 »)
  };
  const resume = (s) => [nbSeries(s.series.length), s.tonnage > 0 ? `${formatNombre(s.tonnage)} kg` : '', s.rm != null ? `1RM ${formatKg(s.rm)} kg` : ''].filter(Boolean).join(' · ');
  const serie = (s) => `${s.reps} × ${s.poids > 0 ? `${formatKg(s.poids)} kg` : 'poids du corps'}`;
  const nbSeries = (n) => `${n} série${n > 1 ? 's' : ''}`;
</script>

{#if exo?.seances?.length}
  <p class="total">{exo.seances.length} séance{exo.seances.length > 1 ? 's' : ''} · {nbSeries(exo.seances.reduce((t, s) => t + s.series.length, 0))}</p>
  <!-- La liste défile dans son cadre : la page ne s'allonge pas, même avec des années d'historique -->
  <div class="liste" tabindex="0" role="region" aria-label={`Historique des séances : ${exo.nom}`}>
    {#each exo.seances as s (s.date)}
      <article class="seance" class:cliquable={!!s.id}>
        {#if s.id}
          <button type="button" class="ouvrir" aria-label={`Ouvrir la séance du ${date(s.date)}`} onclick={() => ouvrirPanneau({ apercu: s.id })}></button>
        {/if}
        <header>
          <h3>{date(s.date)}</h3>
          {#if s.record}<span class="badge">Record</span>{/if}
          <p class="resume">{resume(s)}</p>
        </header>
        <ol class="series">
          {#each s.series as serieLigne, i (i)}
            <li><span class="n">{i + 1}</span>{serie(serieLigne)}</li>
          {/each}
        </ol>
      </article>
    {/each}
  </div>
{:else}
  <p class="vide">Aucune séance enregistrée pour cet exercice.</p>
{/if}

<style>
  .total {
    margin: 0 0 10px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .liste {
    max-height: 480px;
    overflow-y: auto;
    border-top: 1px solid var(--trait);
  }
  .liste:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .seance {
    position: relative;
    padding: 14px 0;
    border-bottom: 1px solid var(--trait);
  }
  /* Toute la séance est cliquable : un bouton invisible la recouvre (le contenu dessous n'est que du texte) */
  .ouvrir {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    border: 0;
    border-radius: var(--rayon-s);
    background: transparent;
    cursor: pointer;
  }
  .cliquable:hover {
    background: color-mix(in srgb, var(--texte) 4%, transparent);
  }
  .ouvrir:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: -2px;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin-bottom: 8px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
  }
  .badge {
    padding: 2px 10px;
    border-radius: var(--rayon-rond);
    background: var(--sport-muscu);
    color: var(--encre-sur-couleur);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .resume {
    margin: 0 0 0 auto;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .series {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .series li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 12px 0 8px;
    border-radius: var(--rayon-rond);
    background: var(--surface-2);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .n {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--texte) 14%, var(--surface-2));
    font-size: 11px;
    font-weight: 700;
    color: var(--texte-doux);
  }
  .vide {
    margin: 0;
    color: var(--texte-doux);
  }
</style>
