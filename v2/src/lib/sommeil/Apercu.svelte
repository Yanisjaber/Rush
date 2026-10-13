<script>
  import { untrack } from 'svelte';
  import Bloc from '../components/Bloc.svelte';
  import Bouton from '../components/Bouton.svelte';
  import Panneau from '../components/Panneau.svelte';
  import StatCle from '../components/StatCle.svelte';
  import GrapheNuits from '../components/charts/GrapheNuits.svelte';
  import { COULEURS_PHASE, COULEUR_TON } from './palette.js';
  import { chargerFcNuit } from '../data/api.js';
  import { fcNuitDemo } from '../data/demo.js';
  import { heureDe } from '../data/sommeil.js';
  import { NOM_NIVEAU, NOM_QUALIFICATIF, tonDe, efficacitePct, latenceMin, texteHMdepuisSec } from '../data/score-sommeil.js';
  import { formatDateLongue } from '../utils/format.js';

  // Aperçu : la nuit choisie (score maison, horaires, hypnogramme, phases, chiffres clés), le calendrier de nuits colorées par
  // score, le détail chiffré et la FC minute par minute.
  //  nuits : nuits préparées (la plus récente d'abord) · choisie / onchoisir : date de la nuit affichée · userId / demo
  let { nuits = [], choisie = null, onchoisir, userId, demo = false } = $props();

  const nuit = $derived(nuits.find((n) => n.date === choisie) || nuits[0] || null);
  const derniere = $derived(nuits[0]?.date);
  const parDate = $derived(new Map(nuits.map((n) => [n.date, n])));
  const score = $derived(nuit?.score_maison);
  const ton = $derived(score ? tonDe(score.qualificatif) : 'neutre');

  // --- Phases ---
  const totalLit = $derived(nuit ? (nuit.deep_sec || 0) + (nuit.light_sec || 0) + (nuit.rem_sec || 0) + (nuit.awake_sec || 0) : 0);
  const phases = $derived(
    nuit && totalLit
      ? [
          { niveau: 0, sec: nuit.deep_sec },
          { niveau: 1, sec: nuit.light_sec },
          { niveau: 2, sec: nuit.rem_sec },
          { niveau: 3, sec: nuit.awake_sec },
        ].map((p) => ({ ...p, sec: p.sec || 0, part: Math.round(((p.sec || 0) / totalLit) * 100) }))
      : [],
  );

  // --- Hypnogramme : un rang par niveau, les segments placés selon leur début et leur fin (en minutes) ---
  const segments = $derived(Array.isArray(nuit?.segments) ? nuit.segments : []);
  const dureeMin = $derived(segments.length ? Math.max(...segments.map((s) => s[1])) : 0);
  const heureCoucher = $derived(heureDe(nuit?.bedtime));
  function reperesTemps(fin) {
    const [h, m] = (heureCoucher || '0:0').split(':').map(Number);
    return [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const t = h * 60 + m + fin * f;
      return `${String(Math.floor((t / 60) % 24)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
    });
  }

  // --- Calendrier ---
  let mois = $state(null); // 'AAAA-MM'
  $effect(() => {
    const d = derniere;
    untrack(() => {
      if (!mois && d) mois = d.slice(0, 7);
    });
  });
  $effect(() => {
    // Quand on choisit une nuit d'un autre mois (flèches, bouton), le calendrier suit
    const c = nuit?.date;
    untrack(() => {
      if (c && mois && c.slice(0, 7) !== mois) mois = c.slice(0, 7);
    });
  });
  const NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const titreMois = $derived(mois ? `${NOMS_MOIS[Number(mois.slice(5, 7)) - 1]} ${mois.slice(0, 4)}` : '');
  function decalerMois(delta) {
    const [a, m] = mois.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const jours = $derived.by(() => {
    if (!mois) return [];
    const [a, m] = mois.split('-').map(Number);
    const nb = new Date(a, m, 0).getDate();
    const decalage = (new Date(a, m - 1, 1).getDay() + 6) % 7; // lundi = 0
    const liste = Array.from({ length: decalage }, () => null);
    for (let j = 1; j <= nb; j++) {
      const date = `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
      const n = parDate.get(date);
      liste.push({ j, date, ton: n?.score_maison ? tonDe(n.score_maison.qualificatif) : null });
    }
    return liste;
  });

  // --- Détail d'une nuit ---
  const latence = $derived(nuit ? latenceMin(nuit) : null);
  const efficacite = $derived(nuit ? efficacitePct(nuit) : null);
  const arrondi = (v) => (v == null ? null : Math.round(v));

  // --- FC minute par minute (chargée à la demande : colonne lourde) ---
  let fc = $state({ ouvert: false, chargement: false, points: null, erreur: '' });
  async function ouvrirFc() {
    fc = { ouvert: true, chargement: true, points: null, erreur: '' };
    const r = demo ? { data: fcNuitDemo(nuit), erreur: '' } : await chargerFcNuit(userId, nuit.date);
    fc = { ouvert: true, chargement: false, points: r.data, erreur: r.erreur };
  }
  const fcValeurs = $derived(fc.points ? fc.points.map((p) => p[1]) : []);
  const fcStats = $derived(fcValeurs.length ? { moy: Math.round(fcValeurs.reduce((a, b) => a + b, 0) / fcValeurs.length), min: Math.min(...fcValeurs), max: Math.max(...fcValeurs) } : null);
  const fcEtiquettes = $derived(fc.points ? fc.points.map((_, i) => nuit.date) : []);
</script>

{#if nuit}
  <div class="apercu">
    <Bloc>
      <div class="entete-nuit">
        <div>
          <p class="quand">{formatDateLongue(nuit.date)} <span class="sous">· {nuit.date === derniere ? 'dernière nuit' : 'nuit sélectionnée'}</span></p>
          <div class="horaires" aria-label="Coucher {heureDe(nuit.bedtime) || 'inconnu'}, réveil {heureDe(nuit.wake_time) || 'inconnu'}">
            <span><b>{heureDe(nuit.bedtime) || '—'}</b><i>coucher</i></span>
            <span class="trait" aria-hidden="true"></span>
            <span class="duree"><b class="titre">{texteHMdepuisSec((nuit.total_sec || 0) + (nuit.awake_sec || 0))}</b><i>au lit</i></span>
            <span class="trait" aria-hidden="true"></span>
            <span><b>{heureDe(nuit.wake_time) || '—'}</b><i>réveil</i></span>
          </div>
        </div>
        {#if score}
          <div class="score" style:--ton={COULEUR_TON[ton]} title="Score maison, indépendant de celui de Garmin (durée, efficacité, éveil nocturne, réveils, endormissement, architecture)">
            <span class="nombre titre">{score.total}</span>
            <span class="qualif">{NOM_QUALIFICATIF[score.qualificatif]}</span>
          </div>
        {/if}
      </div>

      {#if segments.length}
        <div class="hypno" role="img" aria-label="Hypnogramme : phases de sommeil au cours de la nuit">
          {#each NOM_NIVEAU as nom, niveau (niveau)}
            <div class="rang">
              <span class="nom-rang">{nom}</span>
              <div class="piste">
                {#each segments.filter((s) => s[2] === niveau) as s, k (k)}
                  <span class="seg" style:left="{(s[0] / dureeMin) * 100}%" style:width="{Math.max(((s[1] - s[0]) / dureeMin) * 100, 0.3)}%" style:background={COULEURS_PHASE[niveau]}></span>
                {/each}
              </div>
            </div>
          {/each}
          <div class="reperes">
            {#each reperesTemps(dureeMin) as h, k (k)}<span>{h}</span>{/each}
          </div>
        </div>
      {:else if phases.length}
        <div class="barre-phases" role="img" aria-label="Répartition des phases">
          {#each phases as p (p.niveau)}<span style:flex={Math.max(p.sec, 1)} style:background={COULEURS_PHASE[p.niveau]}></span>{/each}
        </div>
      {/if}

      {#if phases.length}
        <ul class="phases">
          {#each phases as p (p.niveau)}
            <li><span class="carre" style:background={COULEURS_PHASE[p.niveau]}></span><span class="nom">{NOM_NIVEAU[p.niveau]}</span><strong>{texteHMdepuisSec(p.sec)}</strong><span class="part">{p.part} %</span></li>
          {/each}
        </ul>
      {/if}

      <div class="cles">
        <StatCle etiquette="Efficacité" valeur={efficacite != null ? String(arrondi(efficacite)) : '—'} unite={efficacite != null ? '%' : ''} />
        <StatCle etiquette="HRV" valeur={nuit.hrv_avg != null ? String(arrondi(nuit.hrv_avg)) : '—'} unite={nuit.hrv_avg != null ? 'ms' : ''} />
        <StatCle etiquette="FC moyenne" valeur={nuit.avg_heart_rate != null ? String(arrondi(nuit.avg_heart_rate)) : '—'} unite={nuit.avg_heart_rate != null ? 'bpm' : ''} />
        <StatCle etiquette="FC repos" valeur={nuit.resting_heart_rate != null ? String(arrondi(nuit.resting_heart_rate)) : '—'} unite={nuit.resting_heart_rate != null ? 'bpm' : ''} />
        <StatCle etiquette="Stress" valeur={nuit.avg_stress != null ? String(arrondi(nuit.avg_stress)) : '—'} />
      </div>
    </Bloc>

    <div class="deux">
      <Bloc titre={titreMois}>
        {#snippet actions()}
          <div class="nav-mois">
            <button type="button" aria-label="Mois précédent" onclick={() => decalerMois(-1)}>‹</button>
            <button type="button" aria-label="Mois suivant" onclick={() => decalerMois(1)}>›</button>
          </div>
        {/snippet}
        <div class="calendrier" role="group" aria-label="Choisir une nuit">
          {#each ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as j, k (k)}<span class="dow" aria-hidden="true">{j}</span>{/each}
          {#each jours as j, k (k)}
            {#if j === null}
              <span class="vide"></span>
            {:else if j.ton}
              <button type="button" class="jour" class:choisi={j.date === nuit.date} style:--ton={COULEUR_TON[j.ton]} aria-pressed={j.date === nuit.date} aria-label="Nuit du {formatDateLongue(j.date)}, {j.ton}" onclick={() => onchoisir?.(j.date)}>{j.j}</button>
            {:else}
              <span class="jour sans" aria-hidden="true">{j.j}</span>
            {/if}
          {/each}
        </div>
        <div class="legende">
          <span><i style:background="var(--danger)"></i>Faible</span>
          <span><i style:background="var(--alerte)"></i>Correct</span>
          <span><i style:background="var(--ok)"></i>Bon</span>
          {#if nuit.date !== derniere}<button type="button" class="lien" onclick={() => onchoisir?.(derniere)}>↺ Dernière nuit</button>{/if}
        </div>
      </Bloc>

      <Bloc titre="Détail de la nuit">
        <div class="detail">
          <StatCle etiquette="Endormissement" valeur={latence != null ? String(latence) : '—'} unite={latence != null ? 'min' : ''} />
          <StatCle etiquette="Réveils" valeur={nuit.awake_count != null ? String(nuit.awake_count) : '—'} />
          <StatCle etiquette="Agitation" valeur={nuit.restless_count != null ? String(nuit.restless_count) : '—'} unite={nuit.restless_count != null ? 'mvts' : ''} />
          <StatCle etiquette="Respiration" valeur={nuit.resp_avg != null ? String(nuit.resp_avg).replace('.', ',') : '—'} unite={nuit.resp_avg != null ? '/min' : ''} />
          <StatCle etiquette="SpO2" valeur={nuit.spo2_avg != null ? String(arrondi(nuit.spo2_avg)) : '—'} unite={nuit.spo2_avg != null ? '%' : ''} />
          <StatCle etiquette="Body Battery" valeur={nuit.body_battery_change != null ? `+${nuit.body_battery_change}` : '—'} />
        </div>
        <div class="actions"><Bouton variante="discret" onclick={ouvrirFc}>Voir la FC minute par minute</Bouton></div>
      </Bloc>
    </div>
  </div>

  <Panneau ouvert={fc.ouvert} titre="FC pendant la nuit" onfermer={() => (fc.ouvert = false)}>
    <p class="quand">{formatDateLongue(nuit.date)}</p>
    {#if fc.chargement}
      <p class="info" role="status">Chargement…</p>
    {:else if fc.erreur}
      <p class="erreur" role="alert">{fc.erreur}</p>
    {:else if fc.points && fc.points.length}
      <div class="stats-fc">
        <StatCle etiquette="Moyenne" valeur={String(fcStats.moy)} unite="bpm" />
        <StatCle etiquette="Minimum" valeur={String(fcStats.min)} unite="bpm" />
        <StatCle etiquette="Maximum" valeur={String(fcStats.max)} unite="bpm" />
      </div>
      <GrapheNuits etiquettes={fcEtiquettes} lignes={[{ nom: 'FC', valeurs: fcValeurs, couleur: 'var(--danger)' }]} min={Math.max(0, fcStats.min - 5)} max={fcStats.max + 5} hauteur={220} titre="Fréquence cardiaque pendant la nuit" formater={(v) => `${Math.round(v)} bpm`} />
      <div class="reperes fc-reperes">{#each reperesTemps(Math.max(...fc.points.map((p) => p[0]))) as h, k (k)}<span>{h}</span>{/each}</div>
    {:else}
      <p class="info">Pas de données minute par minute pour cette nuit. Lance une synchro Garmin pour les récupérer sur les prochaines nuits.</p>
    {/if}
  </Panneau>
{/if}

<style>
  .apercu {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .entete-nuit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px 32px;
    margin-bottom: 20px;
  }
  .quand {
    font-size: 15px;
    font-weight: 600;
  }
  .sous {
    font-weight: 400;
    color: var(--texte-doux);
  }
  .horaires {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 10px;
  }
  .horaires span {
    display: flex;
    flex-direction: column;
  }
  .horaires b {
    font-size: 22px;
  }
  .horaires i {
    font-style: normal;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .horaires .duree b {
    font-size: 40px;
    line-height: 1;
  }
  .horaires .trait {
    width: clamp(16px, 5vw, 56px);
    height: 2px;
    background: var(--trait-fort);
  }
  .score {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 110px;
    padding: 12px 20px;
    border: 2px solid var(--ton);
    border-radius: var(--rayon-l);
  }
  .score .nombre {
    font-size: 52px;
    line-height: 1;
    color: var(--ton);
  }
  .score .qualif {
    font-size: 13px;
    font-weight: 700;
    color: var(--ton);
  }
  .hypno {
    margin: 4px 0 16px;
  }
  .rang {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .nom-rang {
    flex: 0 0 74px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .piste {
    position: relative;
    flex: 1;
    height: 18px;
    border-bottom: 1px solid var(--trait);
  }
  .seg {
    position: absolute;
    top: 2px;
    bottom: 2px;
    border-radius: 2px;
  }
  .reperes {
    display: flex;
    justify-content: space-between;
    margin: 4px 0 0 84px;
    font-size: 11px;
    color: var(--texte-muet);
  }
  .fc-reperes {
    margin-left: 0;
  }
  .barre-phases {
    display: flex;
    gap: 3px;
    height: 28px;
    margin-bottom: 14px;
  }
  .barre-phases span {
    border-radius: 4px;
  }
  .phases {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 260px));
    gap: 8px 32px;
    margin-bottom: 20px;
    font-size: 14px;
  }
  .phases li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .carre {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
  }
  .phases .nom {
    flex: 1;
    color: var(--texte-doux);
  }
  .part {
    min-width: 36px;
    text-align: right;
    color: var(--texte-doux);
  }
  .cles {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 36px;
    padding: 16px 18px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .deux {
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 820px) {
    .deux {
      grid-template-columns: 1fr;
    }
  }
  .nav-mois {
    display: flex;
    gap: 6px;
  }
  .nav-mois button {
    width: 44px;
    height: 44px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte);
    font-size: 20px;
    cursor: pointer;
  }
  .calendrier {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }
  /* Petit téléphone : sept colonnes sans espace pour que chaque nuit mesure au moins 44 px de large ;
     le liseré de la couleur du fond redonne l'impression d'un espace entre les cases. */
  @media (max-width: 460px) {
    .calendrier {
      gap: 0;
    }
    .calendrier .jour {
      box-shadow: inset 0 0 0 2px var(--surface-2);
    }
  }
  .dow {
    text-align: center;
    font-size: 11px;
    color: var(--texte-muet);
  }
  .jour {
    display: grid;
    place-items: center;
    min-height: 44px;
    border: 0;
    border-radius: var(--rayon-s);
    background: color-mix(in srgb, var(--ton) 28%, var(--surface-2));
    color: var(--texte);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .jour.sans {
    background: transparent;
    color: var(--texte-muet);
    font-weight: 400;
    cursor: default;
  }
  .jour.choisi {
    outline: 2px solid var(--texte);
    outline-offset: 1px;
    background: color-mix(in srgb, var(--ton) 38%, var(--surface-2));
  }
  .legende {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    margin-top: 14px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .legende span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legende i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .lien {
    min-height: 44px;
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: var(--texte);
    font-size: 13px;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .detail {
    display: flex;
    flex-wrap: wrap;
    gap: 18px 32px;
    margin-bottom: 18px;
  }
  .stats-fc {
    display: flex;
    gap: 28px;
    margin: 14px 0;
  }
  .info,
  .erreur {
    margin-top: 10px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .erreur {
    color: var(--danger);
  }
  button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
</style>
