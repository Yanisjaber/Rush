<script>
  import Bloc from '../components/Bloc.svelte';
  import CourbeLissee from '../components/charts/CourbeLissee.svelte';
  import { recordsParGroupe } from '../data/force.js';
  import { menu } from '../stores/menu.svelte.js';
  import { construireAdresse } from '../data/adresses.js';
  import { formatKg, formatDateCourte } from '../utils/format.js';

  // Un exercice par groupe musculaire (pectoraux, dos, jambes, épaules, bras) : 1RM estimé, record éventuel et progression.
  // En taille moyenne il n'y a la place que pour 2 cartes (jambes et pectoraux en priorité).
  // compact : liste courte pour téléphone (3 exercices, une ligne chacun) ; la progression complète est dans l'analyse
  let { contexte, taille = 'l', compact = false } = $props();
  // Cliquer sur une carte ouvre la page Records déjà placée sur cet exercice (le reste du widget ouvre la page Records telle quelle)
  const lien = (cle) => construireAdresse({ sport: menu.filtre, page: '/analyse', sous: 'records', q: { exo: cle } });
  const pageExercices = construireAdresse({ sport: 'muscu', sous: 'exercices' });
  const exos = $derived(recordsParGroupe(contexte.force.series, compact ? 3 : taille === 'm' ? 2 : 5));
</script>

<Bloc titre="Tes records" {compact}>
  {#if exos.length && compact}
    <ul class="lignes">
      {#each exos as e (e.cle)}
        <li>
          <a class="ligne-record" href={lien(e.cle)} aria-label={`Voir la progression : ${e.nom}`}>
            <span class="nom-record">{e.nom}</span>
            {#if e.record}
              <span class="badge record">Record</span>
            {:else if e.delta != null && e.delta !== 0}
              <span class="badge">{e.delta > 0 ? '+' : '−'}{formatKg(Math.abs(e.delta))} kg</span>
            {/if}
            <span class="rm-record titre">{formatKg(e.rm)}<span class="unite">kg</span></span>
          </a>
        </li>
      {/each}
    </ul>
  {:else if exos.length}
    <div class="cartes">
      {#each exos as e (e.cle)}
        <a class="carte" href={lien(e.cle)} aria-label={`Voir la progression : ${e.nom}`}>
          <header>
            <h3>{e.nom}</h3>
            {#if e.record}
              <span class="badge record">Record</span>
            {:else if e.delta != null && e.delta !== 0}
              <span class="badge">{e.delta > 0 ? '+' : '−'}{formatKg(Math.abs(e.delta))} kg</span>
            {/if}
          </header>
          <div class="chiffre titre">{formatKg(e.rm)}<span class="unite">kg</span><span class="estime">1RM estimé</span></div>
          {#if e.serie.length > 1}
            <div class="courbe">
              <CourbeLissee valeurs={e.serie.map((p) => p.rm)} couleur="var(--sport-muscu)" hauteur={64} etiquette={`Progression du 1RM estimé : ${e.nom}`} />
            </div>
          {/if}
          <p class="pied">{formatDateCourte(e.date)} · {e.reps} × {formatKg(e.poids)} kg</p>
        </a>
      {/each}
    </div>
  {:else}
    <p class="vide">Tes records apparaîtront dès que tu auras enregistré quelques séries.</p>
  {/if}
  <!-- Le widget entier ouvre l'analyse des records ; ce lien-ci ouvre la liste de tous tes exercices (records, exercices perso) -->
  <a class="lien-exos" href={pageExercices}>Tous mes exercices et records ›</a>
</Bloc>

<style>
  .lien-exos {
    display: inline-flex;
    align-items: center;
    min-height: var(--cible);
    margin-top: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
  }
  .lien-exos:hover {
    color: var(--texte);
  }
  .lignes {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }
  .lignes li + li {
    border-top: 1px solid var(--trait);
  }
  .ligne-record {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
  }
  .nom-record {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rm-record {
    font-size: 20px;
    line-height: 1;
  }
  .rm-record .unite {
    margin-left: 3px;
    font-family: var(--police-texte);
    font-size: 12px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  .cartes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 12px;
  }
  .carte {
    display: block;
    color: inherit;
    text-decoration: none;
    padding: 16px 16px 14px;
    background: var(--surface-2);
    border-radius: var(--rayon);
    min-width: 0;
  }
  .carte:hover {
    background: color-mix(in srgb, var(--texte) 7%, var(--surface-2));
  }
  .carte:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--texte-doux);
  }
  .badge {
    flex: none;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: var(--rayon-rond);
    background: var(--surface);
    color: var(--texte-doux);
  }
  .badge.record {
    background: var(--sport-muscu);
    color: var(--encre-sur-couleur);
  }
  .chiffre {
    margin-top: 8px;
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
  .estime {
    margin-left: 8px;
    font-family: var(--police-texte);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
    color: var(--texte-doux);
  }
  .courbe {
    margin-top: 10px;
  }
  .pied {
    margin-top: 8px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .vide {
    font-size: 14px;
    color: var(--texte-doux);
  }
</style>
