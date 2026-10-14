<script>
  import GraphiqueLignes from './GraphiqueLignes.svelte';
  import { formatKg } from '../../utils/format.js';

  // Progression du 1RM estimé : des ONGLETS pour choisir le groupe musculaire, un menu déroulant pour choisir l'exercice de ce
  // groupe, et UN seul graphique visible (la page reste courte même avec 6 groupes).
  // Même système que le menu principal (EnTete.svelte) : tous les groupes à plat s'il y a la place ; sinon ils se rangent dans
  // un seul bouton « Groupe ▾ » qui ouvre la liste. On mesure la place nécessaire avec une copie invisible.
  //  groupes : [{ groupe, nom, exercices: [{ cle, nom, etiquettes (dates), valeurs (1RM estimé par séance), rm (dernier), record }] }]
  //  Les exercices d'un groupe arrivent du plus pratiqué au moins pratiqué : le premier est proposé d'abord.
  //  selection (à lier avec bind:) : l'exercice affiché, { groupe, exo }, pour que la page puisse montrer son historique à côté
  let { groupes = [], selection = $bindable(null) } = $props();

  let groupeChoisi = $state('');
  let exoChoisi = $state({}); // exercice retenu pour chaque groupe (on le garde quand on change d'onglet)
  // Si le groupe ou l'exercice choisi n'existe plus (autre période, autre filtre), on retombe sur le premier
  const courant = $derived(groupes.find((g) => g.groupe === groupeChoisi) || groupes[0]);
  const exo = $derived(courant ? courant.exercices.find((e) => e.cle === exoChoisi[courant.groupe]) || courant.exercices[0] : null);

  // On dit à la page quel exercice est affiché (elle en montre l'historique)
  $effect(() => {
    selection = courant && exo ? { groupe: courant.groupe, exo } : null;
  });

  let ligne = $state(); // la ligne entière : les onglets des groupes + le sélecteur d'exercice à côté
  let exoZone = $state(); // le sélecteur d'exercice
  let chiffresZone = $state(); // les chiffres (1RM, record), à droite de la ligne
  let mesure = $state(); // copie invisible de tous les onglets à plat
  let compact = $state(false);
  let ouvert = $state(false);
  let posMenu = $state({ top: 0, left: 0 });

  $effect(() => {
    if (!ligne || !mesure) return;
    void groupes; // les noms peuvent changer avec la période
    const calculer = () => {
      // la place des onglets = la ligne moins le sélecteur d'exercice et l'écart entre les deux (on ne mesure pas les onglets
      // eux-mêmes : en mode compact ils sont minuscules, ça ne dirait pas s'il y a la place de repasser à plat)
      const place = ligne.clientWidth - (exoZone ? exoZone.offsetWidth + 12 : 0) - (chiffresZone ? chiffresZone.offsetWidth + 12 : 0);
      compact = mesure.scrollWidth > place;
      if (!compact) ouvert = false;
    };
    calculer();
    const obs = new ResizeObserver(calculer);
    obs.observe(ligne);
    if (exoZone) obs.observe(exoZone); // la largeur du sélecteur change avec le nom de l'exercice
    if (chiffresZone) obs.observe(chiffresZone); // et celle des chiffres avec l'exercice choisi
    return () => obs.disconnect();
  });

  function basculer(e) {
    if (ouvert) {
      ouvert = false;
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    posMenu = { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 200)) };
    ouvert = true;
  }
  function choisir(g) {
    groupeChoisi = g.groupe;
    ouvert = false;
  }
  function fermerSiDehors(e) {
    if (ouvert && !e.target.closest?.('.bouton-groupe, .liste-groupes')) ouvert = false;
  }
</script>

<svelte:window onclick={fermerSiDehors} onkeydown={(e) => e.key === 'Escape' && (ouvert = false)} onresize={() => (ouvert = false)} />

{#if courant && exo}
  <div class="ligne" bind:this={ligne}>
    {#if groupes.length > 1}
      <div class="onglets" role="group" aria-label="Groupe musculaire">
        {#if compact}
          <button type="button" class="onglet bouton-groupe courant" aria-haspopup="true" aria-expanded={ouvert} onclick={basculer}>
            <span class="point" aria-hidden="true"></span>{courant.nom}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4l4 4 4-4" /></svg>
          </button>
        {:else}
          {#each groupes as g (g.groupe)}
            <button type="button" class="onglet" class:courant={courant.groupe === g.groupe} aria-pressed={courant.groupe === g.groupe} onclick={() => (groupeChoisi = g.groupe)}><span class="point" aria-hidden="true"></span>{g.nom}</button>
          {/each}
        {/if}
        <!-- Copie invisible de tous les onglets à plat, uniquement pour mesurer la place nécessaire -->
        <div class="mesure" aria-hidden="true" bind:this={mesure}>{#each groupes as g (g.groupe)}<span>{g.nom}</span>{/each}</div>
      </div>
    {:else}
      <div class="mesure" aria-hidden="true" bind:this={mesure}></div>
    {/if}
    <!-- Le sélecteur d'exercice, juste à côté du groupe -->
    <div class="exo" bind:this={exoZone}>
      {#if courant.exercices.length > 1}
        <select aria-label={`Exercice (${courant.nom})`} value={exo.cle} onchange={(e) => (exoChoisi[courant.groupe] = e.currentTarget.value)}>
          {#each courant.exercices as e (e.cle)}<option value={e.cle}>{e.nom}</option>{/each}
        </select>
      {:else}
        <span class="seul">{exo.nom}</span>
      {/if}
    </div>
    <!-- Les chiffres de l'exercice, tout à droite de la ligne -->
    <p class="chiffres" bind:this={chiffresZone}>1RM estimé <strong>{formatKg(exo.rm)} kg</strong> · record <strong>{formatKg(exo.record)} kg</strong></p>
  </div>
  {#if ouvert}
    <ul class="liste-groupes" style:top="{posMenu.top}px" style:left="{posMenu.left}px">
      {#each groupes as g (g.groupe)}
        <li><button type="button" class:courant={courant.groupe === g.groupe} onclick={() => choisir(g)}><span class="point" aria-hidden="true"></span>{g.nom}</button></li>
      {/each}
    </ul>
  {/if}
  <GraphiqueLignes
    etiquettes={exo.etiquettes}
    series={[{ nom: exo.nom, couleur: 'var(--sport-muscu)', valeurs: exo.valeurs }]}
    etiquette={`Progression du 1RM estimé : ${exo.nom} (${courant.nom})`}
  />
{/if}

<style>
  /* Une seule ligne : les groupes puis, juste à côté, le sélecteur d'exercice (ça passe à la ligne seulement si même le bouton compact + le sélecteur ne tiennent pas) */
  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 12px;
  }
  .onglets {
    position: relative;
    display: flex;
    gap: 4px;
  }
  .exo {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  /* Même look que les liens du menu principal : sobre, le groupe choisi sur fond doux */
  .onglet {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: var(--cible);
    padding: 0 14px;
    border: 0;
    border-radius: var(--rayon-rond);
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    white-space: nowrap;
    cursor: pointer;
  }
  .onglet:hover,
  .onglet[aria-expanded='true'] {
    color: var(--texte);
  }
  /* Dans le menu du haut la pastille est posée sur le fond de la page, très sombre, et ressort bien. Ici on est sur une carte plus
     claire : le même fond (--surface-2) s'y noierait, donc on le renforce pour garder le même contraste que dans le menu. */
  .onglet.courant {
    background: color-mix(in srgb, var(--texte) 9%, var(--surface));
    color: var(--texte);
  }
  /* Le point de couleur devant chaque nom, comme les sports du menu du haut. La couleur désigne le sport (ici la muscu), pas le groupe. */
  .point {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--sport-muscu);
  }
  .liste-groupes {
    position: fixed;
    z-index: 50;
    min-width: 180px;
    margin: 0;
    padding: 6px;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
  }
  .liste-groupes button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: var(--cible);
    padding: 0 12px;
    border: 0;
    border-radius: var(--rayon-s);
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    color: var(--texte-doux);
    cursor: pointer;
  }
  .liste-groupes button:hover,
  .liste-groupes button.courant {
    background: var(--surface-2);
    color: var(--texte);
  }
  /* Copie de mesure : hors écran, invisible, une seule ligne */
  .mesure {
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    gap: 4px;
    visibility: hidden;
    pointer-events: none;
    white-space: nowrap;
    width: max-content;
    font-size: 14px;
    font-weight: 600;
  }
  .mesure span {
    padding: 0 14px 0 30px; /* + le point de couleur (9 px) et son écart (7 px) */
  }
  select {
    min-height: 44px;
    max-width: 100%;
    padding: 0 12px;
    font: inherit;
    font-weight: 600;
    color: var(--texte);
    background: var(--surface-2);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
  }
  select:focus-visible,
  .onglet:focus-visible,
  .liste-groupes button:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .seul {
    font-weight: 600;
  }
  .chiffres {
    margin: 0 0 0 auto;
    font-size: 13px;
    white-space: nowrap;
    color: var(--texte-doux);
  }
  .chiffres strong {
    color: var(--texte);
  }
</style>
