<script>
  import Bloc from '../components/Bloc.svelte';
  import { ouvrirApercu } from '../stores/apercu.svelte.js';
  import { chargeSeance } from '../data/synthese.js';
  import { recordsParSeance } from '../data/force.js';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS, couleurSport } from '../sports.js';
  import { formatDuree, formatKm, formatDateCourte } from '../utils/format.js';

  // Les plus récentes, quelle que soit leur date (contexte.dernieres) : la liste ne se vide pas pendant une pause.
  // Autant de lignes que la carte a de place : on mesure la hauteur disponible (la carte prend celle de sa rangée, la liste
  // ne l'agrandit jamais) et on divise par la hauteur d'une ligne.
  // compact : liste courte pour téléphone (3 lignes, sans mesure de hauteur) ; le journal complet s'ouvre en touchant la carte
  let { contexte, taille = 'm', compact = false } = $props();
  const HAUTEUR_LIGNE = 61; // 60 px mini + 1 px de séparation
  let hauteur = $state(0);
  let zone = $state(); // l'élément qui reçoit la liste
  // Mesure explicite (et pas bind:clientHeight) : on relit la hauteur à chaque changement de taille de la zone
  $effect(() => {
    if (!zone) return;
    const mesurer = () => (hauteur = zone.clientHeight);
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(zone);
    return () => obs.disconnect();
  });
  const nb = $derived(compact ? 3 : hauteur ? Math.max(1, Math.floor((hauteur + 1) / HAUTEUR_LIGNE)) : taille === 'l' ? 8 : 5); // avant la mesure : l'ancien nombre fixe
  // Les records battus dans chaque séance (sur tout l'historique de force) : une pastille « Record » ou « 2 records »
  const records = $derived(recordsParSeance(contexte.force.series));
  const recentes = $derived(contexte.dernieres.slice(0, nb));
  const nomFamille = (f) => (SPORTS[f] || SPORTS.autre).court;

  function detail(s) {
    const morceaux = [formatDateCourte(s.start_date_local), formatDuree(s.moving_time)];
    if (s.distance_km) morceaux.push(`${formatKm(s.distance_km)} km`);
    return morceaux.join(' · ');
  }
</script>

<div class="cadre">
<Bloc titre="Dernières séances" {compact}>
  {#if recentes.length}
    <div class="zone" class:plat={compact} bind:this={zone}>
    <ul class="seances">
      {#each recentes as s (s.id)}
        <li>
          <a class="ligne" href="#/seance/{s.id}" onclick={(e) => { e.preventDefault(); ouvrirApercu(s); }}>
            <span class="barre" style:background={couleurSport(familleAffichage(s.sport))}></span>
            <div class="infos">
              <div class="titre-ligne">
                <div class="nom">{s.name || nomFamille(familleAffichage(s.sport))}</div>
                {#if records.get(s.id)?.length}
                  {@const n = records.get(s.id).length}
                  <span class="record" title={records.get(s.id).join(', ')}>{n > 1 ? `${n} records` : 'Record'}</span>
                {/if}
              </div>
              <div class="detail">{detail(s)}</div>
            </div>
            <div class="points"><span class="titre">{chargeSeance(s)}</span><span class="petit">pts</span></div>
          </a>
        </li>
      {/each}
    </ul>
    </div>
  {:else}
    <p class="vide">Aucune séance à afficher.</p>
  {/if}
</Bloc>
</div>

<style>
  /* La carte remplit la rangée ; la zone de la liste prend tout l'espace restant sous le titre (au moins 4 lignes) et la liste,
     posée dessus en absolu, ne peut pas l'agrandir : c'est la hauteur de la rangée qui décide du nombre de lignes. */
  .cadre {
    display: flex;
  }
  .cadre :global(.bloc) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .zone {
    position: relative;
    flex: 1;
    min-height: 244px; /* 4 lignes : la carte ne dépasse jamais les autres, elle prend la hauteur de sa rangée et ajoute des lignes si elle est plus haute */
  }
  .zone.plat {
    min-height: 0;
  }
  .zone.plat .seances {
    position: static;
  }
  .zone.plat .ligne {
    min-height: 52px;
  }
  .seances {
    position: absolute;
    inset: 0;
    overflow: hidden;
    margin: 0;
    padding: 0;
    list-style: none;
  }
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
  .titre-ligne {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .record {
    flex: none;
    padding: 2px 8px;
    border-radius: var(--rayon-rond);
    background: var(--sport-muscu);
    color: var(--encre-sur-couleur);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.4;
    white-space: nowrap;
  }
  .nom {
    min-width: 0;
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
