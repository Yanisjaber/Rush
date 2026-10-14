<script>
  import Bouton from './Bouton.svelte';
  import StatCle from './StatCle.svelte';
  import ProfilStructure from './ProfilStructure.svelte';
  import ParcoursGpx from './ParcoursGpx.svelte';
  import { SPORTS, couleurSport } from '../sports.js';
  import { familleAffichage } from '../data/familles.js';
  import { formatDateLongue, formatKm } from '../utils/format.js';
  import { texteDuree, texteCible, COULEURS_ZONE, indiceZone, milieu, resume } from '../data/structure.js';

  // Affichage (lecture seule) d'une séance prévue : résumé, profil, déroulé, notes.
  // Rien n'est modifié ici : « Modifier » ouvre le formulaire, « Supprimer » demande d'abord une confirmation.
  //  f : séance au format du formulaire (voir formulaireDepuisLigne) · ref : { ftp, hrMax } · erreur / envoi : état du parent
  //  programme : le programme de muscu relié à la séance ({ id, name }) ou null
  let { f, ref = {}, gpx = '', programme = null, erreur = '', envoi = false, onmodifier, onsupprimer, onfermer } = $props();

  let confirmer = $state(false);

  const famille = $derived(familleAffichage(f.sport));
  const nomSport = $derived((SPORTS[famille] || SPORTS.autre).nom);
  const couleur = $derived(couleurSport(famille));
  const bilan = $derived(f.structure.length ? resume(f.structure, ref, f.sport) : null);
  const couleurSeg = (seg, m) => COULEURS_ZONE[Math.min(COULEURS_ZONE.length - 1, indiceZone(milieu(seg), m))];
  const ligne = (seg, m) => `${texteDuree(seg.min)} · ${texteCible(seg, m, ref, f.sport)}`;
  const duree = $derived(Number(f.duree) > 0 ? Number(f.duree) : 0);
  const tuiles = $derived(
    [
      { etiquette: 'Durée', valeur: texteDuree(duree) },
      { etiquette: 'Charge', valeur: f.tss !== '' ? String(f.tss) : '—', unite: f.tss !== '' ? 'pts' : '' },
      f.rpe !== '' ? { etiquette: 'Effort ressenti', valeur: String(f.rpe), unite: '/ 10' } : null,
      f.km !== '' ? { etiquette: 'Distance', valeur: formatKm(Number(f.km)), unite: 'km' } : null,
      f.dPlus !== '' ? { etiquette: 'Dénivelé +', valeur: String(f.dPlus), unite: 'm' } : null,
      bilan?.watts ? { etiquette: 'Puissance moy.', valeur: String(bilan.watts), unite: 'W' } : null,
      bilan?.kj ? { etiquette: 'Énergie', valeur: String(bilan.kj), unite: 'kJ' } : null,
    ].filter(Boolean),
  );
</script>

<article class="vue">
  <header>
    <p class="sport"><span class="pastille" style:background={couleur}></span>{nomSport} · prévue</p>
    <h3 class="titre">{f.nom}</h3>
    <p class="quand">{formatDateLongue(f.date)} · {f.heure}</p>
    {#if programme}
      <p class="programme">Programme : <strong>{programme.name}</strong> · <a href={`#/force/seance/${programme.id}`}>Démarrer</a></p>
    {/if}
  </header>

  <div class="tuiles">
    {#each tuiles as t (t.etiquette)}
      <StatCle etiquette={t.etiquette} valeur={t.valeur} unite={t.unite || ''} />
    {/each}
  </div>

  {#if f.structure.length}
    <section aria-label="Structure de la séance">
      <h4>Profil de la séance</h4>
      <ProfilStructure blocs={f.structure} hauteur={120} />
      <ol class="deroule">
        {#each f.structure as b, i (i)}
          <li>
            <span class="trait" style:background={couleurSeg(b.work, b.metric)}></span>
            <span class="corps">
              <span class="nom">{b.name}{#if b.reps > 1}<span class="reps">×{b.reps}</span>{/if}</span>
              <span class="sous">{ligne(b.work, b.metric)}</span>
              {#if b.type === 'interval' && b.rec}<span class="sous doux">récup {ligne(b.rec, b.metric)}</span>{/if}
            </span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if gpx}
    <section aria-label="Parcours">
      <h4>Parcours</h4>
      <ParcoursGpx contenu={gpx} nom={f.gpxNom} />
    </section>
  {/if}

  {#if f.notes}
    <section aria-label="Notes">
      <h4>Notes</h4>
      <p class="notes">{f.notes}</p>
    </section>
  {/if}

  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

  <div class="actions">
    <Bouton onclick={onmodifier}>Modifier</Bouton>
    <Bouton variante="discret" onclick={onfermer}>Fermer</Bouton>
  </div>

  <div class="danger">
    {#if confirmer}
      <p>Supprimer définitivement « {f.nom} » ?</p>
      <div class="actions">
        <Bouton variante="discret" onclick={() => !envoi && onsupprimer?.()}>Oui, supprimer</Bouton>
        <Bouton variante="texte" onclick={() => (confirmer = false)}>Non, garder</Bouton>
      </div>
    {:else}
      <Bouton variante="texte" onclick={() => (confirmer = true)}>Supprimer cette séance</Bouton>
    {/if}
  </div>
</article>

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
  .programme {
    margin-top: 8px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .programme strong {
    color: var(--texte);
  }
  .programme a {
    color: var(--texte);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .tuiles {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 32px;
    padding: 16px 18px;
    border-radius: var(--rayon-l);
    background: var(--surface-2);
  }
  h4 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-muet);
  }
  .deroule {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }
  .deroule li {
    display: flex;
    gap: 10px;
  }
  .trait {
    width: 4px;
    border-radius: 2px;
    flex: none;
  }
  .corps {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .nom {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 14px;
  }
  .reps {
    padding: 0 7px;
    border: 1px solid var(--trait-fort);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }
  .sous {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .sous.doux {
    color: var(--texte-muet);
  }
  .notes {
    white-space: pre-line;
    overflow-wrap: anywhere;
    font-size: 15px;
    line-height: 1.5;
    color: var(--texte-doux);
  }
  .erreur {
    padding: 10px 14px;
    border: 1px solid var(--danger);
    border-radius: var(--rayon-l);
    font-size: 14px;
    color: var(--danger);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .danger {
    padding-top: 16px;
    border-top: 1px solid var(--trait);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
  }
</style>
