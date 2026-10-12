<script>
  import Bouton from './Bouton.svelte';
  import ProfilStructure from './ProfilStructure.svelte';
  import {
    NOM_TYPE, NOM_METRIQUE, metriquesDuSport, normaliser, nouveauBloc, modeles, lireCommande,
    lireDuree, texteDuree, texteCible, resume, indiceZone, milieu, ZONES,
  } from '../data/structure.js';

  // Éditeur de la structure d'une séance, pensé pour être lu d'un coup d'œil :
  //   1. un grand graphique cliquable (le profil de la séance) ;
  //   2. des pastilles pour choisir un bloc ;
  //   3. un seul panneau qui règle le bloc choisi (durée, zone, répétitions) ; les % précis sont dans « Avancé ».
  //  blocs (bindable) : structure normalisée · sport : type brut · ref : { ftp, hrMax } · couleur : couleur du sport
  let { blocs = $bindable([]), sport = 'Ride', ref = {}, couleur = 'var(--sport-neutre)' } = $props();

  const metriques = $derived(metriquesDuSport(sport));
  const metrique = $derived(blocs[0]?.metric && metriques.includes(blocs[0].metric) ? blocs[0].metric : metriques[0]);
  const bilan = $derived(resume(blocs, ref, sport));

  let selection = $state(null); // indice du bloc choisi
  let annuler = $state([]);
  let refaire = $state([]);
  let commande = $state('');
  let erreurCommande = $state('');

  const choisi = $derived(selection !== null && blocs[selection] ? blocs[selection] : null);
  const segments = $derived(choisi ? (choisi.type === 'interval' ? [['work', 'Effort'], ['rec', 'Récupération']] : [['work', 'Durée et intensité']]) : []);

  // Toute modification passe par ici : on garde l'état précédent (annuler) et on repasse par normaliser (valeurs bornées)
  function appliquer(nouveaux, nouvelleSelection = selection) {
    annuler = [...annuler.slice(-39), blocs];
    refaire = [];
    blocs = normaliser(nouveaux, metrique);
    selection = nouvelleSelection !== null && nouvelleSelection < blocs.length ? nouvelleSelection : blocs.length ? Math.min(blocs.length - 1, Math.max(0, nouvelleSelection ?? 0)) : null;
  }
  function revenir(pile, autre, definir) {
    if (!pile.length) return;
    definir(pile[pile.length - 1], pile.slice(0, -1), [...autre, blocs]);
    if (selection !== null && selection >= blocs.length) selection = blocs.length ? blocs.length - 1 : null;
  }
  const retour = () => revenir(annuler, refaire, (b, a, r) => { blocs = b; annuler = a; refaire = r; });
  const avancer = () => revenir(refaire, annuler, (b, r, a) => { blocs = b; refaire = r; annuler = a; });

  const copie = (b) => $state.snapshot(b);
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

  // Durée : pas plus fin pour les efforts courts (30 s), plus gros pour les longs blocs
  const pasDuree = (min) => (min < 3 ? 0.5 : min < 20 ? 1 : 5);
  const changerDuree = (quel, sens) => {
    const m = choisi[quel].min;
    modifierSegment(quel, { min: Math.max(0.5, m + sens * pasDuree(sens < 0 ? m - 0.01 : m)) });
  };
  function lireChampDuree(quel, valeur) {
    const m = lireDuree(valeur);
    if (m != null) modifierSegment(quel, { min: m });
  }
  const indiceDeZone = (seg) => indiceZone(milieu(seg), metrique);
  function choisirZone(quel, valeur) {
    const z = ZONES[metrique];
    const k = Number(valeur);
    if (Number.isInteger(k) && k >= 0 && k < z.bas.length) modifierSegment(quel, { int: z.bas[k], intHi: z.haut[k] });
  }
  const nombre = (v) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  function lireChampPct(quel, cle, valeur) {
    if (cle === 'intHi' && String(valeur).trim() === '') return modifierSegment(quel, { intHi: null });
    const n = nombre(valeur);
    if (n != null && n > 0) modifierSegment(quel, { [cle]: n });
  }
  const changerReps = (sens) => modifierBloc({ reps: Math.min(99, Math.max(1, choisi.reps + sens)) });

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
  function chargerModele(e) {
    const m = modeles(metrique).find((x) => x.nom === e.currentTarget.value);
    e.currentTarget.value = '';
    if (m) appliquer(m.blocs, 0);
  }

  // Phrase lisible d'un bloc : « 4 × 4 min en Z5, récup 3 min en Z1 »
  const nomZone = (seg, m = metrique) => ZONES[m].noms[indiceZone(milieu(seg), m)].split(' ')[0];
  function phrase(b) {
    if (b.type === 'interval') return `${b.reps} × ${texteDuree(b.work.min)} en ${nomZone(b.work, b.metric)}, récup ${texteDuree(b.rec.min)} en ${nomZone(b.rec, b.metric)}`;
    return `${texteDuree(b.work.min)} en ${nomZone(b.work, b.metric)}`;
  }
  const textePct = (seg) => (seg.intHi != null ? `${Math.round(seg.int)}–${Math.round(seg.intHi)} %` : `${Math.round(seg.int)} %`);
</script>

{#snippet pas(etiquette, valeur, moins, plus, descMoins, descPlus)}
  <div class="pas">
    <span class="etiq">{etiquette}</span>
    <div class="pas-ligne">
      <button type="button" class="rond" aria-label={descMoins} onclick={moins}>−</button>
      <span class="valeur" aria-live="polite">{valeur}</span>
      <button type="button" class="rond" aria-label={descPlus} onclick={plus}>+</button>
    </div>
  </div>
{/snippet}

<div class="editeur">
  <!-- Barre d'actions : ajouter, partir d'un modèle, mesure, annuler -->
  <div class="barre">
    <div class="groupe">
      <button type="button" class="bouton plein" onclick={() => ajouter('interval')}>+ Intervalles</button>
      <button type="button" class="bouton" onclick={() => ajouter('steady')}>+ Bloc continu</button>
      <select class="bouton" aria-label="Ajouter un autre type de bloc" onchange={(e) => { if (e.currentTarget.value) ajouter(e.currentTarget.value); e.currentTarget.value = ''; }}>
        <option value="">+ Autre…</option>
        <option value="warmup">Échauffement</option>
        <option value="recovery">Récupération</option>
        <option value="cooldown">Retour au calme</option>
      </select>
      <select class="bouton" aria-label="Partir d'un modèle" onchange={chargerModele}>
        <option value="">Partir d'un modèle…</option>
        {#each modeles(metrique) as m (m.nom)}<option value={m.nom}>{m.nom}</option>{/each}
      </select>
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

  {#if blocs.length}
    <ProfilStructure {blocs} {couleur} {selection} onselectionner={(i) => (selection = i)} />

    <div class="pastilles" role="group" aria-label="Choisir un bloc">
      {#each blocs as b, i (i)}
        <button type="button" class="pastille" class:choisie={selection === i} aria-pressed={selection === i} onclick={() => (selection = i)}>
          <span class="num">{i + 1}</span>
          <span class="txt"><strong>{b.name}</strong><small>{phrase(b)}</small></span>
        </button>
      {/each}
    </div>

    <p class="bilan">
      <strong>{texteDuree(bilan.dureeMin)}</strong> au total · {bilan.tss} points de charge
      {#if bilan.watts} · {bilan.watts} W en moyenne{/if}
      {#if bilan.bpm} · {bilan.bpm} bpm en moyenne{/if}
      {#if bilan.km} · {String(bilan.km).replace('.', ',')} km{/if}
    </p>
  {:else}
    <div class="vide">
      <p><strong>Ta séance est vide.</strong></p>
      <p>Pour commencer : choisis « Partir d'un modèle… », ou ajoute un bloc avec « + Intervalles ».</p>
    </div>
  {/if}

  {#if choisi}
    <section class="inspecteur" aria-label="Réglages du bloc {selection + 1}">
      <div class="titre-bloc">
        <label class="nom">
          <span class="etiq">Bloc {selection + 1} · {NOM_TYPE[choisi.type]}</span>
          <input type="text" maxlength="60" value={choisi.name} onchange={(e) => modifierBloc({ name: e.currentTarget.value })} />
        </label>
        <div class="groupe">
          <button type="button" class="bouton" disabled={selection === 0} onclick={() => deplacer(-1)}>← Avant</button>
          <button type="button" class="bouton" disabled={selection === blocs.length - 1} onclick={() => deplacer(1)}>Après →</button>
          <button type="button" class="bouton" onclick={dupliquer}>Dupliquer</button>
          <button type="button" class="bouton danger" onclick={supprimer}>Supprimer</button>
        </div>
      </div>

      {#if choisi.type === 'interval'}
        {@render pas('Répétitions', `${choisi.reps} ×`, () => changerReps(-1), () => changerReps(1), 'Une répétition de moins', 'Une répétition de plus')}
      {/if}

      {#each segments as [quel, titre] (quel)}
        {@const seg = choisi[quel]}
        <div class="segment">
          <h4>{titre}</h4>
          <div class="ligne-segment">
            {@render pas('Durée', texteDuree(seg.min), () => changerDuree(quel, -1), () => changerDuree(quel, 1), 'Durée plus courte', 'Durée plus longue')}
            <label class="zone">
              <span class="etiq">Intensité</span>
              <select value={indiceDeZone(seg)} onchange={(e) => choisirZone(quel, e.currentTarget.value)}>
                {#each ZONES[metrique].noms as n, k (k)}<option value={k}>{n}</option>{/each}
              </select>
            </label>
            <p class="cible">{texteCible(seg, metrique, ref, sport)}</p>
          </div>
          <details class="avance">
            <summary>Avancé : réglages précis</summary>
            <div class="champs-avance">
              <label><span class="etiq">Durée (ex. 4:30, 45s, 1h)</span>
                <input type="text" value={texteDuree(seg.min)} onchange={(e) => lireChampDuree(quel, e.currentTarget.value)} />
              </label>
              <label><span class="etiq">Intensité minimum (%)</span>
                <input type="text" inputmode="decimal" value={Math.round(seg.int)} onchange={(e) => lireChampPct(quel, 'int', e.currentTarget.value)} />
              </label>
              <label><span class="etiq">Intensité maximum (%) — facultatif</span>
                <input type="text" inputmode="decimal" placeholder="—" value={seg.intHi != null ? Math.round(seg.intHi) : ''} onchange={(e) => lireChampPct(quel, 'intHi', e.currentTarget.value)} />
              </label>
            </div>
            <p class="aide">Actuellement {textePct(seg)} de {metrique === 'power' ? 'ta FTP' : metrique === 'hr' ? 'ta FC max' : "ton allure de référence"}.</p>
          </details>
        </div>
      {/each}
    </section>
  {:else if blocs.length}
    <p class="aide">Touche une barre du graphique ou une pastille pour régler un bloc.</p>
  {/if}

  <details class="texte-libre">
    <summary>Écrire la séance en texte</summary>
    <form onsubmit={envoyerCommande}>
      <label for="structure-commande" class="etiq">Un bloc par ligne, par exemple : 15' Z1 · 20' à 250W · 3x8' Z4 récup 4'</label>
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
    gap: 16px;
  }
  .barre {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 16px;
  }
  .groupe {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
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
  button:focus-visible,
  select:focus-visible,
  input:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .pastilles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .pastille {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 6px 14px 6px 8px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-l);
    background: var(--surface-2);
    color: var(--texte);
    text-align: left;
    cursor: pointer;
  }
  .pastille.choisie {
    border-color: var(--texte);
    background: var(--surface);
  }
  .num {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--trait-fort);
    font-size: 13px;
    font-weight: 700;
    flex: none;
  }
  .choisie .num {
    background: var(--texte);
    color: var(--fond);
  }
  .txt {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .txt strong {
    font-size: 14px;
  }
  .txt small {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .bilan {
    font-size: 14px;
    color: var(--texte-doux);
  }
  .bilan strong {
    color: var(--texte);
  }
  .vide {
    padding: 20px;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon-l);
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--texte-doux);
  }
  .vide strong {
    color: var(--texte);
  }
  .inspecteur {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .titre-bloc {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }
  .nom {
    flex: 1 1 220px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .segment {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 14px;
    border-top: 1px solid var(--trait);
  }
  h4 {
    margin: 0;
    font-size: 15px;
  }
  .ligne-segment {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px 24px;
  }
  .pas {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pas-ligne {
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
    min-width: 72px;
    text-align: center;
    font-size: 20px;
    font-weight: 700;
  }
  .zone {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cible {
    font-size: 14px;
    color: var(--texte-doux);
    align-self: center;
  }
  .etiq {
    font-size: 12px;
    color: var(--texte-doux);
  }
  input,
  select {
    box-sizing: border-box;
    min-height: 44px;
    padding: 0 12px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 16px;
  }
  select.bouton {
    background: transparent;
    font-size: 14px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .avance summary,
  .texte-libre summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-size: 14px;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .champs-avance {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }
  .aide {
    margin-top: 8px;
    font-size: 13px;
    color: var(--texte-doux);
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
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
</style>
