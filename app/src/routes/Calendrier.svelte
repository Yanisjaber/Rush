<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import SelecteurSport from '../lib/components/SelecteurSport.svelte';
  import { menu } from '../lib/stores/menu.svelte.js';
  import Bouton from '../lib/components/Bouton.svelte';
  import PanneauPrevue from '../lib/components/PanneauPrevue.svelte';
  import PanneauMarquage from '../lib/components/PanneauMarquage.svelte';
  import PanneauModeles from '../lib/components/PanneauModeles.svelte';
  import Dialogue from '../lib/components/Dialogue.svelte';
  import { ouvrirApercu } from '../lib/stores/apercu.svelte.js';
  import { ouvrirCreation, donnees } from '../lib/stores/edition.svelte.js';
  import { route, aller, ouvrirPanneau, fermerPanneau } from '../lib/routeur.svelte.js';
  import { construireAdresse, moisDepuisAdresse, moisVersAdresse } from '../lib/data/adresses.js';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { chargerSeancesPeriode, chargerPlanifiees, chargerAnnotations, chargerModeles } from '../lib/data/api.js';
  import { joursDe, versLigneNote } from '../lib/data/annotations.js';
  import { donneesDemo, modelesDemo } from '../lib/data/demo.js';
  import { grilleMois, bornesGrille, decalerMois, JOURS_SEMAINE } from '../lib/data/calendrier.js';
  import { familleAffichage } from '../lib/data/familles.js';
  import { SPORTS, couleurSport } from '../lib/sports.js';
  import { formatDuree, dateIsoLocale, formatDateLongue } from '../lib/utils/format.js';

  let { demo = false } = $props();

  const maintenant = new Date();
  // Le mois affiché est dans l'adresse (#/course/calendrier/2026-09) ; sans mois, c'est le mois en cours
  const cible = $derived(moisDepuisAdresse(route.sous) || { annee: maintenant.getFullYear(), mois: maintenant.getMonth() });
  let etat = $state({ chargement: true, erreur: '', seances: [], planifiees: [], objectifs: [], notes: [], repos: [] });
  // En démo, les notes et repos vivent en mémoire (ils survivent au changement de mois, pas au rechargement de la page)
  const jourDemo = (delta) => dateIsoLocale(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + delta));
  let annotationsDemo = $state({
    notes: [{ id: 'demo-n1', type: 'blessure', text: 'Genou gauche : on lève le pied', color: '#fb923c', from_date: jourDemo(-3), to_date: jourDemo(-1) }],
    repos: [jourDemo(-6), jourDemo(3)],
  });
  const filtre = $derived(menu.filtre); // sport choisi dans l'en-tête (filtre global)

  let numeroRequete = 0; // pour ignorer une réponse arrivée en retard si on a déjà changé de mois

  async function charger(userId, annee, mois) {
    const numero = ++numeroRequete;
    etat.chargement = true;
    etat.erreur = '';
    const { debut, fin } = bornesGrille(annee, mois);
    let seances = [];
    let prevues = [];
    let notes = [];
    let repos = [];
    let erreur = '';
    if (demo) {
      const d = donneesDemo();
      seances = d.seances.filter((s) => String(s.start_date_local).slice(0, 10) >= debut && String(s.start_date_local).slice(0, 10) <= fin);
      prevues = d.planifiees.filter((p) => p.date >= debut && p.date <= fin);
      notes = annotationsDemo.notes.filter((n) => n.from_date <= fin && n.to_date >= debut);
      repos = annotationsDemo.repos.filter((r) => r >= debut && r <= fin);
    } else if (userId) {
      const [s, p, a] = await Promise.all([chargerSeancesPeriode(userId, debut, fin), chargerPlanifiees(userId, debut, fin), chargerAnnotations(userId, debut, fin)]);
      seances = s.data || [];
      prevues = p.data || [];
      notes = a.data?.notes || [];
      repos = a.data?.repos || [];
      erreur = s.erreur || p.erreur || a.erreur;
    } else {
      return;
    }
    if (numero !== numeroRequete) return; // une requête plus récente a pris le relais
    etat.seances = seances;
    etat.objectifs = prevues.filter((p) => p.category === 'competition');
    etat.planifiees = prevues.filter((p) => p.category !== 'competition');
    etat.notes = notes;
    etat.repos = repos;
    etat.erreur = erreur;
    etat.chargement = false;
  }

  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  // L'effet ne dépend que de l'utilisateur et du mois affiché (le reste est isolé par untrack).
  $effect(() => {
    const id = userId;
    const a = cible.annee;
    const m = cible.mois;
    void donnees.version; // se recharge quand une sortie est créée, retouchée ou supprimée
    untrack(() => charger(id, a, m));
  });

  // --- Dérivés ---
  const garder = (sport) => filtre === 'tout' || familleAffichage(sport) === filtre;
  const grille = $derived(
    grilleMois(cible.annee, cible.mois, {
      seances: etat.seances.filter((s) => garder(s.sport)),
      planifiees: etat.planifiees.filter((p) => garder(p.sport)),
      objectifs: etat.objectifs,
      notes: etat.notes,
      repos: etat.repos,
    }),
  );
  const seancesDuMois = $derived(
    grille.semaines.flat().filter((j) => j.dansMois).flatMap((j) => j.seances),
  );
  const tempsDuMois = $derived(seancesDuMois.reduce((t, s) => t + (s.moving_time || 0), 0));
  const titre = $derived(grille.titre.charAt(0).toUpperCase() + grille.titre.slice(1));

  const nomFamille = (sport) => (SPORTS[familleAffichage(sport)] || SPORTS.autre).court;
  const versMois = (c) => aller(construireAdresse({ sport: menu.filtre, page: '/calendrier', sous: moisVersAdresse(c) }));
  function precedent() { versMois(decalerMois(cible.annee, cible.mois, -1)); }
  function suivant() { versMois(decalerMois(cible.annee, cible.mois, 1)); }
  function aujourdhui() { aller(construireAdresse({ sport: menu.filtre, page: '/calendrier' })); }

  // --- Séances prévues : panneau de création / modification ---
  // Ce qui est ouvert est dans l'adresse (?prevue=nouvelle&date=…&modele=… ou ?prevue=<id>) : `panneau` n'en est que le reflet (voir plus bas)
  let panneau = $state({ ouvert: false, seance: null, modele: null, date: dateIsoLocale(maintenant) });
  function nouvelle(date = dateIsoLocale(maintenant)) {
    ouvrirPanneau({ prevue: 'nouvelle', date }, ['modele']);
  }
  function modifier(p) {
    ouvrirPanneau({ prevue: p.id }, ['date', 'modele']);
  }
  const fermerPrevue = () => fermerPanneau('prevue', 'date', 'modele');
  function apresEnregistrement(ligne) {
    // La séance affichée dans le panneau prend les nouvelles valeurs (le panneau repasse à l'affichage)
    if (panneau.seance && panneau.seance.id === ligne.id) panneau.seance = ligne;
    if (demo) {
      // En démo, rien n'est écrit en base : on met juste la liste à jour sous les yeux
      etat.planifiees = [...etat.planifiees.filter((p) => p.id !== ligne.id), ligne];
    } else {
      charger(userId, cible.annee, cible.mois);
    }
  }
  function apresSuppression(id) {
    etat.planifiees = etat.planifiees.filter((p) => p.id !== id);
  }
  const vide = (j) => !j.seances.length && !j.planifiees.length && !j.objectifs.length && !j.notes.length && !j.repos;

  // --- Modèles de séances ---
  let modeles = $state({ ouvert: false, charge: false, chargement: false, erreur: '', liste: [] });
  let dateModele = dateIsoLocale(maintenant); // jour pour lequel on choisit un modèle (aujourd'hui, ou le jour touché dans la grille)
  const ouvrirModeles = (date = dateIsoLocale(maintenant)) => ouvrirPanneau({ modeles: '1', date }, ['prevue', 'modele']);
  async function chargerListeModeles() {
    if (modeles.charge) return;
    if (demo) {
      modeles.liste = modelesDemo();
      return (modeles.charge = true);
    }
    modeles.chargement = true;
    const r = await chargerModeles(userId);
    modeles.chargement = false;
    modeles.erreur = r.erreur;
    modeles.liste = r.data || [];
    modeles.charge = !r.erreur;
  }
  function utiliserModele(m) {
    ouvrirPanneau({ prevue: 'nouvelle', modele: m.id, date: dateModele }, ['modeles']);
  }
  const modeleAjoute = (m) => (modeles.liste = [...modeles.liste.filter((x) => x.id !== m.id), m]);

  // --- Menu d'un jour : toucher une case de la grille propose quoi y ajouter ---
  let menuJour = $state({ ouvert: false, iso: '' });
  const choisir = (action) => {
    const iso = menuJour.iso;
    fermerPanneau('jour');
    action(iso);
  };

  // --- Repos, notes, maladies, blessures ---
  let panneauMarquage = $state({ ouvert: false, marquage: null, date: dateIsoLocale(maintenant) });
  const nouveauMarquage = (date = dateIsoLocale(maintenant)) => ouvrirPanneau({ marquage: 'nouveau', date });
  const ouvrirNote = (n) => ouvrirPanneau({ marquage: n.id }, ['date']);
  const ouvrirRepos = (iso) => ouvrirPanneau({ marquage: 'repos-' + iso }, ['date']);
  const fermerMarquage = () => fermerPanneau('marquage', 'date');
  function marquageEnregistre(valeurs) {
    if (demo) {
      const ancien = panneauMarquage.marquage;
      if (ancien?.type === 'repos') annotationsDemo.repos = annotationsDemo.repos.filter((r) => r !== ancien.iso);
      else if (ancien) annotationsDemo.notes = annotationsDemo.notes.filter((n) => n.id !== ancien.id);
      if (valeurs.type === 'repos') annotationsDemo.repos = [...new Set([...annotationsDemo.repos, ...joursDe(valeurs.de, valeurs.a)])];
      else annotationsDemo.notes = [...annotationsDemo.notes, { id: ancien && ancien.type !== 'repos' ? ancien.id : `demo-n${Date.now()}`, ...versLigneNote(valeurs) }];
    }
    charger(userId, cible.annee, cible.mois);
  }
  function marquageSupprime(m) {
    if (demo) {
      if (m.type === 'repos') annotationsDemo.repos = annotationsDemo.repos.filter((r) => r !== m.iso);
      else annotationsDemo.notes = annotationsDemo.notes.filter((n) => n.id !== m.id);
    }
    charger(userId, cible.annee, cible.mois);
  }

  // --- L'adresse décide de ce qui est ouvert : chaque effet aligne un panneau sur elle (arrivée sur la page, rechargement, bouton Retour) ---
  // Les effets ne lisent que l'adresse et les données chargées ; ce qu'ils écrivent est isolé par untrack (sinon boucle infinie).
  const dateOuAujourdhui = (iso) => iso || dateIsoLocale(maintenant);

  $effect(() => {
    const id = route.q.prevue || '';
    const jour = route.q.date || '';
    const idModele = route.q.modele || '';
    void etat.planifiees;
    const chargement = etat.chargement;
    void modeles.liste;
    untrack(() => {
      if (!id) {
        if (panneau.ouvert) panneau.ouvert = false;
        return;
      }
      if (id === 'nouvelle') {
        const m = idModele ? modeles.liste.find((x) => x.id === idModele) || null : null;
        if (idModele && !m && !modeles.charge) return void chargerListeModeles(); // le modèle demandé n'est pas encore là : on le charge, l'effet repartira
        if (!panneau.ouvert || panneau.seance || panneau.modele !== m || panneau.date !== dateOuAujourdhui(jour)) {
          panneau = { ouvert: true, seance: null, modele: m, date: dateOuAujourdhui(jour) };
        }
        return;
      }
      const trouvee = etat.planifiees.find((p) => p.id === id);
      if (trouvee) {
        if (!panneau.ouvert || panneau.seance?.id !== id) panneau = { ouvert: true, seance: trouvee, modele: null, date: trouvee.date };
      } else if (!chargement) fermerPanneau('prevue', 'date', 'modele'); // identifiant inconnu (ou séance supprimée)
    });
  });

  $effect(() => {
    const ouvert = route.q.modeles === '1';
    const jour = route.q.date || '';
    untrack(() => {
      if (!ouvert) {
        if (modeles.ouvert) modeles.ouvert = false;
        return;
      }
      dateModele = dateOuAujourdhui(jour);
      modeles.ouvert = true;
      chargerListeModeles();
    });
  });

  $effect(() => {
    const id = route.q.marquage || '';
    const jour = route.q.date || '';
    void etat.notes;
    const chargement = etat.chargement;
    untrack(() => {
      if (!id) {
        if (panneauMarquage.ouvert) panneauMarquage.ouvert = false;
        return;
      }
      if (id === 'nouveau') {
        if (!panneauMarquage.ouvert || panneauMarquage.marquage || panneauMarquage.date !== dateOuAujourdhui(jour)) {
          panneauMarquage = { ouvert: true, marquage: null, date: dateOuAujourdhui(jour) };
        }
        return;
      }
      const repos = /^repos-(\d{4}-\d{2}-\d{2})$/.exec(id);
      if (repos) {
        if (!panneauMarquage.ouvert || panneauMarquage.marquage?.iso !== repos[1]) panneauMarquage = { ouvert: true, marquage: { type: 'repos', iso: repos[1] }, date: repos[1] };
        return;
      }
      const note = etat.notes.find((n) => n.id === id);
      if (note) {
        if (!panneauMarquage.ouvert || panneauMarquage.marquage?.id !== id) panneauMarquage = { ouvert: true, marquage: note, date: note.from_date };
      } else if (!chargement) fermerPanneau('marquage', 'date');
    });
  });

  // Le menu d'un jour touché dans la grille est dans l'adresse (?jour=2026-10-14)
  $effect(() => {
    const iso = route.q.jour || '';
    untrack(() => {
      if (iso && !menuJour.ouvert) menuJour = { ouvert: true, iso };
      else if (!iso && menuJour.ouvert) menuJour = { ouvert: false, iso: '' };
    });
  });
</script>

<main class="page">
  <EnTete actif="calendrier" {demo} />

  <SelecteurSport />

  <div class="navigation">
    <div class="mois">
      <button type="button" class="fleche" aria-label="Mois précédent" onclick={precedent}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <h1 class="titre" aria-live="polite">{titre}</h1>
      <button type="button" class="fleche" aria-label="Mois suivant" onclick={suivant}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
    <div class="droite">
      <span class="resume">{seancesDuMois.length} séance{seancesDuMois.length > 1 ? 's' : ''} · {formatDuree(tempsDuMois)}</span>
      <Bouton variante="discret" onclick={aujourdhui}>Aujourd'hui</Bouton>
      <Bouton variante="discret" onclick={() => ouvrirCreation(dateIsoLocale(maintenant))}>Sortie réalisée</Bouton>
      <Bouton variante="discret" onclick={() => ouvrirModeles()}>Modèles</Bouton>
      <Bouton variante="discret" onclick={() => nouveauMarquage()}>Repos ou note</Bouton>
      <Bouton onclick={() => nouvelle()}>Nouvelle séance</Bouton>
    </div>
  </div>

  {#if etat.erreur}<p class="alerte" role="alert">{etat.erreur}</p>{/if}

  <div class="calendrier" class:charge={etat.chargement} aria-busy={etat.chargement}>
    <div class="entetes" aria-hidden="true">
      {#each JOURS_SEMAINE as j}<span>{j}</span>{/each}
    </div>
    {#each grille.semaines as semaine, i (i)}
      <div class="semaine">
        {#each semaine as j (j.iso)}
          <div class="jour" class:hors={!j.dansMois} class:aujourdhui={j.aujourdhui} class:vide={vide(j) && !j.aujourdhui}>
            <!-- Toucher une zone libre de la case ouvre le menu du jour ; les séances et notes restent cliquables par-dessus -->
            <button type="button" class="ajout" aria-label="Ajouter pour le {formatDateLongue(j.iso)}" onclick={() => ouvrirPanneau({ jour: j.iso })}></button>
            <div class="entete-jour">
              <span class="nomjour">{JOURS_SEMAINE[(new Date(j.iso + 'T12:00:00').getDay() + 6) % 7]}</span>
              <span class="num titre">{j.num}</span>
            </div>
            <div class="contenu">
              {#each j.objectifs as o (o.id)}
                <span class="pastille objectif" title={o.name}>{o.name}</span>
              {/each}
              {#if j.repos}
                <button type="button" class="marque repos" aria-label="Jour de repos, modifier" onclick={() => ouvrirRepos(j.iso)}>Repos</button>
              {/if}
              {#each j.notes as n (n.id)}
                <button type="button" class="marque" style:--c={n.color || '#60a5fa'} aria-label="{n.type === 'texte' ? 'Note' : n.type === 'maladie' ? 'Maladie' : 'Blessure'} : {n.text || ''}, modifier" title={n.text || n.type} onclick={() => ouvrirNote(n)}>
                  <span class="point" aria-hidden="true"></span><span class="txt">{n.text || (n.type === 'maladie' ? 'Maladie' : n.type === 'blessure' ? 'Blessure' : 'Note')}</span>
                </button>
              {/each}
              {#each j.seances.slice(0, 3) as s (s.id)}
                <a
                  class="pastille"
                  href="#/seance/{s.id}"
                  onclick={(e) => { e.preventDefault(); ouvrirApercu(s); }}
                  style:background={couleurSport(familleAffichage(s.sport))}
                  aria-label="{s.name || nomFamille(s.sport)}, {formatDuree(s.moving_time)}"
                >
                  <span class="type">{nomFamille(s.sport)}</span>
                  <span class="duree">{formatDuree(s.moving_time)}</span>
                </a>
              {/each}
              {#if j.seances.length > 3}<span class="plus">+{j.seances.length - 3}</span>{/if}
              {#each j.planifiees as p (p.id)}
                <button type="button" class="pastille prevue" style:border-color={couleurSport(familleAffichage(p.sport))} title="Séance prévue : {p.name}" aria-label="Modifier la séance prévue {p.name}" onclick={() => modifier(p)}>
                  <span class="type">{p.name || nomFamille(p.sport)}</span>
                  {#if p.duration}<span class="duree">{formatDuree(p.duration * 60)}</span>{/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</main>

<Dialogue ouvert={menuJour.ouvert} titre={menuJour.iso ? formatDateLongue(menuJour.iso) : ''} onfermer={() => fermerPanneau('jour')}>
  <p class="menu-aide">Que veux-tu ajouter ce jour-là ?</p>
  <div class="menu-choix">
    <button type="button" onclick={() => choisir((iso) => nouvelle(iso))}>Nouvelle séance prévue</button>
    <button type="button" onclick={() => choisir((iso) => ouvrirCreation(iso))}>Sortie réalisée</button>
    <button type="button" onclick={() => choisir((iso) => nouveauMarquage(iso))}>Repos ou note</button>
    <button type="button" onclick={() => choisir((iso) => ouvrirModeles(iso))}>Modèle de séance</button>
  </div>
  <button type="button" class="menu-annuler" onclick={() => fermerPanneau('jour')}>Annuler</button>
</Dialogue>

<PanneauModeles
  ouvert={modeles.ouvert}
  modeles={modeles.liste}
  chargement={modeles.chargement}
  erreur={modeles.erreur}
  {userId}
  {demo}
  onfermer={() => fermerPanneau('modeles', 'date')}
  onutiliser={utiliserModele}
  onsupprime={(id) => (modeles.liste = modeles.liste.filter((m) => m.id !== id))}
/>

<PanneauMarquage
  ouvert={panneauMarquage.ouvert}
  marquage={panneauMarquage.marquage}
  dateInitiale={panneauMarquage.date}
  {userId}
  {demo}
  onfermer={fermerMarquage}
  enregistre={marquageEnregistre}
  supprime={marquageSupprime}
/>

<PanneauPrevue
  ouvert={panneau.ouvert}
  seance={panneau.seance}
  modele={panneau.modele}
  dateInitiale={panneau.date}
  {userId}
  {demo}
  onfermer={fermerPrevue}
  enregistree={apresEnregistrement}
  supprimee={apresSuppression}
  modeleEnregistre={modeleAjoute}
/>

<style>
  .navigation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    margin: 16px 0 16px;
  }
  .mois {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h1 {
    font-size: clamp(28px, 5vw, 40px);
    line-height: 1;
    min-width: 7ch;
    text-align: center;
  }
  .fleche {
    width: var(--cible);
    height: var(--cible);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--trait-fort);
    border-radius: 50%;
    color: var(--texte);
    cursor: pointer;
  }
  .droite {
    display: flex;
    flex-wrap: wrap; /* les boutons passent à la ligne sur téléphone au lieu de déborder */
    align-items: center;
    gap: 8px 14px;
    min-width: 0;
  }
  .resume {
    font-size: 14px;
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

  .calendrier {
    transition: opacity 0.15s;
  }
  .calendrier.charge {
    opacity: 0.55;
  }
  .entetes,
  .semaine {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .entetes {
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
    padding: 0 8px;
  }
  .semaine {
    margin-bottom: 6px;
  }
  .jour {
    position: relative;
    min-height: 118px;
    min-width: 0;
    box-sizing: border-box;
    padding: 8px;
    background: var(--surface);
    border-radius: var(--rayon);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  /* Zone cliquable qui couvre toute la case ; l'en-tête et les pastilles passent par-dessus, seules leurs parties actives captent le toucher */
  .ajout {
    position: absolute;
    inset: 0;
    z-index: 0;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--rayon);
    background: transparent;
    cursor: pointer;
  }
  .ajout:hover {
    background: rgb(255 255 255 / 0.04);
  }
  .ajout:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: -2px;
  }
  .jour :global(.entete-jour),
  .jour :global(.contenu) {
    position: relative;
    z-index: 1;
    pointer-events: none;
  }
  .jour :global(.contenu) :global(a),
  .jour :global(.contenu) :global(button) {
    pointer-events: auto;
  }
  .menu-aide {
    margin: 0;
    color: #4a4f5a;
    font-size: 15px;
  }
  .menu-choix {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .menu-choix button {
    min-height: 48px;
    border: 0;
    border-radius: var(--rayon-l);
    background: #0c0d10;
    color: #f3f2ee;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .menu-choix button:focus-visible,
  .menu-annuler:focus-visible {
    outline: 3px solid var(--sport-course);
    outline-offset: 2px;
  }
  .menu-annuler {
    min-height: 44px;
    border: 0;
    background: none;
    color: #0c0d10;
    font: inherit;
    font-size: 14px;
    text-decoration: underline;
    cursor: pointer;
  }
  .jour.hors {
    opacity: 0.45;
  }
  .jour.aujourdhui {
    outline: 2px solid var(--texte);
    outline-offset: -2px;
  }
  .entete-jour {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .nomjour {
    display: none;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .num {
    font-size: 18px;
    line-height: 1;
    letter-spacing: 0;
    color: var(--texte-doux);
  }
  .aujourdhui .num {
    color: var(--texte);
  }
  .contenu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .pastille {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px 8px;
    border-radius: var(--rayon-s);
    color: var(--encre-sur-couleur);
    font-size: 12px;
    line-height: 1.2;
    min-width: 0;
    min-height: 44px;
    box-sizing: border-box;
    justify-content: center;
  }
  a.pastille:hover {
    filter: brightness(1.1);
  }
  .type {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .duree {
    font-weight: 500;
  }
  .marque {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-height: 32px;
    padding: 4px 8px;
    border: 0;
    border-left: 3px solid var(--c);
    border-radius: var(--rayon-s);
    background: color-mix(in srgb, var(--c) 16%, var(--surface));
    color: var(--texte);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .marque .txt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 760px) {
    .marque {
      min-height: 44px; /* cible tactile */
    }
  }
  .marque.repos {
    --c: var(--texte-muet);
    background: transparent;
    border: 1px dashed var(--trait-fort);
    border-left-width: 1px;
    color: var(--texte-doux);
    justify-content: center;
  }
  .pastille.prevue {
    width: 100%;
    text-align: left;
    font: inherit;
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
    background: transparent;
    color: var(--texte);
    border: 2px dashed var(--trait-fort);
  }
  .pastille.objectif {
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    font-family: var(--police-titre);
    font-weight: 800;
    font-size: 13px;
    min-height: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }
  .plus {
    font-size: 12px;
    color: var(--texte-doux);
    padding: 0 4px;
  }

  /* Sur téléphone : le calendrier devient un agenda, une ligne par jour, les jours vides sont masqués */
  @media (max-width: 760px) {
    .entetes {
      display: none;
    }
    .semaine {
      grid-template-columns: 1fr;
    }
    .jour {
      min-height: 0;
      flex-direction: row;
      align-items: flex-start;
      gap: 12px;
    }
    .jour.vide {
      display: none;
    }
    .jour.hors:not(:has(.pastille)) {
      display: none;
    }
    .entete-jour {
      flex: 0 0 52px;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }
    .nomjour {
      display: block;
    }
    .num {
      font-size: 24px;
    }
    .contenu {
      flex: 1;
    }
  }
</style>
