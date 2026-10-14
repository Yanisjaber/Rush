<script>
  import Panneau from './Panneau.svelte';
  import Bouton from './Bouton.svelte';
  import StatCle from './StatCle.svelte';
  import { construireAdresse } from '../data/adresses.js';
  import { resumeProgramme } from '../data/force.js';
  import { menu } from '../stores/menu.svelte.js';
  import { formatDateLongue, formatKg } from '../utils/format.js';

  // La séance de muscu prévue aujourd'hui, ouverte PAR-DESSUS l'accueil (on ne change pas de page) : son programme relié avec tous ses
  // exercices, de quoi la démarrer. S'ouvre depuis le bouton « Voir » de la carte « Séance du jour » (adresse ?seancejour=<id>).
  //  prevue : la ligne de activity_planned (ou null) · programme : le programme relié ({ id, name, exercises }) ou null
  let { ouvert = false, prevue = null, programme = null, onfermer } = $props();

  const exercices = $derived(Array.isArray(programme?.exercises) ? programme.exercises : []);
  const resume = $derived(programme ? resumeProgramme(programme) : null);
  const duree = $derived(Number(prevue?.duration) > 0 ? Number(prevue.duration) : 0);
  const calendrier = $derived(prevue ? construireAdresse({ sport: menu.filtre, page: '/calendrier', q: { prevue: prevue.id } }) : '');
</script>

<Panneau {ouvert} titre="Séance du jour" {onfermer}>
  {#if prevue}
    <article class="vue">
      <header>
        <p class="sport"><span class="pastille"></span>Musculation · prévue</p>
        <h3 class="titre">{programme ? programme.name : prevue.name}</h3>
        <p class="quand">{formatDateLongue(prevue.date)}</p>
        {#if programme && prevue.name && prevue.name.toLowerCase() !== programme.name.toLowerCase()}
          <p class="quand">Séance prévue : {prevue.name}</p>
        {/if}
      </header>

      {#if duree || prevue.tss}
        <div class="tuiles">
          {#if duree}<StatCle etiquette="Durée prévue" valeur={String(duree)} unite="min" />{/if}
          {#if prevue.tss}<StatCle etiquette="Charge" valeur={String(prevue.tss)} unite="pts" />{/if}
          {#if resume}<StatCle etiquette="Programme" valeur={String(resume.series)} unite="séries" />{/if}
        </div>
      {/if}

      {#if programme}
        <section aria-label="Exercices du programme">
          <h4 class="sous-titre">Exercices</h4>
          {#if exercices.length}
            <ol class="liste">
              {#each exercices as e, i}
                <li>
                  <span class="rang">{i + 1}</span>
                  <span class="nom">{e.name}</span>
                  <span class="series">{e.sets} × {e.reps}</span>
                  <span class="charge">{e.weight ? `${formatKg(e.weight)} kg` : 'poids du corps'}</span>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="vide">Ce programme n'a pas encore d'exercices.</p>
          {/if}
        </section>
      {:else}
        <p class="vide">Aucun programme n'est relié à cette séance. Ouvre-la dans le calendrier, puis « Modifier », pour en choisir un.</p>
      {/if}

      <div class="actions">
        <Bouton href={programme ? `#/force/seance/${programme.id}` : '#/force/demarrer'}>{programme ? 'Démarrer la séance' : 'Enregistrer la séance'}</Bouton>
        <Bouton variante="discret" onclick={onfermer}>Fermer</Bouton>
      </div>
      <p class="lien"><a href={calendrier}>Ouvrir dans le calendrier</a></p>
    </article>
  {:else}
    <p class="vide">Séance introuvable.</p>
  {/if}
</Panneau>

<style>
  .vue {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .sport {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--texte-doux);
  }
  .pastille {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--sport-muscu);
  }
  h3 {
    margin: 0;
    font-size: clamp(30px, 5vw, 40px);
    line-height: 1.05;
    overflow-wrap: anywhere;
  }
  .quand {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .tuiles {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 32px;
  }
  .sous-titre {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: 22px 1fr auto auto;
    align-items: baseline;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid var(--trait);
    font-size: 15px;
  }
  li:first-child {
    border-top: 0;
  }
  .rang {
    font-size: 12px;
    color: var(--texte-doux);
  }
  .series {
    color: var(--texte-doux);
    font-variant-numeric: tabular-nums;
  }
  .charge {
    min-width: 76px;
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .vide {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .lien {
    margin: 0;
    font-size: 14px;
  }
  .lien a {
    color: var(--texte-doux);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
