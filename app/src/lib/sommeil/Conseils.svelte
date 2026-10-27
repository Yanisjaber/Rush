<script>
  import Bloc from '../components/Bloc.svelte';
  import { COULEUR_TON } from './palette.js';
  import { REPERES, tesDernieresNuits, analyser, signauxPhysio, synthese, planAction, texteHM } from '../data/score-sommeil.js';

  // Conseils : analyse des dernières nuits (informatif, ne remplace pas un avis médical).
  //  nuits : nuits préparées (la plus récente d'abord)
  let { nuits = [] } = $props();

  const pro = $derived(analyser(nuits));
  const signaux = $derived(pro ? signauxPhysio(pro) : []);
  const plan = $derived(pro ? planAction(pro) : []);
  const h = $derived(pro?.horaires);
  const NOM_IMPACT = { fort: 'Impact fort', modere: 'Impact modéré', general: 'Général' };

  // Puces d'architecture : valeur moyenne comparée à la cible (au-dessus de la fourchette, ce n'est pas un problème : « bon »)
  const puce = (nom, valeur, [bas, haut]) => (valeur == null ? null : { nom, valeur: Math.round(valeur), bas, haut, etat: valeur >= bas ? 'bon' : valeur < bas * 0.6 ? 'mauvais' : 'attention' });
  const puces = $derived(pro ? [puce('Profond', pro.profondPct, REPERES.profondPct), puce('Paradoxal', pro.paradoxalPct, REPERES.paradoxalPct)].filter(Boolean) : []);
  const profondOk = $derived(pro?.profondPct != null && pro.profondPct >= REPERES.profondPct[0]);
  const paradoxalOk = $derived(pro?.paradoxalPct != null && pro.paradoxalPct >= REPERES.paradoxalPct[0]);
  const texteArchitecture = $derived(
    pro
      ? `Sur ${tesDernieresNuits(pro.nbAnalysees)}, le sommeil profond représente en moyenne ${pro.profondPct != null ? `${Math.round(pro.profondPct)} %` : '—'} et le sommeil paradoxal ${pro.paradoxalPct != null ? `${Math.round(pro.paradoxalPct)} %` : '—'} du temps de sommeil. ` +
          (profondOk
            ? `La part de sommeil profond, qui porte l'essentiel de la récupération physique, est dans la norme attendue (${REPERES.profondPct[0]}–${REPERES.profondPct[1]} %). `
            : `La part de sommeil profond est sous la cible (${REPERES.profondPct[0]}–${REPERES.profondPct[1]} %) : c'est la phase la plus sensible à l'heure de coucher et à l'alcool en soirée. `) +
          (paradoxalOk
            ? 'Le sommeil paradoxal, lié à la consolidation de la mémoire, est également correct.'
            : `Le sommeil paradoxal est sous la cible (${REPERES.paradoxalPct[0]}–${REPERES.paradoxalPct[1]} %) : il se concentre en fin de nuit, donc les réveils précoces le rognent en premier.`)
      : '',
  );
</script>

{#if !pro}
  <Bloc><p class="info">Pas encore assez de nuits pour une analyse détaillée.</p></Bloc>
{:else}
  <div class="colonne">
    <Bloc titre="Analyse">
      <p class="legende-bloc">Basée sur {tesDernieresNuits(pro.nbAnalysees)}. Informatif, ne remplace pas un avis médical.</p>
      <div class="boites">
        <div class="boite"><span class="etiq">Efficacité</span><strong>{pro.efficaciteMoy != null ? `${Math.round(pro.efficaciteMoy)} %` : '—'}</strong><span class="sous">cible ≥ {REPERES.efficaciteBonne} %</span></div>
        <div class="boite"><span class="etiq">Endormissement</span><strong>{pro.latenceMoy != null ? `${Math.round(pro.latenceMoy)} min` : '—'}</strong><span class="sous">cible ≤ {REPERES.latenceBonne} min</span></div>
        <div class="boite"><span class="etiq">Dette (7 jours)</span><strong>{texteHM(Math.round(pro.detteMin))}</strong><span class="sous">par rapport à 8 h par nuit</span></div>
        {#if h}<div class="boite"><span class="etiq">Régularité du coucher</span><strong>± {texteHM(Math.round(h.ecartCoucherMin / 2))}</strong><span class="sous">écart sur la période</span></div>{/if}
      </div>
      <p class="synthese">{synthese(nuits, pro)}</p>
    </Bloc>

    {#if puces.length}
      <Bloc titre="Architecture du sommeil">
        <div class="puces">
          {#each puces as p (p.nom)}
            <span class="puce" style:--ton={COULEUR_TON[p.etat]}>{p.nom} : {p.valeur} % <span class="cible">(cible {p.bas}–{p.haut} %)</span></span>
          {/each}
        </div>
        <p class="synthese">{texteArchitecture}</p>
      </Bloc>
    {/if}

    {#if signaux.length}
      <Bloc titre="Signaux physiologiques">
        <p class="legende-bloc">Dernière nuit comparée à ta moyenne récente (jusqu'à 30 nuits).</p>
        <ul class="signaux">
          {#each signaux as s (s.cle)}
            <li style:--ton={COULEUR_TON[s.ton]}>
              <span class="point" aria-hidden="true"></span>
              <div>
                <p class="titre-signal">{s.titre} <strong>{s.valeur}</strong></p>
                <p class="texte-signal">{s.texte}</p>
              </div>
            </li>
          {/each}
        </ul>
      </Bloc>
    {/if}

    <Bloc titre="Plan d'action priorisé">
      <ul class="plan">
        {#each plan as a, i (i)}
          <li><span class="impact {a.impact}">{NOM_IMPACT[a.impact]}</span><span>{a.texte}</span></li>
        {/each}
      </ul>
    </Bloc>

    {#if h}
      <Bloc titre="Objectifs">
        <div class="boites">
          <div class="boite"><span class="etiq">Coucher visé</span><strong>{h.coucherVise}</strong><span class="sous">± 30 min</span></div>
          <div class="boite"><span class="etiq">Lever visé</span><strong>{h.leverVise}</strong></div>
          <div class="boite"><span class="etiq">Durée visée</span><strong>{texteHM(REPERES.dureeCibleMin)}</strong><span class="sous">actuel : {texteHM(h.dureeMoyMin)}</span></div>
        </div>
      </Bloc>
    {/if}

    <p class="avertissement">
      Le score et les analyses viennent des mesures Garmin (montre au poignet), recalculés selon des seuils publiés : Hirshkowitz et al. 2015 pour la durée (National Sleep Foundation) et Ohayon et al. 2017 pour l'efficacité, l'endormissement, les réveils et l'éveil nocturne (consensus d'experts). L'architecture profond/paradoxal suit des normes descriptives de polysomnographie, pas un seuil de qualité validé : elle est pondérée en conséquence. Ce n'est pas un diagnostic médical : en cas de doute (fatigue persistante, ronflements, SpO2 basse récurrente…), consulte un médecin.
    </p>
  </div>
{/if}

<style>
  .colonne {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 900px;
  }
  .info,
  .legende-bloc {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .legende-bloc {
    margin: -6px 0 14px;
    font-size: 13px;
  }
  .boites {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }
  .boite {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    border-radius: var(--rayon);
    background: var(--surface-2);
  }
  .boite strong {
    font-family: var(--police-titre);
    font-size: 24px;
  }
  .etiq {
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .sous {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .synthese {
    font-size: 15px;
    line-height: 1.55;
    color: var(--texte-doux);
  }
  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .puce {
    padding: 6px 14px;
    border: 1px solid var(--ton);
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    color: var(--ton);
  }
  .cible {
    font-weight: 400;
    opacity: 0.75;
  }
  .signaux {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .signaux li {
    display: flex;
    gap: 12px;
  }
  .point {
    width: 10px;
    height: 10px;
    margin-top: 7px;
    border-radius: 50%;
    background: var(--ton);
    flex: none;
  }
  .titre-signal {
    font-size: 15px;
    font-weight: 600;
  }
  .titre-signal strong {
    margin-left: 8px;
    color: var(--ton);
  }
  .texte-signal {
    margin-top: 2px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .plan {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .plan li {
    display: flex;
    gap: 12px;
    font-size: 15px;
    line-height: 1.5;
  }
  .impact {
    flex: 0 0 auto;
    align-self: flex-start;
    margin-top: 2px;
    padding: 2px 10px;
    border: 1px solid var(--trait-fort);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    color: var(--texte-doux);
  }
  .impact.fort {
    border-color: var(--danger);
    color: var(--danger);
  }
  .impact.modere {
    border-color: var(--alerte);
    color: var(--alerte);
  }
  .avertissement {
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--texte-muet);
  }
</style>
