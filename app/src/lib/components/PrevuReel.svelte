<script>
  import Bloc from './Bloc.svelte';
  import Bouton from './Bouton.svelte';
  import { calculerAdherence } from '../data/adherence.js';
  import { normaliser } from '../data/structure.js';
  import { formatDuree, formatKm, formatDateLongue } from '../utils/format.js';

  // « Prévu contre réalisé » : compare la séance prévue liée à la sortie (durée, charge, distance) et, si elle a une structure en
  // puissance, note chaque effort (adhérence par intervalle). Sans lien, propose les séances prévues du même jour.
  //  prevue : séance prévue liée (ou null) · candidates : séances prévues du même jour · seance : la sortie · charge : charge réalisée
  //  watts : puissance par seconde (ou null) · ftp : FTP (ou null) · onlier(id) / odelier() · erreur / envoi : état du parent
  let { prevue = null, candidates = [], seance, charge = 0, watts = null, ftp = null, onlier, odelier, erreur = '', envoi = false } = $props();

  const structure = $derived(prevue ? normaliser(prevue.structure, 'power') : []);
  const adherence = $derived(structure.length ? calculerAdherence(structure, watts, ftp) : null);
  const raisonAbsente = $derived(
    !structure.length ? '' : !ftp ? 'Renseigne ta FTP dans les paramètres pour noter les efforts.' : !watts?.length ? 'Pas de courbe de puissance pour cette sortie.' : 'Cette séance n’a pas d’effort en puissance à noter.',
  );
  const lignes = $derived(
    prevue
      ? [
          prevue.duration ? { nom: 'Durée', prevu: formatDuree(prevue.duration * 60), reel: formatDuree(seance.moving_time) } : null,
          prevue.tss ? { nom: 'Charge', prevu: `${prevue.tss} pts`, reel: `${charge} pts` } : null,
          prevue.km && seance.distance_km ? { nom: 'Distance', prevu: `${formatKm(prevue.km)} km`, reel: `${formatKm(seance.distance_km)} km` } : null,
        ].filter(Boolean)
      : [],
  );
  const TON = { bon: 'var(--ok)', attention: 'var(--alerte)', mauvais: 'var(--danger)' };
  const tonGlobal = $derived(adherence ? (adherence.global >= 90 ? 'bon' : adherence.global >= 75 ? 'attention' : 'mauvais') : 'attention');
</script>

{#if prevue || candidates.length}
  <Bloc titre="Prévu contre réalisé">
    {#if prevue}
      <div class="entete">
        <p class="prevue"><strong>{prevue.name}</strong><span> · prévue le {formatDateLongue(prevue.date)}</span></p>
        {#if adherence}<span class="global" style:--ton={TON[tonGlobal]} title="Adhérence globale : moyenne des efforts, pondérée par leur durée">{adherence.global} %</span>{/if}
      </div>

      {#if lignes.length}
        <table class="comparaison">
          <thead><tr><th scope="col"><span class="cache">Mesure</span></th><th scope="col">Prévu</th><th scope="col">Réalisé</th></tr></thead>
          <tbody>
            {#each lignes as l (l.nom)}<tr><th scope="row">{l.nom}</th><td>{l.prevu}</td><td><strong>{l.reel}</strong></td></tr>{/each}
          </tbody>
        </table>
      {/if}

      {#if adherence}
        <h3>Adhérence par intervalle</h3>
        <ul class="efforts">
          {#each adherence.items as it, i (i)}
            <li style:--ton={TON[it.ton]}>
              <span class="nom">{it.libelle} · {it.minutes < 1 ? `${Math.round(it.minutes * 60)} s` : `${String(Math.round(it.minutes * 10) / 10).replace('.', ',')} min`}</span>
              <span class="piste" role="img" aria-label="{it.moyenne} watts réalisés pour une cible de {it.cibleBas} à {it.cibleHaut} watts, soit {it.pct} %">
                <span class="rempli" style:width="{Math.min(100, Math.max(4, it.pct) / 1.25)}%"></span>
                <span class="cible" style:left="80%"></span>
              </span>
              <span class="chiffres"><strong>{it.moyenne} W</strong> / {it.cibleBas}{it.cibleHaut !== it.cibleBas ? `–${it.cibleHaut}` : ''} · <b>{it.pct} %</b></span>
            </li>
          {/each}
        </ul>
        <p class="aide">Le repère est la cible. Chaque effort est jugé sur la meilleure fenêtre de puissance de la durée prévue.</p>
      {:else if raisonAbsente}
        <p class="aide">{raisonAbsente}</p>
      {/if}

      <div class="actions"><Bouton variante="texte" onclick={odelier}>{envoi ? 'Enregistrement…' : 'Délier de cette séance prévue'}</Bouton></div>
    {:else}
      <p class="aide">Une séance était prévue ce jour-là ? Relie-la à cette sortie pour comparer prévu et réalisé.</p>
      <ul class="candidates">
        {#each candidates as c (c.id)}
          <li>
            <span><strong>{c.name}</strong>{#if c.duration} · {formatDuree(c.duration * 60)}{/if}</span>
            <Bouton variante="discret" onclick={() => onlier?.(c.id)}>{envoi ? '…' : 'Lier à cette sortie'}</Bouton>
          </li>
        {/each}
      </ul>
    {/if}
    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
  </Bloc>
{/if}

<style>
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 14px;
  }
  .prevue {
    font-size: 15px;
  }
  .prevue span {
    color: var(--texte-doux);
  }
  .global {
    min-width: 76px;
    padding: 6px 14px;
    border: 2px solid var(--ton);
    border-radius: var(--rayon-l);
    font-family: var(--police-titre);
    font-size: 26px;
    font-weight: 700;
    text-align: center;
    color: var(--ton);
  }
  .comparaison {
    width: 100%;
    max-width: 460px;
    margin-bottom: 18px;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 8px 6px;
    border-top: 1px solid var(--trait);
    text-align: left;
    font-weight: 400;
  }
  thead th {
    border-top: 0;
    font-size: 12px;
    color: var(--texte-muet);
  }
  tbody th {
    color: var(--texte-doux);
  }
  .cache {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  h3 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .efforts {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .efforts li {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr) 190px;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  @media (max-width: 640px) {
    .efforts li {
      grid-template-columns: 1fr;
      gap: 4px;
    }
  }
  .nom {
    color: var(--texte-doux);
  }
  .piste {
    position: relative;
    display: block;
    height: 12px;
    border-radius: 6px;
    background: var(--trait);
    overflow: hidden;
  }
  .rempli {
    display: block;
    height: 100%;
    background: var(--ton);
  }
  .cible {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--texte);
    opacity: 0.8;
  }
  .chiffres {
    text-align: right;
    color: var(--texte-doux);
  }
  .chiffres strong,
  .chiffres b {
    color: var(--texte);
  }
  .chiffres b {
    color: var(--ton);
  }
  .aide {
    margin-top: 10px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .actions {
    margin-top: 6px;
  }
  .candidates {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }
  .candidates li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    padding: 10px 14px;
    border-radius: var(--rayon);
    background: var(--surface-2);
    font-size: 14px;
  }
  .erreur {
    margin-top: 10px;
    font-size: 14px;
    color: var(--danger);
  }
</style>
