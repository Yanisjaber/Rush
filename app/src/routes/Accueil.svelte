<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import ChipSport from '../lib/components/ChipSport.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import CadreEdition from '../lib/widgets/CadreEdition.svelte';
  import BibliothequeWidgets from '../lib/widgets/BibliothequeWidgets.svelte';
  import { COMPOSANTS } from '../lib/widgets/composants.js';
  import { disponibles, disponiblesOnglet, composerOnglet, ONGLETS_PERSONNALISABLES } from '../lib/widgets/registre.js';
  import { SPORTS } from '../lib/sports.js';
  import Onboarding from '../lib/components/Onboarding.svelte';
  import { sportsChoisis, chargerSportsChoisis } from '../lib/stores/sports.svelte.js';
  import { onboardingNecessaire, fusionnerFamilles } from '../lib/data/sports-choisis.js';
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
    chargerProfil, chargerMetriques, chargerSeances, chargerObjectifs, chargerPuissance, chargerPlanifiees,
    chargerSeriesForce, chargerProgrammes, chargerExercicesPerso, chargerTestsHyrox, chargerObjectifHyrox,
  } from '../lib/data/api.js';
  import { donneesDemo, programmesDemo, seriesForceDemo, testsHyroxDemo, objectifHyroxDemo } from '../lib/data/demo.js';
  import { chargeParSemaine, formeActuelle, seancesForce } from '../lib/data/synthese.js';
  import { programmeDuJour } from '../lib/data/force.js';
  import { accrocheMuscu, accrocheHyrox } from '../lib/data/accroche.js';
  import { familleSport } from '../lib/data/familles.js';
  import { dateIsoLocale } from '../lib/utils/format.js';
  import { familleAffichage } from '../lib/data/familles.js';

  let { demo = false } = $props();

  const forceVide = { series: [], programmes: [], exercicesPerso: [] };
  const hyroxVide = { tests: [], objectif: null };
  let etat = $state({
    chargement: true, erreur: '', erreurSport: '', profil: null, metriques: [], seances: [], objectifs: [], puissance: [], planifiees: [],
    force: forceVide, hyrox: hyroxVide,
  });
  let filtre = $state('tout');

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
      demarrerEdition();
    }
  }

  async function charger(userId) {
    etat.chargement = true;
    etat.erreur = '';
    if (demo) {
      Object.assign(etat, donneesDemo());
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
    const [profil, metriques, seances, objectifs, puissance, series, programmes, exercices, tests, objectifHyrox, prevues] = await Promise.all([
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
    ]);
    etat.profil = profil.data;
    etat.metriques = metriques.data || [];
    etat.seances = seances.data || [];
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
      onboardingNecessaire({
        demo,
        sportsEnregistres: sportsChoisis.liste,
        nbSeances: etat.seances.length,
        aForce: etat.force.programmes.length > 0 || etat.force.series.length > 0,
        aHyrox: etat.hyrox.tests.length > 0 || !!etat.hyrox.objectif,
      }),
  );
  const prenom = $derived(etat.profil?.extras?.first_name || auth.session?.user?.email?.split('@')[0] || '');
  const familles = $derived(famillesDe(etat.seances, etat.force, etat.hyrox, etat.objectifs));
  // Le filtre doit rester un sport que l'utilisateur pratique (sinon on revient sur « Tout »)
  const filtreActif = $derived(filtre === 'tout' || familles.includes(filtre) ? filtre : 'tout');
  const seancesVisibles = $derived(filtreActif === 'tout' ? etat.seances : etat.seances.filter((s) => familleAffichage(s.sport) === filtreActif));
  // Ce que reçoit chaque widget : toujours la même enveloppe, filtrée par le sport choisi
  const contexte = $derived({
    seances: seancesVisibles,
    toutesSeances: etat.seances,
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
  const ongletRiche = $derived(ONGLETS_PERSONNALISABLES.includes(filtreActif));
  const nomOngletEdition = $derived(disposition.ongletEdition !== 'tout' ? (SPORTS[disposition.ongletEdition] || SPORTS.autre).court : ''); // « Muscu », « Hyrox »
  const idsBibliotheque = $derived(
    disposition.ongletEdition !== 'tout' ? disponiblesOnglet(listeEnEdition, disposition.ongletEdition) : disponibles(disposition, familles),
  );
  const accrocheSport = $derived.by(() => {
    if (filtreActif === 'muscu') {
      return accrocheMuscu({
        serie: seancesForce(etat.seances).serie,
        series: etat.force.series,
        programme: programmeDuJour(etat.force.programmes, etat.seances),
      });
    }
    if (filtreActif === 'hyrox') {
      return accrocheHyrox({
        objectif: etat.objectifs.find((o) => familleSport(o.sport) === 'hyrox') || null,
        test: etat.hyrox.tests[0] || null,
        cible: etat.hyrox.objectif,
      });
    }
    return '';
  });
  const forme = $derived(formeActuelle(etat.metriques));
  const chargeSemaine = $derived(
    chargeParSemaine(seancesVisibles).series.reduce((s, serie) => s + (serie.valeurs[serie.valeurs.length - 1] || 0), 0),
  );
</script>

<main class="page">
  <EnTete actif="accueil" {demo} />
  {#if afficherOnboarding}
    <Onboarding userId={userId} onTermine={() => mettreAJourSports(familles)} />
  {:else}
  <nav class="puces" aria-label="Filtrer par sport">
    <ChipSport label="Tout" sport="autre" actif={filtreActif === 'tout'} onclick={() => (filtre = 'tout')} />
    {#each familles as f}
      <ChipSport sport={f} actif={filtreActif === f} onclick={() => (filtre = f)} />
    {/each}
    {#if !disposition.enEdition && !etat.chargement}
      <span class="espace"></span>
      <Bouton variante="discret" onclick={() => demarrerEdition(filtreActif)}>{ongletRiche ? `Personnaliser l'onglet ${(SPORTS[filtreActif] || SPORTS.autre).court}` : "Personnaliser l'accueil"}</Bouton>
    {/if}
  </nav>

  {#if disposition.enEdition}
    <section class="bandeau-edition" aria-label="Mode édition">
      <div class="texte">
        <div class="titre">Mode édition{nomOngletEdition ? ` : onglet ${nomOngletEdition}` : ''}</div>
        <p>Monte, descends, redimensionne ou retire les widgets. Ajoute-en depuis la bibliothèque en bas.</p>
      </div>
      <div class="actions">
        <Bouton variante="texte" onclick={reinitialiserAuto}>{nomOngletEdition ? 'Revenir à la composition par défaut de cet onglet' : "Revenir à l'accueil automatique"}</Bouton>
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
    {#if etat.erreurSport && (filtreActif === 'muscu' || filtreActif === 'hyrox')}<p class="alerte" role="alert">{etat.erreurSport}</p>{/if}

    <section class="accroche">
      <h1 class="titre">Salut{prenom ? ` ${prenom}` : ''}.</h1>
      {#if accrocheSport}
        <p>{accrocheSport}</p>
      {:else if forme}
        <p>
          Ta forme est de <strong class="ok">{forme.tsb > 0 ? '+' : ''}{forme.tsb}</strong> ({forme.libelle.toLowerCase()}).
          {#if chargeSemaine}Tu as encaissé <strong>{chargeSemaine} points de charge</strong> ces 7 derniers jours.{/if}
        </p>
      {:else}
        <p>Dès que tes séances sont synchronisées, ta forme et ta charge s'affichent ici.</p>
      {/if}
    </section>

    {#if widgetsAffiches.length}
      <div class="grille">
        {#each widgetsAffiches as w, i (w.id)}
          {@const Composant = COMPOSANTS[w.id]}
          <div class="cellule t-{w.taille}">
            {#if disposition.enEdition}
              <CadreEdition
                id={w.id}
                taille={w.taille}
                index={i}
                total={widgetsAffiches.length}
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
        <BibliothequeWidgets ids={idsBibliotheque} {familles} onAjouter={ajouter} />
      </div>
    {/if}
  {/if}
  {/if}
</main>

<style>
  .puces {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  /* pousse le bouton « Personnaliser » à droite des puces de sport */
  .espace {
    flex: 1;
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

</style>
