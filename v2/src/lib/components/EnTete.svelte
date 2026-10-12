<script>
  // En-tête commun à toutes les pages : logo, navigation principale, zone libre (droite) et réglages.
  // actif : 'accueil' | 'calendrier' | 'plan' | 'force' | 'hyrox' | 'competitions' | 'bilan' | 'sommeil' | 'parametres' (la page courante est signalée aux lecteurs d'écran)
  let { actif = 'accueil', demo = false, droite } = $props();

  const liens = [
    { cle: 'accueil', nom: 'Accueil', href: '#/' },
    { cle: 'calendrier', nom: 'Calendrier', href: '#/calendrier' },
    { cle: 'plan', nom: 'Plan', href: '#/plan' },
    { cle: 'force', nom: 'Force', href: '#/force' },
    { cle: 'hyrox', nom: 'Hyrox', href: '#/hyrox' },
    { cle: 'competitions', nom: 'Compétitions', href: '#/competitions' },
    { cle: 'bilan', nom: 'Bilan', href: '#/bilan' },
    { cle: 'sommeil', nom: 'Sommeil', href: '#/sommeil' },
  ];
</script>

<header class="barre">
  <div class="gauche">
    <span class="logo titre" aria-hidden="true">CI</span>
    <nav class="liens" aria-label="Navigation principale">
      {#each liens as l (l.cle)}
        <a href={l.href} aria-current={actif === l.cle ? 'page' : undefined}>{l.nom}</a>
      {/each}
    </nav>
  </div>
  <div class="droite">
    {#if demo}<span class="etiquette-demo">Mode démo</span>{/if}
    {@render droite?.()}
    <a class="reglages" href="#/parametres" aria-label="Paramètres" aria-current={actif === 'parametres' ? 'page' : undefined}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    </a>
  </div>
</header>

<style>
  .barre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    padding: 20px 0;
  }
  .gauche,
  .droite {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .logo {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    border-radius: var(--rayon);
    font-size: 17px;
    letter-spacing: 0;
  }
  .liens {
    display: flex;
    flex-wrap: wrap; /* sur téléphone, les liens passent à la ligne au lieu de déborder */
    gap: 4px;
    min-width: 0;
  }
  .liens a {
    display: inline-flex;
    align-items: center;
    min-height: var(--cible);
    padding: 0 14px;
    border-radius: var(--rayon-rond);
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
  }
  @media (max-width: 600px) {
    .liens a {
      padding: 0 11px;
    }
  }
  .liens a:hover {
    color: var(--texte);
  }
  .liens a[aria-current='page'] {
    background: var(--surface-2);
    color: var(--texte);
  }
  .reglages {
    width: var(--cible);
    height: var(--cible);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--trait-fort);
    border-radius: 50%;
    color: var(--texte-doux);
  }
  .reglages:hover,
  .reglages[aria-current='page'] {
    color: var(--texte);
  }
  .etiquette-demo {
    padding: 6px 10px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    font-size: 12px;
    color: var(--texte-doux);
  }
</style>
