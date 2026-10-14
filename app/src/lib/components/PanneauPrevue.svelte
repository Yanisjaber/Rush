<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import EditeurStructure from './EditeurStructure.svelte';
  import VuePrevue from './VuePrevue.svelte';
  import ChampGpx from './ChampGpx.svelte';
  import { SPORTS, couleurSport } from '../sports.js';
  import { menu } from '../stores/menu.svelte.js';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS_PREVUE, sportsTries, sportDefaut, formulaireVide, formulaireDepuisLigne, validerPrevue, versLigne, estimerTss } from '../data/prevue.js';
  import { sportAvecStructure } from '../data/structure.js';
  import { donneesDemo, programmesDemo } from '../data/demo.js';
  import { creerPlanifiee, modifierPlanifiee, supprimerPlanifiee, chargerProfil, creerModele, chargerGpx, chargerProgrammes, chargerLienProgramme, lierProgramme } from '../data/api.js';
  import { formulaireDepuisModele, modeleDepuisValeurs } from '../data/modeles.js';

  // Créer ou modifier une séance prévue.
  //  seance : ligne de activity_planned à modifier (null = nouvelle) · dateInitiale : jour proposé pour une nouvelle
  //  modele : modèle de séance de départ (nouvelle séance préremplie) · modeleEnregistre(ligne) : un modèle vient d'être créé
  //  enregistree(ligne) / supprimee(id) : prévient la page pour qu'elle se mette à jour
  let { ouvert = false, seance = null, modele = null, dateInitiale, userId, demo = false, onfermer, enregistree, supprimee, modeleEnregistre } = $props();

  let f = $state(formulaireVide(dateInitiale));
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let confirmerSuppression = $state(false);
  let ref = $state({ ftp: 0, hrMax: 0 }); // FTP et FC max du profil : servent à traduire les % en watts et en bpm
  let avecStructure = $state(false);
  // 'voir' : affichage seul (clic sur une séance existante) · 'modifier' : formulaire (nouvelle séance ou bouton Modifier)
  let mode = $state('modifier');
  let retourModele = $state({ texte: '', erreur: false }); // résultat de « Enregistrer comme modèle »
  // Programme de muscu relié à la séance (séances de muscu seulement) : la carte « Séance du jour » de l'accueil propose de le démarrer
  let programmes = $state([]);
  let lien = $state(''); // identifiant du programme choisi ('' = aucun)
  let lienInitial = $state(''); // celui qui était enregistré à l'ouverture
  const estMuscu = $derived(familleAffichage(f.sport) === 'muscu');
  const programmeChoisi = $derived(estMuscu && lien ? programmes.find((p) => p.id === lien) || null : null);
  let contenuGpx = $state(''); // parcours de la séance affichée (chargé à la demande : colonne lourde)

  // Quand on affiche une séance qui a un parcours, on va chercher son contenu (jamais chargé avec les listes)
  $effect(() => {
    const cible = seance;
    const vue = ouvert && mode === 'voir';
    untrack(async () => {
      contenuGpx = '';
      if (!vue || !cible?.gpx_name) return;
      if (demo) return (contenuGpx = cible.gpx_content || '');
      const r = await chargerGpx(userId, cible.id);
      if (seance === cible) contenuGpx = r.data || '';
    });
  });
  const sportSansParcours = $derived(['WeightTraining', 'Swim'].includes(f.sport));
  function parcoursChoisi(g) {
    f.gpx = { nom: g.nom, contenu: g.contenu };
    f.gpxNom = g.nom;
    if (String(f.km).trim() === '' && g.km != null) f.km = String(g.km).replace('.', ',');
    if (String(f.dPlus).trim() === '' && g.dPlus != null) f.dPlus = String(g.dPlus);
  }
  function parcoursRetire() {
    f.gpx = null;
    f.gpxNom = '';
  }

  // À chaque ouverture : on repart d'un formulaire propre (celui de la séance, ou vide).
  // L'effet ne dépend que de l'ouverture et de la séance visée : le reste est isolé par untrack,
  // sinon chaque modification d'un bloc relancerait l'effet et effacerait la saisie.
  $effect(() => {
    if (!ouvert) return;
    const cible = seance;
    const depart = modele;
    const jour = dateInitiale;
    untrack(() => {
      f = cible ? formulaireDepuisLigne(cible) : depart ? formulaireDepuisModele(depart, jour) : { ...formulaireVide(jour), sport: sportDefaut(menu.filtre) }; // nouvelle séance : le sport filtré d'abord
      retourModele = { texte: '', erreur: false };
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      confirmerSuppression = false;
      avecStructure = f.structure.length > 0;
      mode = cible ? 'voir' : 'modifier';
      chargerReference();
      chargerProgrammesEtLien(cible);
    });
  });

  async function chargerReference() {
    const p = demo ? donneesDemo().profil : userId ? (await chargerProfil(userId)).data : null;
    ref = { ftp: Number(p?.ftp) || 0, hrMax: Number(p?.hr_max) || 0 };
  }

  async function chargerProgrammesEtLien(cible) {
    lien = '';
    lienInitial = '';
    if (demo) {
      programmes = programmesDemo();
      lien = cible?.programme_id || '';
    } else if (userId) {
      const [p, l] = await Promise.all([chargerProgrammes(userId), cible ? chargerLienProgramme(userId, cible.id) : Promise.resolve({ data: null })]);
      programmes = p.data || [];
      lien = l.data || cible?.programme_id || '';
    }
    lienInitial = lien;
  }

  const nomSport = (type) => (SPORTS[familleAffichage(type)] || SPORTS.autre).nom;
  const peutStructurer = $derived(sportAvecStructure(f.sport));
  const structureActive = $derived(peutStructurer && avecStructure && f.structure.length > 0);
  const tssEstime = $derived(estimerTss(Number(f.duree), Number(f.rpe) || null));

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerPrevue(f, ref);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    const ligne = versLigne(valeurs);
    let r;
    if (demo) r = { data: { ...ligne, id: seance?.id || `demo-nouvelle-${Date.now()}` }, erreur: '' };
    else r = seance ? await modifierPlanifiee(userId, seance.id, ligne) : await creerPlanifiee(userId, ligne);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      return;
    }
    // Le lien avec le programme s'enregistre à part (colonne ajoutée par une migration) : un échec n'efface pas la séance, on le dit
    const voulu = estMuscu ? lien : '';
    let lienErreur = '';
    if (!demo && voulu !== lienInitial) lienErreur = (await lierProgramme(userId, r.data.id, voulu || null)).erreur;
    if (!lienErreur) lienInitial = voulu;
    enregistree?.({ ...r.data, programme_id: lienErreur ? lienInitial || null : voulu || null });
    if (lienErreur) {
      erreurGlobale = lienErreur;
      return;
    }
    if (!seance) onfermer?.(); // une séance modifiée se réaffiche (la page met `seance` à jour) ; une nouvelle séance ferme le panneau
  }

  // Enregistre la séance telle qu'elle est dans le formulaire comme modèle réutilisable
  async function enregistrerModele() {
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerPrevue(f, ref);
    erreurs = e2;
    retourModele = { texte: '', erreur: false };
    if (!valeurs) return (retourModele = { texte: 'Complète le formulaire avant de l’enregistrer comme modèle.', erreur: true });
    envoi = true;
    const ligne = modeleDepuisValeurs(valeurs);
    const r = demo ? { data: { ...ligne, id: `demo-m-${Date.now()}` }, erreur: '' } : await creerModele(userId, ligne);
    envoi = false;
    if (r.erreur) return (retourModele = { texte: r.erreur, erreur: true });
    modeleEnregistre?.(r.data);
    retourModele = { texte: 'Modèle enregistré.', erreur: false };
  }

  // Annuler : sur une séance existante on revient à son affichage (en reprenant ses valeurs), sinon on ferme
  function annulerSaisie() {
    if (!seance) return onfermer?.();
    f = formulaireDepuisLigne(seance);
    erreurs = {};
    erreurGlobale = '';
    avecStructure = f.structure.length > 0;
    mode = 'voir';
  }

  async function supprimer() {
    if (!seance || envoi) return;
    envoi = true;
    const r = demo ? { erreur: '' } : await supprimerPlanifiee(userId, seance.id);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      confirmerSuppression = false;
      return;
    }
    supprimee?.(seance.id);
    onfermer?.();
  }
</script>

<Panneau {ouvert} grand={mode === 'modifier' && peutStructurer && avecStructure} titre={!seance ? 'Nouvelle séance' : mode === 'voir' ? 'Séance prévue' : 'Modifier la séance'} {onfermer}>
  {#if mode === 'voir' && seance}
    <VuePrevue {f} {ref} gpx={contenuGpx} programme={programmeChoisi} erreur={erreurGlobale} {envoi} onmodifier={() => { erreurGlobale = ''; mode = 'modifier'; }} onsupprimer={supprimer} {onfermer} />
  {:else}
  <form class="formulaire" onsubmit={enregistrer} novalidate>
    <Champ id="prevue-nom" label="Nom" bind:valeur={f.nom} erreur={erreurs.nom} maxlength={120} placeholder="Footing, sortie longue…" />

    <div class="ligne">
      <Champ id="prevue-date" type="date" label="Date" bind:valeur={f.date} erreur={erreurs.date} />
      <Champ id="prevue-heure" type="time" label="Heure" bind:valeur={f.heure} erreur={erreurs.heure} />
    </div>

    <div class="champ">
      <label for="prevue-sport">Sport</label>
      <select id="prevue-sport" bind:value={f.sport} aria-invalid={erreurs.sport ? 'true' : undefined}>
        {#each sportsTries(menu.filtre) as s (s.type)}
          <option value={s.type}>{nomSport(s.type)}</option>
        {/each}
      </select>
      {#if erreurs.sport}<span class="erreur" role="alert">{erreurs.sport}</span>{/if}
    </div>

    {#if estMuscu}
      <div class="champ">
        <label for="prevue-programme">Programme</label>
        <select id="prevue-programme" bind:value={lien}>
          <option value="">Aucun (séance libre)</option>
          {#each programmes as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        </select>
        <span class="aide">Le programme relié s'affiche sur la carte « Séance du jour » de l'accueil pour être démarré en un clic.</span>
      </div>
    {/if}

    {#if peutStructurer}
      <section class="structure" aria-label="Structure de la séance">
        {#if avecStructure}
          <div class="entete-structure">
            <h3 class="titre">Structure</h3>
            <Bouton variante="texte" onclick={() => { avecStructure = false; f.structure = []; }}>Retirer la structure</Bouton>
          </div>
          <EditeurStructure bind:blocs={f.structure} sport={f.sport} {ref} />
          {#if structureActive}<p class="aide">Durée et charge sont calculées à partir des blocs.</p>{/if}
        {:else}
          <Bouton variante="discret" onclick={() => (avecStructure = true)}>Construire la séance par blocs</Bouton>
        {/if}
      </section>
    {/if}

    {#if !structureActive}
      <div class="ligne">
        <Champ id="prevue-duree" label="Durée (min)" inputmode="numeric" bind:valeur={f.duree} erreur={erreurs.duree} />
        <Champ id="prevue-rpe" label="Effort ressenti (1 à 10)" inputmode="numeric" bind:valeur={f.rpe} erreur={erreurs.rpe} />
      </div>

      <div class="ligne">
        <Champ id="prevue-tss" label="Charge (TSS)" inputmode="numeric" placeholder="auto : {tssEstime}" bind:valeur={f.tss} erreur={erreurs.tss} />
        <Champ id="prevue-km" label="Distance (km)" inputmode="decimal" bind:valeur={f.km} erreur={erreurs.km} />
      </div>
    {:else}
      <div class="ligne">
        <Champ id="prevue-rpe" label="Effort ressenti (1 à 10)" inputmode="numeric" bind:valeur={f.rpe} erreur={erreurs.rpe} />
        <Champ id="prevue-km" label="Distance (km)" inputmode="decimal" bind:valeur={f.km} erreur={erreurs.km} />
      </div>
    {/if}

    <Champ id="prevue-dplus" label="Dénivelé + (m)" inputmode="numeric" bind:valeur={f.dPlus} erreur={erreurs.dPlus} />

    {#if !sportSansParcours}
      <ChampGpx nomActuel={f.gpxNom || ''} onchoisi={parcoursChoisi} onretirer={parcoursRetire} erreur={erreurs.gpx} />
    {/if}

    <div class="champ">
      <label for="prevue-notes">Notes</label>
      <textarea id="prevue-notes" rows="4" maxlength="2000" bind:value={f.notes} aria-invalid={erreurs.notes ? 'true' : undefined}></textarea>
      {#if erreurs.notes}<span class="erreur" role="alert">{erreurs.notes}</span>{/if}
    </div>

    {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}

    <div class="actions">
      <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
      <Bouton variante="discret" onclick={annulerSaisie}>Annuler</Bouton>
      <Bouton variante="texte" onclick={enregistrerModele}>Enregistrer comme modèle</Bouton>
    </div>
    {#if retourModele.texte}<p class={retourModele.erreur ? 'erreur' : 'aide'} role="status" aria-live="polite">{retourModele.texte}</p>{/if}

    {#if seance}
      <div class="danger">
        {#if confirmerSuppression}
          <p>Supprimer définitivement « {seance.name} » ?</p>
          <div class="actions">
            <Bouton variante="discret" onclick={supprimer}>Oui, supprimer</Bouton>
            <Bouton variante="texte" onclick={() => (confirmerSuppression = false)}>Non, garder</Bouton>
          </div>
        {:else}
          <Bouton variante="texte" onclick={() => (confirmerSuppression = true)}>Supprimer cette séance</Bouton>
        {/if}
      </div>
    {/if}
  </form>
  {/if}
</Panneau>

<style>
  .formulaire {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  select,
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 12px 16px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  select {
    height: 52px;
    padding-block: 0;
  }
  textarea {
    resize: vertical;
  }
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  [aria-invalid='true'] {
    border-color: var(--danger);
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
  .structure {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
  }
  .entete-structure {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .entete-structure h3 {
    font-size: 17px;
  }
  .aide {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .global {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .danger {
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--trait);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
  }
</style>
