<script>
  import Bouton from './Bouton.svelte';
  import { lireGpx, profil, statistiques, TAILLE_MAX_GPX } from '../data/gpx.js';

  // Import d'un parcours GPX dans un formulaire. Le fichier est lu et vérifié dans le navigateur (taille, format, coordonnées) avant tout envoi.
  //  nomActuel : parcours déjà enregistré (ou chargé) · onchoisi({ nom, contenu, km, dPlus }) · onretirer()
  let { nomActuel = '', onchoisi, onretirer, erreur = '' } = $props();

  let message = $state('');
  let envoi = $state(false);
  const id = `gpx-${Math.random().toString(36).slice(2, 8)}`;

  async function choisir(e) {
    const fichier = e.currentTarget.files?.[0];
    e.currentTarget.value = ''; // permet de rechoisir le même fichier
    message = '';
    if (!fichier) return;
    if (!/\.gpx$/i.test(fichier.name)) return (message = 'Choisis un fichier .gpx.');
    if (fichier.size > TAILLE_MAX_GPX) return (message = 'Le fichier est trop gros (5 Mo maximum).');
    envoi = true;
    const contenu = await fichier.text().catch(() => '');
    envoi = false;
    const lu = lireGpx(contenu);
    if (lu.erreur) return (message = lu.erreur);
    const stats = statistiques(profil(lu.points));
    onchoisi?.({
      nom: (lu.nom || fichier.name).slice(0, 120),
      contenu,
      km: stats ? Math.round(stats.distanceKm * 100) / 100 : null,
      dPlus: stats ? Math.round(stats.gain) : null,
    });
  }
</script>

<div class="champ">
  <label for={id}>Parcours GPX (facultatif)</label>
  <div class="ligne">
    <input {id} type="file" accept=".gpx,application/gpx+xml" onchange={choisir} />
    {#if nomActuel}<Bouton variante="texte" onclick={onretirer}>Retirer le parcours</Bouton>{/if}
  </div>
  {#if nomActuel}<p class="actuel">Parcours : <strong>{nomActuel}</strong></p>{/if}
  {#if envoi}<p class="aide" role="status">Lecture du fichier…</p>{/if}
  {#if message || erreur}<p class="erreur" role="alert">{message || erreur}</p>{/if}
  <p class="aide">La distance et le dénivelé sont remplis à partir du parcours s'ils sont vides.</p>
</div>

<style>
  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  input[type='file'] {
    flex: 1 1 220px;
    min-width: 0;
    padding: 10px;
    border: 1px dashed var(--trait-fort);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte-doux);
    font-size: 14px;
  }
  input[type='file']:focus-visible {
    outline: 2px solid var(--texte);
    outline-offset: 2px;
  }
  .actuel,
  .aide {
    font-size: 13px;
    color: var(--texte-doux);
  }
  .actuel strong {
    color: var(--texte);
    overflow-wrap: anywhere;
  }
  .erreur {
    font-size: 13px;
    color: var(--danger);
  }
</style>
