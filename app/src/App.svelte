<script>
  import { untrack } from 'svelte';
  // Aiguillage de l'app : catalogue, paramètres, démo, connexion ou accueil selon l'adresse et l'état.
  import Connexion from './routes/Connexion.svelte';
  import Accueil from './routes/Accueil.svelte';
  import Ecran from './lib/components/Ecran.svelte';
  import BarreBas from './lib/components/BarreBas.svelte';
  import EnTete from './lib/components/EnTete.svelte';
  import SelecteurSport from './lib/components/SelecteurSport.svelte';
  import SelecteurDiscipline from './lib/components/SelecteurDiscipline.svelte';
  import { cleDePage } from './lib/data/menu.js';
  import { chargerMenu, menuDemo, oublierMenu } from './lib/stores/menu.svelte.js';
  import PanneauSeance from './lib/components/PanneauSeance.svelte';
  import PanneauReel from './lib/components/PanneauReel.svelte';
  import PanneauImportHevy from './lib/components/PanneauImportHevy.svelte';
  import { auth, initAuth } from './lib/stores/auth.svelte.js';
  import { route, modeDemo } from './lib/routeur.svelte.js';
  import { hydraterApercu } from './lib/stores/apercu.svelte.js';
  import { hydraterEdition } from './lib/stores/edition.svelte.js';
  import { lireRetourDansAdresse } from './lib/stores/connexions.svelte.js';
  import { synchroniserTheme, oublierCompteTheme } from './lib/stores/theme.svelte.js';

  // Chaque écran est chargé à la demande (voir Ecran.svelte). Connexion et Accueil restent dans le premier fichier.
  const ecrans = {
    Catalogue: () => import('./routes/Catalogue.svelte'),
    Confidentialite: () => import('./routes/Confidentialite.svelte'),
    DefinirMotDePasse: () => import('./routes/DefinirMotDePasse.svelte'),
    Parametres: () => import('./routes/Parametres.svelte'),
    Calendrier: () => import('./routes/Calendrier.svelte'),
    Sommeil: () => import('./routes/Sommeil.svelte'),
    Competitions: () => import('./routes/Competitions.svelte'),
    Bilan: () => import('./routes/Bilan.svelte'),
    Plan: () => import('./routes/Plan.svelte'),
    Analyse: () => import('./routes/Analyse.svelte'),
    ForceDemarrer: () => import('./routes/ForceDemarrer.svelte'),
    ForceSeance: () => import('./routes/ForceSeance.svelte'),
    Seance: () => import('./routes/Seance.svelte'),
  };

  const demo = modeDemo();

  // Paramètres : #/parametres ou #/parametres/<onglet> (onglet inconnu = Général)
  const ONGLETS = ['general', 'physiologie', 'zones', 'connexions', 'preferences', 'confidentialite'];
  const paramOnglet = $derived.by(() => {
    const m = /^\/parametres(?:\/([a-z]+))?$/.exec(route.chemin);
    if (!m) return null;
    return ONGLETS.includes(m[1]) ? m[1] : 'general';
  });

  // Sommeil : #/sommeil, #/sommeil/graphiques ou #/sommeil/conseils
  const sommeilOnglet = $derived.by(() => {
    const m = /^\/sommeil(?:\/([a-z]+))?$/.exec(route.chemin);
    if (!m) return null;
    return m[1] === 'graphiques' || m[1] === 'conseils' ? m[1] : 'apercu';
  });

  // Séance de force en direct ou saisie après coup : #/force/seance|apres/<programme|libre> et #/force/modifier/<id>
  // (les programmes, le journal et les exercices vivent dans l'accueil Muscu : #/muscu/programmes… ; l'ancien #/force y renvoie)
  const forceSeance = $derived.by(() => {
    const m = /^\/force\/(seance|apres|modifier)\/([A-Za-z0-9_-]{1,64})$/.exec(route.chemin);
    if (!m) return null;
    return { mode: m[1] === 'seance' ? 'direct' : m[1], cible: m[2] };
  });

  // Identifiant de séance dans l'adresse (#/seance/<id>) : on n'accepte que des caractères sûrs
  const idSeance = $derived.by(() => {
    const m = /^\/seance\/([A-Za-z0-9_-]{1,64})$/.exec(route.chemin);
    return m ? m[1] : null;
  });

  // En démo, on n'a pas besoin de session : on évite même de contacter Supabase.
  if (!demo) {
    lireRetourDansAdresse(); // retour de Strava (?strava_connected=1) : ouvre l'onglet Connexions
    initAuth();
  }

  // Le thème suit le compte : récupéré à la connexion, plus écrit après la déconnexion
  $effect(() => {
    const uid = auth.session?.user?.id;
    if (demo) return;
    if (uid) synchroniserTheme(uid);
    else oublierCompteTheme();
  });

  // Les sports décident du menu (Muscu, Hyrox) : chargés à la connexion, en démo on montre tout
  $effect(() => {
    const uid = auth.session?.user?.id;
    untrack(() => {
      if (demo) menuDemo();
      else if (uid) chargerMenu(uid);
      else oublierMenu();
    });
  });

  // Les fenêtres globales (aperçu d'une séance, saisie d'une sortie) suivent l'adresse : un rechargement les rouvre au même endroit
  $effect(() => {
    const idApercu = route.q.apercu || '';
    const idSortie = route.q.sortie || '';
    const jour = route.q.date || '';
    const uid = auth.session?.user?.id;
    untrack(() => {
      hydraterApercu(idApercu, uid, demo);
      hydraterEdition(idSortie, jour, uid, demo);
    });
  });

  // La barre du bas (téléphone) n'a de sens qu'une fois dans l'app : ni sur la connexion, ni sur les pages publiques
  const avecBarreBas = $derived(
    route.chemin !== '/catalogue' && route.chemin !== '/confidentialite' && (demo || (auth.pret && !!auth.session && !auth.definirMdp && route.chemin !== '/mot-de-passe')),
  );

  // La barre des sports (téléphone) ne s'affiche que sur Accueil, Calendrier, Plan, Compétitions et Bilan.
  // Une page ouverte depuis un widget (analyse, journal) la recouvre entièrement : son bouton « Retour » la remet.
  const PAGES_AVEC_BARRE_SPORT = ['/', '/calendrier', '/plan', '/competitions', '/bilan'];
  const avecBarreSport = $derived(avecBarreBas && PAGES_AVEC_BARRE_SPORT.includes(route.chemin) && !(route.chemin === '/' && route.sous === 'journal'));

  // Le lien du menu à surligner : la page courante (les séances de force en direct ne surlignent rien, comme avant)
  const actifMenu = $derived(forceSeance ? 'force' : (cleDePage(route.chemin) ?? ''));
</script>

<!-- Le menu du haut est monté UNE SEULE fois ici (et non dans chaque page) : il ne se recrée plus, ne se re-mesure plus et ne disparaît plus
     pendant le chargement d'une page. Même largeur et mêmes marges que les pages (.page). Sur téléphone il est caché (voir BarreBas). -->
{#if avecBarreBas}
  <div class="entete-fixe"><EnTete actif={actifMenu} {demo} /></div>
{/if}

{#if route.chemin === '/catalogue'}
  <Ecran charger={ecrans.Catalogue} />
{:else if route.chemin === '/confidentialite'}
  <Ecran charger={ecrans.Confidentialite} />
{:else if demo}
  {#if paramOnglet}
    <Ecran charger={ecrans.Parametres} demo={true} onglet={paramOnglet} />
  {:else if route.chemin === '/calendrier'}
    <Ecran charger={ecrans.Calendrier} demo={true} />
  {:else if sommeilOnglet}
    <Ecran charger={ecrans.Sommeil} demo={true} onglet={sommeilOnglet} />
  {:else if route.chemin === '/competitions'}
    <Ecran charger={ecrans.Competitions} demo={true} />
  {:else if route.chemin === '/bilan'}
    <Ecran charger={ecrans.Bilan} demo={true} />
  {:else if route.chemin === '/plan'}
    <Ecran charger={ecrans.Plan} demo={true} />
  {:else if route.chemin === '/analyse'}
    {#key route.sous}<Ecran charger={ecrans.Analyse} id={route.sous} demo={true} />{/key}
  {:else if route.chemin === '/force/demarrer'}
    <Ecran charger={ecrans.ForceDemarrer} demo={true} />
  {:else if forceSeance}
    {#key route.chemin}<Ecran charger={ecrans.ForceSeance} demo={true} mode={forceSeance.mode} cible={forceSeance.cible} />{/key}
  {:else if idSeance}
    <Ecran charger={ecrans.Seance} id={idSeance} demo={true} />
  {:else}
    <Accueil demo={true} />
  {/if}
{:else if !auth.pret}
  <p class="attente" role="status">Chargement…</p>
{:else if !auth.session}
  <Connexion />
{:else if auth.definirMdp || route.chemin === '/mot-de-passe'}
  <Ecran charger={ecrans.DefinirMotDePasse} />
{:else if paramOnglet}
  <Ecran charger={ecrans.Parametres} onglet={paramOnglet} />
{:else if route.chemin === '/calendrier'}
  <Ecran charger={ecrans.Calendrier} />
{:else if sommeilOnglet}
  <Ecran charger={ecrans.Sommeil} onglet={sommeilOnglet} />
{:else if route.chemin === '/competitions'}
  <Ecran charger={ecrans.Competitions} />
{:else if route.chemin === '/bilan'}
  <Ecran charger={ecrans.Bilan} />
{:else if route.chemin === '/plan'}
  <Ecran charger={ecrans.Plan} />
{:else if route.chemin === '/analyse'}
  {#key route.sous}<Ecran charger={ecrans.Analyse} id={route.sous} />{/key}
{:else if route.chemin === '/force/demarrer'}
  <Ecran charger={ecrans.ForceDemarrer} />
{:else if forceSeance}
  {#key route.chemin}<Ecran charger={ecrans.ForceSeance} mode={forceSeance.mode} cible={forceSeance.cible} />{/key}
{:else if idSeance}
  <Ecran charger={ecrans.Seance} id={idSeance} />
{:else}
  <Accueil />
{/if}

{#if avecBarreSport}<SelecteurSport /><SelecteurDiscipline />{/if}
{#if avecBarreBas}<BarreBas />{/if}

<!-- Résumé d'une séance réalisée : ouvert depuis le calendrier ou les widgets -->
<PanneauSeance />
<PanneauReel />
<PanneauImportHevy {demo} />

<style>
  .entete-fixe {
    view-transition-name: entete; /* le menu d'ordinateur reste fixe pendant le fondu entre deux pages */
    position: relative;
    z-index: 45; /* ce nom isole l'en-tête dans sa propre couche : sans z-index ici, ses menus (+, Sports, Plus) passent derrière les widgets */
    box-sizing: border-box;
    width: 100%;
    max-width: var(--page-max);
    margin: 0 auto;
    padding: 0 var(--gouttiere);
  }
  .attente {
    padding: 48px 32px;
    color: var(--texte-doux);
  }
</style>
