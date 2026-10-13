<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import Bloc from '../lib/components/Bloc.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import PanneauProgramme from '../lib/components/PanneauProgramme.svelte';
  import CourbeLissee from '../lib/components/charts/CourbeLissee.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { donnees, rafraichir } from '../lib/stores/edition.svelte.js';
  import { lireForce, sauverProgramme, retirerProgramme, ajouterExercicePerso, retirerExercicePerso } from '../lib/data/force-acces.js';
  import { exerciceDepuisLigne, GROUPES, ORDRE_GROUPES, groupeValide } from '../lib/data/exercices.js';
  import { progressionParExercice, resumeProgramme, tonnage } from '../lib/data/force.js';
  import { formatDateCourte, formatKg, formatNombre } from '../lib/utils/format.js';

  // Page « Force » : programmes (séances types), journal des séances de force, exercices et records.
  // onglet : 'programmes' | 'journal' | 'exercices'
  let { demo = false, onglet = 'programmes' } = $props();

  let etat = $state({ chargement: true, erreur: '', seances: [], series: [], programmes: [], exercicesPerso: [] });
  let panneau = $state({ ouvert: false, programme: null });
  let nouvelExo = $state({ nom: '', groupe: 'pectoraux', erreur: '', envoi: false });
  let aSupprimer = $state('');

  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  const perso = $derived(etat.exercicesPerso.map(exerciceDepuisLigne));

  async function charger(u) {
    if (!u) return;
    const r = await lireForce(demo, u);
    etat = { chargement: false, erreur: r.erreur, ...(r.data || { seances: [], series: [], programmes: [], exercicesPerso: [] }) };
  }
  $effect(() => {
    const u = userId;
    void donnees.version;
    untrack(() => charger(u));
  });

  // --- Programmes ---
  const ouvrirProgramme = (p = null) => (panneau = { ouvert: true, programme: p });
  const fermerProgramme = () => (panneau = { ouvert: false, programme: null });

  async function enregistrerProgramme(valeurs, id) {
    const r = await sauverProgramme(demo, userId, valeurs, id);
    if (!r.erreur) {
      fermerProgramme();
      rafraichir();
    }
    return r;
  }
  async function supprimerProgramme(id) {
    const r = await retirerProgramme(demo, userId, id);
    if (!r.erreur) {
      fermerProgramme();
      rafraichir();
    }
    return r;
  }
  async function creerExoPerso(nom, groupe) {
    const r = await ajouterExercicePerso(demo, userId, nom, groupe);
    if (r.erreur) return { exo: null, erreur: r.erreur };
    rafraichir();
    return { exo: exerciceDepuisLigne(r.data), erreur: '' };
  }

  // --- Journal : tonnage et nombre de séries de chaque séance ---
  const journal = $derived.by(() => {
    const parSeance = new Map();
    for (const s of etat.series) {
      if (!parSeance.has(s.activity_id)) parSeance.set(s.activity_id, []);
      parSeance.get(s.activity_id).push(s);
    }
    return etat.seances.map((s) => {
      const lignes = parSeance.get(s.id) || [];
      return { ...s, nbSeries: lignes.length, tonnage: tonnage(lignes) };
    });
  });

  // --- Exercices : records et exercices perso ---
  const records = $derived(progressionParExercice(etat.series).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));

  async function ajouterPerso(e) {
    e.preventDefault();
    if (nouvelExo.envoi) return;
    const nom = nouvelExo.nom.trim();
    if (!nom) return (nouvelExo.erreur = 'Donne un nom à ton exercice.');
    if (nom.length > 80) return (nouvelExo.erreur = '80 caractères maximum.');
    if (!groupeValide(nouvelExo.groupe)) return (nouvelExo.erreur = 'Choisis un groupe musculaire.');
    nouvelExo.envoi = true;
    const r = await ajouterExercicePerso(demo, userId, nom, nouvelExo.groupe);
    nouvelExo.envoi = false;
    if (r.erreur) return (nouvelExo.erreur = r.erreur);
    nouvelExo.nom = '';
    nouvelExo.erreur = '';
    rafraichir();
  }
  async function supprimerPerso(id) {
    const r = await retirerExercicePerso(demo, userId, id);
    aSupprimer = '';
    if (r.erreur) etat.erreur = r.erreur;
    else rafraichir();
  }

  const onglets = [
    { cle: 'programmes', nom: 'Programmes', href: '#/force' },
    { cle: 'journal', nom: 'Journal', href: '#/force/journal' },
    { cle: 'exercices', nom: 'Exercices et records', href: '#/force/exercices' },
  ];
</script>

<main class="page">
  <EnTete actif="force" {demo} />

  <header class="titre-page">
    <h1 class="titre">Force</h1>
    <div class="actions">
      <Bouton variante="discret" href="#/force/apres/libre">Ajouter une séance passée</Bouton>
      <Bouton href="#/force/seance/libre">Séance libre</Bouton>
    </div>
  </header>

  <nav class="onglets" aria-label="Sections de la force">
    {#each onglets as o (o.cle)}
      <a href={o.href} aria-current={onglet === o.cle ? 'page' : undefined}>{o.nom}</a>
    {/each}
  </nav>

  {#if etat.erreur}<p class="alerte" role="alert">{etat.erreur}</p>{/if}

  {#if etat.chargement}
    <p class="info" role="status">Chargement…</p>
  {:else if onglet === 'journal'}
    {#if journal.length}
      <ul class="journal">
        {#each journal as s (s.id)}
          <li>
            <a href={`#/force/modifier/${s.id}`}>
              <span class="date">{formatDateCourte(s.start_date_local)}</span>
              <span class="nom">{s.name || 'Séance de force'}</span>
              <span class="detail">
                {#if s.nbSeries}{s.nbSeries} série{s.nbSeries > 1 ? 's' : ''} · {formatNombre(s.tonnage)} kg{:else}Sans détail : ajoute tes séries{/if}
                {#if s.moving_time} · {Math.round(s.moving_time / 60)} min{/if}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <Bloc><p class="vide">Aucune séance de force sur les 12 derniers mois. Démarre une séance ou ajoute-en une passée.</p></Bloc>
    {/if}
  {:else if onglet === 'exercices'}
    <div class="deux">
      <Bloc titre="Tes records par exercice">
        {#if records.length}
          <ul class="records">
            {#each records as e (e.cle)}
              <li>
                <span class="nom">{e.nom}{#if e.record} <span class="badge">Record</span>{/if}</span>
                <span class="rm titre">{formatKg(e.rm)}<small> kg</small></span>
                <span class="mini">
                  {#if e.serie.length > 1}<CourbeLissee valeurs={e.serie.map((p) => p.rm)} couleur="var(--sport-muscu)" hauteur={36} largeur={120} marge={4} epaisseur={2} aire={false} etiquette={`Progression : ${e.nom}`} />{/if}
                </span>
                <span class="quand">{formatDateCourte(e.date)}</span>
              </li>
            {/each}
          </ul>
          <p class="note">1RM estimé (formule d'Epley) sur la meilleure série de la dernière séance, jusqu'à 12 répétitions.</p>
        {:else}
          <p class="vide">Tes records apparaîtront dès que tu auras enregistré des séries avec une charge.</p>
        {/if}
      </Bloc>

      <Bloc titre="Tes exercices">
        {#if perso.length}
          <ul class="perso">
            {#each etat.exercicesPerso as l (l.id)}
              <li>
                <span>{l.name} <span class="groupe">{GROUPES[l.muscle_group]?.nom}</span></span>
                {#if aSupprimer === l.id}
                  <span class="confirmer">
                    <button type="button" onclick={() => supprimerPerso(l.id)}>Oui, supprimer</button>
                    <button type="button" class="texte" onclick={() => (aSupprimer = '')}>Non</button>
                  </span>
                {:else}
                  <button type="button" class="texte" onclick={() => (aSupprimer = l.id)} aria-label={`Supprimer ${l.name}`}>Supprimer</button>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="vide">Tu n'as pas encore créé d'exercice. La bibliothèque contient déjà une cinquantaine d'exercices classiques.</p>
        {/if}
        <form class="ajout" onsubmit={ajouterPerso} novalidate>
          <label for="perso-nom">Nouvel exercice</label>
          <input id="perso-nom" type="text" bind:value={nouvelExo.nom} maxlength="80" placeholder="Développé Svend" aria-invalid={nouvelExo.erreur ? 'true' : undefined} />
          <label for="perso-groupe">Groupe musculaire</label>
          <select id="perso-groupe" bind:value={nouvelExo.groupe}>
            {#each ORDRE_GROUPES as g}<option value={g}>{GROUPES[g].nom}</option>{/each}
          </select>
          {#if nouvelExo.erreur}<p class="erreur" role="alert">{nouvelExo.erreur}</p>{/if}
          <Bouton type="submit" variante="discret">{nouvelExo.envoi ? 'Ajout…' : 'Ajouter'}</Bouton>
        </form>
      </Bloc>
    </div>
  {:else}
    <div class="programmes">
      {#each etat.programmes as p (p.id)}
        {@const r = resumeProgramme(p)}
        <Bloc titre={p.name}>
          <p class="resume">{r.exercices} exercice{r.exercices > 1 ? 's' : ''} · {r.series} séries · environ {r.minutes} min</p>
          <ul class="apercu">
            {#each (p.exercises || []).slice(0, 5) as e}<li>{e.name} <span>{e.sets} × {e.reps}</span></li>{/each}
            {#if (p.exercises || []).length > 5}<li class="suite">+ {p.exercises.length - 5} autres</li>{/if}
          </ul>
          <div class="actions">
            <Bouton href={`#/force/seance/${p.id}`}>Démarrer</Bouton>
            <Bouton variante="discret" onclick={() => ouvrirProgramme(p)}>Modifier</Bouton>
          </div>
        </Bloc>
      {:else}
        <Bloc titre="Aucun programme">
          <p class="vide">Un programme, c'est une séance type : Push, Pull, Legs… avec ses exercices, ses séries et ses charges. Ton accueil Muscu s'en sert pour te proposer la séance du jour.</p>
        </Bloc>
      {/each}
      <button type="button" class="nouveau" onclick={() => ouvrirProgramme(null)}>+ Nouveau programme</button>
    </div>
  {/if}
</main>

<PanneauProgramme
  ouvert={panneau.ouvert}
  programme={panneau.programme}
  {perso}
  onenregistrer={enregistrerProgramme}
  onsupprimer={supprimerProgramme}
  oncreerExo={creerExoPerso}
  onfermer={fermerProgramme}
/>

<style>
  .titre-page {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0 8px;
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
  .onglets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 12px 0 20px;
  }
  .onglets a {
    display: inline-flex;
    align-items: center;
    min-height: var(--cible);
    padding: 0 16px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    color: var(--texte-doux);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .onglets a[aria-current='page'] {
    background: var(--texte);
    border-color: var(--texte);
    color: var(--fond);
  }
  .info,
  .vide,
  .note {
    color: var(--texte-doux);
    font-size: 14px;
    line-height: 1.5;
  }
  .note {
    margin-top: 12px;
    font-size: 12px;
  }
  .alerte {
    padding: 10px 14px;
    margin-bottom: 16px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }

  .programmes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .resume {
    margin: -8px 0 12px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .apercu {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    font-size: 14px;
  }
  .apercu li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-top: 1px solid var(--trait);
  }
  .apercu li span,
  .suite {
    color: var(--texte-doux);
  }
  .nouveau {
    min-height: 120px;
    background: transparent;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon);
    color: var(--texte);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .journal {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .journal a {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 2px 14px;
    padding: 14px 18px;
    background: var(--surface);
    border-radius: var(--rayon);
    color: var(--texte);
    text-decoration: none;
  }
  .journal .date {
    grid-row: span 2;
    align-self: center;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .journal .nom {
    font-weight: 700;
  }
  .journal .detail {
    font-size: 13px;
    color: var(--texte-doux);
  }

  .deux {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
    align-items: start;
  }
  .records,
  .perso {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .records li {
    display: grid;
    grid-template-columns: 1fr auto 120px;
    align-items: center;
    gap: 2px 14px;
    padding: 10px 0;
    border-top: 1px solid var(--trait);
    font-size: 14px;
  }
  .records li:first-child {
    border-top: 0;
  }
  .records .rm {
    font-size: 22px;
    text-align: right;
  }
  .records small {
    font-family: var(--police-texte);
    font-size: 12px;
    color: var(--texte-doux);
  }
  .records .mini {
    grid-row: span 2;
    grid-column: 3;
  }
  .records .quand {
    grid-column: 1 / 3;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .badge {
    padding: 2px 7px;
    border-radius: var(--rayon-rond);
    background: var(--sport-muscu);
    color: var(--encre-sur-couleur);
    font-size: 11px;
    font-weight: 700;
  }
  .perso li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: var(--cible);
    border-top: 1px solid var(--trait);
    font-size: 14px;
  }
  .perso li:first-child {
    border-top: 0;
  }
  .groupe {
    margin-left: 6px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .texte,
  .confirmer button {
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
  .ajout {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--trait);
  }
  .ajout label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .ajout input,
  .ajout select {
    box-sizing: border-box;
    width: 100%;
    height: 48px;
    padding: 0 14px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  .ajout input[aria-invalid='true'] {
    border-color: var(--danger);
  }
  .erreur {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
</style>
