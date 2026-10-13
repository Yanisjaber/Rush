<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import General from '../lib/parametres/General.svelte';
  import Physiologie from '../lib/parametres/Physiologie.svelte';
  import Zones from '../lib/parametres/Zones.svelte';
  import Connexions from '../lib/parametres/Connexions.svelte';
  import Preferences from '../lib/parametres/Preferences.svelte';
  import Confidentialite from '../lib/parametres/Confidentialite.svelte';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { profil, chargerProfilStore } from '../lib/stores/profil.svelte.js';

  // Paramètres : un espace à onglets (#/parametres/general, /physiologie, /zones, /connexions, /preferences, /confidentialite).
  // Le profil est chargé une seule fois ici, puis partagé par les onglets (voir stores/profil.svelte.js).
  let { demo = false, onglet = 'general' } = $props();

  const ONGLETS = [
    { cle: 'general', nom: 'Général' },
    { cle: 'physiologie', nom: 'Physiologie' },
    { cle: 'zones', nom: 'Zones' },
    { cle: 'connexions', nom: 'Connexions' },
    { cle: 'preferences', nom: 'Préférences' },
    { cle: 'confidentialite', nom: 'Confidentialité' },
  ];
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = userId;
    untrack(() => chargerProfilStore(u, demo));
  });

  // Connexions, Préférences et Confidentialité ne dépendent pas du profil : elles s'affichent tout de suite
  const besoinProfil = $derived(!['preferences', 'connexions', 'confidentialite'].includes(onglet));
</script>

<div class="page">
  <EnTete actif="parametres" {demo} />

  <h1 class="titre">Paramètres</h1>

  <div class="disposition">
    <nav class="onglets" aria-label="Sections des paramètres">
      {#each ONGLETS as o (o.cle)}
        <a href="#/parametres/{o.cle}" aria-current={onglet === o.cle ? 'page' : undefined}>{o.nom}</a>
      {/each}
    </nav>

    <div class="contenu">
      {#if besoinProfil && profil.chargement}
        <p class="info" role="status">Chargement…</p>
      {:else if besoinProfil && profil.erreur}
        <p class="alerte" role="alert">{profil.erreur}</p>
      {:else if onglet === 'general'}
        <General {demo} {userId} />
      {:else if onglet === 'physiologie'}
        <Physiologie {demo} {userId} />
      {:else if onglet === 'zones'}
        <Zones />
      {:else if onglet === 'connexions'}
        <Connexions {demo} />
      {:else if onglet === 'confidentialite'}
        <Confidentialite />
      {:else}
        <Preferences />
      {/if}
    </div>
  </div>
</div>

<style>
  h1 {
    margin: 4px 0 20px;
    font-size: clamp(36px, 6vw, 52px);
    line-height: 1.05;
  }
  .disposition {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }
  .onglets {
    position: sticky;
    top: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .onglets a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 14px;
    border-radius: var(--rayon);
    font-size: 15px;
    color: var(--texte-doux);
  }
  .onglets a:hover {
    background: var(--surface);
    color: var(--texte);
  }
  .onglets a[aria-current='page'] {
    background: var(--surface);
    color: var(--texte);
    font-weight: 700;
  }
  .contenu {
    min-width: 0;
  }
  .info {
    color: var(--texte-doux);
  }
  .alerte {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }
  @media (max-width: 900px) {
    .disposition {
      grid-template-columns: 1fr;
    }
    .onglets {
      position: static;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
    }
    .onglets a {
      border: 1px solid var(--trait-fort);
      border-radius: 999px;
    }
    .onglets a[aria-current='page'] {
      background: var(--texte);
      color: var(--fond);
      border-color: var(--texte);
    }
  }
</style>
