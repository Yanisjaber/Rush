<script>
  import GraphiqueLignes from './GraphiqueLignes.svelte';
  import { formatKg } from '../../utils/format.js';

  // Progression du 1RM estimé : des ONGLETS pour choisir le groupe musculaire, un menu déroulant pour choisir l'exercice de ce
  // groupe, et UN seul graphique visible (la page reste courte même avec 6 groupes).
  // Même système que le menu principal (EnTete.svelte) : tous les groupes à plat s'il y a la place ; sinon ils se rangent dans
  // un seul bouton « Groupe ▾ » qui ouvre la liste. On mesure la place nécessaire avec une copie invisible.
  //  groupes : [{ groupe, nom, exercices: [{ cle, nom, etiquettes (dates), valeurs (1RM estimé par séance), rm (dernier), record }] }]
  //  Les exercices d'un groupe arrivent du plus pratiqué au moins pratiqué : le premier est proposé d'abord.
  let { groupes = [] } = $props();

  let groupeChoisi = $state('');
  let exoChoisi = $state({}); // exercice retenu pour chaque groupe (on le garde quand on change d'onglet)
  // Si le groupe ou l'exercice choisi n'existe plus (autre période, autre filtre), on retombe sur le premier
  const courant = $derived(groupes.find((g) => g.groupe === groupeChoisi) || groupes[0]);
  const exo = $derived(courant ? courant.exercices.find((e) => e.cle === exoChoisi[courant.groupe]) || courant.exercices[0] : null);
  const idMenu = `exo-${Math.random().toString(36).slice(2, 8)}`;

  let zone = $state(); // la ligne qui reçoit les onglets
  let mesure = $state(); // copie invisible de tous les onglets à plat
  let compact = $state(false);
  let ouvert = $state(false);
  let posMenu = $state({ top: 0, left: 0 });

  $effect(() => {
    if (!zone || !mesure) return;
    void groupes; // les noms peuvent changer avec la période
    const calculer = () => {
      compact = mesure.scrollWidth > zone.clientWidth;
      if (!compact) ouvert = false;
    };
    calculer();
    const obs = new ResizeObserver(calculer);
    obs.observe(zone);
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
  {#if groupes.length > 1}
    <div class="onglets" role="group" aria-label="Groupe musculaire" bind:this={zone}>
      {#if compact}
        <button type="button" class="onglet bouton-groupe courant" aria-haspopup="true" aria-expanded={ouvert} onclick={basculer}>
          {courant.nom}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4l4 4 4-4" /></svg>
        </button>
      {:else}
        {#each groupes as g (g.groupe)}
          <button type="button" class="onglet" class:courant={courant.groupe === g.groupe} aria-pressed={courant.groupe === g.groupe} onclick={() => (groupeChoisi = g.groupe)}>{g.nom}</button>
        {/each}
      {/if}
      <!-- Copie invisible de tous les onglets à plat, uniquement pour mesurer la place nécessaire -->
      <div class="mesure" aria-hidden="true" bind:this={mesure}>{#each groupes as g (g.groupe)}<span>{g.nom}</span>{/each}</div>
    </div>
    {#if ouvert}
      <ul class="liste-groupes" style:top="{posMenu.top}px" style:left="{posMenu.left}px">
        {#each groupes as g (g.groupe)}
          <li><button type="button" class:courant={courant.groupe === g.groupe} onclick={() => choisir(g)}>{g.nom}</button></li>
        {/each}
      </ul>
    {/if}
  {/if}
  <div class="barre">
    {#if courant.exercices.length > 1}
      <label for={idMenu}>Exercice</label>
      <select id={idMenu} value={exo.cle} onchange={(e) => (exoChoisi[courant.groupe] = e.currentTarget.value)}>
        {#each courant.exercices as e (e.cle)}<option value={e.cle}>{e.nom}</option>{/each}
      </select>
    {:else}
      <span class="seul">{exo.nom}</span>
    {/if}
    <span class="chiffres">1RM estimé <strong>{formatKg(exo.rm)} kg</strong> · record <strong>{formatKg(exo.record)} kg</strong></span>
  </div>
  <GraphiqueLignes
    etiquettes={exo.etiquettes}
    series={[{ nom: exo.nom, couleur: 'var(--sport-muscu)', valeurs: exo.valeurs }]}
    etiquette={`Progression du 1RM estimé : ${exo.nom} (${courant.nom})`}
  />
{/if}

<style>
  .onglets {
    position: relative;
    display: flex;
    gap: 4px;
    margin-bottom: 14px;
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
  .onglet.courant {
    background: var(--surface-2);
    color: var(--texte);
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
    padding: 0 14px;
  }
  .barre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 12px;
  }
  label {
    font-size: 13px;
    color: var(--texte-doux);
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
    margin-left: auto;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .chiffres strong {
    color: var(--texte);
  }
</style>
