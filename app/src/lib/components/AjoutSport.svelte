<script>
  import { SPORTS, couleurSport } from '../sports.js';
  import { GROUPES_SPORTS, nettoyerSports, fusionnerFamilles, sportsCoches } from '../data/sports-choisis.js';
  import { menu, chargerMenu } from '../stores/menu.svelte.js';
  import { auth } from '../stores/auth.svelte.js';
  import { modeDemo } from '../routeur.svelte.js';
  import { sportsChoisis, chargerSportsChoisis, enregistrerSportsChoisis } from '../stores/sports.svelte.js';

  // Le bouton « + » fixe à droite de la barre des sports (téléphone) : un menu déroulant avec tous les sports, coché pour ceux qu'on pratique.
  // Toucher un sport l'ajoute ou le retire tout de suite (même enregistrement que Préférences › Mes sports).
  let { demo = false } = $props();

  const uid = $derived(demo || modeDemo() ? 'demo' : auth.session?.user?.id);
  let ouvert = $state(false);
  let enCours = $state(false);
  let bouton = $state();
  let liste = $state();

  // Coché : la même règle que Préférences (sports choisis + sports principaux que les séances font déjà apparaître dans la barre)
  const cochesActuels = $derived(sportsCoches(sportsChoisis.liste, menu.familles));
  const coche = (cle) => cochesActuels.includes(cle);

  async function basculerMenu() {
    ouvert = !ouvert;
    if (ouvert && uid && !sportsChoisis.pret) await chargerSportsChoisis(uid);
  }

  async function basculerSport(cle) {
    if (enCours || !uid) return;
    enCours = true;
    // On part de tous les sports cochés (y compris ceux que les séances révèlent) pour ne changer que le sport touché
    const apres = cochesActuels.includes(cle) ? cochesActuels.filter((s) => s !== cle) : [...cochesActuels, cle];
    await enregistrerSportsChoisis(uid, apres, sportsChoisis.disciplines);
    if (uid === 'demo') menu.familles = fusionnerFamilles(['course', 'velo', 'muscu', 'hyrox'], nettoyerSports(apres) || []); // la démo n'a pas de base : on recompose le menu ici
    else await chargerMenu(uid); // le menu suit les sports choisis (et les données qui les révèlent)
    enCours = false;
  }

  // On referme en touchant ailleurs ou avec Échap
  function dehors(e) {
    if (ouvert && !liste?.contains(e.target) && !bouton?.contains(e.target)) ouvert = false;
  }
  function touche(e) {
    if (e.key === 'Escape' && ouvert) {
      ouvert = false;
      bouton?.focus();
    }
  }
</script>

<svelte:window onpointerdown={dehors} onkeydown={touche} />

<div class="ajout">
  <button
    bind:this={bouton}
    type="button"
    class="plus"
    class:ouvert
    aria-haspopup="menu"
    aria-expanded={ouvert}
    aria-label="Ajouter ou retirer un sport"
    onclick={basculerMenu}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
  </button>

  {#if ouvert}
    <div class="menu" bind:this={liste} role="menu" aria-label="Tes sports">
      {#each GROUPES_SPORTS as groupe (groupe.titre)}
        <div class="groupe" role="group" aria-label={groupe.titre}>
          <p class="titre-groupe">{groupe.titre}</p>
          {#each groupe.sports as cle (cle)}
            {@const actif = coche(cle)}
            <button type="button" role="menuitemcheckbox" aria-checked={actif} class="ligne" disabled={enCours} onclick={() => basculerSport(cle)} style:--c={couleurSport(cle)}>
              <span class="point" aria-hidden="true"></span>
              <span class="nom">{(SPORTS[cle] || SPORTS.autre).nom}</span>
              <span class="case" class:cochee={actif} aria-hidden="true">
                {#if actif}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{/if}
              </span>
            </button>
          {/each}
        </div>
      {/each}
      <a class="note" href="#/parametres/preferences" onclick={() => (ouvert = false)}>Pour gérer l'ordre d'affichage : Paramètres ›</a>
    </div>
  {/if}
</div>

<style>
  .ajout {
    flex: none;
    display: flex;
    align-items: center;
    padding-left: 8px;
    margin-left: 4px;
    border-left: 1px solid var(--trait);
  }
  .plus {
    -webkit-tap-highlight-color: transparent;
    width: var(--cible);
    height: var(--cible);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-rond);
    background: none;
    color: var(--texte);
    cursor: pointer;
  }
  .plus svg {
    transition: transform 0.2s;
  }
  .plus.ouvert {
    background: var(--surface-2);
  }
  .plus.ouvert svg {
    transform: rotate(45deg); /* le « + » devient un « × » quand le menu est ouvert */
  }

  /* Le menu se pose sous la barre, calé à droite : il reste lisible même quand la rangée de pastilles défile */
  .menu {
    position: absolute; /* par rapport à la barre des sports (elle est fixe), qui n'a pas de défilement : le menu n'est jamais coupé */
    top: calc(100% + 6px);
    right: 12px;
    z-index: 50;
    width: min(280px, calc(100vw - 24px));
    max-height: min(70dvh, 560px);
    overflow-y: auto;
    padding: 6px 14px 10px;
    box-sizing: border-box;
    background: var(--surface);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-l);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
  }
  /* Une ligne, en petit, tout en bas du menu */
  .note {
    display: block;
    margin-top: 6px;
    padding: 10px 0 2px;
    border-top: 1px solid var(--trait);
    font-size: 11px;
    line-height: 1.3;
    color: var(--texte-muet);
    white-space: nowrap;
  }
  .note:hover {
    color: var(--texte);
  }
  .groupe + .groupe {
    border-top: 1px solid var(--trait);
  }
  .titre-groupe {
    margin: 10px 0 2px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .ligne {
    -webkit-tap-highlight-color: transparent;
    width: 100%;
    min-height: var(--cible);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    color: var(--texte);
    text-align: left;
    cursor: pointer;
  }
  .ligne:disabled {
    opacity: 0.6;
  }
  .point {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--c);
  }
  .nom {
    flex: 1;
    min-width: 0;
  }
  .case {
    flex: none;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--trait-fort);
    border-radius: 6px;
    color: var(--encre-sur-couleur);
  }
  .case.cochee {
    background: var(--c);
    border-color: var(--c);
  }
</style>
