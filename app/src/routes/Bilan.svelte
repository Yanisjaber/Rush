<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import ChipSport from '../lib/components/ChipSport.svelte';
  import PanneauObjectif from '../lib/components/PanneauObjectif.svelte';
  import GrapheNuits from '../lib/components/charts/GrapheNuits.svelte';
  import { menu } from '../lib/stores/menu.svelte.js';
  import SelecteurSport from '../lib/components/SelecteurSport.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { donnees } from '../lib/stores/edition.svelte.js';
  import { ouvrirApercu } from '../lib/stores/apercu.svelte.js';
  import { chargerActivitesBilan, chargerObjectifsAnnuels } from '../lib/data/api.js';
  import { activitesBilanDemo, objectifsAnnuelsDemo } from '../lib/data/demo.js';
  import {
    normaliser, activitesAnnee, activitesAnneePrecedente, sommer, ecartPct, anneesDisponibles, avancement, recordsVolume, recordRecent,
    cumulParAnnee, volumeMensuel, repartitionSport, NOM_SPORT_BILAN, SPORTS_BILAN, familleBilanDuFiltre,
  } from '../lib/data/bilan.js';
  import { formatDateLongue } from '../lib/utils/format.js';
  import { texteHM } from '../lib/data/score-sommeil.js';

  let { demo = false } = $props();

  const maintenant = new Date();
  let annee = $state(maintenant.getFullYear());
  let metrique = $state('distance_km'); // graphique de cumul : distance ou dénivelé
  let etat = $state({ chargement: true, erreur: '', brutes: [], objectifs: [] });
  let panneau = $state({ ouvert: false, objectif: null });

  async function charger(userId, a) {
    if (demo) {
      etat = { chargement: false, erreur: '', brutes: activitesBilanDemo(maintenant), objectifs: objectifsAnnuelsDemo(maintenant) };
      return;
    }
    if (!userId) return;
    const [acts, obj] = await Promise.all([chargerActivitesBilan(userId, a), chargerObjectifsAnnuels(userId)]);
    etat = { chargement: false, erreur: acts.erreur || obj.erreur, brutes: acts.data || [], objectifs: obj.data || [] };
  }
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  // On recharge quand l'utilisateur change (les trois années sont chargées d'un coup ; changer d'année ne recharge pas)
  $effect(() => {
    const u = userId;
    void donnees.version; // se recharge quand une sortie est créée, retouchée ou supprimée
    untrack(() => charger(u, new Date().getFullYear()));
  });

  const toutes = $derived(etat.brutes.map(normaliser));
  const parId = $derived(new Map(etat.brutes.map((l) => [l.id, l])));
  const annees = $derived(anneesDisponibles(toutes, maintenant));
  // Filtre global de sport (en-tête) : concerne les chiffres, records et graphiques ; pas les objectifs annuels
  const filtrees = $derived(menu.filtre === 'tout' ? toutes : toutes.filter((a) => a.famille === menu.filtre));

  // --- Chiffres de l'année contre l'an dernier à la même date ---
  const courant = $derived(sommer(activitesAnnee(filtrees, annee, maintenant)));
  const precedent = $derived(sommer(activitesAnneePrecedente(filtrees, annee, maintenant)));
  const fmt = (v, d = 0) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d });
  const tuiles = $derived([
    { cle: 'distance', libelle: 'Distance', val: courant.distance, prec: precedent.distance, unite: 'km', dec: 0 },
    { cle: 'heures', libelle: 'Temps', val: courant.heures, prec: precedent.heures, unite: 'h', dec: 1 },
    { cle: 'seances', libelle: 'Séances', val: courant.seances, prec: precedent.seances, unite: '', dec: 0 },
    { cle: 'tss', libelle: 'Charge', val: courant.tss, prec: precedent.tss, unite: 'TSS', dec: 0 },
  ]);

  // --- Objectifs de l'année ---
  // Objectifs annuels du sport filtré, plus ceux qui valent pour « tous sports »
  const familleFiltre = $derived(familleBilanDuFiltre(menu.filtre));
  const objectifsAnnee = $derived(etat.objectifs.filter((o) => o.annee === annee && (!familleFiltre || o.sport === 'tous' || o.sport === familleFiltre)));
  const avancements = $derived(objectifsAnnee.map((o) => ({ objectif: o, av: avancement(o, toutes, annee, maintenant) })).filter((x) => x.av));

  // --- Records, graphiques ---
  const records = $derived(recordsVolume(activitesAnnee(filtrees, annee, maintenant)));
  const cumul = $derived(cumulParAnnee(filtrees, [annee, annee - 1, annee - 2], metrique, maintenant));
  const mensuel = $derived(volumeMensuel(filtrees, annee));
  const maxMois = $derived(Math.max(1, ...mensuel));
  const repartition = $derived(repartitionSport(activitesAnnee(toutes, annee, maintenant)));
  const MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const nomUnite = (u) => (u ? ` ${u}` : '');
  const chipSport = { cyclisme: 'velo', course: 'course', natation: 'natation', musculation: 'muscu', autre: 'autre' };

  function nouvelObjectif() {
    panneau = { ouvert: true, objectif: null };
  }
  function ouvrirObjectif(o) {
    panneau = { ouvert: true, objectif: o };
  }
  const apresEnregistrement = (o) => (etat.objectifs = [...etat.objectifs.filter((x) => x.id !== o.id), o]);
  const apresSuppression = (id) => (etat.objectifs = etat.objectifs.filter((x) => x.id !== id));
  function ouvrirRecord(r) {
    const ligne = r.id ? parId.get(r.id) : null;
    if (ligne) ouvrirApercu(ligne);
  }
</script>

<main class="page">
  <EnTete actif="bilan" {demo} />

  <header class="entete-page">
    <h1 class="titre">Bilan {annee}</h1>
    <label class="annee">
      <span>Année</span>
      <select bind:value={annee} aria-label="Choisir l'année du bilan">
        {#each annees as y (y)}<option value={y}>{y}</option>{/each}
      </select>
    </label>
  </header>

  <SelecteurSport />

  {#if etat.chargement}
    <p class="info" role="status">Chargement du bilan…</p>
  {:else if etat.erreur}
    <p class="alerte" role="alert">{etat.erreur}</p>
  {:else}
    <div class="tuiles">
      {#each tuiles as t (t.cle)}
        {@const e = ecartPct(t.val, t.prec)}
        <Bloc compact>
          <p class="etiq">{t.libelle}</p>
          <p class="valeur titre">{fmt(t.val, t.dec)}<span class="unite">{nomUnite(t.unite)}</span></p>
          {#if e != null}
            <p class="delta" class:haut={e >= 0} class:bas={e < 0}>{e >= 0 ? '+' : ''}{e} % contre {annee - 1}</p>
            <p class="ref">{annee - 1} à la même date : {fmt(t.prec, t.dec)}{nomUnite(t.unite)}</p>
          {:else}
            <p class="ref">Pas de référence {annee - 1}</p>
          {/if}
        </Bloc>
      {/each}
    </div>

    <Bloc titre="Objectifs de {annee}">
      {#snippet actions()}
        <Bouton variante="discret" onclick={nouvelObjectif}>Ajouter un objectif</Bouton>
      {/snippet}
      {#if avancements.length}
        <ul class="objectifs">
          {#each avancements as { objectif, av } (objectif.id)}
            <li>
              <button type="button" class="objectif" onclick={() => ouvrirObjectif(objectif)} aria-label="Modifier l'objectif {av.modele.label}">
                <span class="tete">
                  <span class="nom">{#if objectif.sport !== 'tous'}<span class="badge">{NOM_SPORT_BILAN[objectif.sport]}</span>{/if}{av.modele.label}</span>
                  <span class="chiffres"><strong>{av.actuel == null ? '—' : fmt(av.actuel, av.modele.unit === 'h' || av.modele.unit === 'W/kg' ? 1 : 0)}</strong> / {fmt(av.cible, av.modele.unit === 'h' ? 1 : 0)}{nomUnite(av.modele.unit)} <span class="pct">{av.actuel == null ? '—' : `${Math.round(av.pct)} %`}</span></span>
                </span>
                <span class="barre" aria-hidden="true">
                  <span class="remplie" class:ok={av.enRythme} style:width="{av.pct}%"></span>
                  {#if av.repere != null}<span class="repere" style:left="{av.repere}%" title="Rythme attendu à cette date"></span>{/if}
                </span>
                {#if av.projection != null}
                  <span class="projection" class:ok={av.projectionPct >= 100}>Projection fin d'année : {fmt(av.projection, av.modele.unit === 'h' ? 1 : 0)}{nomUnite(av.modele.unit)} · {av.projectionPct} % de la cible</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="info">Aucun objectif pour {annee}. Ajoutes-en un : distance annuelle, heures, chrono visé…</p>
      {/if}
    </Bloc>

    {#if records.length}
      <Bloc titre="Records de {annee}">
        <ul class="records">
          {#each records as r (r.cle)}
            <li>
              <button type="button" class="record" disabled={!r.id} onclick={() => ouvrirRecord(r)}>
                <span class="etiq">{r.libelle}{#if recordRecent(r.iso, maintenant)} <span class="nouveau">nouveau</span>{/if}</span>
                <span class="valeur titre">{r.cle === 'duree' ? texteHM(Math.round(r.valeur)) : fmt(r.valeur, r.cle === 'distance' ? 1 : 0)}{#if r.cle !== 'duree'}<span class="unite"> {r.unite}</span>{/if}</span>
                <span class="sous">{r.nom}</span>
                <span class="sous">{formatDateLongue(r.iso)}</span>
              </button>
            </li>
          {/each}
        </ul>
      </Bloc>
    {/if}

    <div class="graphes">
      <Bloc titre="Cumul sur 3 ans">
        {#snippet actions()}
          <div class="bascule" role="group" aria-label="Mesure du cumul">
            <button type="button" aria-pressed={metrique === 'distance_km'} onclick={() => (metrique = 'distance_km')}>Distance</button>
            <button type="button" aria-pressed={metrique === 'd_plus'} onclick={() => (metrique = 'd_plus')}>Dénivelé</button>
          </div>
        {/snippet}
        <GrapheNuits
          etiquettes={cumul.etiquettes}
          lignes={[
            { nom: String(annee), valeurs: cumul.series[0].valeurs, couleur: 'var(--texte)' },
            { nom: String(annee - 1), valeurs: cumul.series[1].valeurs, couleur: 'var(--texte-doux)' },
            { nom: String(annee - 2), valeurs: cumul.series[2].valeurs, couleur: 'var(--texte-muet)', pointille: true },
          ]}
          min={0}
          hauteur={190}
          titre="Cumul de la {metrique === 'd_plus' ? 'dénivelé' : 'distance'} sur trois ans"
          formater={(v) => `${fmt(v)} ${metrique === 'd_plus' ? 'm' : 'km'}`}
        />
        <ul class="cles">
          <li><i style:background="var(--texte)"></i>{annee}</li>
          <li><i style:background="var(--texte-doux)"></i>{annee - 1}</li>
          <li><i style:background="var(--texte-muet)"></i>{annee - 2}</li>
        </ul>
      </Bloc>

      <Bloc titre="Volume par mois">
        <p class="legende-bloc">Heures d'entraînement chaque mois de {annee}.</p>
        <div class="mois" role="img" aria-label="Heures d'entraînement par mois en {annee}">
          {#each mensuel as h, i (i)}
            <div class="col" title="{NOMS_MOIS[i]} : {fmt(h, 1)} h">
              <span class="val">{h >= 1 ? fmt(h, 0) : ''}</span>
              <span class="fut" style:height="{(h / maxMois) * 100}%"></span>
              <span class="nom-mois">{MOIS[i]}</span>
            </div>
          {/each}
        </div>
      </Bloc>

      <Bloc titre="Répartition par sport">
        <p class="legende-bloc">Part du temps d'entraînement de {annee}.</p>
        {#if repartition.length}
          <ul class="repartition">
            {#each repartition as r (r.sport)}
              <li>
                <span class="sport">{NOM_SPORT_BILAN[r.sport]}</span>
                <span class="piste" aria-hidden="true"><span style:width="{r.part}%"></span></span>
                <span class="chiffre">{fmt(r.heures, 0)} h · {r.part} %</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="info">Pas encore d'activité en {annee}.</p>
        {/if}
      </Bloc>
    </div>
  {/if}
</main>

<PanneauObjectif
  ouvert={panneau.ouvert}
  objectif={panneau.objectif}
  {annee}
  {userId}
  {demo}
  onfermer={() => (panneau.ouvert = false)}
  enregistre={apresEnregistrement}
  supprime={apresSuppression}
/>

<style>
  .entete-page {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    margin-bottom: 12px;
  }
  h1 {
    font-size: clamp(32px, 6vw, 52px);
    line-height: 1.05;
  }
  .annee {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .annee select {
    min-height: 44px;
    padding: 0 14px;
    background: var(--surface);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 16px;
  }
  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
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
  .alerte {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }
  .tuiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .etiq {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .valeur {
    font-size: 40px;
    line-height: 1.1;
  }
  .unite {
    font-family: var(--police-texte);
    font-size: 16px;
    font-weight: 400;
    color: var(--texte-doux);
  }
  .delta {
    margin-top: 4px;
    font-size: 14px;
    font-weight: 700;
  }
  .delta.haut {
    color: var(--ok);
  }
  .delta.bas {
    color: var(--alerte);
  }
  .ref,
  .sous {
    font-size: 13px;
    color: var(--texte-doux);
  }
  :global(.bloc) + :global(.bloc) {
    margin-top: 0;
  }
  .objectifs {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .objectif {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 12px 14px;
    border: 0;
    border-radius: var(--rayon);
    background: var(--surface-2);
    color: var(--texte);
    text-align: left;
    cursor: pointer;
  }
  .objectif:hover {
    background: var(--trait);
  }
  .tete {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 16px;
  }
  .nom {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
  }
  .badge {
    padding: 1px 9px;
    border: 1px solid var(--trait-fort);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: var(--texte-doux);
  }
  .chiffres {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .chiffres strong {
    color: var(--texte);
  }
  .pct {
    margin-left: 6px;
    font-weight: 700;
    color: var(--texte);
  }
  .barre {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: var(--trait);
  }
  .remplie {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--alerte);
  }
  .remplie.ok {
    background: var(--ok);
  }
  .repere {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--texte);
  }
  .projection {
    font-size: 12.5px;
    color: var(--alerte);
  }
  .projection.ok {
    color: var(--ok);
  }
  .records {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 10px;
  }
  .record {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    height: 100%;
    padding: 12px 14px;
    border: 0;
    border-radius: var(--rayon);
    background: var(--surface-2);
    color: var(--texte);
    text-align: left;
    cursor: pointer;
  }
  .record:disabled {
    cursor: default;
  }
  .record:not(:disabled):hover {
    background: var(--trait);
  }
  .record .valeur {
    font-size: 30px;
  }
  .nouveau {
    margin-left: 4px;
    padding: 0 7px;
    border: 1px solid var(--ok);
    border-radius: 999px;
    font-size: 10px;
    letter-spacing: 0;
    color: var(--ok);
    text-transform: none;
  }
  .graphes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr));
    gap: 16px;
    margin-top: 16px;
  }
  .bascule {
    display: inline-flex;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    overflow: hidden;
  }
  .bascule button {
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    background: transparent;
    color: var(--texte-doux);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .bascule button[aria-pressed='true'] {
    background: var(--texte);
    color: var(--fond);
  }
  .cles {
    display: flex;
    gap: 16px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .cles li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .cles i {
    width: 14px;
    height: 3px;
    border-radius: 2px;
  }
  .mois {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 170px;
  }
  .col {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: 100%;
    gap: 4px;
  }
  .col .val {
    font-size: 11px;
    color: var(--texte-doux);
  }
  .col .fut {
    display: block;
    width: 100%;
    min-height: 2px;
    border-radius: 3px 3px 0 0;
    background: var(--texte-muet);
  }
  .nom-mois {
    font-size: 11px;
    color: var(--texte-muet);
  }
  .repartition {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .repartition li {
    display: grid;
    grid-template-columns: 110px 1fr 100px;
    align-items: center;
    gap: 12px;
    font-size: 14px;
  }
  .sport {
    color: var(--texte-doux);
  }
  .piste {
    height: 10px;
    border-radius: 5px;
    background: var(--trait);
    overflow: hidden;
  }
  .piste span {
    display: block;
    height: 100%;
    background: var(--texte);
  }
  .chiffre {
    text-align: right;
    color: var(--texte-doux);
  }
  select:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
</style>
