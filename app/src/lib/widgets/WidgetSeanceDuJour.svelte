<script>
  import Dossard from '../components/Dossard.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { ouvrirPanneau } from '../routeur.svelte.js';
  import { familleAffichage } from '../data/familles.js';
  import { programmeDuJour, resumeProgramme } from '../data/force.js';
  import { formatDateLongue, dateIsoLocale } from '../utils/format.js';

  // Le dossard de la séance de force du jour. Dans l'ordre :
  //  1. une séance de muscu PRÉVUE aujourd'hui au calendrier : on l'affiche, avec le programme qu'on lui a relié (s'il y en a un) ;
  //     « Voir » ouvre un panneau par-dessus l'accueil (PanneauSeanceDuJour, monté dans l'accueil) ;
  //  2. sinon le programme qui suit celui de ta dernière séance (PUSH, PULL, LEGS, PUSH…) ;
  //  3. sinon on propose d'enregistrer une séance.
  // compact : bandeau dossard pour téléphone (le nom du programme en gros, un seul bouton)
  let { contexte, compact = false } = $props();
  const jour = formatDateLongue(dateIsoLocale());
  const aujourdhui = dateIsoLocale();

  // Séance de muscu prévue aujourd'hui (ni compétition, ni autre sport) et son programme relié
  const prevue = $derived(contexte.planifiees.find((p) => p.date === aujourdhui && p.category !== 'competition' && familleAffichage(p.sport) === 'muscu') || null);
  const programmeLie = $derived(prevue?.programme_id ? contexte.force.programmes.find((p) => p.id === prevue.programme_id) || null : null);
  // « Voir » ouvre un panneau PAR-DESSUS l'accueil (on ne change pas de page) : la séance prévue et son programme
  const voir = () => ouvrirPanneau({ seancejour: prevue.id });

  const prog = $derived(programmeLie || programmeDuJour(contexte.force.programmes, contexte.toutesSeances));
  const resume = $derived(prog ? resumeProgramme(prog) : null);
  const detailProgramme = $derived(resume ? `${resume.exercices} exercice${resume.exercices > 1 ? 's' : ''} · ${resume.series} séries · environ ${resume.minutes} min` : '');

  // Version compacte : un seul bloc de texte et un bouton, quel que soit le cas (prévue, programme suivant, rien)
  const bandeau = $derived(
    prevue
      ? {
          etiquette: 'Séance du jour · prévue',
          valeur: programmeLie ? programmeLie.name : prevue.name,
          detail: programmeLie ? detailProgramme : Number(prevue.duration) > 0 ? `${prevue.duration} min · sans programme relié` : 'Sans programme relié',
          href: programmeLie ? `#/force/seance/${programmeLie.id}` : '#/force/demarrer',
          action: programmeLie ? 'Démarrer' : 'Enregistrer',
        }
      : prog
        ? { etiquette: 'Séance du jour', valeur: prog.name, detail: detailProgramme, href: `#/force/seance/${prog.id}`, action: 'Démarrer' }
        : { etiquette: 'Séance du jour', valeur: '—', detail: 'Enregistre ta séance : chrono, exercices, séries.', href: '#/force/demarrer', action: 'Enregistrer' },
  );
</script>

{#if compact}
  <section class="bandeau" aria-label={bandeau.etiquette}>
    <span class="attache a" aria-hidden="true"></span>
    <span class="attache b" aria-hidden="true"></span>
    <span class="attache c" aria-hidden="true"></span>
    <span class="attache d" aria-hidden="true"></span>
    <div class="texte">
      <div class="etiquette">{bandeau.etiquette}</div>
      <div class="valeur titre">{bandeau.valeur}</div>
      {#if bandeau.detail}<div class="detail">{bandeau.detail}</div>{/if}
    </div>
    <div class="boutons">
      <Bouton variante="sur-dossard" href={bandeau.href}>{bandeau.action}</Bouton>
      {#if prevue}<Bouton variante="sur-dossard-contour" onclick={voir}>Voir</Bouton>{/if}
    </div>
  </section>
{:else}
<div class="cadre">
  {#if prevue}
    <!-- Séance prévue aujourd'hui : on la montre (avec son programme si elle en a un) ; « Voir » ouvre son panneau sur l'accueil -->
    <Dossard
      taille="m"
      etiquette="Séance du jour · prévue"
      nom={jour}
      valeur={programmeLie ? programmeLie.name : prevue.name}
      detail={programmeLie ? detailProgramme : Number(prevue.duration) > 0 ? `${prevue.duration} min · sans programme relié` : 'Sans programme relié'}
    >
      <div class="actions">
        <Bouton variante="sur-dossard" href={programmeLie ? `#/force/seance/${programmeLie.id}` : '#/force/demarrer'}>{programmeLie ? 'Démarrer la séance' : 'Enregistrer la séance'}</Bouton>
        <Bouton variante="sur-dossard-contour" onclick={voir}>Voir</Bouton>
      </div>
    </Dossard>
  {:else if prog}
    <Dossard taille="m" etiquette="Séance du jour" nom={jour} valeur={prog.name} detail={detailProgramme}>
      <div class="actions"><Bouton variante="sur-dossard" href={`#/force/seance/${prog.id}`}>Démarrer la séance</Bouton></div>
    </Dossard>
  {:else}
    <Dossard taille="m" etiquette="Séance du jour" nom={jour} valeur="—" detail="Pas de programme à suivre ? Enregistre ta séance : chrono, exercices, séries et charges.">
      <div class="actions"><Bouton variante="sur-dossard" href="#/force/demarrer">Enregistrer une séance</Bouton></div>
    </Dossard>
  {/if}
</div>
{/if}

<style>
  .bandeau {
    position: relative;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 18px 22px;
    background: var(--dossard-fond);
    color: var(--dossard-texte);
    border-radius: var(--rayon);
  }
  .attache {
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--dossard-texte);
  }
  .attache.a { left: 8px; top: 8px; }
  .attache.b { right: 8px; top: 8px; }
  .attache.c { left: 8px; bottom: 8px; }
  .attache.d { right: 8px; bottom: 8px; }
  .texte {
    flex: 1;
    min-width: 0;
  }
  .etiquette {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .valeur {
    margin-top: 2px;
    font-size: 34px;
    line-height: 1;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.35;
    opacity: 0.75;
  }
  .boutons {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cadre {
    height: 100%;
  }
  .cadre :global(.dossard) {
    height: 100%;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
</style>
