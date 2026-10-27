<script>
  import Bloc from '../components/Bloc.svelte';
  import GrapheNuits from '../components/charts/GrapheNuits.svelte';
  import { COULEURS_PHASE } from './palette.js';
  import { comparaisons, ecartHeures, bornesAuto, joursSansNuit, moyenneDe, bandeStress, texteHM, texteHMdepuisSec } from '../data/score-sommeil.js';

  // Graphiques : l'évolution des 30 dernières nuits (durée et score, phases, HRV, respiration, SpO2, stress)
  // et deux comparaisons (7 derniers jours contre les 7 précédents ; semaine contre week-end).
  //  nuits : nuits préparées (la plus récente d'abord)
  let { nuits = [] } = $props();

  const valides = $derived(nuits.filter((n) => n.total_sec != null));
  const serie = $derived(valides.slice(0, 30).reverse()); // de la plus ancienne à la plus récente
  const dates = $derived(serie.map((n) => n.date));
  const col = (champ) => serie.map((n) => (n[champ] == null ? null : Number(n[champ])));
  const moyenneHrv = $derived(moyenneDe(col('hrv_avg')));
  const couleurStress = (v) => {
    const b = bandeStress(v);
    return b === 'repos' || b === 'bas' ? 'var(--ok)' : b === 'moyen' ? 'var(--alerte)' : 'var(--danger)';
  };
  const comp = $derived(comparaisons(nuits));
  const trous = $derived(joursSansNuit(serie));
  // Échelles qui collent aux valeurs (sinon la HRV et la respiration, qui bougent peu, paraissent plates)
  const echelleHrv = $derived(bornesAuto(col('hrv_avg')));
  const echelleResp = $derived(bornesAuto([...col('resp_min'), ...col('resp_max')]));

  // Lignes de comparaison : [libellé, clé, formatage d'une valeur, formatage de l'écart, heure de la journée ?]
  const minHM = (v) => texteHM(Math.round(v));
  function lignes(a, b, definitions) {
    return definitions
      .map(([libelle, cle, fmt, fmtEcart, circulaire]) => {
        const va = a[cle];
        const vb = b[cle];
        if (va == null && vb == null) return null;
        // une heure de la journée est circulaire : 00h30 contre 23h30, c'est 1 h d'écart (pas 23 h)
        const ecart = va != null && vb != null ? (circulaire ? ecartHeures(va, vb) : va - vb) : null;
        return { libelle, avant: vb != null ? fmt(vb) : '—', apres: va != null ? fmt(va) : '—', delta: ecart == null ? '—' : ecart === 0 ? '=' : `${ecart > 0 ? '↑' : '↓'} ${fmtEcart(Math.abs(ecart))}` };
      })
      .filter(Boolean);
  }
  const defRecent = [
    ['Durée moyenne', 'dureeSec', (v) => texteHMdepuisSec(v), (v) => texteHMdepuisSec(v)],
    ['Score moyen', 'score', (v) => String(Math.round(v)), (v) => `${Math.round(v)} pts`],
    ['HRV moyenne', 'hrv', (v) => String(Math.round(v)), (v) => `${Math.round(v)} ms`],
    ['Efficacité', 'efficacite', (v) => `${Math.round(v)} %`, (v) => `${Math.round(v)} pts`],
  ];
  const defSemaine = [
    ['Durée moyenne', 'dureeSec', (v) => texteHMdepuisSec(v), (v) => texteHMdepuisSec(v)],
    ['Score moyen', 'score', (v) => String(Math.round(v)), (v) => `${Math.round(v)} pts`],
    ['Heure de coucher', 'coucherMin', minHM, minHM, true],
    ['Heure de réveil', 'leverMin', minHM, minHM, true],
  ];
</script>

{#if serie.length < 3}
  <Bloc><p class="info">Pas encore assez de nuits synchronisées pour les graphiques (3 minimum).</p></Bloc>
{:else}
  {#if trous > 0}
    <p class="note-trous">{trous} jour{trous > 1 ? 's' : ''} sans nuit mesurée sur la période : les nuits sont placées les unes à côté des autres, sans laisser de vide pour ces jours.</p>
  {/if}
  <div class="grille">
    <Bloc titre="Durée et score">
      <p class="legende-bloc">Score maison (pas celui de Garmin) en ligne, durée de sommeil en barres.</p>
      <GrapheNuits
        etiquettes={dates}
        barres={[{ nom: 'Durée', valeurs: serie.map((n) => (n.total_sec || 0) / 3600), couleur: 'var(--texte-muet)' }]}
        lignes={[{ nom: 'Score', valeurs: serie.map((n) => n.score_maison?.total ?? null), couleur: 'var(--texte)', echelle: { min: 0, max: 100 } }]}
        reperes={[{ valeur: 7, etiquette: 'repère : 7 h de sommeil' }]}
        min={0}
        max={10}
        titre="Durée de sommeil et score par nuit"
        formater={(v, nom) => (nom === 'Durée' ? texteHM(Math.round(v * 60)) : String(Math.round(v)))}
      />
    </Bloc>

    <Bloc titre="Architecture du sommeil">
      <p class="legende-bloc">Répartition des phases par nuit, en % du temps au lit.</p>
      <GrapheNuits
        etiquettes={dates}
        empile
        barres={[
          { nom: 'Profond', valeurs: col('deep_sec'), couleur: COULEURS_PHASE[0] },
          { nom: 'Léger', valeurs: col('light_sec'), couleur: COULEURS_PHASE[1] },
          { nom: 'Paradoxal', valeurs: col('rem_sec'), couleur: COULEURS_PHASE[2] },
          { nom: 'Éveil', valeurs: col('awake_sec'), couleur: COULEURS_PHASE[3] },
        ]}
        titre="Phases de sommeil par nuit"
        formater={(v) => texteHMdepuisSec(v)}
      />
      <ul class="cles-couleurs">
        {#each ['Profond', 'Léger', 'Paradoxal', 'Éveil'] as nom, i (nom)}<li><i style:background={COULEURS_PHASE[i]}></i>{nom}</li>{/each}
      </ul>
    </Bloc>

    <Bloc titre="Variabilité cardiaque (HRV)">
      <p class="legende-bloc">La ligne pointillée est ta moyenne sur la période.</p>
      <GrapheNuits
        etiquettes={dates}
        lignes={[
          { nom: 'HRV', valeurs: col('hrv_avg'), couleur: 'var(--texte)' },
          { nom: 'Moyenne', valeurs: serie.map(() => moyenneHrv), couleur: 'var(--texte-muet)', pointille: true },
        ]}
        min={echelleHrv.min}
        max={echelleHrv.max}
        titre="HRV nocturne"
        formater={(v) => `${Math.round(v)} ms`}
      />
    </Bloc>

    <Bloc titre="Fréquence respiratoire">
      <p class="legende-bloc">La zone grise va du minimum au maximum de la nuit, la ligne est la moyenne.</p>
      <GrapheNuits
        etiquettes={dates}
        bande={{ min: col('resp_min').map((v) => v ?? NaN), max: col('resp_max').map((v) => v ?? NaN) }}
        lignes={[{ nom: 'Moyenne', valeurs: col('resp_avg'), couleur: 'var(--texte)' }]}
        min={echelleResp.min}
        max={echelleResp.max}
        titre="Fréquence respiratoire par nuit"
        formater={(v) => `${String(Math.round(v * 10) / 10).replace('.', ',')} /min`}
      />
    </Bloc>

    <Bloc titre="Saturation en oxygène (SpO2)">
      <p class="legende-bloc">Repère : sous 95 % de moyenne, ça mérite une vérification.</p>
      <GrapheNuits
        etiquettes={dates}
        lignes={[{ nom: 'SpO2', valeurs: col('spo2_avg'), couleur: 'var(--texte)' }]}
        reperes={[{ valeur: 95, etiquette: 'repère : 95 %' }]}
        min={85}
        max={100}
        titre="SpO2 moyenne par nuit"
        formater={(v) => `${Math.round(v)} %`}
      />
    </Bloc>

    <Bloc titre="Stress pendant le sommeil">
      <p class="legende-bloc">Plus la barre est basse et verte, plus la nuit a été récupératrice.</p>
      <GrapheNuits
        etiquettes={dates}
        barres={[{ nom: 'Stress', valeurs: col('avg_stress'), couleur: 'var(--ok)', couleurs: col('avg_stress').map((v) => (v == null ? null : couleurStress(v))) }]}
        min={0}
        max={100}
        titre="Stress moyen par nuit"
      />
    </Bloc>
  </div>

  {#if comp.recent || comp.semaineWeekEnd}
    <div class="grille comparaisons">
      {#if comp.recent}
        <Bloc titre="7 derniers jours contre les 7 précédents">
          <p class="legende-bloc">{comp.recent.a.n} nuits comparées à {comp.recent.b.n} : la tendance récente.</p>
          <table>
            <thead><tr><th scope="col"><span class="visuel-cache">Mesure</span></th><th scope="col">Précédent</th><th scope="col"><span class="visuel-cache">vers</span></th><th scope="col">Récent</th><th scope="col"><span class="visuel-cache">Écart</span></th></tr></thead>
            <tbody>
              {#each lignes(comp.recent.a, comp.recent.b, defRecent) as l (l.libelle)}
                <tr><th scope="row">{l.libelle}</th><td>{l.avant}</td><td class="fleche">→</td><td><strong>{l.apres}</strong></td><td class="delta">{l.delta}</td></tr>
              {/each}
            </tbody>
          </table>
        </Bloc>
      {/if}
      {#if comp.semaineWeekEnd}
        <Bloc titre="Semaine contre week-end">
          <p class="legende-bloc">{comp.semaineWeekEnd.b.n} nuits en semaine, {comp.semaineWeekEnd.a.n} de week-end : l'effet « décalage horaire social ».</p>
          <table>
            <thead><tr><th scope="col"><span class="visuel-cache">Mesure</span></th><th scope="col">Semaine</th><th scope="col"><span class="visuel-cache">vers</span></th><th scope="col">Week-end</th><th scope="col"><span class="visuel-cache">Écart</span></th></tr></thead>
            <tbody>
              {#each lignes(comp.semaineWeekEnd.a, comp.semaineWeekEnd.b, defSemaine) as l (l.libelle)}
                <tr><th scope="row">{l.libelle}</th><td>{l.avant}</td><td class="fleche">→</td><td><strong>{l.apres}</strong></td><td class="delta">{l.delta}</td></tr>
              {/each}
            </tbody>
          </table>
        </Bloc>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .grille {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr));
    gap: 16px;
  }
  .note-trous {
    margin-bottom: 12px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .comparaisons {
    margin-top: 16px;
  }
  .info,
  .legende-bloc {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .legende-bloc {
    margin: -6px 0 12px;
    font-size: 13px;
  }
  .cles-couleurs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .cles-couleurs li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .cles-couleurs i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 9px 6px;
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
  .fleche {
    color: var(--texte-muet);
  }
  .delta {
    text-align: right;
    color: var(--texte-doux);
    white-space: nowrap;
  }
  .visuel-cache {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
