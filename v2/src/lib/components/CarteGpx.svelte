<script>
  import { onMount } from 'svelte';
  import 'leaflet/dist/leaflet.css';

  // Carte du parcours (Leaflet + fonds de carte OpenStreetMap). Leaflet est chargé seulement quand une carte est affichée.
  //  points : [{ lat, lon }] (série déjà réduite) · curseur : indice du point survolé sur le profil (ou null)
  //  portion : { de, a } indices à mettre en valeur (une montée choisie), ou null
  let { points = [], curseur = null, portion = null, hauteur = 280 } = $props();

  let conteneur = $state(null);
  let L = null;
  let carte = null;
  let repere = null;
  let surlignage = null;
  let pret = $state(false);

  onMount(() => {
    let ferme = false;
    (async () => {
      const module = await import('leaflet');
      if (ferme || !conteneur) return;
      L = module.default || module;
      carte = L.map(conteneur, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(carte);
      pret = true;
    })();
    return () => {
      ferme = true;
      carte?.remove(); // libère la carte et ses écouteurs
      carte = null;
    };
  });

  // Le tracé se redessine quand les points changent
  $effect(() => {
    if (!pret || !carte || points.length < 2) return;
    const coords = points.map((p) => [p.lat, p.lon]);
    const trace = L.polyline(coords, { color: '#ff7a33', weight: 4, opacity: 0.95 }).addTo(carte);
    const depart = L.circleMarker(coords[0], { radius: 7, color: '#0c0d10', weight: 2, fillColor: '#4ade80', fillOpacity: 1 }).addTo(carte);
    const arrivee = L.circleMarker(coords[coords.length - 1], { radius: 7, color: '#0c0d10', weight: 2, fillColor: '#f43f5e', fillOpacity: 1 }).addTo(carte);
    carte.fitBounds(trace.getBounds(), { padding: [24, 24] });
    return () => {
      trace.remove();
      depart.remove();
      arrivee.remove();
    };
  });

  // Repère qui suit le survol du profil d'altitude
  $effect(() => {
    if (!pret || !carte) return;
    const p = curseur != null ? points[curseur] : null;
    if (!p) {
      repere?.remove();
      repere = null;
      return;
    }
    if (!repere) repere = L.circleMarker([p.lat, p.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(carte);
    else repere.setLatLng([p.lat, p.lon]);
  });

  // Montée choisie : mise en valeur d'une portion du tracé
  $effect(() => {
    if (!pret || !carte) return;
    surlignage?.remove();
    surlignage = null;
    if (!portion) return;
    const morceau = points.slice(portion.de, portion.a + 1).map((p) => [p.lat, p.lon]);
    if (morceau.length < 2) return;
    surlignage = L.polyline(morceau, { color: '#4ade80', weight: 9, opacity: 0.95, lineCap: 'round' }).addTo(carte);
    carte.fitBounds(surlignage.getBounds(), { padding: [40, 40], maxZoom: 15 });
  });
</script>

<div class="carte" bind:this={conteneur} style:height="{hauteur}px" role="img" aria-label="Carte du parcours"></div>

<style>
  .carte {
    width: 100%;
    border-radius: var(--rayon);
    background: var(--surface-2);
    overflow: hidden;
    z-index: 0;
  }
  /* Leaflet pose ses propres commandes : on les garde lisibles en thème sombre */
  .carte :global(.leaflet-control-attribution) {
    font-size: 10px;
  }
</style>
