<script>
  import Bloc from '../components/Bloc.svelte';
  import { prochainesPrevues } from '../data/synthese.js';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS, couleurSport } from '../sports.js';
  import { formatDuree, formatDateCourte } from '../utils/format.js';

  // Les prochaines séances que tu as prévues (les compétitions sont dans le dossard d'objectif).
  let { contexte, taille = 'm' } = $props();
  const prochaines = $derived(prochainesPrevues(contexte.planifiees || [], new Date(), taille === 'l' ? 5 : 3));
  const nomFamille = (sport) => (SPORTS[familleAffichage(sport)] || SPORTS.autre).court;

  function detail(p) {
    const morceaux = [formatDateCourte(p.date)];
    if (p.duration) morceaux.push(formatDuree(p.duration * 60));
    if (p.km) morceaux.push(`${String(Math.round(p.km * 10) / 10).replace('.', ',')} km`);
    return morceaux.join(' · ');
  }
</script>

<Bloc titre="À venir">
  {#if prochaines.length}
    <ul class="seances">
      {#each prochaines as p (p.id)}
        <li>
          <a class="ligne" href="#/calendrier">
            <span class="barre" style:background={couleurSport(familleAffichage(p.sport))}></span>
            <div class="infos">
              <div class="nom">{p.name || nomFamille(p.sport)}</div>
              <div class="detail">{detail(p)}</div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="vide">Aucune séance prévue. <a href="#/calendrier">Planifie la prochaine depuis le calendrier</a>.</p>
  {/if}
</Bloc>

<style>
  .seances li {
    border-top: 1px solid var(--trait);
  }
  .seances li:first-child {
    border-top: 0;
  }
  .ligne {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
  }
  .ligne:hover .nom {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .barre {
    width: 6px;
    height: 36px;
    border-radius: 3px;
    flex: none;
  }
  .infos {
    flex: 1;
    min-width: 0;
  }
  .nom {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .vide {
    color: var(--texte-doux);
  }
  .vide a {
    color: var(--texte);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
