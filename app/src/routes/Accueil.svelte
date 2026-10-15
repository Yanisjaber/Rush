<script>
  import { untrack } from 'svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import CadreEdition from '../lib/widgets/CadreEdition.svelte';
  import BibliothequeWidgets from '../lib/widgets/BibliothequeWidgets.svelte';
  import { COMPOSANTS } from '../lib/widgets/composants.js';
  import { ecran } from '../lib/stores/ecran.svelte.js';
  import BarreEditionTel from '../lib/widgets/BarreEditionTel.svelte';
  import { disponibles, disponiblesOnglet, composerOnglet, ONGLETS_PERSONNALISABLES } from '../lib/widgets/registre.js';
  import { SPORTS } from '../lib/sports.js';
  import Ecran from '../lib/components/Ecran.svelte';
  import ParcoursDemarrage from '../lib/components/ParcoursDemarrage.svelte';
  import Onboarding from '../lib/components/Onboarding.svelte';
  import { sportsChoisis, chargerSportsChoisis } from '../lib/stores/sports.svelte.js';
  import { onboardingNecessaire, fusionnerFamilles } from '../lib/data/sports-choisis.js';
  import { menu, chargerMenu } from '../lib/stores/menu.svelte.js';
  import { route, ouvrirPanneau, fermerPanneau } from '../lib/routeur.svelte.js';
  import PanneauSeanceDuJour from '../lib/components/PanneauSeanceDuJour.svelte';
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
    deplacerVers,
    ajouter,
    changerTaille,
  } from '../lib/stores/disposition.svelte.js';
  import {
    chargerProfil, chargerMetriques, chargerSeances, chargerDernieresSeances, chargerObjectifs, chargerPuissance, chargerPlanifiees, chargerLiensProgrammes,
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
    const [profil, metriques, seances, objectifs, puissance, series, programmes, exercices, tests, objectifHyrox, prevues, liens, dernieres] = await Promise.all([
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
      chargerLiensProgrammes(userId, dateIsoLocale(), dateIsoLocale(new Date(Date.now() + 60 * 86400e3))), // programme relié à chaque séance prévue (tolérant si la migration n'est pas appliquée)
      chargerDernieresSeances(userId), // sans limite de date : la liste « Dernières séances » ne se vide pas pendant une pause
    ]);
    etat.profil = profil.data;
    etat.metriques = metriques.data || [];
    etat.seances = seances.data || [];
    etat.dernieres = dernieres.data || []; // non bloquant : sans elles, l'accueil s'affiche quand même
    etat.objectifs = objectifs.data || [];
    etat.puissance = puissance.data || [];
    etat.planifiees = (prevues.data || []).map((p) => (liens.data[p.id] ? { ...p, programme_id: liens.data[p.id] } : p)); // non bloquant : sans elles, l'accueil s'affiche quand même
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

  // --- Séance du jour ouverte par-dessus l'accueil ---
  const idSeanceDuJour = $derived(route.q.seancejour || '');
  const prevueOuverte = $derived(idSeanceDuJour ? etat.planifiees.find((p) => p.id === idSeanceDuJour) || null : null);
  const programmeOuvert = $derived(prevueOuverte?.programme_id ? etat.force.programmes.find((p) => p.id === prevueOuverte.programme_id) || null : null);
  // Séance inconnue (supprimée, adresse trompeuse) : une fois les données chargées, on referme proprement l'adresse
  $effect(() => {
    if (!etat.chargement && idSeanceDuJour && !prevueOuverte) untrack(() => fermerPanneau('seancejour'));
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

  // Téléphone, onglet Muscu : les widgets passent en version compacte (4 à 6 d'un coup d'œil, voir chaque widget), y compris en mode
  // Personnaliser. L'ordre reste celui de l'utilisateur ; les tuiles se rangent deux par deux dans une grille « dense » (voir le CSS).
  // Hors téléphone, rien ne change.
  const compactMuscu = $derived(ecran.telephone && filtreActif === 'muscu');
  const TUILES = new Set(['tonnage', 'regularite']);
  // Ces widgets ne se comprennent que grâce à leur graphique (le corps, la courbe de charge) : ils gardent leur version complète
  const GRANDS_TELEPHONE = new Set(['groupes', 'chargemuscu']);
  const compactDe = (id) => compactMuscu && !GRANDS_TELEPHONE.has(id);

  // Personnaliser sur téléphone : on touche un widget pour le sélectionner (la barre du bas de l'écran permet alors de le retirer),
  // et on le MAINTIENT puis on le glisse pour le déplacer, comme sur l'écran d'accueil de l'iPhone.
  let selection = $state('');
  const indexSelection = $derived(widgetsVisibles.findIndex((w) => w.id === selection));
  $effect(() => {
    // le widget choisi a disparu (retiré), ou on a quitté le mode édition : plus de sélection
    if (selection && (indexSelection < 0 || !disposition.enEdition)) selection = '';
  });
  const basculerSelection = (id) => (selection = selection === id ? '' : id);

  // --- Glisser-déposer au doigt ---
  // Maintenir ~0,3 s : le widget se soulève (une copie suit le doigt) ; en le passant sur un autre, les deux changent de place.
  // Avant ce délai, bouger le doigt = défiler la page normalement (le geste est abandonné).
  const DELAI_MAINTIEN = 300; // ms
  const PAUSE_ENTRE_ECHANGES = 180; // ms : le temps que la grille se recompose, sinon deux widgets s'échangent en boucle
  let grilleEl = $state();
  let glisse = $state({ id: '', x: 0, y: 0, rect: { left: 0, top: 0, width: 0, height: 0 } }); // x, y : le déplacement du doigt depuis le début
  let appui = null; // { id, x, y } : où et sur quoi le doigt s'est posé
  let minuteur = 0;
  let doigt = { x: 0, y: 0 };
  let dernierEchange = 0;
  let animation = 0;
  let ignorerClic = false;

  const annulerMaintien = () => {
    clearTimeout(minuteur);
    minuteur = 0;
  };

  function poserDoigt(e, id) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    annulerMaintien();
    appui = { id, x: e.clientX, y: e.clientY, souris: e.pointerType === 'mouse' };
    doigt = { x: e.clientX, y: e.clientY };
    // Doigt : on maintient ~0,3 s (sinon c'est un défilement). Souris : rien à attendre, le glissement part dès que la souris bouge un peu.
    if (!appui.souris) minuteur = setTimeout(commencerGlisse, DELAI_MAINTIEN);
  }

  function commencerGlisse() {
    minuteur = 0;
    const cellule = grilleEl?.querySelector(`.cellule[data-id="${appui?.id}"]`);
    if (!cellule) return;
    const r = cellule.getBoundingClientRect();
    glisse = { id: appui.id, x: 0, y: 0, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    selection = appui.id;
    navigator.vibrate?.(15); // petit retour tactile là où c'est permis (Android) ; sans effet sur iPhone
    animation = requestAnimationFrame(defilerAuBord);
  }

  function bougerDoigt(e) {
    doigt = { x: e.clientX, y: e.clientY };
    if (!glisse.id) {
      if (!appui) return;
      const distance = Math.hypot(e.clientX - appui.x, e.clientY - appui.y);
      if (appui.souris) {
        if (distance > 6 && e.buttons === 1) commencerGlisse(); // la souris est enfoncée et bouge : on attrape le widget
      } else if (minuteur && distance > 10) annulerMaintien(); // le doigt a bougé avant la fin du maintien : c'est un défilement
      if (!glisse.id) return;
    }
    glisse.x = e.clientX - appui.x;
    glisse.y = e.clientY - appui.y;
    echangerSousLeDoigt();
  }

  // Le doigt est sur un autre widget ET a dépassé son milieu dans le sens du déplacement : le widget glissé prend sa place dans la liste.
  // Cette règle du « milieu dépassé » évite qu'un échange en entraîne un autre tout de suite après (les widgets n'ont pas la même hauteur).
  function echangerSousLeDoigt() {
    if (performance.now() - dernierEchange < PAUSE_ENTRE_ECHANGES) return;
    const cellules = [...(grilleEl?.querySelectorAll('.cellule[data-id]') ?? [])];
    const de = cellules.findIndex((c) => c.dataset.id === glisse.id);
    if (de < 0) return;
    const place = cellules[de].getBoundingClientRect();
    for (let i = 0; i < cellules.length; i++) {
      if (i === de) continue;
      const r = cellules[i].getBoundingClientRect();
      const dedans = doigt.x >= r.left && doigt.x <= r.right && doigt.y >= r.top && doigt.y <= r.bottom;
      if (!dedans) continue;
      const apres = i > de; // le widget visé vient après celui qu'on glisse dans la liste
      const memeRangee = Math.abs(r.top - place.top) < 24; // deux tuiles côte à côte : on compare à l'horizontale
      const milieuDepasse = memeRangee
        ? apres ? doigt.x > r.left + r.width / 2 : doigt.x < r.left + r.width / 2
        : apres ? doigt.y > r.top + r.height / 2 : doigt.y < r.top + r.height / 2;
      if (milieuDepasse) {
        deplacerVers(de, i);
        dernierEchange = performance.now();
        return;
      }
    }
  }

  // Près du haut ou du bas de l'écran, la page défile toute seule pour atteindre les autres widgets
  function defilerAuBord() {
    if (!glisse.id) return;
    if (doigt.y < 170) window.scrollBy(0, -10);
    else if (doigt.y > window.innerHeight - 190) window.scrollBy(0, 10);
    echangerSousLeDoigt(); // la page a bougé sous le doigt
    animation = requestAnimationFrame(defilerAuBord);
  }

  function leverDoigt() {
    annulerMaintien();
    cancelAnimationFrame(animation);
    if (glisse.id) {
      ignorerClic = true; // le « clic » qui suit un glissement ne doit pas changer la sélection
      setTimeout(() => (ignorerClic = false), 80);
      glisse.id = '';
    }
    appui = null;
  }

  // Une fois le glissement commencé, le navigateur ne doit plus faire défiler la page sous le doigt
  const bloquerDefilement = (e) => {
    if (glisse.id) e.preventDefault();
  };
  $effect(() => {
    if (!disposition.enEdition) return;
    window.addEventListener('pointermove', bougerDoigt);
    window.addEventListener('pointerup', leverDoigt);
    window.addEventListener('pointercancel', leverDoigt);
    window.addEventListener('touchmove', bloquerDefilement, { passive: false });
    window.addEventListener('blur', leverDoigt); // la souris est relâchée hors de la fenêtre : on repose le widget
    return () => {
      window.removeEventListener('blur', leverDoigt);
      window.removeEventListener('pointermove', bougerDoigt);
      window.removeEventListener('pointerup', leverDoigt);
      window.removeEventListener('pointercancel', leverDoigt);
      window.removeEventListener('touchmove', bloquerDefilement);
      leverDoigt();
    };
  });

  const toucher = (id) => {
    if (!ignorerClic) basculerSelection(id);
  };
  // Au clavier : Entrée ou espace sélectionnent, les flèches haut et bas déplacent le widget (une alternative au glissement)
  function toucheClavier(e, id, index) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      basculerSelection(id);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      deplacer(index, e.key === 'ArrowUp' ? -1 : 1);
    }
  }
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

  {#if disposition.enEdition}
    <section class="bandeau-edition" aria-label="Mode édition">
      <div class="texte">
        <div class="titre">Mode édition{nomOngletEdition ? ` : onglet ${nomOngletEdition}` : ''}</div>
        <p>{ecran.telephone ? 'Touche un widget pour le retirer, maintiens-le et glisse pour le déplacer.' : 'Glisse les widgets pour les déplacer (ou utilise les flèches), redimensionne-les ou retire-les.'} Ajoute-en depuis la bibliothèque en bas.</p>
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


    {#if sportAvecDetail && !disposition.enEdition && filtreActif !== 'muscu'} <!-- Muscu n'a plus de bouton de vue : programmes, exercices et journal s'ouvrent depuis leurs widgets -->
      <nav class="vues" aria-label="Vues {(SPORTS[filtreActif] || SPORTS.autre).court}">
        <a href={construireAdresse({ sport: filtreActif })} aria-current={!sousDetail ? 'page' : undefined}>Vue d'ensemble</a>
        <a href={construireAdresse({ sport: filtreActif, sous: SOUS_ACCUEIL[filtreActif][0] })} aria-current={sousDetail && sousDetail !== 'journal' ? 'page' : undefined}>
          {filtreActif === 'muscu' ? 'Programmes et exercices' : 'Tests et objectif'}
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
      <div class="grille" class:dense={compactMuscu} class:enGlisse={!!glisse.id} bind:this={grilleEl}>
        {#each widgetsVisibles as w, i (w.id)}
          {@const Composant = COMPOSANTS[w.id]}
          <div class="cellule t-{w.taille}" data-id={w.id} class:demi={compactMuscu && TUILES.has(w.id)} class:souleve={glisse.id === w.id}>
            {#if disposition.enEdition && ecran.telephone}
              <!-- Téléphone : le widget garde sa forme finale (même grille, mêmes tuiles) ; un contour montre qu'on peut le choisir -->
              <div
                class="choix"
                class:choisi={selection === w.id}
                role="button"
                tabindex="0"
                aria-pressed={selection === w.id}
                aria-label="Sélectionner {WIDGETS[w.id]?.nom || w.id}. Flèches haut et bas pour le déplacer."
                onpointerdown={(e) => poserDoigt(e, w.id)}
                onclick={() => toucher(w.id)}
                onkeydown={(e) => toucheClavier(e, w.id, i)}
              >
                <div class="apercu-choix" inert>
                  <Composant {contexte} taille={w.taille} compact={compactDe(w.id)} />
                </div>
              </div>
            {:else if disposition.enEdition}
              <!-- Ordinateur : on attrape le widget par sa barre d'outils (hors boutons) et on le tire ; les flèches ↑ ↓ restent -->
              <div class="deplacable" onpointerdown={(e) => { if (!e.target.closest('button')) poserDoigt(e, w.id); }}>
              <CadreEdition
                id={w.id}
                taille={w.taille}
                index={i}
                total={widgetsVisibles.length}
                onDeplacer={deplacer}
                onTaille={changerTaille}
                onRetirer={retirer}
              >
                <Composant {contexte} taille={w.taille} compact={compactDe(w.id)} />
              </CadreEdition>
              </div>
            {:else}
              <Composant {contexte} taille={w.taille} compact={compactDe(w.id)} />
              {#if ANALYSE_DU_WIDGET[w.id]}
                <!-- Le widget entier est une porte vers sa page d'analyse (les liens et boutons du widget restent au-dessus) -->
                <a class="porte" href={construireAdresse({ sport: filtreActif, page: '/analyse', sous: ANALYSE_DU_WIDGET[w.id] })} aria-label="Ouvrir l'analyse : {WIDGETS[w.id]?.nom || w.id}"></a>
                <span class="indice" aria-hidden="true">Analyse ›</span>
              {:else if w.id === 'dernieres' && filtreActif === 'muscu'}
                <!-- Sur Muscu, ce widget est la porte vers le journal (la liste complète des séances de force) : les lignes restent cliquables au-dessus -->
                <a class="porte" href={construireAdresse({ sport: 'muscu', sous: 'journal' })} aria-label="Ouvrir le journal de musculation"></a>
                <span class="indice" aria-hidden="true">Journal ›</span>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
      {#if disposition.enEdition && glisse.id}
        {@const Copie = COMPOSANTS[glisse.id]}
        {@const w = widgetsVisibles.find((x) => x.id === glisse.id)}
        <!-- La copie du widget qui suit le doigt ou la souris (le vrai reste en place, estompé, et marque l'endroit où il tombera) -->
        <div class="copie" aria-hidden="true" inert style="left:{glisse.rect.left + glisse.x}px; top:{glisse.rect.top + glisse.y}px; width:{glisse.rect.width}px; height:{glisse.rect.height}px">
          {#if Copie && w}<Copie {contexte} taille={w.taille} compact={compactDe(w.id)} />{/if}
        </div>
      {/if}
      {#if disposition.enEdition && ecran.telephone}
        <BarreEditionTel nom={selection ? WIDGETS[selection]?.nom || selection : ''} onRetirer={() => retirer(selection)} />
      {/if}
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

  <!-- La séance de muscu prévue aujourd'hui, ouverte par-dessus l'accueil (adresse ?seancejour=<id> : un rechargement la rouvre) -->
  <PanneauSeanceDuJour ouvert={!!prevueOuverte} prevue={prevueOuverte} programme={programmeOuvert} onfermer={() => fermerPanneau('seancejour')} />
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

  /* Ordinateur, accueil Muscu : la séance du jour prend les 3/4 de la ligne, les programmes le dernier quart */
  @media (min-width: 761px) {
    .cellule[data-id='seancedujour'] {
      flex: 3 1 540px;
    }
    .cellule[data-id='programmes'] {
      flex: 1 1 200px;
    }
  }

  /* Personnaliser sur téléphone : un contour (sans décaler la mise en page, donc identique à l'écran validé) */
  .choix {
    -webkit-touch-callout: none; /* pas de menu iPhone quand on maintient */
    user-select: none;
    flex: 1;
    min-width: 0;
    display: flex;
    outline: 2px dashed var(--trait-fort);
    outline-offset: 2px;
    border-radius: var(--rayon);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .choix.choisi {
    outline: 3px solid var(--texte);
  }
  /* Le widget qu'on glisse : la place qu'il occupe est estompée, une copie suit le doigt */
  .cellule.souleve .choix,
  .cellule.souleve .deplacable {
    opacity: 0.3;
  }
  /* Ordinateur : la barre d'outils du widget sert de poignée */
  .deplacable {
    display: flex;
    flex: 1;
    min-width: 0;
  }
  .deplacable :global(.cadre) {
    flex: 1;
  }
  .deplacable :global(.outils) {
    cursor: grab;
  }
  .grille.enGlisse,
  .grille.enGlisse * {
    cursor: grabbing !important;
  }
  .copie {
    position: fixed;
    z-index: 60;
    display: flex;
    pointer-events: none;
    transform: scale(1.04);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55);
    border-radius: var(--rayon);
    opacity: 0.95;
  }
  .copie > :global(*) {
    flex: 1;
    min-width: 0;
  }
  .apercu-choix {
    flex: 1;
    display: flex;
    min-width: 0;
  }
  .apercu-choix > :global(*) {
    flex: 1;
    min-width: 0;
  }
  /* Téléphone : espaces plus serrés, et les tuiles compactes se rangent deux par deux */
  @media (max-width: 760px) {
    .grille {
      gap: 10px;
    }
    /* Muscu compact : grille à 2 colonnes. Les tuiles prennent une colonne, tout le reste la largeur entière ; « dense » comble
       un trou à côté d'une tuile seule avec la tuile suivante, donc l'ordre de l'utilisateur marche sans laisser de vide. */
    .grille.dense {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-flow: row dense;
    }
    .grille.dense .cellule {
      grid-column: 1 / -1;
    }
    .grille.dense .cellule.demi {
      grid-column: auto;
    }
    /* Dans une tuile, le bouton « Analyse › » ne garde que la flèche : le texte cacherait le titre */
    .cellule.demi .indice {
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      padding: 0;
      display: flex; /* pas « grid » : le texte caché compterait comme une case et pousserait la flèche vers le bas */
      align-items: center;
      justify-content: center;
      font-size: 0;
    }
    /* La flèche est dessinée (deux traits tournés), pas un caractère : un « › » de police se pose toujours un peu bas */
    .cellule.demi .indice::after {
      content: '';
      width: 6px;
      height: 6px;
      border-top: 2px solid currentColor;
      border-right: 2px solid currentColor;
      transform: translateX(-2px) rotate(45deg); /* le bout de la flèche dépasse à droite : on la recule pour que son centre visuel tombe au milieu */
    }
  }

  .bibliotheque {
    margin-top: 24px;
  }

</style>
