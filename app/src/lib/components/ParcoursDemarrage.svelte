<script>
  // Compte neuf, cartes vides : au lieu d'un accueil plein de « pas de données », on propose les 4 premières étapes.
  const etapes = [
    { href: '#/parametres/connexions', titre: 'Connecter Strava', texte: 'Tes sorties arrivent toutes seules.' },
    { href: '#/plan', titre: 'Planifier une première séance', texte: 'Pose ce que tu comptes faire cette semaine.' },
    { href: '#/competitions', titre: 'Ajouter un objectif', texte: 'Une course, un défi : le compte à rebours démarre.' },
    { href: '#/parametres/general', titre: 'Renseigner ton profil', texte: 'Poids, FC max, FTP : les zones se calculent.' },
  ];
</script>

<section class="parcours" aria-label="Pour démarrer">
  <h2 class="titre">Pour démarrer</h2>
  <ol>
    {#each etapes as e, i (e.href)}
      <li>
        <a href={e.href}>
          <span class="num titre" aria-hidden="true">{i + 1}</span>
          <span class="corps"><strong>{e.titre}</strong><span>{e.texte}</span></span>
        </a>
      </li>
    {/each}
  </ol>
</section>

<style>
  .parcours {
    margin-bottom: 20px;
    padding: 22px 24px;
    background: var(--surface);
    border-radius: var(--rayon);
  }
  h2 {
    margin-bottom: 14px;
    font-size: 20px;
  }
  ol {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  a {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 44px;
    padding: 12px 14px;
    color: var(--texte);
    text-decoration: none;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
  }
  a:hover {
    border-color: var(--texte-doux);
  }
  .num {
    flex: none;
    font-size: 28px;
    line-height: 1;
    color: var(--texte-doux);
  }
  .corps {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .corps strong {
    font-size: 15px;
    color: var(--texte);
  }
</style>
