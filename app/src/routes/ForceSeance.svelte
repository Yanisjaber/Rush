<script>
  import { untrack } from 'svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import Champ from '../lib/components/Champ.svelte';
  import SelecteurExercice from '../lib/components/SelecteurExercice.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { rafraichir } from '../lib/stores/edition.svelte.js';
  import { lireForce, lireSeanceForce, sauverSeance, retirerSeance, ajouterExercicePerso } from '../lib/data/force-acces.js';
  import { exerciceDepuisLigne, GROUPES } from '../lib/data/exercices.js';
  import {
    brouillonVide, brouillonDepuisProgramme, brouillonDepuisSeance, dernieresCharges, serieVide, validerSeance,
    ligneSeanceForce, lignesSeries, tonnage, LIMITES,
  } from '../lib/data/force.js';
  import { dateIsoLocale, formatNombre, formatKg, formatDateCourte } from '../lib/utils/format.js';

  // Saisir une séance de force.
  //  - mode « direct » : séance en cours (chrono, repos entre les séries, brouillon gardé si la page se recharge) ;
  //  - mode « apres » : séance déjà faite, qu'on saisit après coup (date et durée libres) ;
  //  - mode « modifier » : séance déjà enregistrée.
  // cible : identifiant d'un programme, « libre » (séance sans programme) ou identifiant de la séance à modifier.
  let { demo = false, mode = 'direct', cible = 'libre' } = $props();

  const REPOS = 90; // secondes de repos proposées après une série cochée
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);

  let b = $state(brouillonVide(dateIsoLocale()));
  let chargement = $state(true);
  let erreur = $state('');
  let erreurs = $state({});
  let envoi = $state(false);
  let choix = $state(false);
  let confirmer = $state(''); // 'abandon' | 'suppression'
  let perso = $state([]);
  let derniers = $state(new Map());
  let existante = $state(null); // { id, manuelle } en mode modifier
  let debut = $state(Date.now());
  let maintenant = $state(Date.now());
  let reposFin = $state(0);

  const cleBrouillon = $derived(`rush-force-brouillon-${userId}`);

  // --- Chargement ---
  async function initialiser(u) {
    if (!u) return;
    chargement = true;
    erreur = '';
    const f = await lireForce(demo, u);
    if (f.erreur) erreur = f.erreur;
    const donnees = f.data || { series: [], programmes: [], exercicesPerso: [] };
    perso = donnees.exercicesPerso.map(exerciceDepuisLigne);
    derniers = dernieresCharges(donnees.series);
    const aujourdhui = dateIsoLocale();
    const heure = new Date().toTimeString().slice(0, 5);

    if (mode === 'modifier') {
      const r = await lireSeanceForce(demo, u, cible);
      if (r.erreur && !r.data) {
        erreur = r.erreur;
        chargement = false;
        return;
      }
      existante = { id: r.data.seance.id, manuelle: r.data.seance.source === 'manual' };
      b = brouillonDepuisSeance(r.data.seance, r.data.series);
      chargement = false;
      return;
    }

    // Brouillon de la même séance gardé dans le navigateur ? On le reprend (seulement en direct : une séance en cours).
    const cle = `${mode}:${cible}`;
    if (mode === 'direct') {
      try {
        const brut = JSON.parse(localStorage.getItem(cleBrouillon) || 'null');
        if (brut && brut.cle === cle && brut.b && Array.isArray(brut.b.exercices)) {
          b = brut.b;
          debut = Number(brut.debut) || Date.now();
          chargement = false;
          return;
        }
      } catch (e) {
        /* brouillon illisible : on repart de zéro */
      }
    }
    const prog = donnees.programmes.find((p) => p.id === cible);
    if (cible !== 'libre' && !prog) {
      erreur = 'Programme introuvable.';
    }
    b = prog ? brouillonDepuisProgramme(prog, aujourdhui, derniers, heure) : brouillonVide(aujourdhui, heure);
    if (!prog) b.nom = 'Séance de force';
    if (mode === 'apres') for (const ex of b.exercices) for (const s of ex.series) s.fait = true;
    debut = Date.now();
    chargement = false;
  }
  $effect(() => {
    const u = userId;
    void mode;
    void cible;
    untrack(() => initialiser(u));
  });

  // --- Brouillon gardé dans le navigateur (séance en cours uniquement) ---
  $effect(() => {
    if (mode !== 'direct' || chargement) return;
    const instantane = JSON.stringify({ cle: `${mode}:${cible}`, debut, b });
    try {
      localStorage.setItem(cleBrouillon, instantane);
    } catch (e) {
      /* stockage indisponible : la séance reste en mémoire */
    }
  });
  function effacerBrouillon() {
    try {
      localStorage.removeItem(cleBrouillon);
    } catch (e) {
      /* rien à effacer */
    }
  }

  // --- Chrono ---
  $effect(() => {
    const t = setInterval(() => (maintenant = Date.now()), 1000);
    return () => clearInterval(t);
  });
  const ecoule = $derived(Math.max(0, Math.floor((maintenant - debut) / 1000)));
  const reposRestant = $derived(Math.max(0, Math.ceil((reposFin - maintenant) / 1000)));
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const hhmmss = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : mmss(s));

  // --- Totaux en direct ---
  const faites = $derived(b.exercices.flatMap((e) => e.series.filter((s) => s.fait)));
  const tonnageDirect = $derived(
    tonnage(faites.map((s) => ({ reps: Number(String(s.reps).replace(',', '.')) || 0, weight_kg: Number(String(s.poids).replace(',', '.')) || 0 }))),
  );

  // --- Actions sur les exercices et les séries ---
  function cocher(ex, s) {
    s.fait = !s.fait;
    if (s.fait && mode === 'direct') reposFin = Date.now() + REPOS * 1000;
    if (!s.fait) reposFin = 0;
  }
  function ajouterSerie(ex) {
    if (ex.series.length >= LIMITES.series) return;
    const derniere = ex.series[ex.series.length - 1];
    ex.series.push(derniere ? serieVide(derniere.reps, derniere.poids) : serieVide('', ''));
  }
  function retirerSerie(ex, i) {
    ex.series.splice(i, 1);
  }
  function retirerExercice(i) {
    b.exercices.splice(i, 1);
  }
  function ajouterExercice(exo) {
    if (b.exercices.length >= LIMITES.exercices) return;
    const d = derniers.get(exo.cle);
    b.exercices.push({ cle: exo.cle, nom: exo.nom, groupe: exo.groupe, series: Array.from({ length: 3 }, () => serieVide(d ? d.reps : 8, d ? d.poids : '')) });
    choix = false;
  }
  async function creerExoPerso(nom, groupe) {
    const r = await ajouterExercicePerso(demo, userId, nom, groupe);
    if (r.erreur) return { exo: null, erreur: r.erreur };
    const exo = exerciceDepuisLigne(r.data);
    perso = [...perso, exo];
    return { exo, erreur: '' };
  }

  // --- Enregistrer, abandonner, supprimer ---
  async function enregistrer(e) {
    e?.preventDefault();
    if (envoi || chargement) return;
    if (mode === 'direct' && String(b.duree).trim() === '') b.duree = String(Math.min(600, Math.max(1, Math.round(ecoule / 60))));
    const { valeurs, erreurs: e2 } = validerSeance(b);
    erreurs = e2;
    erreur = '';
    if (!valeurs) return;
    envoi = true;
    const r = await sauverSeance(demo, userId, ligneSeanceForce(valeurs), lignesSeries(valeurs), existante);
    envoi = false;
    if (r.erreur) return (erreur = r.erreur);
    effacerBrouillon();
    rafraichir();
    location.hash = '#/muscu/journal';
  }
  function abandonner() {
    effacerBrouillon();
    location.hash = '#/muscu/programmes';
  }
  async function supprimer() {
    if (envoi || !existante) return;
    envoi = true;
    const r = await retirerSeance(demo, userId, existante.id, existante.manuelle);
    envoi = false;
    if (r.erreur) {
      erreur = r.erreur;
      confirmer = '';
      return;
    }
    rafraichir();
    location.hash = '#/muscu/journal';
  }

  const titre = $derived(mode === 'direct' ? 'Séance en cours' : mode === 'apres' ? 'Séance passée' : 'Modifier la séance');
</script>

<main class="page">

  <header class="titre-page">
    <div>
      <p class="surtitre"><a href="#/muscu/programmes">← Muscu</a></p>
      <h1 class="titre">{titre}</h1>
    </div>
    {#if mode === 'direct' && !chargement}
      <div class="chrono" role="timer" aria-label="Durée de la séance">
        <span class="valeur titre">{hhmmss(ecoule)}</span>
        <span class="legende">{faites.length} série{faites.length > 1 ? 's' : ''} · {formatNombre(tonnageDirect)} kg</span>
      </div>
    {/if}
  </header>

  {#if erreur}<p class="alerte" role="alert">{erreur}</p>{/if}

  {#if chargement}
    <p class="info" role="status">Chargement…</p>
  {:else}
    <form onsubmit={enregistrer} novalidate>
      <section class="infos">
        <Champ id="fs-nom" label="Nom de la séance" bind:valeur={b.nom} erreur={erreurs.nom} maxlength={80} placeholder="Push, Pull, Legs…" />
        {#if mode !== 'direct'}
          <div class="ligne">
            <Champ id="fs-date" type="date" label="Date" bind:valeur={b.date} erreur={erreurs.date} />
            <Champ id="fs-heure" type="time" label="Heure" bind:valeur={b.heure} erreur={erreurs.heure} />
            <Champ id="fs-duree" label="Durée (min)" inputmode="numeric" bind:valeur={b.duree} erreur={erreurs.duree} placeholder="auto" />
          </div>
        {/if}
      </section>

      {#if b.exercices.length}
        <p class="aide-rir"><strong>RIR</strong> (facultatif) : les répétitions qu'il te restait en fin de série, 0 si tu étais à l'échec. Ça rend l'analyse de ta fatigue bien plus juste.</p>
      {/if}

      {#each b.exercices as ex, i (i + ex.cle)}
        {@const dernier = derniers.get(ex.cle)}
        <section class="exercice" aria-label={ex.nom}>
          <header>
            <div>
              <h2>{ex.nom}</h2>
              <p class="groupe">{GROUPES[ex.groupe]?.nom}{#if dernier} · dernière fois : {dernier.reps} × {formatKg(dernier.poids)} kg ({formatDateCourte(dernier.date)}){/if}</p>
            </div>
            <button type="button" class="texte" onclick={() => retirerExercice(i)} aria-label={`Retirer ${ex.nom} de la séance`}>Retirer</button>
          </header>
          <div class="entete-series" aria-hidden="true"><span>Série</span><span>Reps</span><span>Charge (kg)</span><span title="Répétitions en réserve : combien il t'en restait (0 = à l'échec)">RIR</span><span></span><span></span></div>
          {#each ex.series as s, k (k)}
            <div class="serie" class:fait={s.fait}>
              <span class="numero">{k + 1}</span>
              <input inputmode="numeric" bind:value={s.reps} aria-label={`${ex.nom}, série ${k + 1}, répétitions`} />
              <input inputmode="decimal" bind:value={s.poids} placeholder="corps" aria-label={`${ex.nom}, série ${k + 1}, charge en kilos`} />
              <input class="rir" inputmode="numeric" maxlength="2" bind:value={s.rir} placeholder="–" aria-label={`${ex.nom}, série ${k + 1}, répétitions en réserve (facultatif)`} />
              <button type="button" class="coche" aria-pressed={s.fait} aria-label={`Série ${k + 1} de ${ex.nom} faite`} onclick={() => cocher(ex, s)}>
                {s.fait ? '✓' : ''}
              </button>
              <button type="button" class="x" onclick={() => retirerSerie(ex, k)} aria-label={`Retirer la série ${k + 1}`}>×</button>
            </div>
          {/each}
          <button type="button" class="ajout-serie" onclick={() => ajouterSerie(ex)}>+ Série</button>
        </section>
      {/each}

      {#if erreurs.exercices}<p class="erreur" role="alert">{erreurs.exercices}</p>{/if}

      <section class="ajouter">
        {#if choix}
          <SelecteurExercice {perso} onchoisir={ajouterExercice} oncreer={creerExoPerso} onfermer={() => (choix = false)} />
        {:else}
          <Bouton variante="discret" onclick={() => (choix = true)}>+ Ajouter un exercice</Bouton>
        {/if}
      </section>

      <section class="infos">
        <div class="ligne">
          <Champ id="fs-rpe" label="Effort ressenti (1 à 10)" inputmode="numeric" bind:valeur={b.rpe} erreur={erreurs.rpe} />
        </div>
        <div class="champ">
          <label for="fs-notes">Notes</label>
          <textarea id="fs-notes" rows="3" maxlength="2000" bind:value={b.notes} aria-invalid={erreurs.notes ? 'true' : undefined}></textarea>
          {#if erreurs.notes}<span class="erreur" role="alert">{erreurs.notes}</span>{/if}
        </div>
      </section>

      <div class="barre">
        {#if mode === 'direct' && reposRestant > 0}
          <div class="repos" role="status">
            <span>Repos <strong>{mmss(reposRestant)}</strong></span>
            <button type="button" class="texte" onclick={() => (reposFin += 15000)}>+ 15 s</button>
            <button type="button" class="texte" onclick={() => (reposFin = 0)}>Passer</button>
          </div>
        {/if}
        <div class="actions">
          <Bouton type="submit">{envoi ? 'Enregistrement…' : mode === 'modifier' ? 'Enregistrer' : 'Terminer et enregistrer'}</Bouton>
          {#if mode === 'direct'}
            {#if confirmer === 'abandon'}
              <Bouton variante="discret" onclick={abandonner}>Oui, abandonner</Bouton>
              <Bouton variante="texte" onclick={() => (confirmer = '')}>Non</Bouton>
            {:else}
              <Bouton variante="texte" onclick={() => (confirmer = 'abandon')}>Abandonner</Bouton>
            {/if}
          {:else}
            <Bouton variante="discret" href={mode === 'modifier' ? '#/muscu/journal' : '#/muscu/programmes'}>Annuler</Bouton>
          {/if}
        </div>
      </div>

      {#if mode === 'modifier' && existante}
        <div class="danger">
          {#if confirmer === 'suppression'}
            <p>{existante.manuelle ? 'Supprimer définitivement cette séance et ses séries ?' : 'Supprimer les séries de cette séance ? La séance Strava reste dans ton calendrier.'}</p>
            <div class="actions">
              <Bouton variante="discret" onclick={supprimer}>Oui, supprimer</Bouton>
              <Bouton variante="texte" onclick={() => (confirmer = '')}>Non, garder</Bouton>
            </div>
          {:else}
            <Bouton variante="texte" onclick={() => (confirmer = 'suppression')}>{existante.manuelle ? 'Supprimer cette séance' : 'Supprimer les séries'}</Bouton>
          {/if}
        </div>
      {/if}
    </form>
  {/if}
</main>

<style>
  .titre-page {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0 16px;
  }
  .surtitre {
    margin: 0 0 6px;
    font-size: 13px;
  }
  .surtitre a {
    color: var(--texte-doux);
  }
  h1 {
    font-size: clamp(30px, 5vw, 42px);
    line-height: 1;
  }
  .chrono {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .chrono .valeur {
    font-size: 44px;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--sport-muscu);
  }
  .legende {
    margin-top: 4px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 760px;
  }
  .info {
    color: var(--texte-doux);
  }
  .alerte,
  .erreur {
    font-size: 14px;
    color: var(--danger);
  }
  .alerte {
    padding: 10px 14px;
    margin-bottom: 16px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
  }
  .infos {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
  }
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .champ label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 12px 16px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
    resize: vertical;
  }

  .exercice {
    padding: 16px 16px 12px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  .exercice header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .groupe {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .entete-series,
  .serie {
    display: grid;
    grid-template-columns: 34px 1fr 1fr 56px 52px 44px;
    align-items: center;
    gap: 8px;
  }
  .entete-series {
    margin-bottom: 4px;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .serie {
    margin-bottom: 6px;
  }
  .numero {
    text-align: center;
    font-weight: 700;
    color: var(--texte-doux);
  }
  .serie input {
    box-sizing: border-box;
    width: 100%;
    height: 48px;
    padding: 0 10px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 18px;
    font-weight: 600;
    text-align: center;
  }
  .serie input.rir {
    padding: 0 4px;
    font-size: 16px;
  }
  .aide-rir {
    margin: 0 0 4px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--texte-doux);
  }
  .serie.fait input {
    border-color: color-mix(in srgb, var(--sport-muscu) 70%, transparent);
  }
  .coche {
    width: 52px;
    height: 48px;
    background: transparent;
    border: 2px solid var(--trait-fort);
    border-radius: var(--rayon);
    color: var(--encre-sur-couleur);
    font-size: 22px;
    font-weight: 800;
    cursor: pointer;
  }
  .coche[aria-pressed='true'] {
    background: var(--sport-muscu);
    border-color: var(--sport-muscu);
  }
  .x {
    width: 44px;
    height: 48px;
    background: transparent;
    border: 0;
    color: var(--texte-doux);
    font-size: 22px;
    cursor: pointer;
  }
  .ajout-serie {
    min-height: var(--cible);
    width: 100%;
    margin-top: 2px;
    background: transparent;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon);
    color: var(--texte);
    font-weight: 600;
    cursor: pointer;
  }
  .texte {
    min-height: var(--cible);
    padding: 0 8px;
    background: transparent;
    border: 0;
    color: var(--texte-doux);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 4px;
    cursor: pointer;
  }
  input:focus-visible,
  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }

  /* Barre du bas : reste visible pendant qu'on fait défiler la séance */
  .barre {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 0 calc(12px + env(safe-area-inset-bottom));
    background: var(--fond);
    border-top: 1px solid var(--trait);
  }
  .repos {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
  }
  .repos strong {
    font-variant-numeric: tabular-nums;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .danger {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    font-size: 14px;
  }
</style>
