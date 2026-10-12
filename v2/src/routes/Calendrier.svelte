<script>
  import { untrack } from 'svelte';
  import EnTete from '../lib/components/EnTete.svelte';
  import ChipSport from '../lib/components/ChipSport.svelte';
  import Bouton from '../lib/components/Bouton.svelte';
  import PanneauPrevue from '../lib/components/PanneauPrevue.svelte';
  import { ouvrirApercu } from '../lib/stores/apercu.svelte.js';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { chargerSeancesPeriode, chargerPlanifiees } from '../lib/data/api.js';
  import { donneesDemo } from '../lib/data/demo.js';
  import { grilleMois, bornesGrille, decalerMois, JOURS_SEMAINE } from '../lib/data/calendrier.js';
  import { familleAffichage } from '../lib/data/familles.js';
  import { SPORTS, couleurSport } from '../lib/sports.js';
  import { formatDuree, dateIsoLocale } from '../lib/utils/format.js';

  let { demo = false } = $props();

  const maintenant = new Date();
  let cible = $state({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() });
  let etat = $state({ chargement: true, erreur: '', seances: [], planifiees: [], objectifs: [] });
  let filtre = $state('tout');

  let numeroRequete = 0; // pour ignorer une réponse arrivée en retard si on a déjà changé de mois

  async function charger(userId, annee, mois) {
    const numero = ++numeroRequete;
    etat.chargement = true;
    etat.erreur = '';
    const { debut, fin } = bornesGrille(annee, mois);
    let seances = [];
    let prevues = [];
    let erreur = '';
    if (demo) {
      const d = donneesDemo();
      seances = d.seances.filter((s) => String(s.start_date_local).slice(0, 10) >= debut && String(s.start_date_local).slice(0, 10) <= fin);
      prevues = d.planifiees.filter((p) => p.date >= debut && p.date <= fin);
    } else if (userId) {
      const [s, p] = await Promise.all([chargerSeancesPeriode(userId, debut, fin), chargerPlanifiees(userId, debut, fin)]);
      seances = s.data || [];
      prevues = p.data || [];
      erreur = s.erreur || p.erreur;
    } else {
      return;
    }
    if (numero !== numeroRequete) return; // une requête plus récente a pris le relais
    etat.seances = seances;
    etat.objectifs = prevues.filter((p) => p.category === 'competition');
    etat.planifiees = prevues.filter((p) => p.category !== 'competition');
    etat.erreur = erreur;
    etat.chargement = false;
  }

  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  // L'effet ne dépend que de l'utilisateur et du mois affiché (le reste est isolé par untrack).
  $effect(() => {
    const id = userId;
    const a = cible.annee;
    const m = cible.mois;
    untrack(() => charger(id, a, m));
  });

  // --- Dérivés ---
  const familles = $derived([...new Set(etat.seances.map((s) => familleAffichage(s.sport)))].filter((f) => f !== 'autre'));
  const garder = (sport) => filtre === 'tout' || familleAffichage(sport) === filtre;
  const grille = $derived(
    grilleMois(cible.annee, cible.mois, {
      seances: etat.seances.filter((s) => garder(s.sport)),
      planifiees: etat.planifiees.filter((p) => garder(p.sport)),
      objectifs: etat.objectifs,
    }),
  );
  const seancesDuMois = $derived(
    grille.semaines.flat().filter((j) => j.dansMois).flatMap((j) => j.seances),
  );
  const tempsDuMois = $derived(seancesDuMois.reduce((t, s) => t + (s.moving_time || 0), 0));
  const titre = $derived(grille.titre.charAt(0).toUpperCase() + grille.titre.slice(1));

  const nomFamille = (sport) => (SPORTS[familleAffichage(sport)] || SPORTS.autre).court;
  function precedent() { cible = decalerMois(cible.annee, cible.mois, -1); }
  function suivant() { cible = decalerMois(cible.annee, cible.mois, 1); }
  function aujourdhui() { cible = { annee: maintenant.getFullYear(), mois: maintenant.getMonth() }; }

  // --- Séances prévues : panneau de création / modification ---
  let panneau = $state({ ouvert: false, seance: null, date: dateIsoLocale(maintenant) });
  function nouvelle() {
    panneau = { ouvert: true, seance: null, date: dateIsoLocale(maintenant) };
  }
  function modifier(p) {
    panneau = { ouvert: true, seance: p, date: p.date };
  }
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
  const vide = (j) => !j.seances.length && !j.planifiees.length && !j.objectifs.length;
</script>

<div class="page">
  <EnTete actif="calendrier" {demo} />

  <nav class="puces" aria-label="Filtrer par sport">
    <ChipSport label="Tout" sport="autre" actif={filtre === 'tout'} onclick={() => (filtre = 'tout')} />
    {#each familles as f}
      <ChipSport sport={f} actif={filtre === f} onclick={() => (filtre = f)} />
    {/each}
  </nav>

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
      <Bouton onclick={nouvelle}>Nouvelle séance</Bouton>
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
            <div class="entete-jour">
              <span class="nomjour">{JOURS_SEMAINE[(new Date(j.iso + 'T12:00:00').getDay() + 6) % 7]}</span>
              <span class="num titre">{j.num}</span>
            </div>
            <div class="contenu">
              {#each j.objectifs as o (o.id)}
                <span class="pastille objectif" title={o.name}>{o.name}</span>
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
</div>

<PanneauPrevue
  ouvert={panneau.ouvert}
  seance={panneau.seance}
  dateInitiale={panneau.date}
  {userId}
  {demo}
  onfermer={() => (panneau.ouvert = false)}
  enregistree={apresEnregistrement}
  supprimee={apresSuppression}
/>

<style>
  .puces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
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
    align-items: center;
    gap: 14px;
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
    opacity: 0.85;
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
