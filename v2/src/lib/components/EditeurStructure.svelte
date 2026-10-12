<script>
  import Bouton from './Bouton.svelte';
  import GrapheStructure from './GrapheStructure.svelte';
  import {
    NOM_TYPE, NOM_METRIQUE, COULEURS_ZONE, metriquesDuSport, normaliser, nouveauBloc, modeles, lireCommande,
    lireDuree, texteDuree, texteCible, resume, milieu, indiceZone, ZONES,
  } from '../data/structure.js';

  // Éditeur de structure, à la manière de la v1 et de Zwift :
  //   - en haut : les chiffres de la séance (durée, charge, intensité, énergie) et annuler / rétablir ;
  //   - à gauche : le graphique éditable (on tire les barres) ; à droite : le « Déroulé » en phrases ;
  //   - dessous : boutons d'ajout, ligne de commande, puis les réglages du bloc choisi (cartes Effort / Récupération).
  //  blocs (bindable) : structure normalisée · sport : type brut · ref : { ftp, hrMax }
  let { blocs = $bindable([]), sport = 'Ride', ref = {} } = $props();

  const metriques = $derived(metriquesDuSport(sport));
  const metrique = $derived(blocs[0]?.metric && metriques.includes(blocs[0].metric) ? blocs[0].metric : metriques[0]);
  const bilan = $derived(resume(blocs, ref, sport));
  const zones = $derived(ZONES[metrique]);

  let selection = $state(null);
  let annuler = $state([]);
  let refaire = $state([]);
  let commande = $state('');
  let erreurCommande = $state('');
  let avantGeste = null;

  const choisi = $derived(selection !== null && blocs[selection] ? blocs[selection] : null);
  const segments = $derived(choisi ? (choisi.type === 'interval' ? [['work', 'Effort'], ['rec', 'Récupération']] : [['work', 'Durée et intensité']]) : []);
  const copie = (b) => $state.snapshot(b);
  const couleurDeSegment = (seg, m = metrique) => COULEURS_ZONE[Math.min(COULEURS_ZONE.length - 1, indiceZone(milieu(seg), m))];
  const couleurBloc = (b) => couleurDeSegment(b.work, b.metric);
  const COULEUR_TYPE = { warmup: COULEURS_ZONE[1], steady: COULEURS_ZONE[2], interval: COULEURS_ZONE[4], recovery: COULEURS_ZONE[0], cooldown: COULEURS_ZONE[0] };

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
  function lireChampDuree(quel, valeur) {
    const m = lireDuree(valeur);
    if (m != null) modifierSegment(quel, { min: m });
  }
  const changerIntensite = (quel, sens) => modifierSegment(quel, { int: Math.min(300, Math.max(20, Math.round(milieu(choisi[quel])) + sens * 5)), intHi: null });
  function lireChampPct(quel, valeur) {
    const n = Number(String(valeur).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) modifierSegment(quel, { int: n, intHi: null });
  }
  const choisirZone = (quel, k) => modifierSegment(quel, { int: zones.bas[k], intHi: zones.haut[k] });
  const changerReps = (sens) => modifierBloc({ reps: Math.min(99, Math.max(1, choisi.reps + sens)) });

  const chargerModele = (m) => appliquer(m.blocs, 0);
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

  const infobulle = (s) => `${texteDuree(s.min)} · ${texteCible(s.seg, s.metric, ref, sport)}`;
  const ligneSegment = (seg, m) => `${texteDuree(seg.min)} · ${texteCible(seg, m, ref, sport)}`;
</script>

<div class="editeur">
  <!-- 1. Les chiffres de la séance + annuler / rétablir -->
  <div class="haut">
    <div class="puces" aria-label="Résumé de la séance">
      <span class="puce"><b>{texteDuree(bilan.dureeMin)}</b><i>durée</i></span>
      <span class="puce"><b>{bilan.tss}</b><i>charge (TSS)</i></span>
      <span class="puce"><b>{bilan.facteurIntensite ? String(bilan.facteurIntensite).replace('.', ',') : '—'}</b><i>intensité (IF)</i></span>
      {#if bilan.kj}<span class="puce"><b>{bilan.kj}</b><i>kJ</i></span>{/if}
      {#if bilan.watts}<span class="puce"><b>{bilan.watts}</b><i>W moy.</i></span>{/if}
      {#if bilan.bpm}<span class="puce"><b>{bilan.bpm}</b><i>bpm moy.</i></span>{/if}
      {#if bilan.km}<span class="puce"><b>{String(bilan.km).replace('.', ',')}</b><i>km</i></span>{/if}
    </div>
    <div class="groupe">
      {#if metriques.length > 1}
        <div class="groupe" role="group" aria-label="Mesure de l'intensité">
          {#each metriques as m (m)}
            <button type="button" class="bouton" class:plein={m === metrique} aria-pressed={m === metrique} onclick={() => changerMetrique(m)}>{NOM_METRIQUE[m]}</button>
          {/each}
        </div>
      {/if}
      <button type="button" class="bouton" disabled={!annuler.length} onclick={retour}>Annuler</button>
      <button type="button" class="bouton" disabled={!refaire.length} onclick={avancer}>Rétablir</button>
    </div>
  </div>

  <!-- 2. Les modèles -->
  <div class="modeles">
    <span class="legende">Modèles</span>
    {#each modeles(metrique) as m (m.nom)}
      <button type="button" class="modele" onclick={() => chargerModele(m)}>{m.nom}</button>
    {/each}
  </div>

  <!-- 3. Graphique éditable + déroulé -->
  <div class="principal">
    <div class="colonne-graphe">
      {#if blocs.length}
        <GrapheStructure {blocs} {metrique} {selection} onselectionner={(i) => (selection = i)} ondebut={debutGeste} onmodifier={gesteEnCours} onfin={finGeste} {infobulle} />
        <p class="aide">Touche une barre, puis tire son <strong>haut</strong> (intensité) ou son <strong>bord droit</strong> (durée).</p>
      {:else}
        <div class="vide">
          <p><strong>Ta séance est vide.</strong></p>
          <p>Choisis un modèle ci-dessus, ou ajoute un premier bloc avec les boutons en dessous.</p>
        </div>
      {/if}
    </div>

    <aside class="deroule" aria-label="Déroulé de la séance">
      <h4>Déroulé</h4>
      {#if blocs.length}
        <ol>
          {#each blocs as b, i (i)}
            <li>
              <button type="button" class="etape" class:choisie={selection === i} aria-pressed={selection === i} onclick={() => (selection = i)}>
                <span class="trait" style:background={couleurBloc(b)}></span>
                <span class="corps-etape">
                  <span class="nom-etape">{b.name}{#if b.reps > 1}<span class="reps">×{b.reps}</span>{/if}</span>
                  <span class="sous">{ligneSegment(b.work, b.metric)}</span>
                  {#if b.type === 'interval' && b.rec}<span class="sous doux">récup {ligneSegment(b.rec, b.metric)}</span>{/if}
                </span>
              </button>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="aide">Les blocs apparaîtront ici, dans l'ordre.</p>
      {/if}
    </aside>
  </div>

  <!-- 4. Ajouter un bloc, écrire en texte -->
  <div class="ajouts" role="group" aria-label="Ajouter un bloc">
    {#each ['warmup', 'steady', 'interval', 'recovery', 'cooldown'] as t (t)}
      <button type="button" class="ajout" style:--c={COULEUR_TYPE[t]} onclick={() => ajouter(t)}>+ {NOM_TYPE[t]}</button>
    {/each}
  </div>

  <form class="commande" onsubmit={envoyerCommande}>
    <label for="structure-commande" class="legende">Ou écris-le : 15' Z1 · 20' à 250W · 3x8' Z4 récup 4'</label>
    <div class="ligne-commande">
      <input id="structure-commande" type="text" placeholder="4x4' Z5 récup 3'" bind:value={commande} aria-describedby={erreurCommande ? 'structure-commande-erreur' : undefined} />
      <Bouton type="submit" variante="discret">Ajouter</Bouton>
    </div>
    {#if erreurCommande}<span class="erreur" id="structure-commande-erreur" role="alert">{erreurCommande}</span>{/if}
  </form>

  <!-- 5. Réglages du bloc choisi -->
  {#if choisi}
    <section class="inspecteur" aria-label="Réglages du bloc {selection + 1}">
      <div class="carte-bloc">
        <div class="tete-bloc">
          <span class="pastille" style:background={couleurBloc(choisi)}></span>
          <input class="nom" type="text" maxlength="60" aria-label="Nom du bloc" value={choisi.name} onchange={(e) => modifierBloc({ name: e.currentTarget.value })} />
        </div>
        <span class="legende">Bloc {selection + 1} sur {blocs.length} · {NOM_TYPE[choisi.type]}</span>
        {#if choisi.type === 'interval'}
          <span class="etiquette">Répéter</span>
          <div class="ligne">
            <button type="button" class="rond" aria-label="Une répétition de moins" onclick={() => changerReps(-1)}>−</button>
            <span class="valeur">{choisi.reps} ×</span>
            <button type="button" class="rond" aria-label="Une répétition de plus" onclick={() => changerReps(1)}>+</button>
          </div>
        {/if}
        <div class="groupe actions-bloc">
          <button type="button" class="bouton" disabled={selection === 0} onclick={() => deplacer(-1)}>← Avant</button>
          <button type="button" class="bouton" disabled={selection === blocs.length - 1} onclick={() => deplacer(1)}>Après →</button>
          <button type="button" class="bouton" onclick={dupliquer}>Dupliquer</button>
          <button type="button" class="bouton danger" onclick={supprimer}>Supprimer</button>
        </div>
      </div>

      {#each segments as [quel, titre] (quel)}
        {@const seg = choisi[quel]}
        <div class="carte-seg" style:--c={couleurDeSegment(seg)}>
          <h5 style:color={couleurDeSegment(seg)}>{titre}</h5>

          <span class="etiquette">Durée</span>
          <div class="ligne">
            <button type="button" class="rond" aria-label="Durée plus courte ({titre})" onclick={() => changerDuree(quel, -1)}>−</button>
            <input class="champ" type="text" aria-label="Durée ({titre})" value={texteDuree(seg.min)} onchange={(e) => lireChampDuree(quel, e.currentTarget.value)} />
            <button type="button" class="rond" aria-label="Durée plus longue ({titre})" onclick={() => changerDuree(quel, 1)}>+</button>
          </div>

          <span class="etiquette">Intensité</span>
          <div class="ligne">
            <button type="button" class="rond" aria-label="Intensité plus faible ({titre})" onclick={() => changerIntensite(quel, -1)}>−</button>
            <input class="champ" type="text" inputmode="decimal" aria-label="Intensité en pourcentage ({titre})" value={Math.round(milieu(seg))} onchange={(e) => lireChampPct(quel, e.currentTarget.value)} />
            <span class="unite">%</span>
            <button type="button" class="rond" aria-label="Intensité plus forte ({titre})" onclick={() => changerIntensite(quel, 1)}>+</button>
          </div>
          <p class="cible">{texteCible(seg, metrique, ref, sport)}</p>

          <div class="barre-zones" role="group" aria-label="Choisir une zone ({titre})">
            {#each zones.noms as nomZone, k (k)}
              <button
                type="button"
                class="zone"
                class:actif={indiceZone(milieu(seg), metrique) === k}
                style:background={COULEURS_ZONE[k]}
                aria-label={nomZone}
                aria-pressed={indiceZone(milieu(seg), metrique) === k}
                title={nomZone}
                onclick={() => choisirZone(quel, k)}
              >Z{k + 1}</button>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  {:else if blocs.length}
    <p class="aide">Touche une barre du graphique, ou une étape du déroulé, pour régler un bloc.</p>
  {/if}
</div>

<style>
  .editeur {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .haut {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
  }
  .puces,
  .groupe,
  .modeles,
  .ajouts,
  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .puce {
    display: inline-flex;
    flex-direction: column;
    padding: 6px 14px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon);
    background: var(--surface-2);
    line-height: 1.2;
  }
  .puce b {
    font-size: 17px;
  }
  .puce i {
    font-style: normal;
    font-size: 10.5px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .legende {
    font-size: 13px;
    color: var(--texte-doux);
  }
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
  .modele {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--trait-fort);
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte);
    font-size: 14px;
    cursor: pointer;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }

  .principal {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 270px;
    gap: 14px;
    align-items: start;
  }
  @container (max-width: 760px) {
    .principal {
      grid-template-columns: 1fr;
    }
  }
  .aide {
    margin-top: 8px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .aide strong {
    color: var(--texte);
  }
  .vide {
    padding: 28px 20px;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon-l);
    text-align: center;
    color: var(--texte-doux);
  }
  .vide strong {
    color: var(--texte);
  }

  .deroule {
    padding: 12px 14px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
    background: var(--fond);
    max-height: 430px;
    overflow-y: auto;
  }
  .deroule h4 {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .deroule ol {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .etape {
    display: flex;
    align-items: stretch;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 6px 8px 6px 0;
    border: 0;
    border-radius: var(--rayon-s);
    background: transparent;
    color: var(--texte-doux);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }
  .etape:hover {
    background: var(--surface-2);
  }
  .etape.choisie {
    background: var(--surface-2);
    color: var(--texte);
  }
  .trait {
    width: 4px;
    border-radius: 2px;
    flex: none;
  }
  .corps-etape {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .nom-etape {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    color: var(--texte);
  }
  .reps {
    padding: 0 7px;
    border: 1px solid var(--trait-fort);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }
  .sous {
    font-size: 12px;
  }
  .sous.doux {
    color: var(--texte-muet);
  }

  .ajout {
    min-height: 48px;
    padding: 0 16px;
    border: 1px solid var(--trait-fort);
    border-left: 4px solid var(--c);
    border-radius: var(--rayon);
    background: var(--surface-2);
    color: var(--texte);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .ajout:hover {
    border-color: var(--c);
  }
  .commande {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ligne-commande {
    display: flex;
    gap: 8px;
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
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 15px;
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }

  .inspecteur {
    display: grid;
    grid-template-columns: minmax(220px, 0.8fr) 1fr 1fr;
    gap: 12px;
    align-items: stretch;
    padding: 14px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  @container (max-width: 760px) {
    .inspecteur {
      grid-template-columns: 1fr;
    }
  }
  .carte-bloc,
  .carte-seg {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .carte-seg {
    padding: 12px 14px;
    background: var(--fond);
    border: 1px solid var(--trait);
    border-left: 4px solid var(--c);
    border-radius: 0 var(--rayon-l) var(--rayon-l) 0;
  }
  /* Bloc simple : la carte unique prend toute la largeur restante */
  .carte-seg:nth-child(2):last-child {
    grid-column: 2 / -1;
  }
  @container (max-width: 760px) {
    .carte-seg:nth-child(2):last-child {
      grid-column: auto;
    }
  }
  .tete-bloc {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pastille {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex: none;
  }
  .nom {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 0 10px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 16px;
    font-weight: 700;
  }
  h5 {
    margin: 0;
    font-size: 14px;
  }
  .etiquette {
    margin-top: 6px;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--texte-muet);
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
    flex: none;
  }
  .valeur {
    min-width: 56px;
    text-align: center;
    font-size: 20px;
    font-weight: 700;
  }
  .champ {
    width: 84px;
    min-height: 44px;
    padding: 0 8px;
    background: var(--surface-2);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 16px;
    text-align: center;
  }
  .unite {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .cible {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .barre-zones {
    display: flex;
    gap: 3px;
    margin-top: 6px;
  }
  .zone {
    flex: 1;
    min-height: 44px;
    border: 0;
    border-radius: 4px;
    color: #0c0d10;
    font-size: 12px;
    font-weight: 700;
    opacity: 0.55;
    cursor: pointer;
  }
  .zone:hover {
    opacity: 0.85;
  }
  .zone.actif {
    opacity: 1;
    outline: 2px solid var(--texte);
    outline-offset: 1px;
  }
  .actions-bloc {
    margin-top: 8px;
  }
</style>
