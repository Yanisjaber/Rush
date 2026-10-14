<script>
  import { untrack } from 'svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import CadreEdition from '../lib/widgets/CadreEdition.svelte';
  import BibliothequeWidgets from '../lib/widgets/BibliothequeWidgets.svelte';
  import { COMPOSANTS } from '../lib/widgets/composants.js';
  import { disponibles, disponiblesOnglet, composerOnglet, ONGLETS_PERSONNALISABLES } from '../lib/widgets/registre.js';
  import { SPORTS } from '../lib/sports.js';
  import SelecteurSport from '../lib/components/SelecteurSport.svelte';
  import Ecran from '../lib/components/Ecran.svelte';
  import ParcoursDemarrage from '../lib/components/ParcoursDemarrage.svelte';
  import Onboarding from '../lib/components/Onboarding.svelte';
  import { sportsChoisis, chargerSportsChoisis } from '../lib/stores/sports.svelte.js';
  import { onboardingNecessaire, fusionnerFamilles } from '../lib/data/sports-choisis.js';
  import { menu, chargerMenu } from '../lib/stores/menu.svelte.js';
  import { route, ouvrirPanneau, fermerPanneau } from '../lib/routeur.svelte.js';
  import { construireAdresse, SOUS_ACCUEIL } from '../lib/data/adresses.js';
  import { ANALYSE_DU_WIDGET } from '../lib/analyse/registre.js';
  import { WIDGETS } from '../lib/widgets/registre.js';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { donnees } from '../lib/stores/edition.svelte.js';
  import {
    disposition,
    chargerDisposition,
    demarrerEdition,
    annulerEdition,
    terminerEdition,
    reinitialiserAuto,
    mettreAJourSports,
    deplacer,
    retirer,
    ajouter,
    changerTaille,
  } from '../lib/stores/disposition.svelte.js';
  import {
    chargerProfil, chargerMetriques, chargerSeances, chargerDernieresSeances, chargerObjectifs, chargerPuissance, chargerPlanifiees,
    chargerSeriesForce, chargerProgrammes, chargerExercicesPerso, chargerTestsHyrox, chargerObjectifHyrox,
  } from '../lib/data/api.js';
  import { donneesDemo, programmesDemo, seriesForceDemo, testsHyroxDemo, objectifHyroxDemo } from '../lib/data/demo.js';
  import { dateIsoLocale } from '../lib/utils/format.js';
  import { familleAffichage } from '../lib/data/familles.js';

  let { demo = false } = $props();

  const forceVide = { series: [], programmes: [], exercicesPerso: [] };
  const hyroxVide = { tests: [], objectif: null };
  let etat = $state({
    chargement: true, erreur: '', erreurSport: '', profil: null, metriques: [], seances: [], dernieres: [], objectifs: [], puissance: [], planifiees: [],
    force: forceVide, hyrox: hyroxVide,
  });
  const filtre = $derived(menu.filtre); // le choix se fait dans l'en-tête (ordinateur) ou le sélecteur « Voir » (téléphone)

  // Sports de l'utilisateur : ceux de ses séances, plus la muscu s'il a un programme ou des séries, plus Hyrox s'il a un test ou un objectif Hyrox
  const famillesDe = (seances, force = forceVide, hyrox = hyroxVide, objectifs = []) => {
    const f = new Set(seances.map((s) => familleAffichage(s.sport)));
    if (force.programmes.length || force.series.length) f.add('muscu');
    if (hyrox.tests.length || hyrox.objectif || objectifs.some((o) => familleAffichage(o.sport) === 'hyrox')) f.add('hyrox');
    return fusionnerFamilles([...f], sportsChoisis.liste);
  };

  /** Fin du chargement : ouvre le mode édition si on arrive depuis les paramètres. */
  function terminerChargement() {
    etat.chargement = false;
    if (disposition.editionDemandee) {
      disposition.editionDemandee = false;
      ouvrirPanneau({ edition: '1' }); // le mode édition est dans l'adresse (?edition=1) : l'effet plus bas le démarre
    }
  }

  async function charger(userId) {
    etat.chargement = true;
    etat.erreur = '';
    if (demo) {
      Object.assign(etat, donneesDemo());
      etat.dernieres = etat.seances;
      etat.force = { series: seriesForceDemo(), programmes: programmesDemo(), exercicesPerso: [] };
      etat.hyrox = { tests: testsHyroxDemo(), objectif: objectifHyroxDemo() };
      etat.erreurSport = '';
      await chargerSportsChoisis('demo');
      await chargerDisposition('demo', famillesDe(etat.seances, etat.force, etat.hyrox, etat.objectifs));
      terminerChargement();
      return;
    }
    if (!userId) return;
    await chargerSportsChoisis(userId); // avant la disposition : les sports choisis comptent pour composer l'accueil
    const [profil, metriques, seances, objectifs, puissance, series, programmes, exercices, tests, objectifHyrox, prevues, dernieres] = await Promise.all([
      chargerProfil(userId),
      chargerMetriques(userId),
      chargerSeances(userId),
      chargerObjectifs(userId, 10),
      chargerPuissance(userId),
      chargerSeriesForce(userId),
      chargerProgrammes(userId),
      chargerExercicesPerso(userId),
      chargerTestsHyrox(userId),
      chargerObjectifHyrox(userId),
      chargerPlanifiees(userId, dateIsoLocale(), dateIsoLocale(new Date(Date.now() + 60 * 86400e3))), // séances prévues des 60 prochains jours
      chargerDernieresSeances(userId), // sans limite de date : la liste « Dernières séances » ne se vide pas pendant une pause
    ]);
    etat.profil = profil.data;
    etat.metriques = metriques.data || [];
    etat.seances = seances.data || [];
    etat.dernieres = dernieres.data || []; // non bloquant : sans elles, l'accueil s'affiche quand même
    etat.objectifs = objectifs.data || [];
    etat.puissance = puissance.data || [];
    etat.planifiees = prevues.data || []; // non bloquant : sans elles, l'accueil s'affiche quand même
    etat.erreur = [profil, metriques, seances, objectifs, puissance].map((r) => r.erreur).find(Boolean) || '';
    // Force et Hyrox : tables ajoutées par la migration 2026-10-13. Si elle n'est pas appliquée, on affiche l'accueil quand même.
    etat.force = { series: series.data || [], programmes: programmes.data || [], exercicesPerso: exercices.data || [] };
    etat.hyrox = { tests: tests.data || [], objectif: objectifHyrox.data || null };
    etat.erreurSport = [series, programmes, exercices, tests, objectifHyrox].some((r) => r.erreur)
      ? "Le carnet de force et le suivi Hyrox ne répondent pas : la migration « force_hyrox » n'est peut-être pas appliquée sur ta base."
      : '';
    await chargerDisposition(userId, famillesDe(etat.seances, etat.force, etat.hyrox, etat.objectifs));
    terminerChargement();
  }
  // L'effet ne dépend QUE de l'identité de l'utilisateur. Tout ce que `charger` lit ou écrit dans `etat`
  // est isolé par `untrack` : sinon l'effet se déclencherait lui-même en boucle (il écrit etat.seances,
  // puis le relit).
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const id = userId;
    void donnees.version; // se recharge quand une sortie est créée, retouchée ou supprimée
    untrack(() => charger(id));
  });

  // --- Données dérivées ---
  // Compte neuf (aucune donnée, sports jamais demandés) : on propose de choisir ses sports avant d'afficher l'accueil
  const afficherOnboarding = $derived(
    !etat.chargement &&
      !etat.erreur && // si le chargement a échoué, un compte existant ressemblerait à un compte vide : on ne propose rien
      onboardingNecessaire({
        demo,
        sportsEnregistres: sportsChoisis.liste,
        nbSeances: etat.seances.length,
        aForce: etat.force.programmes.length > 0 || etat.force.series.length > 0,
        aHyrox: etat.hyrox.tests.length > 0 || !!etat.hyrox.objectif,
      }),
  );
  const familles = $derived(famillesDe(etat.seances, etat.force, etat.hyrox, etat.objectifs));
  // Le filtre doit rester un sport que l'utilisateur pratique (sinon on revient sur « Tout »)
  const filtreActif = $derived(filtre === 'tout' || familles.includes(filtre) || menu.familles.includes(filtre) ? filtre : 'tout');
  const seancesVisibles = $derived(filtreActif === 'tout' ? etat.seances : etat.seances.filter((s) => familleAffichage(s.sport) === filtreActif));
  // Ce que reçoit chaque widget : toujours la même enveloppe, filtrée par le sport choisi
  const contexte = $derived({
    seances: seancesVisibles,
    toutesSeances: etat.seances,
    dernieres: filtreActif === 'tout' ? etat.dernieres : etat.dernieres.filter((s) => familleAffichage(s.sport) === filtreActif),
    metriques: etat.metriques,
    objectifs: etat.objectifs,
    planifiees: etat.planifiees.filter((p) => filtreActif === 'tout' || familleAffichage(p.sport) === filtreActif),
    profil: etat.profil,
    puissance: etat.puissance,
    hrMax: etat.profil?.hr_max || null,
    filtre: filtreActif,
    force: etat.force,
    hyrox: etat.hyrox,
  });

  // Widgets affichés : tous ceux de ta disposition sur l'onglet « Tout » (et pendant l'édition) ; sur un onglet de sport,
  // la composition de ce sport (muscu et Hyrox ont la leur, voir registre.js).
  // Pendant l'édition, on voit la liste qu'on modifie : celle de l'onglet « Tout », ou la composition propre d'un onglet Muscu / Hyrox.
  const listeEnEdition = $derived(
    disposition.ongletEdition !== 'tout' && disposition.onglets[disposition.ongletEdition] ? disposition.onglets[disposition.ongletEdition] : disposition.widgets,
  );
  const widgetsAffiches = $derived(
    disposition.enEdition
      ? listeEnEdition
      : filtreActif === 'tout'
        ? disposition.widgets
        : composerOnglet(disposition.widgets, filtreActif, disposition.onglets),
  );
  // Compte neuf (aucune séance, rien de prévu, aucun objectif) : parcours de démarrage + seulement objectif / semaine / à venir
  const compteVide = $derived(
    !demo && !etat.chargement && !etat.erreur && !etat.seances.length && !etat.planifiees.length && !etat.objectifs.length,
  );
  const widgetsVisibles = $derived(
    compteVide && !disposition.enEdition ? widgetsAffiches.filter((w) => ['objectif', 'semaine', 'avenir'].includes(w.id)) : widgetsAffiches,
  );
  // Muscu et Hyrox n'ont pas de page à eux : sur leur filtre, l'accueil a deux vues, « Vue d'ensemble » (widgets) et le détail
  // (programmes, journal, exercices pour la muscu ; tests et objectif pour Hyrox).
  const sportAvecDetail = $derived(Object.hasOwn(SOUS_ACCUEIL, filtreActif));
  // La vue détaillée est dans l'adresse (#/muscu/journal, #/hyrox/tests) : l'adresse décide, rien n'est retenu en local
  const sousDetail = $derived(sportAvecDetail && route.chemin === '/' && SOUS_ACCUEIL[filtreActif].includes(route.sous) ? route.sous : '');
  const enDetail = $derived(!!sousDetail && !disposition.enEdition);
  const ongletRiche = $derived(ONGLETS_PERSONNALISABLES.includes(filtreActif));
  const nomOngletEdition = $derived(disposition.ongletEdition !== 'tout' ? (SPORTS[disposition.ongletEdition] || SPORTS.autre).court : ''); // « Muscu », « Hyrox »
  const idsBibliotheque = $derived(
    disposition.ongletEdition !== 'tout' ? disponiblesOnglet(listeEnEdition, disposition.ongletEdition) : disponibles(disposition, familles),
  );

  // Le mode édition est dans l'adresse (?edition=1) : on le démarre quand elle le demande (arrivée, rechargement),
  // on l'abandonne si le bouton Retour la ramène sans (les boutons Terminer et Annuler s'en occupent eux-mêmes).
  $effect(() => {
    const veut = route.q.edition === '1' && route.chemin === '/';
    const pret = !etat.chargement && disposition.pret;
    untrack(() => {
      if (veut && pret && !disposition.enEdition) demarrerEdition(filtreActif);
      else if (!veut && disposition.enEdition) annulerEdition();
    });
  });
</script>

<main class="page">
  <h1 class="invisible">Accueil</h1> <!-- titre de la page pour les lecteurs d'écran, sans le montrer -->
  {#if afficherOnboarding}
    <Onboarding userId={userId} onTermine={() => { mettreAJourSports(familles); chargerMenu(userId); }} />
  {:else}
  <SelecteurSport />

  {#if disposition.enEdition}
    <section class="bandeau-edition" aria-label="Mode édition">
      <div class="texte">
        <div class="titre">Mode édition{nomOngletEdition ? ` : onglet ${nomOngletEdition}` : ''}</div>
        <p>Monte, descends, redimensionne ou retire les widgets. Ajoute-en depuis la bibliothèque en bas.</p>
      </div>
      <div class="actions">
        <Bouton variante="texte" onclick={async () => { await reinitialiserAuto(); fermerPanneau('edition'); }}>{nomOngletEdition ? 'Revenir à la composition par défaut de cet onglet' : "Revenir à l'accueil automatique"}</Bouton>
        <Bouton variante="discret" onclick={() => { annulerEdition(); fermerPanneau('edition'); }}>Annuler</Bouton>
        <Bouton variante="sur-dossard" onclick={async () => { const fin = terminerEdition(); fermerPanneau('edition'); await fin; }}>Terminer</Bouton>
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
    {#if etat.erreurSport && (filtreActif === 'muscu' || filtreActif === 'hyrox')}<p class="alerte" role="alert">{etat.erreurSport}</p>{/if}


    {#if sportAvecDetail && !disposition.enEdition}
      <nav class="vues" aria-label="Vues {(SPORTS[filtreActif] || SPORTS.autre).court}">
        <a href={construireAdresse({ sport: filtreActif })} aria-current={!sousDetail ? 'page' : undefined}>Vue d'ensemble</a>
        <a href={construireAdresse({ sport: filtreActif, sous: SOUS_ACCUEIL[filtreActif][0] })} aria-current={sousDetail ? 'page' : undefined}>
          {filtreActif === 'muscu' ? 'Programmes, journal, exercices' : 'Tests et objectif'}
        </a>
      </nav>
    {/if}

    {#if compteVide && !disposition.enEdition}<ParcoursDemarrage />{/if}
    {#if enDetail}
      {#if filtreActif === 'muscu'}
        <Ecran charger={() => import('./Force.svelte')} {demo} integre={true} onglet={sousDetail} />
      {:else}
        <Ecran charger={() => import('./Hyrox.svelte')} {demo} integre={true} />
      {/if}
    {:else if widgetsVisibles.length}
      <div class="grille">
        {#each widgetsVisibles as w, i (w.id)}
          {@const Composant = COMPOSANTS[w.id]}
          <div class="cellule t-{w.taille}">
            {#if disposition.enEdition}
              <CadreEdition
                id={w.id}
                taille={w.taille}
                index={i}
                total={widgetsVisibles.length}
                onDeplacer={deplacer}
                onTaille={changerTaille}
                onRetirer={retirer}
              >
                <Composant {contexte} taille={w.taille} />
              </CadreEdition>
            {:else}
              <Composant {contexte} taille={w.taille} />
              {#if ANALYSE_DU_WIDGET[w.id]}
                <!-- Le widget entier est une porte vers sa page d'analyse (les liens et boutons du widget restent au-dessus) -->
                <a class="porte" href={construireAdresse({ sport: filtreActif, page: '/analyse', sous: ANALYSE_DU_WIDGET[w.id] })} aria-label="Ouvrir l'analyse : {WIDGETS[w.id]?.nom || w.id}"></a>
                <span class="indice" aria-hidden="true">Analyse ›</span>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="vide">Ton accueil est vide. Passe en mode personnalisation pour y ajouter des widgets.</p>
    {/if}

    {#if disposition.enEdition}
      <div class="bibliotheque">
        <BibliothequeWidgets ids={idsBibliotheque} {familles} onAjouter={ajouter} />
      </div>
    {/if}

    {#if !disposition.enEdition && !etat.chargement && !enDetail}
      <div class="pied">
        <Bouton variante="discret" onclick={() => ouvrirPanneau({ edition: '1' })}>{ongletRiche ? `Personnaliser l'onglet ${(SPORTS[filtreActif] || SPORTS.autre).court}` : "Personnaliser l'accueil"}</Bouton>
      </div>
    {/if}
  {/if}
  {/if}
</main>

<style>
  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* Un widget qui a une page d'analyse est cliquable en entier */
  .cellule {
    position: relative;
  }
  .porte {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: var(--rayon);
  }
  .porte:hover + .indice,
  .porte:focus-visible + .indice {
    opacity: 1;
  }
  .porte:focus-visible {
    outline: 3px solid var(--texte);
    outline-offset: 2px;
  }
  .cellule :global(a:not(.porte)),
  .cellule :global(button) {
    position: relative;
    z-index: 2;
  }
  .indice {
    position: absolute;
    top: 14px;
    right: 18px;
    z-index: 2;
    padding: 3px 10px;
    border-radius: var(--rayon-rond);
    background: var(--texte);
    color: var(--fond);
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }
  @media (hover: none) {
    .indice {
      opacity: 0.85; /* sur téléphone, pas de survol : l'indication reste visible */
    }
  }
  .vues {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 16px;
  }
  .vues a {
    min-height: var(--cible);
    padding: 0 16px;
    border: 1px solid var(--trait);
    border-radius: var(--rayon-rond);
    background: transparent;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--texte-doux);
    display: inline-flex;
    align-items: center;
  }
  .vues a[aria-current='page'] {
    background: var(--surface-2);
    border-color: var(--trait-fort);
    color: var(--texte);
  }
  /* le bouton « Personnaliser » est en bas de page, aligné à droite */
  .pied {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
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

</style>
