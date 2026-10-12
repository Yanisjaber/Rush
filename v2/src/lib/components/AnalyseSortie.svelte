<script>
  import Bloc from './Bloc.svelte';
  import ProfilStructure from './ProfilStructure.svelte';
  import GraphiqueStream from './charts/GraphiqueStream.svelte';
  import { reduire } from '../data/streams.js';
  import { detecterSequences, meilleuresPuissances, statutRecord, texteDuree, estimerCpWprime, wbal } from '../data/analyse-sortie.js';
  import { COULEURS_ZONE, indiceZone, milieu, texteDuree as texteMinutes, texteCible } from '../data/structure.js';

  // Analyse avancée d'une sortie en puissance : séquences détectées, meilleures puissances (comparées à tes records) et W'bal.
  //  watts : puissance par seconde · ftp : FTP · profil : { extras: { cp, wprime } } · records : lignes de power_profile · curseur / onsurvol : curseur partagé
  let { watts = [], ftp = null, profil = null, records = [], curseur = null, onsurvol, couleur = 'var(--sport-neutre)' } = $props();

  const sequences = $derived(ftp ? detecterSequences(watts, ftp) : []);
  let toutVoir = $state(false);
  const visibles = $derived(toutVoir ? sequences : sequences.slice(0, 12));
  const ref = $derived({ ftp: ftp || 0 });
  const meilleures = $derived(meilleuresPuissances(watts));
  const parDuree = $derived(new Map((records || []).map((r) => [Number(r.duration_s), r])));

  // CP et W' : ceux du profil (CP en watts, W' en kJ) en priorité, sinon estimés sur la sortie si elle contient un effort assez dur
  const cpProfil = $derived(Number(profil?.extras?.cp) || 0);
  const wpProfil = $derived((Number(profil?.extras?.wprime) || 0) * 1000);
  const estimation = $derived(cpProfil && wpProfil ? null : estimerCpWprime(watts, ftp));
  const cp = $derived(cpProfil || estimation?.cp || 0);
  const wprime = $derived(wpProfil || estimation?.wprime || 0);
  const source = $derived(cpProfil && wpProfil ? 'profil' : estimation ? 'estimation' : '');
  const bilan = $derived(cp && wprime ? wbal(watts, cp, wprime) : null);
  const serieBilan = $derived(bilan ? reduire(bilan.serie.map((v) => v / 1000)) : []);
</script>

<div class="analyse">
  {#if sequences.length}
    <Bloc titre="Séquences détectées">
      <p class="legende">Les blocs de la sortie, reconstitués à partir de ta puissance (estimation).</p>
      <ProfilStructure blocs={sequences} hauteur={110} />
      <ol class="liste">
        {#each visibles as b, i (i)}
          <li>
            <span class="trait" style:background={COULEURS_ZONE[Math.min(6, indiceZone(milieu(b.work), 'power'))]}></span>
            <span class="nom">{b.name}</span>
            <span class="sous">{texteMinutes(b.work.min)} · {texteCible(b.work, 'power', ref)}</span>
          </li>
        {/each}
      </ol>
      {#if sequences.length > 12}
        <button type="button" class="lien" onclick={() => (toutVoir = !toutVoir)}>{toutVoir ? 'Voir moins' : `Voir les ${sequences.length} blocs`}</button>
      {/if}
    </Bloc>
  {/if}

  {#if meilleures.length}
    <Bloc titre="Meilleures puissances de la sortie">
      <p class="legende">Ta meilleure moyenne sur chaque durée, comparée à tes records.</p>
      <table>
        <thead><tr><th scope="col">Durée</th><th scope="col">Sur cette sortie</th><th scope="col">Meilleur (90 jours)</th><th scope="col">Meilleur (toute la vie)</th></tr></thead>
        <tbody>
          {#each meilleures as m (m.duree)}
            {@const rec = parDuree.get(m.duree)}
            {@const statut = statutRecord(m.watts, Number(rec?.watts_alltime))}
            <tr>
              <th scope="row">{texteDuree(m.duree)}</th>
              <td><strong>{m.watts} W</strong>{#if statut === 'record'} <span class="badge record">Record</span>{:else if statut === 'proche'} <span class="badge">Proche</span>{/if}</td>
              <td>{rec?.watts_90d ? `${Math.round(rec.watts_90d)} W` : '—'}</td>
              <td>{rec?.watts_alltime ? `${Math.round(rec.watts_alltime)} W` : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Bloc>
  {/if}

  {#if bilan}
    <Bloc titre="W'bal : ta réserve au-dessus de la puissance critique">
      <p class="legende">
        CP {cp} W · W' {Math.round(wprime / 100) / 10} kJ ({source === 'profil' ? 'valeurs de ton profil' : 'estimées sur cette sortie'}). La courbe descend quand tu dépasses la CP et remonte quand tu récupères.
      </p>
      <div class="chiffres">
        <span><strong>{Math.round(bilan.epuisement / 100) / 10} kJ</strong> puisés au plus bas</span>
        <span><strong>{bilan.pctEpuise} %</strong> de W' utilisé</span>
      </div>
      <GraphiqueStream titre="W'bal" valeurs={serieBilan} {couleur} unite="kJ" formater={(v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',')} {curseur} {onsurvol} min={0} max={Math.round(wprime / 100) / 10} hauteur={110} />
    </Bloc>
  {:else if ftp}
    <p class="info">W'bal : renseigne ta puissance critique et ton W' dans les paramètres (onglet Physiologie) pour voir ta réserve pendant la sortie.</p>
  {/if}
</div>

<style>
  .analyse {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .legende {
    margin: -6px 0 12px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .liste {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 8px 20px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }
  .liste li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }
  .trait {
    width: 4px;
    height: 32px;
    border-radius: 2px;
    flex: none;
  }
  .nom {
    font-weight: 700;
  }
  .sous {
    margin-left: auto;
    font-size: 13px;
    color: var(--texte-doux);
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
    font-weight: 700;
  }
  .badge {
    margin-left: 6px;
    padding: 1px 8px;
    border: 1px solid var(--trait-fort);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: var(--texte-doux);
  }
  .badge.record {
    border-color: var(--ok);
    color: var(--ok);
  }
  .chiffres {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 24px;
    margin-bottom: 10px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .chiffres strong {
    color: var(--texte);
  }
  .lien {
    min-height: 44px;
    margin-top: 6px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--texte);
    font-size: 14px;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .lien:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .info {
    font-size: 14px;
    color: var(--texte-doux);
  }
</style>
