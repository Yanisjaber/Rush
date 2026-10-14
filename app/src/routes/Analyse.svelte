<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import StatCle from '../lib/components/StatCle.svelte';
  import BarresEmpilees from '../lib/components/charts/BarresEmpilees.svelte';
  import GraphiqueLignes from '../lib/components/charts/GraphiqueLignes.svelte';
  import CarteChaleur from '../lib/components/charts/CarteChaleur.svelte';
  import SelecteurSport from '../lib/components/SelecteurSport.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { menu } from '../lib/stores/menu.svelte.js';
  import { donnees } from '../lib/stores/edition.svelte.js';
  import { route, regler } from '../lib/routeur.svelte.js';
  import { chargerDonneesAnalyse } from '../lib/data/donnees-analyse.js';
  import { construireAdresse } from '../lib/data/adresses.js';
  import { familleAffichage } from '../lib/data/familles.js';
  import { ANALYSES, PERIODES, estAnalyse, periodeValide } from '../lib/analyse/registre.js';
  import { SPORTS } from '../lib/sports.js';

  // Page d'analyse d'un widget : verdict, chiffres clés, graphiques, lecture des données et conseils chiffrés.
  // Les calculs sont dans lib/analyse/ ; cette page ne fait que les afficher. L'analyse, la période et le sport sont dans l'adresse.
  let { id = '', demo = false } = $props();

  const def = $derived(estAnalyse(id) ? ANALYSES[id] : null);
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  const aujourdhui = new Date();

  let brut = $state({ chargement: true, erreur: '', seances: [], planifiees: [], objectifs: [], series: [], hrMax: null });

  async function charger(u) {
    if (!u) return;
    brut.chargement = true;
    const r = await chargerDonneesAnalyse({ userId: u, demo, aujourdhui });
    Object.assign(brut, r, { chargement: false });
  }
  $effect(() => {
    const u = userId;
    void donnees.version; // se recharge quand une sortie est créée, retouchée ou supprimée
    untrack(() => charger(u));
  });

  const sport = $derived(def?.sportImpose || menu.filtre);
  const nomSport = $derived(sport === 'tout' ? '' : (SPORTS[sport] || SPORTS.autre).nom);
  const periodeCle = $derived(periodeValide(route.q.periode, def?.periodeDefaut));
  const semaines = $derived((PERIODES.find((p) => p.cle === periodeCle) || PERIODES[1]).semaines);
  const seances = $derived(sport === 'tout' ? brut.seances : brut.seances.filter((s) => familleAffichage(s.sport) === sport));

  const analyse = $derived(def && !brut.chargement && !brut.erreur ? def.calculer({ ...brut, seances }, { aujourdhui, semaines, nomSport, famille: sport }) : null);

  const retour = $derived(construireAdresse({ sport: menu.filtre }));
  const COULEUR_NIVEAU = { ok: 'var(--ok)', attention: 'var(--alerte)', danger: 'var(--danger)', info: 'var(--sport-velo)' };
  const COULEUR_TON = { ok: 'var(--ok)', alerte: 'var(--alerte)', danger: 'var(--danger)', info: 'var(--sport-velo)' };
  const NOM_PRIORITE = { haute: 'À faire en priorité', moyenne: 'Conseillé', faible: 'Si tu veux', info: 'Bon à savoir' };
  const nomFamille = (f) => (SPORTS[f] || SPORTS.autre).court;
</script>

<main class="page">
  <EnTete actif="accueil" {demo} />
  <SelecteurSport />

  <p class="retour"><a href={retour}>← Retour à l'accueil</a></p>

  {#if !def}
    <header class="entete"><h1 class="titre">Analyse introuvable</h1></header>
    <p class="info">Cette analyse n'existe pas (ou plus). <a href={retour}>Retour à l'accueil</a>.</p>
  {:else}
    <header class="entete">
      <div>
        <h1 class="titre">{def.titre}</h1>
        <p class="sous-titre">{def.sousTitre}{nomSport ? ` · ${nomSport}` : ''}</p>
      </div>
      {#if def.periodes}
        <div class="periodes" role="group" aria-label="Période analysée">
          {#each PERIODES as p (p.cle)}
            <button type="button" aria-pressed={periodeCle === p.cle} onclick={() => regler({ periode: p.cle })}>{p.libelle}</button>
          {/each}
        </div>
      {/if}
    </header>

    {#if def.sportImpose && menu.filtre !== 'tout' && menu.filtre !== def.sportImpose}
      <p class="note-sport">Cette analyse ne porte que sur la {(SPORTS[def.sportImpose] || SPORTS.autre).nom.toLowerCase()}, quel que soit le sport choisi.</p>
    {/if}

    {#if brut.chargement}
      <p class="info" role="status">Analyse de tes données…</p>
    {:else if brut.erreur}
      <p class="alerte" role="alert">{brut.erreur}</p>
    {:else if analyse}
      <section class="verdict" style:--c={COULEUR_NIVEAU[analyse.verdict.niveau]} aria-label="Verdict">
        <h2 class="titre">{analyse.verdict.titre}</h2>
        <p>{analyse.verdict.texte}</p>
      </section>

      {#if analyse.chiffres.length}
        <section class="chiffres" aria-label="Chiffres clés">
          {#each analyse.chiffres as c (c.etiquette)}
            <StatCle etiquette={c.etiquette} valeur={c.valeur} unite={c.unite} note={c.note} couleur={COULEUR_TON[c.ton] || ''} />
          {/each}
        </section>
      {/if}

      {#each analyse.graphiques as g (g.titre)}
        <Bloc titre={g.titre}>
          <p class="description">{g.description}</p>
          {#if g.type === 'barres'}
            <BarresEmpilees series={g.series} etiquettes={g.etiquettes} ligne={g.ligne} hauteur={240} etiquette={g.titre} />
            <ul class="legende">
              {#each g.series as s (s.nom)}<li><span class="pastille" style:background={s.couleur}></span>{nomFamille(s.nom)}</li>{/each}
              <li><span class="trait"></span>Condition</li>
            </ul>
          {:else if g.type === 'lignes'}
            <GraphiqueLignes etiquettes={g.etiquettes} series={g.series} bandes={g.bandes || []} marqueurs={g.marqueurs || []} min={g.min} max={g.max} etiquette={g.titre} />
          {:else if g.type === 'chaleur'}
            <!-- cases plafonnées à ~30 px : sur 3 mois (12 colonnes) elles feraient des carrés énormes sur grand écran -->
            <div style:max-width="{g.colonnes * 30 + 20}px"><CarteChaleur cases={g.cases} colonnes={g.colonnes} etiquette={g.titre} reperes /></div>
            <ul class="legende">
              {#each g.sports as s (s.nom)}<li><span class="pastille" style:background={s.couleur}></span>{s.nom}</li>{/each}
            </ul>
          {:else if g.type === 'repartition'}
            <div class="repartition" role="img" aria-label={g.segments.map((s) => `${s.nom} ${s.valeur} %`).join(', ')}>
              {#each g.segments.filter((s) => s.valeur > 0) as s (s.nom)}<span style:width="{s.valeur}%" style:background={s.couleur}></span>{/each}
            </div>
            <ul class="legende">
              {#each g.segments as s (s.nom)}<li><span class="pastille" style:background={s.couleur}></span>{s.nom} <b>{s.valeur} %</b></li>{/each}
            </ul>
          {:else if g.type === 'tableau'}
            <div class="defile">
              <table>
                <thead><tr>{#each g.colonnes as c (c)}<th scope="col">{c}</th>{/each}</tr></thead>
                <tbody>
                  {#each g.lignes as l, i (i)}<tr>{#each l as cellule, j (j)}<td>{cellule}</td>{/each}</tr>{/each}
                </tbody>
              </table>
            </div>
          {/if}
        </Bloc>
      {/each}

      {#if !analyse.insuffisant}
        <div class="deux">
          <Bloc titre="Ce que disent tes données">
            <ul class="lectures">
              {#each analyse.lectures as l, i (i)}<li>{l}</li>{/each}
            </ul>
          </Bloc>
          <Bloc titre="Ce que je te conseille">
            <ul class="conseils">
              {#each analyse.conseils as c (c.titre)}
                <li class="p-{c.priorite}">
                  <span class="badge">{NOM_PRIORITE[c.priorite]}</span>
                  <strong>{c.titre}</strong>
                  <p>{c.texte}</p>
                </li>
              {/each}
            </ul>
          </Bloc>
        </div>
      {/if}

      <Bloc titre="Comment c'est calculé">
        <div class="methode">
          {#each analyse.methode as m (m.titre)}
            <details>
              <summary>{m.titre}</summary>
              <p>{m.texte}</p>
            </details>
          {/each}
        </div>
        <p class="avertissement">Ces analyses sont des estimations déduites de tes séances : elles aident à décider, elles ne remplacent ni ton ressenti ni l'avis d'un professionnel de santé.</p>
      </Bloc>
    {/if}
  {/if}
</main>

<style>
  .retour {
    margin: 4px 0 0;
    font-size: 14px;
  }
  .retour a {
    color: var(--texte-doux);
  }
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px 24px;
    padding: 12px 0 20px;
  }
  h1 {
    font-size: clamp(32px, 5vw, 48px);
    line-height: 1;
  }
  .sous-titre {
    margin-top: 8px;
    color: var(--texte-doux);
    font-size: 16px;
  }
  .periodes {
    display: flex;
    gap: 4px;
  }
  .periodes button {
    min-height: var(--cible);
    padding: 0 16px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    background: transparent;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .periodes button[aria-pressed='true'] {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
  .note-sport,
  .info {
    margin: 0 0 16px;
    color: var(--texte-doux);
    font-size: 14px;
  }
  .verdict {
    margin-bottom: 16px;
    padding: 22px 26px;
    background: var(--surface);
    border-radius: var(--rayon);
    border-left: 6px solid var(--c);
  }
  .verdict h2 {
    font-size: 26px;
    color: var(--c);
  }
  .verdict p {
    margin-top: 8px;
    max-width: 780px;
    font-size: 17px;
    line-height: 1.5;
    color: var(--texte);
  }
  .chiffres {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .chiffres :global(.stat) {
    padding: 16px 18px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  .chiffres :global(.valeur) {
    font-size: 30px;
  }
  .description {
    margin: -6px 0 14px;
    max-width: 760px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  :global(main.page > .bloc),
  :global(main.page > .deux) {
    margin-bottom: 16px;
  }
  .legende {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .legende li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pastille {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .trait {
    width: 16px;
    height: 3px;
    background: var(--texte);
    border-radius: 2px;
  }
  .repartition {
    display: flex;
    height: 28px;
    overflow: hidden;
    border-radius: var(--rayon);
  }
  .repartition span {
    display: block;
    height: 100%;
  }
  .defile {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--trait);
    white-space: nowrap;
  }
  th {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  td:nth-child(2) {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .deux {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
  }
  .lectures,
  .conseils {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lectures li {
    padding: 10px 0;
    border-bottom: 1px solid var(--trait);
    font-size: 15px;
    line-height: 1.5;
  }
  .lectures li:last-child,
  .conseils li:last-child {
    border-bottom: 0;
  }
  .conseils li {
    padding: 14px 0;
    border-bottom: 1px solid var(--trait);
  }
  .conseils p {
    margin-top: 4px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--texte-doux);
  }
  .conseils strong {
    display: block;
    font-size: 16px;
  }
  .badge {
    display: inline-block;
    margin-bottom: 6px;
    padding: 2px 10px;
    border-radius: var(--rayon-rond);
    border: 1px solid var(--trait-fort);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .p-haute .badge {
    border-color: var(--danger);
    color: var(--danger);
  }
  .p-moyenne .badge {
    border-color: var(--alerte);
    color: var(--alerte);
  }
  .methode details {
    padding: 10px 0;
    border-bottom: 1px solid var(--trait);
  }
  .methode summary {
    min-height: 32px;
    cursor: pointer;
    font-weight: 600;
  }
  .methode p {
    margin-top: 6px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--texte-doux);
  }
  .avertissement {
    margin-top: 14px;
    font-size: 12px;
    color: var(--texte-doux);
  }
</style>
