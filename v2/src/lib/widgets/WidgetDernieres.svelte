<script>
  import Bloc from '../components/Bloc.svelte';
  import { chargeSeance } from '../data/synthese.js';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS, couleurSport } from '../sports.js';
  import { formatDuree, formatKm, formatDateCourte } from '../utils/format.js';

  let { contexte, taille = 'm' } = $props();
  const recentes = $derived(contexte.seances.slice(0, taille === 'l' ? 8 : 5));
  const nomFamille = (f) => (SPORTS[f] || SPORTS.autre).court;

  function detail(s) {
    const morceaux = [formatDateCourte(s.start_date_local), formatDuree(s.moving_time)];
    if (s.distance_km) morceaux.push(`${formatKm(s.distance_km)} km`);
    return morceaux.join(' · ');
  }
</script>

<Bloc titre="Dernières séances">
  {#if recentes.length}
    <ul class="seances">
      {#each recentes as s (s.id)}
        <li>
          <a class="ligne" href="#/seance/{s.id}">
            <span class="barre" style:background={couleurSport(familleAffichage(s.sport))}></span>
            <div class="infos">
              <div class="nom">{s.name || nomFamille(familleAffichage(s.sport))}</div>
              <div class="detail">{detail(s)}</div>
            </div>
            <div class="points"><span class="titre">{chargeSeance(s)}</span><span class="petit">pts</span></div>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="vide">Aucune séance à afficher.</p>
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
  .detail,
  .petit {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .points {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .points .titre {
    font-size: 20px;
    line-height: 1;
    letter-spacing: 0;
  }
  .vide {
    color: var(--texte-doux);
  }
</style>
