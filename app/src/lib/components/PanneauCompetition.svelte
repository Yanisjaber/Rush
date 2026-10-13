<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Champ from './Champ.svelte';
  import Bouton from './Bouton.svelte';
  import StatCle from './StatCle.svelte';
  import ChampGpx from './ChampGpx.svelte';
  import ParcoursGpx from './ParcoursGpx.svelte';
  import { SPORTS } from '../sports.js';
  import { menu } from '../stores/menu.svelte.js';
  import { familleAffichage } from '../data/familles.js';
  import { sportsTries, sportDefaut } from '../data/prevue.js';
  import { PRIORITES, formulaireVide, formulaireDepuisLigne, validerCompetition, versLigne, nomPriorite } from '../data/competitions.js';
  import { creerPlanifiee, modifierPlanifiee, supprimerPlanifiee, chargerGpx, COLONNES_COMPETITION } from '../data/api.js';
  import { formatDateLongue, formatKm, joursAvant } from '../utils/format.js';

  // Créer, afficher, modifier ou supprimer une compétition à venir (ligne de activity_planned, catégorie « competition »).
  //  competition : ligne à afficher (null = nouvelle) · dateInitiale : jour proposé pour une nouvelle
  //  enregistree(ligne) / supprimee(id) : préviennent la page pour qu'elle se mette à jour
  let { ouvert = false, competition = null, dateInitiale, userId, demo = false, onfermer, enregistree, supprimee } = $props();

  let f = $state(formulaireVide(dateInitiale));
  let erreurs = $state({});
  let erreurGlobale = $state('');
  let envoi = $state(false);
  let confirmer = $state(false);
  // 'voir' : affichage seul (clic sur une compétition existante) · 'modifier' : formulaire (nouvelle ou bouton Modifier)
  let mode = $state('modifier');
  let contenuGpx = $state(''); // parcours de la compétition affichée (chargé à la demande : colonne lourde)

  $effect(() => {
    const cible = competition;
    const vue = ouvert && mode === 'voir';
    untrack(async () => {
      contenuGpx = '';
      if (!vue || !cible?.gpx_name) return;
      if (demo) return (contenuGpx = cible.gpx_content || '');
      const r = await chargerGpx(userId, cible.id);
      if (competition === cible) contenuGpx = r.data || '';
    });
  });
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

  // À chaque ouverture : formulaire propre. L'effet ne dépend que de l'ouverture et de la compétition visée.
  $effect(() => {
    if (!ouvert) return;
    const cible = competition;
    const jour = dateInitiale;
    untrack(() => {
      f = cible ? formulaireDepuisLigne(cible) : { ...formulaireVide(jour), sport: sportDefaut(menu.filtre) }; // nouvelle compétition : le sport filtré d'abord
      erreurs = {};
      erreurGlobale = '';
      envoi = false;
      confirmer = false;
      mode = cible ? 'voir' : 'modifier';
    });
  });

  const nomSport = (type) => (SPORTS[familleAffichage(type)] || SPORTS.autre).nom;
  const jours = $derived(f.date ? joursAvant(f.date) : null);
  const tuiles = $derived(
    [
      f.km !== '' ? { etiquette: 'Distance', valeur: formatKm(Number(f.km)), unite: 'km' } : null,
      f.dPlus !== '' ? { etiquette: 'Dénivelé +', valeur: f.dPlus, unite: 'm' } : null,
      f.objectif ? { etiquette: 'Objectif', valeur: f.objectif } : null,
    ].filter(Boolean),
  );

  async function enregistrer(e) {
    e.preventDefault();
    if (envoi) return;
    const { valeurs, erreurs: e2 } = validerCompetition(f);
    erreurs = e2;
    erreurGlobale = '';
    if (!valeurs) return;
    envoi = true;
    const ligne = versLigne(valeurs);
    let r;
    if (demo) r = { data: { ...ligne, id: competition?.id || `demo-comp-${Date.now()}` }, erreur: '' };
    else r = competition ? await modifierPlanifiee(userId, competition.id, ligne, COLONNES_COMPETITION) : await creerPlanifiee(userId, ligne, COLONNES_COMPETITION);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      return;
    }
    enregistree?.(r.data);
    if (!competition) onfermer?.(); // une compétition modifiée se réaffiche (la page met `competition` à jour)
  }

  function annulerSaisie() {
    if (!competition) return onfermer?.();
    f = formulaireDepuisLigne(competition);
    erreurs = {};
    erreurGlobale = '';
    mode = 'voir';
  }

  async function supprimer() {
    if (!competition || envoi) return;
    envoi = true;
    const r = demo ? { erreur: '' } : await supprimerPlanifiee(userId, competition.id);
    envoi = false;
    if (r.erreur) {
      erreurGlobale = r.erreur;
      confirmer = false;
      return;
    }
    supprimee?.(competition.id);
    onfermer?.();
  }
</script>

<Panneau {ouvert} titre={!competition ? 'Nouvelle compétition' : mode === 'voir' ? 'Compétition' : 'Modifier la compétition'} {onfermer}>
  {#if mode === 'voir' && competition}
    <article class="vue">
      <header>
        <p class="sport"><span class="badge {f.priorite === 'A' ? 'objectif' : 'prepa'}">{nomPriorite(f.priorite)}</span>{nomSport(f.sport)}{#if f.type} · {f.type}{/if}</p>
        <h3 class="titre">{f.nom}</h3>
        <p class="quand">{formatDateLongue(f.date)} · {f.heure}{#if jours != null && jours >= 0} · {jours === 0 ? "c'est aujourd'hui" : `dans ${jours} jour${jours > 1 ? 's' : ''}`}{/if}</p>
      </header>
      {#if tuiles.length}
        <div class="tuiles">
          {#each tuiles as t (t.etiquette)}<StatCle etiquette={t.etiquette} valeur={t.valeur} unite={t.unite || ''} />{/each}
        </div>
      {/if}
      {#if contenuGpx}
        <section aria-label="Parcours"><h4>Parcours</h4><ParcoursGpx contenu={contenuGpx} nom={f.gpxNom} /></section>
      {/if}
      {#if f.notes}
        <section aria-label="Notes"><h4>Notes</h4><p class="notes">{f.notes}</p></section>
      {/if}
      {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}
      <div class="actions">
        <Bouton onclick={() => { erreurGlobale = ''; mode = 'modifier'; }}>Modifier</Bouton>
        <Bouton variante="discret" onclick={() => onfermer?.()}>Fermer</Bouton>
      </div>
      <div class="danger">
        {#if confirmer}
          <p>Supprimer définitivement « {f.nom} » ?</p>
          <div class="actions">
            <Bouton variante="discret" onclick={supprimer}>Oui, supprimer</Bouton>
            <Bouton variante="texte" onclick={() => (confirmer = false)}>Non, garder</Bouton>
          </div>
        {:else}
          <Bouton variante="texte" onclick={() => (confirmer = true)}>Supprimer cette compétition</Bouton>
        {/if}
      </div>
    </article>
  {:else}
    <form class="formulaire" onsubmit={enregistrer} novalidate>
      <Champ id="comp-nom" label="Nom" bind:valeur={f.nom} erreur={erreurs.nom} maxlength={120} placeholder="Ronde de Ramonville…" />

      <fieldset class="priorites">
        <legend>Priorité</legend>
        <div class="choix">
          {#each PRIORITES as [cle, nom, aide] (cle)}
            <label class="choix-prio" class:actif={f.priorite === cle}>
              <input type="radio" name="comp-priorite" value={cle} bind:group={f.priorite} />
              <span class="nom">{nom}</span>
              <span class="aide">{aide}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <div class="ligne">
        <Champ id="comp-date" type="date" label="Date" bind:valeur={f.date} erreur={erreurs.date} />
        <Champ id="comp-heure" type="time" label="Heure de départ" bind:valeur={f.heure} erreur={erreurs.heure} />
      </div>

      <div class="champ">
        <label for="comp-sport">Sport</label>
        <select id="comp-sport" bind:value={f.sport}>
          {#each sportsTries(menu.filtre) as s (s.type)}<option value={s.type}>{nomSport(s.type)}</option>{/each}
        </select>
      </div>

      <Champ id="comp-type" label="Type d'épreuve (facultatif)" bind:valeur={f.type} erreur={erreurs.type} maxlength={60} placeholder="Route, contre-la-montre, trail…" />

      <div class="ligne">
        <Champ id="comp-km" label="Distance (km)" inputmode="decimal" bind:valeur={f.km} erreur={erreurs.km} />
        <Champ id="comp-dplus" label="Dénivelé + (m)" inputmode="numeric" bind:valeur={f.dPlus} erreur={erreurs.dPlus} />
      </div>

      <Champ id="comp-objectif" label="Temps visé (ex. 1h45, 40 min)" bind:valeur={f.objectif} erreur={erreurs.objectif} placeholder="1h45" />

      <ChampGpx nomActuel={f.gpxNom || ''} onchoisi={parcoursChoisi} onretirer={parcoursRetire} erreur={erreurs.gpx} />

      <div class="champ">
        <label for="comp-notes">Notes</label>
        <textarea id="comp-notes" rows="4" maxlength="2000" bind:value={f.notes}></textarea>
        {#if erreurs.notes}<span class="erreur" role="alert">{erreurs.notes}</span>{/if}
      </div>

      {#if erreurGlobale}<p class="erreur global" role="alert">{erreurGlobale}</p>{/if}
      <div class="actions">
        <Bouton type="submit">{envoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
        <Bouton variante="discret" onclick={annulerSaisie}>Annuler</Bouton>
      </div>
    </form>
  {/if}
</Panneau>

<style>
  .vue,
  .formulaire {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .sport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .badge {
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
  }
  .badge.objectif {
    background: var(--dossard-fond, #f3f2ee);
    color: var(--dossard-texte, #0c0d10);
  }
  .badge.prepa {
    border: 1px solid var(--trait-fort);
  }
  h3 {
    margin-top: 6px;
    font-size: clamp(26px, 4vw, 34px);
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .quand {
    margin-top: 4px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .tuiles {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 32px;
    padding: 16px 18px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  h4 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .notes {
    white-space: pre-line;
    overflow-wrap: anywhere;
    font-size: 15px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
  .champ,
  .priorites {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  label,
  legend {
    padding: 0;
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
  textarea:focus-visible,
  .choix-prio:has(input:focus-visible) {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .choix {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 8px;
  }
  .choix-prio {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 44px;
    padding: 10px 14px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    cursor: pointer;
  }
  .choix-prio.actif {
    border-color: var(--texte);
    background: var(--surface-2);
  }
  .choix-prio input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .choix-prio .nom {
    font-size: 15px;
    font-weight: 700;
    color: var(--texte);
  }
  .choix-prio .aide {
    font-size: 12.5px;
    color: var(--texte-doux);
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
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
    padding-top: 16px;
    border-top: 1px solid var(--trait);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
  }
</style>
