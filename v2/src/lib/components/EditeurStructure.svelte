<script>
  import Bouton from './Bouton.svelte';
  import GrapheStructure from './GrapheStructure.svelte';
  import {
    NOM_TYPE, NOM_METRIQUE, metriquesDuSport, normaliser, nouveauBloc, modeles, lireCommande,
    texteDuree, texteCible, resume, milieu,
  } from '../data/structure.js';

  // Éditeur de structure inspiré de Zwift : le graphique EST l'éditeur.
  //   1. on ajoute des blocs avec les gros boutons (ou on part d'un modèle) ;
  //   2. on touche une barre, puis on tire son haut (intensité) ou son bord droit (durée) ;
  //   3. une seule ligne de boutons + / − règle le bloc choisi au clavier ou au doigt.
  //  blocs (bindable) : structure normalisée · sport : type brut · ref : { ftp, hrMax } · couleur : couleur du sport
  let { blocs = $bindable([]), sport = 'Ride', ref = {}, couleur = 'var(--sport-neutre)' } = $props();

  const metriques = $derived(metriquesDuSport(sport));
  const metrique = $derived(blocs[0]?.metric && metriques.includes(blocs[0].metric) ? blocs[0].metric : metriques[0]);
  const bilan = $derived(resume(blocs, ref, sport));

  let selection = $state(null);
  let annuler = $state([]);
  let refaire = $state([]);
  let commande = $state('');
  let erreurCommande = $state('');
  let avantGeste = null;

  const choisi = $derived(selection !== null && blocs[selection] ? blocs[selection] : null);
  const segments = $derived(choisi ? (choisi.type === 'interval' ? [['work', 'Effort'], ['rec', 'Récupération']] : [['work', choisi.name]]) : []);
  const copie = (b) => $state.snapshot(b);

  // Toute modification « ponctuelle » passe par ici : historique (annuler) + valeurs bornées (normaliser)
  function appliquer(nouveaux, nouvelleSelection = selection) {
    annuler = [...annuler.slice(-39), blocs];
    refaire = [];
    blocs = normaliser(nouveaux, metrique);
    selection = blocs.length ? Math.min(blocs.length - 1, Math.max(0, nouvelleSelection ?? 0)) : null;
  }
  function retour() {
    if (!annuler.length) return;
    refaire = [...refaire, blocs];
    blocs = annuler[annuler.length - 1];
    annuler = annuler.slice(0, -1);
    if (selection !== null && selection >= blocs.length) selection = blocs.length ? blocs.length - 1 : null;
  }
  function avancer() {
    if (!refaire.length) return;
    annuler = [...annuler, blocs];
    blocs = refaire[refaire.length - 1];
    refaire = refaire.slice(0, -1);
  }

  // Un geste sur le graphique (tirer une barre) = UNE seule entrée d'historique, pas une par pixel
  const debutGeste = () => (avantGeste = blocs);
  function gesteEnCours(bi, quel, changements) {
    blocs = normaliser(blocs.map((b, k) => (k === bi ? { ...copie(b), [quel]: { ...copie(b)[quel], ...changements } } : copie(b))), metrique);
  }
  function finGeste() {
    if (avantGeste && JSON.stringify(avantGeste) !== JSON.stringify(blocs)) {
      annuler = [...annuler.slice(-39), avantGeste];
      refaire = [];
    }
    avantGeste = null;
  }

  const ajouter = (type) => appliquer([...blocs.map(copie), nouveauBloc(type, metrique)], blocs.length);
  const supprimer = () => selection !== null && appliquer(blocs.filter((_, k) => k !== selection).map(copie), Math.max(0, selection - 1));
  const dupliquer = () => selection !== null && appliquer([...blocs.slice(0, selection + 1).map(copie), copie(blocs[selection]), ...blocs.slice(selection + 1).map(copie)], selection + 1);
  function deplacer(delta) {
    const j = selection + delta;
    if (selection === null || j < 0 || j >= blocs.length) return;
    const liste = blocs.map(copie);
    [liste[selection], liste[j]] = [liste[j], liste[selection]];
    appliquer(liste, j);
  }
  const modifierBloc = (changements) => appliquer(blocs.map((b, k) => (k === selection ? { ...copie(b), ...changements } : copie(b))));
  const modifierSegment = (quel, changements) => modifierBloc({ [quel]: { ...copie(choisi)[quel], ...changements } });
  const changerMetrique = (m) => appliquer(blocs.map((b) => ({ ...copie(b), metric: m })));

  const pasDuree = (min) => (min < 3 ? 0.5 : min < 20 ? 1 : 5);
  const changerDuree = (quel, sens) => {
    const m = choisi[quel].min;
    modifierSegment(quel, { min: Math.max(0.5, m + sens * pasDuree(sens < 0 ? m - 0.01 : m)) });
  };
  const changerIntensite = (quel, sens) => modifierSegment(quel, { int: Math.min(300, Math.max(20, Math.round(milieu(choisi[quel])) + sens * 5)), intHi: null });
  const changerReps = (sens) => modifierBloc({ reps: Math.min(99, Math.max(1, choisi.reps + sens)) });

  function chargerModele(e) {
    const m = modeles(metrique).find((x) => x.nom === e.currentTarget.value);
    e.currentTarget.value = '';
    if (m) appliquer(m.blocs, 0);
  }
  function envoyerCommande(e) {
    e.preventDefault();
    const bloc = lireCommande(commande, metrique, ref);
    if (!bloc) {
      erreurCommande = "Je n'ai pas compris. Essaie : 4x4' Z5 récup 3'";
      return;
    }
    erreurCommande = '';
    commande = '';
    appliquer([...blocs.map(copie), bloc], blocs.length);
  }
</script>

{#snippet reglage(etiquette, valeur, moins, plus, descMoins, descPlus)}
  <div class="reglage">
    <span class="etiq">{etiquette}</span>
    <div class="ligne">
      <button type="button" class="rond" aria-label={descMoins} onclick={moins}>−</button>
      <span class="valeur" aria-live="polite">{valeur}</span>
      <button type="button" class="rond" aria-label={descPlus} onclick={plus}>+</button>
    </div>
  </div>
{/snippet}

<div class="editeur">
  <div class="ajouts" role="group" aria-label="Ajouter un bloc">
    <button type="button" class="ajout" onclick={() => ajouter('warmup')}>+ Échauffement</button>
    <button type="button" class="ajout" onclick={() => ajouter('steady')}>+ Bloc continu</button>
    <button type="button" class="ajout fort" onclick={() => ajouter('interval')}>+ Intervalles</button>
    <button type="button" class="ajout" onclick={() => ajouter('recovery')}>+ Récupération</button>
    <button type="button" class="ajout" onclick={() => ajouter('cooldown')}>+ Retour au calme</button>
  </div>

  <div class="outils">
    <select class="bouton" aria-label="Partir d'un modèle" onchange={chargerModele}>
      <option value="">Partir d'un modèle…</option>
      {#each modeles(metrique) as m (m.nom)}<option value={m.nom}>{m.nom}</option>{/each}
    </select>
    {#if metriques.length > 1}
      <div class="groupe" role="group" aria-label="Mesure de l'intensité">
        {#each metriques as m (m)}
          <button type="button" class="bouton" class:plein={m === metrique} aria-pressed={m === metrique} onclick={() => changerMetrique(m)}>{NOM_METRIQUE[m]}</button>
        {/each}
      </div>
    {/if}
    <div class="groupe">
      <button type="button" class="bouton" disabled={!annuler.length} onclick={retour}>Annuler</button>
      <button type="button" class="bouton" disabled={!refaire.length} onclick={avancer}>Rétablir</button>
    </div>
  </div>

  {#if blocs.length}
    <GrapheStructure {blocs} {couleur} {metrique} {selection} onselectionner={(i) => (selection = i)} ondebut={debutGeste} onmodifier={gesteEnCours} onfin={finGeste} />
    <p class="aide-graphe">Touche une barre, puis tire son <strong>haut</strong> pour l'intensité ou son <strong>bord droit</strong> pour la durée.</p>

    <p class="bilan">
      <strong>{texteDuree(bilan.dureeMin)}</strong> au total · {bilan.tss} points de charge
      {#if bilan.watts} · {bilan.watts} W en moyenne{/if}
      {#if bilan.bpm} · {bilan.bpm} bpm en moyenne{/if}
      {#if bilan.km} · {String(bilan.km).replace('.', ',')} km{/if}
    </p>
  {:else}
    <div class="vide">
      <p><strong>Ta séance est vide.</strong></p>
      <p>Ajoute un premier bloc avec les boutons ci-dessus, ou pars d'un modèle.</p>
    </div>
  {/if}

  {#if choisi}
    <section class="bloc-choisi" aria-label="Réglages du bloc {selection + 1}">
      <div class="entete">
        <strong>Bloc {selection + 1} sur {blocs.length} · {NOM_TYPE[choisi.type]}</strong>
        <div class="groupe">
          <button type="button" class="bouton" disabled={selection === 0} onclick={() => deplacer(-1)} aria-label="Placer le bloc avant">←</button>
          <button type="button" class="bouton" disabled={selection === blocs.length - 1} onclick={() => deplacer(1)} aria-label="Placer le bloc après">→</button>
          <button type="button" class="bouton" onclick={dupliquer}>Dupliquer</button>
          <button type="button" class="bouton danger" onclick={supprimer}>Supprimer</button>
        </div>
      </div>

      <div class="reglages">
        {#if choisi.type === 'interval'}
          {@render reglage('Répétitions', `${choisi.reps} ×`, () => changerReps(-1), () => changerReps(1), 'Une répétition de moins', 'Une répétition de plus')}
        {/if}
        {#each segments as [quel, titre] (quel)}
          {@const seg = choisi[quel]}
          {#if choisi.type === 'interval'}<span class="sous-titre">{titre}</span>{/if}
          {@render reglage('Durée', texteDuree(seg.min), () => changerDuree(quel, -1), () => changerDuree(quel, 1), `Durée plus courte (${titre})`, `Durée plus longue (${titre})`)}
          {@render reglage('Intensité', `${Math.round(milieu(seg))} %`, () => changerIntensite(quel, -1), () => changerIntensite(quel, 1), `Intensité plus faible (${titre})`, `Intensité plus forte (${titre})`)}
          <span class="cible">{texteCible(seg, metrique, ref, sport)}</span>
        {/each}
      </div>
    </section>
  {/if}

  <details class="texte-libre">
    <summary>Écrire la séance en texte</summary>
    <form onsubmit={envoyerCommande}>
      <label for="structure-commande" class="etiq">Par exemple : 15' Z1 · 20' à 250W · 3x8' Z4 récup 4'</label>
      <div class="ligne-commande">
        <input id="structure-commande" type="text" placeholder="4x4' Z5 récup 3'" bind:value={commande} aria-describedby={erreurCommande ? 'structure-commande-erreur' : undefined} />
        <Bouton type="submit" variante="discret">Ajouter</Bouton>
      </div>
      {#if erreurCommande}<span class="erreur" id="structure-commande-erreur" role="alert">{erreurCommande}</span>{/if}
    </form>
  </details>
</div>

<style>
  .editeur {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .ajouts,
  .outils,
  .groupe {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .outils {
    justify-content: space-between;
  }
  .ajout,
  .bouton {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte);
    font-size: 14px;
    cursor: pointer;
  }
  .ajout {
    min-height: 48px;
    background: var(--surface-2);
  }
  .ajout.fort,
  .bouton.plein {
    background: var(--texte);
    color: var(--fond);
    border-color: var(--texte);
  }
  .bouton.danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  .bouton:disabled {
    opacity: 0.35;
    cursor: default;
  }
  select.bouton {
    font-size: 14px;
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .aide-graphe,
  .bilan {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .aide-graphe strong,
  .bilan strong {
    color: var(--texte);
  }
  .vide {
    padding: 20px;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon-l);
    color: var(--texte-doux);
  }
  .vide strong {
    color: var(--texte);
  }
  .bloc-choisi {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .reglages {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 14px 28px;
  }
  .sous-titre {
    flex-basis: 100%;
    margin-top: 4px;
    font-size: 13px;
    font-weight: 700;
  }
  .reglage {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ligne {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rond {
    width: 44px;
    height: 44px;
    border: 1px solid var(--trait-fort);
    border-radius: 50%;
    background: var(--fond);
    color: var(--texte);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }
  .valeur {
    min-width: 76px;
    text-align: center;
    font-size: 20px;
    font-weight: 700;
  }
  .etiq {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .cible {
    align-self: center;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .texte-libre summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-size: 14px;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .ligne-commande {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
  .ligne-commande input {
    flex: 1;
    min-width: 0;
    min-height: 52px;
    padding: 0 16px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    font-size: 16px;
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
</style>
