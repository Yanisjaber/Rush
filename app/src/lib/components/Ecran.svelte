<script>
  // Charge un écran seulement quand on l'ouvre (découpage du code : l'app s'ouvre plus vite, surtout sur téléphone).
  // `charger` est une fonction `() => import('./routes/XXX.svelte')` ; les autres propriétés sont transmises à l'écran.
  let { charger, ...proprietes } = $props();
  const chargement = $derived(charger());
</script>

{#await chargement}
  <p class="attente" role="status">Chargement…</p>
{:then module}
  {@const Composant = module.default}
  <Composant {...proprietes} />
{:catch}
  <p class="attente" role="alert">Impossible de charger cet écran. Vérifie ta connexion internet, puis recharge la page.</p>
{/await}

<style>
  .attente {
    padding: 48px 32px;
    color: var(--texte-doux);
  }
  /* Téléphone : la page ne se réduit pas pendant le chargement, le menu du bas reste en place sur iPhone */
  @media (max-width: 760px) {
    .attente {
      box-sizing: border-box;
      min-height: 100lvh;
    }
  }
</style>
