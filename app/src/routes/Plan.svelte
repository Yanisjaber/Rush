<script>
  import { untrack } from 'svelte';
  import PanneauPrevue from '../lib/components/PanneauPrevue.svelte';
  import PanneauCompetition from '../lib/components/PanneauCompetition.svelte';
  import { menu } from '../lib/stores/menu.svelte.js';
  import { route, ouvrirPanneau, fermerPanneau } from '../lib/routeur.svelte.js';
  import { auth } from '../lib/stores/auth.svelte.js';
  import { ouvrirApercu } from '../lib/stores/apercu.svelte.js';
  import { donnees } from '../lib/stores/edition.svelte.js';
  import { chargerPlanifiees, chargerSeancesPeriode, chargerAnnotations, chargerMetriques, chargerObjectifs } from '../lib/data/api.js';
  import { donneesDemo } from '../lib/data/demo.js';
  import { lundiDe, bornesPlan, construirePlan, jourVide } from '../lib/data/plan.js';
  import { phaseDepuis, NOM_PHASE, formeDepuisTsb, conseilPreparation, nomPriorite, prochainObjectif } from '../lib/data/competitions.js';
  import { familleAffichage, garderSeance } from '../lib/data/familles.js';
  import { SPORTS, couleurSport } from '../lib/sports.js';
  import { formatDuree, formatKm, joursAvant, dateIsoLocale } from '../lib/utils/format.js';

  let { demo = false } = $props();

  const maintenant = new Date();
  const lundi = lundiDe(maintenant);
  const { debut, fin } = bornesPlan(lundi, 4);
  let etat = $state({ chargement: true, erreur: '', planifiees: [], objectifs: [], seances: [], notes: [], repos: [], tsb: null, prochains: [] });
  let panneau = $state({ ouvert: false, seance: null, date: dateIsoLocale(maintenant) });
  let panneauCompetition = $state({ ouvert: false, competition: null });

  async function charger(userId) {
    if (demo) {
      const d = donneesDemo();
      const prevues = d.planifiees.filter((p) => p.date >= debut && p.date <= fin);
      etat = {
        chargement: false, erreur: '',
        planifiees: prevues.filter((p) => p.category !== 'competition'),
        objectifs: prevues.filter((p) => p.category === 'competition'),
        seances: d.seances.filter((s) => String(s.start_date_local).slice(0, 10) >= debut && String(s.start_date_local).slice(0, 10) <= fin),
        notes: [], repos: [],
        prochains: d.objectifs,
        tsb: d.metriques.length ? d.metriques[d.metriques.length - 1].tsb : null,
      };
      return;
    }
    if (!userId) return;
    const [p, s, a, m, o] = await Promise.all([chargerPlanifiees(userId, debut, fin), chargerSeancesPeriode(userId, debut, fin), chargerAnnotations(userId, debut, fin), chargerMetriques(userId, 30), chargerObjectifs(userId, 5)]);
    const prevues = p.data || [];
    const serie = m.data || [];
    etat = {
      chargement: false, erreur: p.erreur || s.erreur || a.erreur,
      planifiees: prevues.filter((x) => x.category !== 'competition'),
      objectifs: prevues.filter((x) => x.category === 'competition'),
      seances: s.data || [], notes: a.data?.notes || [], repos: a.data?.repos || [],
      prochains: o.data || [],
      tsb: serie.length ? serie[serie.length - 1].tsb : null,
    };
  }
  const userId = $derived(demo ? 'demo' : auth.session?.user?.id);
  $effect(() => {
    const u = userId;
    void donnees.version;
    untrack(() => charger(u));
  });

  // Filtre global de sport : seules les séances et compétitions de ce sport sont affichées (la forme reste globale)
  const garder = (x) => garderSeance(x, menu.filtre);
  const etatFiltre = $derived({
    ...etat,
    planifiees: etat.planifiees.filter(garder),
    objectifs: etat.objectifs.filter(garder),
    seances: etat.seances.filter(garder),
    prochains: etat.prochains.filter(garder),
  });
  const semaines = $derived(construirePlan(lundi, etatFiltre, maintenant, 4));
  // La phase de préparation regarde la prochaine compétition, même au-delà des 4 semaines affichées
  const prochain = $derived(prochainObjectif([...etatFiltre.prochains].sort((a, b) => a.date.localeCompare(b.date)).filter((o) => o.date >= dateIsoLocale(maintenant))));
  const jours = $derived(prochain ? joursAvant(prochain.date) : null);
  const phase = $derived(phaseDepuis(jours, etat.tsb));
  const forme = $derived(formeDepuisTsb(etat.tsb));
  const nomFamille = (sport) => (SPORTS[familleAffichage(sport)] || SPORTS.autre).court;

  // Ce qui est ouvert est dans l'adresse (?prevue=nouvelle&date=… / ?prevue=<id> / ?competition=<id>) : `panneau` n'en est que le reflet
  const nouvelle = (date) => ouvrirPanneau({ prevue: 'nouvelle', date }, ['competition']);
  const modifier = (p) => ouvrirPanneau({ prevue: p.id }, ['date', 'competition']);
  const ouvrirCompetition = (o) => ouvrirPanneau({ competition: o.id }, ['prevue', 'date']);
  const apresEnregistrement = (ligne) => {
    if (panneau.seance && panneau.seance.id === ligne.id) panneau.seance = ligne;
    etat.planifiees = [...etat.planifiees.filter((p) => p.id !== ligne.id), ligne];
    if (!demo) charger(userId);
  };
  const apresSuppression = (id) => (etat.planifiees = etat.planifiees.filter((p) => p.id !== id));
  const competitionEnregistree = (ligne) => {
    if (panneauCompetition.competition && panneauCompetition.competition.id === ligne.id) panneauCompetition.competition = ligne;
    etat.objectifs = [...etat.objectifs.filter((o) => o.id !== ligne.id), ligne];
    if (!demo) charger(userId);
  };

  // --- L'adresse décide de ce qui est ouvert (arrivée sur la page, rechargement, bouton Retour) ---
  $effect(() => {
    const id = route.q.prevue || '';
    const jour = route.q.date || dateIsoLocale(maintenant);
    void etat.planifiees;
    const chargement = etat.chargement;
    untrack(() => {
      if (!id) {
        if (panneau.ouvert) panneau.ouvert = false;
        return;
      }
      if (id === 'nouvelle') {
        if (!panneau.ouvert || panneau.seance || panneau.date !== jour) panneau = { ouvert: true, seance: null, date: jour };
        return;
      }
      const trouvee = etat.planifiees.find((p) => p.id === id);
      if (trouvee) {
        if (!panneau.ouvert || panneau.seance?.id !== id) panneau = { ouvert: true, seance: trouvee, date: trouvee.date };
      } else if (!chargement) fermerPanneau('prevue', 'date');
    });
  });

  $effect(() => {
    const id = route.q.competition || '';
    void etat.objectifs;
    const chargement = etat.chargement;
    untrack(() => {
      if (!id) {
        if (panneauCompetition.ouvert) panneauCompetition.ouvert = false;
        return;
      }
      const trouvee = etat.objectifs.find((o) => o.id === id);
      if (trouvee) {
        if (!panneauCompetition.ouvert || panneauCompetition.competition?.id !== id) panneauCompetition = { ouvert: true, competition: trouvee };
      } else if (!chargement) fermerPanneau('competition');
    });
  });
</script>

<main class="page">

  <header class="entete-page">
    <h1 class="titre">Plan</h1>
  </header>

  {#if etat.chargement}
    <p class="info" role="status">Chargement du plan…</p>
  {:else if etat.erreur}
    <p class="alerte" role="alert">{etat.erreur}</p>
  {:else}
    <p class="phase">
      {#if prochain}
        <strong>Prochain objectif :</strong> {prochain.name} ({nomPriorite(prochain.priority)}) dans {jours} jour{jours > 1 ? 's' : ''} · phase <strong>{NOM_PHASE[phase]}</strong> · forme {forme.texte}.
        <span class="conseil">{conseilPreparation(phase, etat.tsb)}</span>
      {:else}
        Aucune compétition prévue : entretien général. Ajoute une compétition pour que le plan se construise autour d'elle.
      {/if}
    </p>

    {#each semaines as semaine, i (semaine.debut)}
      <section class="semaine" aria-label={semaine.titre}>
        <header class="tete-semaine">
          <h2 class="titre">{i === 0 ? 'Cette semaine' : semaine.titre}</h2>
          {#if i === 0}<span class="dates">{semaine.titre.replace('Semaine du ', 'du ')}</span>{/if}
          <ul class="totaux" aria-label="Totaux prévus de la semaine">
            <li><b>{semaine.totaux.seances}</b> séance{semaine.totaux.seances > 1 ? 's' : ''}</li>
            <li><b>{formatDuree(semaine.totaux.dureeMin * 60)}</b></li>
            <li><b>{semaine.totaux.tss}</b> TSS</li>
            {#if semaine.totaux.km}<li><b>{formatKm(semaine.totaux.km)}</b> km</li>{/if}
          </ul>
        </header>

        <div class="jours">
          {#each semaine.jours as j (j.iso)}
            <div class="jour" class:passe={j.passe} class:aujourdhui={j.aujourdhui} class:vide={jourVide(j) && j.passe}>
              <div class="entete-jour">
                <span class="nom">{j.nom}</span>
                <span class="num titre">{j.num}</span>
              </div>
              <div class="contenu">
                {#each j.objectifs as o (o.id)}
                  <button type="button" class="chip objectif" onclick={() => ouvrirCompetition(o)} aria-label="Compétition {o.name}, modifier">
                    <span class="t">{o.name}</span>
                    <span class="d">{nomPriorite(o.priority)}{#if o.duration} · {formatDuree(o.duration * 60)}{/if}</span>
                  </button>
                {/each}
                {#each j.prevues as p (p.id)}
                  <button type="button" class="chip prevue" style:--c={couleurSport(familleAffichage(p.sport))} onclick={() => modifier(p)} aria-label="Séance prévue {p.name}">
                    <span class="t">{p.name || nomFamille(p.sport)}</span>
                    <span class="d">{nomFamille(p.sport)}{#if p.duration} · {formatDuree(p.duration * 60)}{/if}{#if p.tss} · {p.tss} TSS{/if}</span>
                  </button>
                {/each}
                {#each j.realisees as s (s.id)}
                  <button type="button" class="chip realisee" style:--c={couleurSport(familleAffichage(s.sport))} onclick={() => ouvrirApercu(s)} aria-label="Sortie réalisée {s.name}">
                    <span class="t">{s.name || nomFamille(s.sport)}</span>
                    <span class="d">fait · {formatDuree(s.moving_time)}</span>
                  </button>
                {/each}
                {#if j.repos}<span class="marque repos">Repos</span>{/if}
                {#each j.notes as n (n.id)}
                  <span class="marque" style:--c={n.color || '#60a5fa'} title={n.text || ''}><span class="point" aria-hidden="true"></span><span class="txt">{n.text || (n.type === 'maladie' ? 'Maladie' : n.type === 'blessure' ? 'Blessure' : 'Note')}</span></span>
                {/each}
                {#if !j.passe}
                  <button type="button" class="ajouter" onclick={() => nouvelle(j.iso)} aria-label="Prévoir une séance le {j.nom} {j.num}">+</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</main>

<PanneauPrevue
  ouvert={panneau.ouvert}
  seance={panneau.seance}
  dateInitiale={panneau.date}
  {userId}
  {demo}
  onfermer={() => fermerPanneau('prevue', 'date')}
  enregistree={apresEnregistrement}
  supprimee={apresSuppression}
/>

<PanneauCompetition
  ouvert={panneauCompetition.ouvert}
  competition={panneauCompetition.competition}
  dateInitiale={dateIsoLocale(maintenant)}
  {userId}
  {demo}
  onfermer={() => fermerPanneau('competition')}
  enregistree={competitionEnregistree}
  supprimee={(id) => (etat.objectifs = etat.objectifs.filter((o) => o.id !== id))}
/>

<style>
  .entete-page {
    margin-bottom: 8px;
  }
  h1 {
    font-size: clamp(32px, 6vw, 52px);
    line-height: 1.05;
  }
  .info {
    color: var(--texte-doux);
  }
  .alerte {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    background: var(--surface);
    font-size: 14px;
  }
  .phase {
    margin-bottom: 20px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .phase strong {
    color: var(--texte);
  }
  .conseil {
    display: block;
    margin-top: 2px;
  }
  .semaine {
    margin-bottom: 24px;
  }
  .tete-semaine {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 16px;
    margin-bottom: 10px;
  }
  .tete-semaine h2 {
    font-size: 22px;
  }
  .dates {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .totaux {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-left: auto;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .totaux b {
    color: var(--texte);
  }
  .jours {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
  }
  .jour {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-radius: var(--rayon);
    background: var(--surface);
    overflow: hidden;
  }
  .jour.passe {
    opacity: 0.7;
  }
  .jour.aujourdhui {
    outline: 2px solid var(--texte);
    outline-offset: -2px;
    opacity: 1;
  }
  .entete-jour {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--surface-2);
  }
  .jour.aujourdhui .entete-jour {
    background: var(--texte);
    color: var(--fond);
  }
  .nom {
    font-size: 11px;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .num {
    font-size: 20px;
    line-height: 1;
    letter-spacing: 0;
  }
  .contenu {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-height: 92px;
    padding: 6px;
  }
  .chip {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    min-height: 44px;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--rayon-s);
    color: var(--texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .chip .t {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 700;
  }
  .chip .d {
    font-size: 11.5px;
    color: var(--texte);
  }
  .chip.objectif {
    background: var(--dossard-fond, #f3f2ee);
    color: var(--dossard-texte, #0c0d10);
  }
  .chip.objectif .d {
    color: inherit;
    opacity: 0.75;
  }
  .chip.prevue {
    background: transparent;
    border: 2px dashed var(--c);
  }
  .chip.realisee {
    background: color-mix(in srgb, var(--c) 28%, var(--surface));
  }
  .marque {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 3px 8px;
    border-left: 3px solid var(--c, var(--texte-muet));
    border-radius: var(--rayon-s);
    background: color-mix(in srgb, var(--c, var(--texte-muet)) 14%, var(--surface));
    font-size: 12px;
    color: var(--texte);
  }
  .marque.repos {
    justify-content: center;
    border: 1px dashed var(--trait-fort);
    background: transparent;
    color: var(--texte-doux);
  }
  .marque .txt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ajouter {
    margin-top: auto;
    min-height: 32px;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon-s);
    background: transparent;
    color: var(--texte-muet);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .ajouter:hover {
    color: var(--texte);
    border-color: var(--texte-doux);
  }
  .chip:focus-visible,
  .ajouter:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  /* Téléphone : une ligne par jour (les jours passés vides sont masqués) */
  @media (max-width: 760px) {
    .ajouter {
      min-height: 44px; /* cible tactile */
    }
    .jours {
      grid-template-columns: 1fr;
    }
    .jour {
      flex-direction: row;
    }
    .jour.vide {
      display: none;
    }
    .entete-jour {
      flex: 0 0 64px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }
    .contenu {
      min-height: 0;
    }
    .ajouter {
      margin-top: 0;
    }
  }
</style>
