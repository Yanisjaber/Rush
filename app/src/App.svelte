<script>
  import { untrack } from 'svelte';
  // Aiguillage de l'app : catalogue, paramètres, démo, connexion ou accueil selon l'adresse et l'état.
  import Connexion from './routes/Connexion.svelte';
  import Accueil from './routes/Accueil.svelte';
  import Ecran from './lib/components/Ecran.svelte';
  import BarreBas from './lib/components/BarreBas.svelte';
  import { chargerMenu, menuDemo, oublierMenu } from './lib/stores/menu.svelte.js';
  import PanneauSeance from './lib/components/PanneauSeance.svelte';
  import PanneauReel from './lib/components/PanneauReel.svelte';
  import { auth, initAuth } from './lib/stores/auth.svelte.js';
  import { route, modeDemo } from './lib/routeur.svelte.js';
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
    Force: () => import('./routes/Force.svelte'),
    ForceSeance: () => import('./routes/ForceSeance.svelte'),
    Hyrox: () => import('./routes/Hyrox.svelte'),
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

  // Force : #/force, #/force/journal, #/force/exercices (pages) ; #/force/seance|apres/<programme|libre> et #/force/modifier/<id> (saisie d'une séance)
  const forceOnglet = $derived.by(() => {
    const m = /^\/force(?:\/(journal|exercices))?$/.exec(route.chemin);
    return m ? m[1] || 'programmes' : null;
  });
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

  // La barre du bas (téléphone) n'a de sens qu'une fois dans l'app : ni sur la connexion, ni sur les pages publiques
  const avecBarreBas = $derived(
    route.chemin !== '/catalogue' && route.chemin !== '/confidentialite' && (demo || (auth.pret && !!auth.session && !auth.definirMdp && route.chemin !== '/mot-de-passe')),
  );
</script>

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
  {:else if forceOnglet}
    <Ecran charger={ecrans.Force} demo={true} onglet={forceOnglet} />
  {:else if forceSeance}
    {#key route.chemin}<Ecran charger={ecrans.ForceSeance} demo={true} mode={forceSeance.mode} cible={forceSeance.cible} />{/key}
  {:else if route.chemin === '/hyrox'}
    <Ecran charger={ecrans.Hyrox} demo={true} />
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
{:else if forceOnglet}
  <Ecran charger={ecrans.Force} onglet={forceOnglet} />
{:else if forceSeance}
  {#key route.chemin}<Ecran charger={ecrans.ForceSeance} mode={forceSeance.mode} cible={forceSeance.cible} />{/key}
{:else if route.chemin === '/hyrox'}
  <Ecran charger={ecrans.Hyrox} />
{:else if idSeance}
  <Ecran charger={ecrans.Seance} id={idSeance} />
{:else}
  <Accueil />
{/if}

{#if avecBarreBas}<BarreBas {demo} />{/if}

<!-- Résumé d'une séance réalisée : ouvert depuis le calendrier ou les widgets -->
<PanneauSeance />
<PanneauReel />

<style>
  .attente {
    padding: 48px 32px;
    color: var(--texte-doux);
  }
</style>
