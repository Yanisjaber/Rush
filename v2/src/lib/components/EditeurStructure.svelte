<script>
  import Bouton from './Bouton.svelte';
  import ProfilStructure from './ProfilStructure.svelte';
  import {
    NOM_TYPE, NOM_METRIQUE, TYPES_BLOC, metriquesDuSport, normaliser, nouveauBloc, modeles, lireCommande,
    lireDuree, texteDuree, texteCible, resume, indiceZone, ZONES,
  } from '../data/structure.js';

  // Éditeur de la structure d'une séance : liste de blocs modifiables, modèles, ligne de commande, profil et résumé.
  //  blocs (bindable) : structure normalisée · sport : type brut · ref : { ftp, hrMax } · couleur : couleur du sport
  let { blocs = $bindable([]), sport = 'Ride', ref = {}, couleur = 'var(--sport-neutre)' } = $props();

  const metriques = $derived(metriquesDuSport(sport));
  const metrique = $derived(blocs[0]?.metric && metriques.includes(blocs[0].metric) ? blocs[0].metric : metriques[0]);
  const bilan = $derived(resume(blocs, ref, sport));

  let commande = $state('');
  let erreurCommande = $state('');
  let annuler = $state([]); // piles d'historique : on peut revenir en arrière
  let refaire = $state([]);

  // Toute modification passe par ici : on garde l'état précédent (annuler) et on repasse par normaliser (valeurs bornées)
  function appliquer(nouveaux) {
    annuler = [...annuler.slice(-39), blocs];
    refaire = [];
    blocs = normaliser(nouveaux, metrique);
  }
  function retour() {
    if (!annuler.length) return;
    refaire = [...refaire, blocs];
    blocs = annuler[annuler.length - 1];
    annuler = annuler.slice(0, -1);
  }
  function avancer() {
    if (!refaire.length) return;
    annuler = [...annuler, blocs];
    blocs = refaire[refaire.length - 1];
    refaire = refaire.slice(0, -1);
  }

  const ajouter = (type) => appliquer([...blocs, nouveauBloc(type, metrique)]);
  const supprimer = (i) => appliquer(blocs.filter((_, k) => k !== i));
  const dupliquer = (i) => appliquer([...blocs.slice(0, i + 1), structuredClone($state.snapshot(blocs[i])), ...blocs.slice(i + 1)]);
  function deplacer(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= blocs.length) return;
    const copie = [...blocs];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    appliquer(copie);
  }
  function modifierBloc(i, changements) {
    appliquer(blocs.map((b, k) => (k === i ? { ...$state.snapshot(b), ...changements } : $state.snapshot(b))));
  }
  function modifierSegment(i, quel, changements) {
    const b = $state.snapshot(blocs[i]);
    modifierBloc(i, { [quel]: { ...b[quel], ...changements } });
  }
  function changerMetrique(m) {
    appliquer(blocs.map((b) => ({ ...$state.snapshot(b), metric: m })));
  }
  const nombre = (v) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  function lireChampDuree(i, quel, valeur) {
    const m = lireDuree(valeur);
    if (m != null) modifierSegment(i, quel, { min: m });
  }
  function lireChampPct(i, quel, cle, valeur) {
    if (cle === 'intHi' && String(valeur).trim() === '') return modifierSegment(i, quel, { intHi: null });
    const n = nombre(valeur);
    if (n != null && n > 0) modifierSegment(i, quel, { [cle]: n });
  }
  function choisirZone(i, quel, valeur) {
    const z = ZONES[metrique];
    const k = Number(valeur);
    if (Number.isInteger(k) && k >= 0 && k < z.bas.length) modifierSegment(i, quel, { int: z.bas[k], intHi: z.haut[k] });
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
    appliquer([...blocs, bloc]);
  }
  const textePct = (seg) => (seg.intHi != null ? `${Math.round(seg.int)}–${Math.round(seg.intHi)} %` : `${Math.round(seg.int)} %`);
</script>

<div class="editeur">
  <div class="barre-haut">
    {#if metriques.length > 1}
      <div class="metriques" role="group" aria-label="Mesure de l'intensité">
        {#each metriques as m (m)}
          <button type="button" class="puce" class:actif={m === metrique} aria-pressed={m === metrique} onclick={() => changerMetrique(m)}>{NOM_METRIQUE[m]}</button>
        {/each}
      </div>
    {/if}
    <div class="historique">
      <button type="button" class="outil" aria-label="Annuler" disabled={!annuler.length} onclick={retour}>↶</button>
      <button type="button" class="outil" aria-label="Rétablir" disabled={!refaire.length} onclick={avancer}>↷</button>
    </div>
  </div>

  {#if blocs.length}
    <ProfilStructure {blocs} {couleur} />
    <p class="bilan">
      <strong>{texteDuree(bilan.dureeMin)}</strong> · {bilan.tss} TSS · IF {String(bilan.facteurIntensite).replace('.', ',')}
      {#if bilan.watts} · {bilan.watts} W moy.{/if}
      {#if bilan.bpm} · {bilan.bpm} bpm moy.{/if}
      {#if bilan.km} · {String(bilan.km).replace('.', ',')} km{/if}
    </p>
  {:else}
    <p class="vide">Aucun bloc pour l'instant. Choisis un modèle, ajoute un bloc, ou écris-le à la ligne de commande.</p>
  {/if}

  <ul class="blocs">
    {#each blocs as b, i (i)}
      <li class="bloc">
        <div class="tete">
          <span class="type">{NOM_TYPE[b.type]}</span>
          <input class="nom" type="text" maxlength="60" aria-label="Nom du bloc {i + 1}" value={b.name} onchange={(e) => modifierBloc(i, { name: e.currentTarget.value })} />
          <div class="outils">
            <button type="button" class="outil" aria-label="Monter le bloc {i + 1}" disabled={i === 0} onclick={() => deplacer(i, -1)}>↑</button>
            <button type="button" class="outil" aria-label="Descendre le bloc {i + 1}" disabled={i === blocs.length - 1} onclick={() => deplacer(i, 1)}>↓</button>
            <button type="button" class="outil" aria-label="Dupliquer le bloc {i + 1}" onclick={() => dupliquer(i)}>⧉</button>
            <button type="button" class="outil" aria-label="Supprimer le bloc {i + 1}" onclick={() => supprimer(i)}>✕</button>
          </div>
        </div>

        {#each b.type === 'interval' ? [['work', 'Effort'], ['rec', 'Récupération']] : [['work', 'Durée et intensité']] as [quel, titre] (quel)}
          {@const seg = b[quel]}
          {#if seg}
            <div class="segment">
              <span class="titre-segment">{titre}</span>
              <div class="champs">
                {#if quel === 'work' && b.type === 'interval'}
                  <label>Répétitions
                    <input type="text" inputmode="numeric" value={b.reps} onchange={(e) => nombre(e.currentTarget.value) > 0 && modifierBloc(i, { reps: Math.round(nombre(e.currentTarget.value)) })} />
                  </label>
                {/if}
                <label>Durée
                  <input type="text" value={texteDuree(seg.min)} onchange={(e) => lireChampDuree(i, quel, e.currentTarget.value)} />
                </label>
                <label>Zone
                  <select value={indiceZone((seg.intHi != null ? (seg.int + seg.intHi) / 2 : seg.int), metrique)} onchange={(e) => choisirZone(i, quel, e.currentTarget.value)}>
                    {#each ZONES[metrique].noms as nomZone, k (k)}<option value={k}>{nomZone}</option>{/each}
                  </select>
                </label>
                <label>Intensité de (%)
                  <input type="text" inputmode="decimal" value={Math.round(seg.int)} onchange={(e) => lireChampPct(i, quel, 'int', e.currentTarget.value)} />
                </label>
                <label>à (%)
                  <input type="text" inputmode="decimal" placeholder="—" value={seg.intHi != null ? Math.round(seg.intHi) : ''} onchange={(e) => lireChampPct(i, quel, 'intHi', e.currentTarget.value)} />
                </label>
              </div>
              <span class="cible">{texteCible(seg, metrique, ref, sport)} <span class="pct">({textePct(seg)})</span></span>
            </div>
          {/if}
        {/each}
      </li>
    {/each}
  </ul>

  <div class="ajout">
    <span class="legende">Ajouter un bloc</span>
    <div class="rangee">
      {#each TYPES_BLOC as t (t)}
        <button type="button" class="puce" onclick={() => ajouter(t)}>{NOM_TYPE[t]}</button>
      {/each}
    </div>
  </div>

  <div class="ajout">
    <span class="legende">Partir d'un modèle</span>
    <div class="rangee">
      {#each modeles(metrique) as m (m.nom)}
        <button type="button" class="puce" onclick={() => appliquer(m.blocs)}>{m.nom}</button>
      {/each}
    </div>
  </div>

  <form class="commande" onsubmit={envoyerCommande}>
    <label for="structure-commande">Ligne de commande</label>
    <div class="ligne-commande">
      <input id="structure-commande" type="text" placeholder="4x4' Z5 récup 3'" bind:value={commande} aria-describedby={erreurCommande ? 'structure-commande-erreur' : undefined} />
      <Bouton type="submit" variante="discret">Ajouter</Bouton>
    </div>
    {#if erreurCommande}<span class="erreur" id="structure-commande-erreur" role="alert">{erreurCommande}</span>{/if}
  </form>
</div>

<style>
  .editeur {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .barre-haut {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .metriques,
  .rangee,
  .historique {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .puce {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--trait-fort);
    border-radius: 999px;
    background: transparent;
    color: var(--texte);
    font-size: 14px;
    cursor: pointer;
  }
  .puce.actif {
    background: var(--texte);
    color: var(--fond);
  }
  .outil {
    width: 44px;
    height: 44px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte);
    font-size: 18px;
    cursor: pointer;
  }
  .outil:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .puce:focus-visible,
  .outil:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .bilan,
  .vide {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .bilan strong {
    color: var(--texte);
  }
  .blocs {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bloc {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .tete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .type {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .nom {
    flex: 1 1 140px;
    min-width: 0;
  }
  .outils {
    display: flex;
    gap: 4px;
  }
  .segment {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .titre-segment {
    font-size: 13px;
    font-weight: 600;
  }
  .champs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 8px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  input,
  select {
    box-sizing: border-box;
    height: 44px;
    padding: 0 10px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 16px;
  }
  .cible {
    font-size: 13px;
  }
  .pct {
    color: var(--texte-doux);
  }
  .ajout {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .legende {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .commande {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .commande label {
    font-size: 13px;
  }
  .ligne-commande {
    display: flex;
    gap: 8px;
  }
  .ligne-commande input {
    flex: 1;
    min-width: 0;
    height: 52px;
    padding: 0 16px;
    border-radius: var(--rayon-l);
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
</style>
