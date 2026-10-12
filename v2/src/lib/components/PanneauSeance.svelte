<script>
  import Panneau from './Panneau.svelte';
  import Bouton from './Bouton.svelte';
  import StatCle from './StatCle.svelte';
  import { apercu, fermerApercu } from '../stores/apercu.svelte.js';
  import { chargeSeance } from '../data/synthese.js';
  import { familleAffichage } from '../data/familles.js';
  import { SPORTS, couleurSport } from '../sports.js';
  import { formatDuree, formatKm, formatAllure, formatDateLongue } from '../utils/format.js';

  // Résumé d'une séance réalisée, sans entrer dans le détail : chiffres clés et notes.
  // Le détail complet (courbes, zones) est sur la page de la séance, atteinte par « Voir le détail ».
  const s = $derived(apercu.seance);
  const famille = $derived(s ? familleAffichage(s.sport) : 'autre');
  const nomSport = $derived((SPORTS[famille] || SPORTS.autre).nom);
  const couleur = $derived(couleurSport(famille));

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

      <div class="actions">
        <Bouton href="#/seance/{s.id}" onclick={fermerApercu}>Voir le détail</Bouton>
        <Bouton variante="discret" onclick={fermerApercu}>Fermer</Bouton>
      </div>
    </article>
  {/if}
</Panneau>

<style>
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
</style>
