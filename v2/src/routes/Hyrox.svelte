<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import StatCle from '../lib/components/StatCle.svelte';
  import PanneauTestHyrox from '../lib/components/PanneauTestHyrox.svelte';
  import PanneauObjectifHyrox from '../lib/components/PanneauObjectifHyrox.svelte';
  import CourbeLissee from '../lib/components/charts/CourbeLissee.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { donnees, rafraichir } from '../lib/stores/edition.svelte.js';
  import { lireHyrox, sauverTest, retirerTest, sauverObjectif } from '../lib/data/force-acces.js';
  import { SEGMENTS, ciblesSegments, ecrireTemps, formatEcart, formatEcartLong, resumeTests } from '../lib/data/hyrox.js';
  import { formatDateCourte } from '../lib/utils/format.js';

  // Page Hyrox : tes tests et courses (16 segments), ton objectif de temps et l'évolution segment par segment.
  let { demo = false } = $props();

  let etat = $state({ chargement: true, erreur: '', tests: [], objectif: null });
  let panneauTest = $state({ ouvert: false, test: null });
  let panneauObjectif = $state({ ouvert: false });

  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);

  async function charger(u) {
    if (!u) return;
    const r = await lireHyrox(demo, u);
    etat = { chargement: false, erreur: r.erreur, ...(r.data || { tests: [], objectif: null }) };
  }
  $effect(() => {
    const u = userId;
    void donnees.version;
    untrack(() => charger(u));
  });

  const resume = $derived(resumeTests(etat.tests));
  const cibles = $derived(ciblesSegments(etat.objectif, resume.dernier));
  const ecartObjectif = $derived(etat.objectif && resume.dernier ? resume.dernier.total_s - etat.objectif.total_s : null);
  // Le meilleur temps de chaque segment, tous tests confondus
  const meilleurs = $derived(SEGMENTS.map((s) => (etat.tests.length ? Math.min(...etat.tests.map((t) => Number(t.segments[s.i]))) : null)));
  // Évolution des temps totaux, du plus ancien au plus récent (un total plus bas est meilleur : on inverse pour que « mieux » monte)
  const evolution = $derived([...etat.tests].reverse().map((t) => -t.total_s));

  const ouvrirTest = (t = null) => (panneauTest = { ouvert: true, test: t });
  const fermerTest = () => (panneauTest = { ouvert: false, test: null });

  async function enregistrerTest(valeurs, id) {
    const r = await sauverTest(demo, userId, valeurs, id);
    if (!r.erreur) {
      fermerTest();
      rafraichir();
    }
    return r;
  }
  async function supprimerTest(id) {
    const r = await retirerTest(demo, userId, id);
    if (!r.erreur) {
      fermerTest();
      rafraichir();
    }
    return r;
  }
  async function enregistrerObjectif(valeurs) {
    const r = await sauverObjectif(demo, userId, valeurs);
    if (!r.erreur) {
      panneauObjectif = { ouvert: false };
      rafraichir();
    }
    return r;
  }

  /** Écart d'un segment avec le test précédent (négatif = plus rapide). */
  const delta = (i) => (resume.dernier && resume.precedent ? Number(resume.dernier.segments[i]) - Number(resume.precedent.segments[i]) : null);
</script>

<main class="page">
  <EnTete actif="hyrox" {demo} />

  <header class="titre-page">
    <h1 class="titre">Hyrox</h1>
    <div class="actions">
      <Bouton variante="discret" onclick={() => (panneauObjectif = { ouvert: true })}>{etat.objectif ? 'Mon objectif' : 'Fixer un objectif'}</Bouton>
      <Bouton onclick={() => ouvrirTest(null)}>Nouveau test</Bouton>
    </div>
  </header>

  {#if etat.erreur}<p class="alerte" role="alert">{etat.erreur}</p>{/if}

  {#if etat.chargement}
    <p class="info" role="status">Chargement…</p>
  {:else if !etat.tests.length}
    <Bloc titre="Aucun test pour l'instant">
      <p class="vide">Un test Hyrox, c'est 8 runs d'1 km et 8 stations. Saisis le temps de chaque segment (au chrono ou depuis ta montre) : l'app te montre où tu perds du temps et si tu progresses.</p>
      <div class="actions"><Bouton onclick={() => ouvrirTest(null)}>Saisir mon premier test</Bouton></div>
    </Bloc>
  {:else}
    <section class="chiffres">
      <StatCle etiquette="Dernier test" valeur={ecrireTemps(resume.dernier.total_s)} note={`${resume.dernier.label} · ${formatDateCourte(resume.dernier.date)}`} />
      <StatCle etiquette="Meilleur" valeur={ecrireTemps(resume.meilleur.total_s)} note={formatDateCourte(resume.meilleur.date)} couleur="var(--sport-hybride-texte)" />
      <StatCle etiquette="Objectif" valeur={etat.objectif ? ecrireTemps(etat.objectif.total_s) : '—'} note={etat.objectif ? '' : 'Fixe-en un pour voir l\'écart'} />
      <StatCle
        etiquette="Écart"
        valeur={ecartObjectif != null ? formatEcartLong(ecartObjectif) : '—'}
        couleur={ecartObjectif == null ? '' : ecartObjectif > 0 ? 'var(--sport-course)' : 'var(--ok)'}
        note={ecartObjectif != null ? (ecartObjectif > 0 ? 'à gagner' : 'sous ton objectif') : ''}
      />
    </section>

    {#if evolution.length > 1}
      <Bloc titre="Évolution du temps total">
        <div class="graphe">
          <CourbeLissee valeurs={evolution} couleur="var(--sport-hybride)" largeur={640} hauteur={120} etiquette="Évolution de ton temps total sur tes tests" />
        </div>
        <p class="note">Plus la courbe monte, plus ton temps total baisse.</p>
      </Bloc>
    {/if}

    <Bloc titre="Segment par segment">
      <div class="defile">
        <table>
          <thead>
            <tr>
              <th scope="col">Segment</th>
              <th scope="col">Dernier</th>
              <th scope="col">vs précédent</th>
              <th scope="col">Meilleur</th>
              <th scope="col">Objectif</th>
            </tr>
          </thead>
          <tbody>
            {#each SEGMENTS as s (s.i)}
              {@const d = delta(s.i)}
              <tr class={s.type}>
                <th scope="row"><span class="pastille"></span>{s.nom} <small>{s.detail}</small></th>
                <td class="t">{ecrireTemps(resume.dernier.segments[s.i])}</td>
                <td class="t" class:mieux={d != null && d < 0} class:moins={d != null && d > 0}>{d != null ? formatEcart(d) : '—'}</td>
                <td class="t">{meilleurs[s.i] != null ? ecrireTemps(meilleurs[s.i]) : '—'}</td>
                <td class="t">{cibles ? ecrireTemps(cibles[s.i]) : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if etat.objectif && !etat.objectif.segments}
        <p class="note">Objectif réparti sur les segments au prorata de ton dernier test. Tu peux fixer un temps par segment dans « Mon objectif ».</p>
      {/if}
    </Bloc>

    <Bloc titre="Tes tests et courses">
      <ul class="tests">
        {#each etat.tests as t (t.id)}
          <li>
            <button type="button" onclick={() => ouvrirTest(t)}>
              <span class="date">{formatDateCourte(t.date)}</span>
              <span class="nom">{t.label}{#if t.kind === 'course'} <span class="badge">Course</span>{/if}</span>
              <span class="total titre">{ecrireTemps(t.total_s)}</span>
            </button>
          </li>
        {/each}
      </ul>
    </Bloc>
  {/if}
</main>

<PanneauTestHyrox ouvert={panneauTest.ouvert} test={panneauTest.test} {demo} {userId} onenregistrer={enregistrerTest} onsupprimer={supprimerTest} onfermer={fermerTest} />
<PanneauObjectifHyrox ouvert={panneauObjectif.ouvert} objectif={etat.objectif} onenregistrer={enregistrerObjectif} onfermer={() => (panneauObjectif = { ouvert: false })} />

<style>
  .page > :global(section + section),
  .page > :global(section + div) {
    margin-top: 16px;
  }
  .titre-page {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0 20px;
  }
  h1 {
    font-size: clamp(32px, 5vw, 44px);
    line-height: 1;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .info,
  .vide {
    color: var(--texte-doux);
    font-size: 14px;
    line-height: 1.5;
  }
  .vide {
    margin: 0 0 16px;
  }
  .alerte {
    padding: 10px 14px;
    margin-bottom: 16px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }
  .chiffres {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    padding: 24px 26px;
    margin-bottom: 16px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  @media (max-width: 600px) {
    .chiffres {
      grid-template-columns: 1fr 1fr;
      padding: 18px;
    }
  }
  .graphe {
    max-width: 640px;
  }
  .note {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .defile {
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 520px;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 9px 8px;
    border-top: 1px solid var(--trait);
    text-align: right;
    white-space: nowrap;
  }
  thead th {
    border-top: 0;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  th:first-child,
  thead th:first-child {
    text-align: left;
  }
  tbody th {
    font-weight: 600;
  }
  tbody th small {
    margin-left: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--texte-doux);
  }
  .pastille {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 10px;
    border-radius: 2px;
    background: var(--trait-fort);
  }
  tr.station .pastille {
    background: var(--sport-hybride);
  }
  .t {
    font-variant-numeric: tabular-nums;
  }
  .mieux {
    color: var(--ok);
  }
  .moins {
    color: var(--alerte);
  }
  .tests {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tests li + li {
    border-top: 1px solid var(--trait);
  }
  .tests button {
    display: grid;
    grid-template-columns: 110px 1fr auto;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 56px;
    padding: 0;
    background: transparent;
    border: 0;
    color: var(--texte);
    font-size: 15px;
    text-align: left;
    cursor: pointer;
  }
  .tests .date {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .tests .total {
    font-size: 22px;
  }
  .badge {
    padding: 2px 7px;
    border-radius: var(--rayon-rond);
    background: var(--sport-hybride);
    color: var(--encre-sur-couleur);
    font-size: 11px;
    font-weight: 700;
  }
  button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
</style>
