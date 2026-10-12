<script>
  import { untrack } from 'svelte';
  import ChipSport from '../lib/components/ChipSport.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import CadreEdition from '../lib/widgets/CadreEdition.svelte';
  import BibliothequeWidgets from '../lib/widgets/BibliothequeWidgets.svelte';
  import { COMPOSANTS } from '../lib/widgets/composants.js';
  import { disponibles } from '../lib/widgets/registre.js';
  import { auth, deconnexion } from '../lib/stores/auth.svelte.js';
  import {
    disposition,
    chargerDisposition,
    demarrerEdition,
    annulerEdition,
    terminerEdition,
    reinitialiserAuto,
    deplacer,
    retirer,
    ajouter,
    changerTaille,
  } from '../lib/stores/disposition.svelte.js';
  import { chargerProfil, chargerMetriques, chargerSeances, chargerObjectifs } from '../lib/data/api.js';
  import { donneesDemo } from '../lib/data/demo.js';
  import { chargeParSemaine, formeActuelle } from '../lib/data/synthese.js';
  import { familleAffichage } from '../lib/data/familles.js';

  let { demo = false } = $props();

  let etat = $state({ chargement: true, erreur: '', profil: null, metriques: [], seances: [], objectifs: [] });
  let filtre = $state('tout');

  const famillesDe = (seances) => [...new Set(seances.map((s) => familleAffichage(s.sport)))].filter((f) => f !== 'autre');

  async function charger(userId) {
    etat.chargement = true;
    etat.erreur = '';
    if (demo) {
      Object.assign(etat, donneesDemo());
      await chargerDisposition('demo', famillesDe(etat.seances));
      etat.chargement = false;
      return;
    }
    if (!userId) return;
    const [profil, metriques, seances, objectifs] = await Promise.all([
      chargerProfil(userId),
      chargerMetriques(userId),
      chargerSeances(userId),
      chargerObjectifs(userId),
    ]);
    etat.profil = profil.data;
    etat.metriques = metriques.data || [];
    etat.seances = seances.data || [];
    etat.objectifs = objectifs.data || [];
    etat.erreur = [profil, metriques, seances, objectifs].map((r) => r.erreur).find(Boolean) || '';
    await chargerDisposition(userId, famillesDe(etat.seances));
    etat.chargement = false;
  }
  // L'effet ne dépend QUE de l'identité de l'utilisateur. Tout ce que `charger` lit ou écrit dans `etat`
  // est isolé par `untrack` : sinon l'effet se déclencherait lui-même en boucle (il écrit etat.seances,
  // puis le relit).
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const id = userId;
    untrack(() => charger(id));
  });

  // --- Données dérivées ---
  const prenom = $derived(etat.profil?.display_name || auth.session?.user?.email?.split('@')[0] || '');
  const familles = $derived(famillesDe(etat.seances));
  const seancesVisibles = $derived(filtre === 'tout' ? etat.seances : etat.seances.filter((s) => familleAffichage(s.sport) === filtre));
  // Ce que reçoit chaque widget : toujours la même enveloppe, filtrée par le sport choisi
  const contexte = $derived({
    seances: seancesVisibles,
    toutesSeances: etat.seances,
    metriques: etat.metriques,
    objectifs: etat.objectifs,
    profil: etat.profil,
    filtre,
  });
  const forme = $derived(formeActuelle(etat.metriques));
  const chargeSemaine = $derived(
    chargeParSemaine(seancesVisibles).series.reduce((s, serie) => s + (serie.valeurs[serie.valeurs.length - 1] || 0), 0),
  );
</script>

<div class="page">
  <header class="barre">
    <div class="gauche">
      <span class="logo titre" aria-hidden="true">CI</span>
      <nav class="puces" aria-label="Filtrer par sport">
        <ChipSport label="Tout" sport="autre" actif={filtre === 'tout'} onclick={() => (filtre = 'tout')} />
        {#each familles as f}
          <ChipSport sport={f} actif={filtre === f} onclick={() => (filtre = f)} />
        {/each}
      </nav>
    </div>
    <div class="droite">
      {#if demo}
        <span class="etiquette-demo">Mode démo</span>
      {/if}
      {#if !etat.chargement && !disposition.enEdition}
        <Bouton variante="discret" onclick={demarrerEdition}>Personnaliser</Bouton>
      {/if}
      {#if demo}
        <Bouton variante="discret" href="./">Se connecter</Bouton>
      {:else}
        <Bouton variante="discret" onclick={deconnexion}>Se déconnecter</Bouton>
      {/if}
    </div>
  </header>

  {#if disposition.enEdition}
    <section class="bandeau-edition" aria-label="Mode édition">
      <div class="texte">
        <div class="titre">Mode édition</div>
        <p>Monte, descends, redimensionne ou retire les widgets. Ajoute-en depuis la bibliothèque en bas.</p>
      </div>
      <div class="actions">
        <Bouton variante="texte" onclick={reinitialiserAuto}>Revenir à l'accueil automatique</Bouton>
        <Bouton variante="discret" onclick={annulerEdition}>Annuler</Bouton>
        <Bouton variante="sur-dossard" onclick={terminerEdition}>Terminer</Bouton>
      </div>
    </section>
  {/if}

  {#if disposition.message && !disposition.enEdition}
    <p class="message" role="status">{disposition.message}</p>
  {/if}

  {#if etat.chargement}
    <p class="info" role="status">Chargement de tes données…</p>
  {:else}
    {#if etat.erreur}<p class="alerte" role="alert">{etat.erreur}</p>{/if}

    <section class="accroche">
      <h1 class="titre">Salut{prenom ? ` ${prenom}` : ''}.</h1>
      {#if forme}
        <p>
          Ta forme est de <strong class="ok">{forme.tsb > 0 ? '+' : ''}{forme.tsb}</strong> ({forme.libelle.toLowerCase()}).
          {#if chargeSemaine}Tu as encaissé <strong>{chargeSemaine} points de charge</strong> ces 7 derniers jours.{/if}
        </p>
      {:else}
        <p>Dès que tes séances sont synchronisées, ta forme et ta charge s'affichent ici.</p>
      {/if}
    </section>

    {#if disposition.widgets.length}
      <div class="grille">
        {#each disposition.widgets as w, i (w.id)}
          {@const Composant = COMPOSANTS[w.id]}
          <div class="cellule t-{w.taille}">
            {#if disposition.enEdition}
              <CadreEdition
                id={w.id}
                taille={w.taille}
                index={i}
                total={disposition.widgets.length}
                onDeplacer={deplacer}
                onTaille={changerTaille}
                onRetirer={retirer}
              >
                <Composant {contexte} taille={w.taille} />
              </CadreEdition>
            {:else}
              <Composant {contexte} taille={w.taille} />
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="vide">Ton accueil est vide. Passe en mode personnalisation pour y ajouter des widgets.</p>
    {/if}

    {#if disposition.enEdition}
      <div class="bibliotheque">
        <BibliothequeWidgets ids={disponibles(disposition, familles)} {familles} onAjouter={ajouter} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 1360px;
    margin: 0 auto;
    padding: 0 32px 64px;
  }
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
  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .etiquette-demo {
    padding: 6px 10px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    font-size: 12px;
    color: var(--texte-doux);
  }

  .bandeau-edition {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    margin-bottom: 16px;
    padding: 14px 18px;
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    --texte: var(--dossard-texte);
    --texte-doux: var(--dossard-texte);
    border-radius: var(--rayon-l);
  }
  .bandeau-edition .titre {
    font-size: 20px;
    letter-spacing: 0;
  }
  .bandeau-edition p {
    font-size: 13px;
    opacity: 0.8;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  /* Sur le bandeau (clair en thème sombre), les boutons « discret » ont besoin d'un contour foncé */
  .bandeau-edition :global(.discret) {
    color: var(--dossard-texte);
    border-color: var(--dossard-texte);
  }

  .message {
    margin-bottom: 12px;
    font-size: 14px;
    color: var(--ok);
  }
  .accroche {
    padding: 20px 0 28px;
  }
  h1 {
    font-size: clamp(36px, 6vw, 52px);
    line-height: 1;
  }
  .accroche p {
    margin-top: 12px;
    max-width: 720px;
    font-size: 18px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .accroche strong {
    color: var(--texte);
    font-weight: 600;
  }
  .accroche .ok {
    color: var(--ok);
  }

  .info,
  .vide {
    color: var(--texte-doux);
  }
  .alerte {
    padding: 10px 14px;
    margin-bottom: 16px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }

  /* Grille : chaque widget occupe une largeur selon sa taille, et passe à la ligne si l'écran est étroit */
  .grille {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .cellule {
    display: flex;
    min-width: 0;
  }
  .cellule > :global(*) {
    flex: 1;
    min-width: 0;
  }
  .t-s { flex: 1 1 240px; }
  .t-m { flex: 1 1 320px; }
  .t-l { flex: 2 1 560px; }
  .t-xl { flex: 1 1 100%; }

  .bibliotheque {
    margin-top: 24px;
  }

  @media (max-width: 600px) {
    .page {
      padding: 0 16px 48px;
    }
  }
</style>
