<script>
  import { untrack } from 'svelte';
  import Panneau from './Panneau.svelte';
  import Bouton from './Bouton.svelte';
  import StatCle from './StatCle.svelte';
  import { apercu, fermerApercu, majApercu } from '../stores/apercu.svelte.js';
  import { auth } from '../stores/auth.svelte.js';
  import { ouvrirModification } from '../stores/edition.svelte.js';
  import { definirCategorieActivite, enregistrerResultat } from '../data/api.js';
  import { validerResultat, texteClassement } from '../data/opendossard.js';
  import { modeDemo } from '../routeur.svelte.js';
  import { chargeSeance } from '../data/synthese.js';
  import { lireSeriesSeance } from '../data/force-acces.js';
  import { grouperParExercice } from '../data/force.js';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS, couleurSport } from '../sports.js';
  import { formatDuree, formatKm, formatAllure, formatDateLongue, formatKg } from '../utils/format.js';

  // Résumé d'une séance réalisée, sans entrer dans le détail : chiffres clés et notes.
  // Le détail complet (courbes, zones) est sur la page de la séance, atteinte par « Voir le détail ».
  const s = $derived(apercu.seance);
  const famille = $derived(s ? familleAffichage(s.sport) : 'autre');
  const nomSport = $derived((SPORTS[famille] || SPORTS.autre).nom);
  const couleur = $derived(couleurSport(famille));

  // Séance de force : exercices et séries enregistrés dans le carnet (si elle en a)
  let exercices = $state([]);
  $effect(() => {
    const x = s;
    const muscu = x && familleAffichage(x.sport) === 'muscu';
    untrack(async () => {
      exercices = [];
      if (!muscu) return;
      const r = await lireSeriesSeance(modeDemo(), modeDemo() ? 'demo' : auth.session?.user?.id, x.id);
      if (apercu.seance?.id === x.id) exercices = grouperParExercice(r.data || []);
    });
  });

  // Marquer la sortie comme compétition (ou l'en retirer) : elle apparaît alors dans la page Compétitions
  let envoi = $state(false);
  let retour = $state({ texte: '', erreur: false });
  const estCompetition = $derived(s?.category === 'competition');
  async function basculer() {
    if (!s || envoi) return;
    envoi = true;
    retour = { texte: '', erreur: false };
    const cible = estCompetition ? 'entrainement' : 'competition';
    const r = modeDemo() ? { erreur: '' } : await definirCategorieActivite(auth.session?.user?.id, s.id, cible);
    envoi = false;
    if (r.erreur) return (retour = { texte: r.erreur, erreur: true });
    majApercu({ category: cible });
    retour = { texte: cible === 'competition' ? 'Marquée comme compétition.' : 'Retirée des compétitions.', erreur: false };
  }

  // Résultat saisi à la main (compétition courue) : seulement quand la ligne vient de la page Compétitions, qui connaît déjà le résultat
  const peutSaisirResultat = $derived(s?.category === 'competition' && s?.result_place !== undefined);
  let resultat = $state({ place: '', total: '', categorie: '' });
  let retourResultat = $state({ texte: '', erreur: false });
  $effect(() => {
    const x = s;
    untrack(() => {
      resultat = { place: x?.result_place != null ? String(x.result_place) : '', total: x?.result_total != null ? String(x.result_total) : '', categorie: x?.result_catev || '' };
      retourResultat = { texte: '', erreur: false };
    });
  });
  async function sauverResultat(e) {
    e.preventDefault();
    const { valeurs, erreurs } = validerResultat(resultat);
    if (!valeurs) return (retourResultat = { texte: Object.values(erreurs)[0], erreur: true });
    const r = modeDemo() ? { erreur: '' } : await enregistrerResultat(auth.session?.user?.id, s.id, valeurs);
    if (r.erreur) return (retourResultat = { texte: r.erreur, erreur: true });
    majApercu(valeurs);
    retourResultat = { texte: valeurs.result_place ? 'Résultat enregistré.' : 'Résultat effacé.', erreur: false };
  }

  const tuiles = $derived.by(() => {
    if (!s) return [];
    const l = [{ etiquette: 'Durée', valeur: formatDuree(s.moving_time) }];
    if (s.distance_km) l.push({ etiquette: 'Distance', valeur: formatKm(s.distance_km), unite: 'km' });
    if (s.distance_km && s.moving_time) {
      if (famille === 'course' || famille === 'trail') l.push({ etiquette: 'Allure', valeur: formatAllure(s.moving_time / s.distance_km).replace('/km', ''), unite: '/km' });
      else l.push({ etiquette: 'Vitesse', valeur: formatKm((s.distance_km / s.moving_time) * 3600), unite: 'km/h' });
    }
    if (s.total_elevation_gain) l.push({ etiquette: 'Dénivelé +', valeur: String(s.total_elevation_gain), unite: 'm' });
    if (s.avg_heartrate) l.push({ etiquette: 'Cardio moy.', valeur: String(s.avg_heartrate), unite: 'bpm' });
    if (s.avg_watts) l.push({ etiquette: 'Puissance moy.', valeur: String(s.avg_watts), unite: 'W' });
    l.push({ etiquette: 'Charge', valeur: String(chargeSeance(s)), unite: 'pts' });
    return l;
  });
</script>

<Panneau ouvert={apercu.ouvert && !!s} titre="Séance" onfermer={fermerApercu}>
  {#if s}
    <article class="apercu">
      <header>
        <p class="sport"><span class="pastille" style:background={couleur}></span>{nomSport}</p>
        <h3 class="titre">{s.name || nomSport}</h3>
        <p class="quand">{formatDateLongue(s.start_date_local)}</p>
      </header>

      <div class="tuiles">
        {#each tuiles as t (t.etiquette)}
          <StatCle etiquette={t.etiquette} valeur={t.valeur} unite={t.unite || ''} />
        {/each}
      </div>

      {#if exercices.length}
        <section class="exercices" aria-label="Exercices de la séance">
          <h4>Exercices</h4>
          <ul>
            {#each exercices as e}
              <li>
                <span class="nom">{e.nom}</span>
                <span class="series">{e.series.map((x) => (x.poids ? `${x.reps} × ${formatKg(x.poids)}` : `${x.reps}`)).join(' · ')}{e.series.some((x) => x.poids) ? ' kg' : ' reps'}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <div class="actions">
        {#if famille === 'muscu'}<Bouton href="#/force/modifier/{s.id}" onclick={fermerApercu}>{exercices.length ? 'Modifier les séries' : 'Ajouter les séries'}</Bouton>{/if}
        <Bouton href="#/seance/{s.id}" onclick={fermerApercu}>Voir le détail</Bouton>
        <Bouton variante="discret" onclick={() => { const sortie = apercu.seance; fermerApercu(); ouvrirModification(sortie); }}>Modifier</Bouton>
        <Bouton variante="texte" onclick={fermerApercu}>Fermer</Bouton>
      </div>
      {#if peutSaisirResultat}
        <form class="resultat" onsubmit={sauverResultat} novalidate>
          <h4>Mon résultat{#if s.result_place}<span class="actuel"> · {texteClassement({ place: s.result_place, total: s.result_total, categorie: s.result_catev })}</span>{/if}</h4>
          <div class="ligne">
            <label>Place<input type="text" inputmode="numeric" bind:value={resultat.place} /></label>
            <label>Sur (partants)<input type="text" inputmode="numeric" bind:value={resultat.total} /></label>
            <label>Catégorie<input type="text" maxlength="30" bind:value={resultat.categorie} /></label>
          </div>
          <div class="actions"><Bouton type="submit" variante="discret">Enregistrer le résultat</Bouton></div>
          {#if retourResultat.texte}<p class={retourResultat.erreur ? 'erreur' : 'info'} role="status" aria-live="polite">{retourResultat.texte}</p>{/if}
        </form>
      {/if}

      {#if s.category !== undefined}
        <div class="competition">
          <Bouton variante="texte" onclick={basculer}>{envoi ? 'Enregistrement…' : estCompetition ? 'Retirer des compétitions' : 'Marquer comme compétition'}</Bouton>
          {#if retour.texte}<p class={retour.erreur ? 'erreur' : 'info'} role="status" aria-live="polite">{retour.texte}</p>{/if}
        </div>
      {/if}
    </article>
  {/if}
</Panneau>

<style>
  .exercices h4 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .exercices ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .exercices li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 9px 0;
    border-top: 1px solid var(--trait);
    font-size: 14px;
  }
  .exercices .series {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .apercu {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .sport {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .pastille {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  h3 {
    margin-top: 6px;
    font-size: clamp(26px, 4vw, 34px);
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .quand {
    margin-top: 4px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .tuiles {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 32px;
    padding: 16px 18px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .resultat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 14px;
    border-top: 1px solid var(--trait);
  }
  .resultat h4 {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .resultat .actuel {
    text-transform: none;
    letter-spacing: 0;
    color: var(--texte);
  }
  .resultat .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 10px;
  }
  .resultat label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--texte-doux);
  }
  .resultat input {
    box-sizing: border-box;
    min-height: 48px;
    padding: 0 12px;
    background: var(--fond);
    color: var(--texte);
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon);
    font-size: 16px;
  }
  .resultat input:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .competition {
    padding-top: 14px;
    border-top: 1px solid var(--trait);
  }
  .info,
  .erreur {
    margin-top: 6px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .erreur {
    color: var(--danger);
  }
</style>
