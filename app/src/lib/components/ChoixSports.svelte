<script>
  import { SPORTS, couleurSport } from '../sports.js';
  import { GROUPES_SPORTS } from '../data/sports-choisis.js';
  import { DISCIPLINES } from '../data/disciplines.js';

  // Choix des sports en pastilles compactes, rangées par thème : une pastille cochée se remplit de la couleur du sport.
  // `selection` est la liste des clés cochées ; `disciplines` les sous-disciplines cochées, par sport (ex. { athletisme: ['100m'] }). Les deux sont bindables.
  let { selection = $bindable([]), disciplines = $bindable({}), desactive = false } = $props();

  function basculer(cle) {
    selection = selection.includes(cle) ? selection.filter((s) => s !== cle) : [...selection, cle];
  }

  const dejaCochee = (sport, cle) => (disciplines[sport] || []).includes(cle);
  function basculerDiscipline(sport, cle) {
    const actuelles = disciplines[sport] || [];
    disciplines = { ...disciplines, [sport]: actuelles.includes(cle) ? actuelles.filter((c) => c !== cle) : [...actuelles, cle] };
  }
</script>

<div class="choix" role="group" aria-label="Tes sports">
  <div class="groupes">
    {#each GROUPES_SPORTS as groupe (groupe.titre)}
      <section class="groupe">
        <h3 class="titre-groupe">{groupe.titre}</h3>
        <div class="pastilles">
          {#each groupe.sports as cle (cle)}
            {@const actif = selection.includes(cle)}
            <button type="button" class="sport" class:actif aria-pressed={actif} disabled={desactive} onclick={() => basculer(cle)} style:--c={couleurSport(cle)}>
              <span class="point" aria-hidden="true"></span>
              {(SPORTS[cle] || SPORTS.autre).nom}
              {#if actif}<span class="coche" aria-hidden="true">✓</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <!-- Sous-disciplines : une rubrique par sport coché qui en a (aujourd'hui l'athlétisme) -->
  {#each Object.keys(DISCIPLINES) as sport (sport)}
    {#if selection.includes(sport)}
      <section class="disciplines" aria-label="Disciplines : {(SPORTS[sport] || SPORTS.autre).nom}" style:--c={couleurSport(sport)}>
        <h3 class="titre-groupe">Tes disciplines : {(SPORTS[sport] || SPORTS.autre).nom.toLowerCase()}</h3>
        <div class="familles">
          {#each DISCIPLINES[sport] as groupe (groupe.titre)}
            <div class="famille">
              <span class="titre-famille">{groupe.titre}</span>
              <div class="pastilles">
                {#each groupe.disciplines as d (d.cle)}
                  {@const actif = dejaCochee(sport, d.cle)}
                  <button type="button" class="discipline" class:actif aria-pressed={actif} disabled={desactive} onclick={() => basculerDiscipline(sport, d.cle)}>
                    {d.nom}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/each}
</div>

<style>
  .choix {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  /* les thèmes se rangent côte à côte tant qu'il y a la place */
  .groupes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px 32px;
  }
  .titre-groupe {
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--trait);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .pastilles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .sport {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 44px;
    padding: 0 18px 0 14px;
    border: 1.5px solid var(--trait-fort);
    border-radius: var(--rayon-rond);
    background: transparent;
    color: var(--texte);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, transform 0.12s;
  }
  .sport .point {
    width: 10px;
    height: 10px;
    flex: none;
    border-radius: 50%;
    background: var(--c);
  }
  .sport:hover:not(:disabled) {
    border-color: var(--c);
  }
  /* cochée : la pastille se remplit de la couleur du sport (texte foncé, la coche double l'information pour ne pas dépendre de la couleur) */
  .sport.actif {
    border-color: var(--c);
    background: var(--c);
    color: var(--encre-sur-couleur, #0c0d10);
  }
  .sport.actif .point {
    background: var(--encre-sur-couleur, #0c0d10);
  }
  .coche {
    font-weight: 800;
  }

  .disciplines {
    padding: 16px 18px 18px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .familles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px 28px;
  }
  .famille {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .titre-famille {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .discipline {
    min-height: 36px;
    padding: 0 13px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-rond);
    background: transparent;
    color: var(--texte);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .discipline:hover:not(:disabled) {
    border-color: var(--c);
  }
  .discipline.actif {
    border-color: var(--c);
    background: var(--c);
    color: var(--encre-sur-couleur, #0c0d10);
    font-weight: 700;
  }

  .sport:focus-visible,
  .discipline:focus-visible {
    outline: 3px solid var(--texte);
    outline-offset: 2px;
  }
  .sport:disabled,
  .discipline:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
