// Relier le profil d'altitude à la carte : le profil est pris à pas de distance réguliers, la trace non. Fonctions pures, sans écran ni réseau.
export interface PointTrace {
  latitude: number;
  longitude: number;
}

export interface RegionPlate extends PointTrace {
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * La région à donner à une carte plein écran dont le haut (en-tête) et le bas (feuille) sont masqués : on dézoome et on décale pour que toute la trace
 * reste visible dans la zone libre, centrée. `hauteur`, `haut` et `bas` sont en pixels.
 */
export function regionPourZone<R extends RegionPlate>(region: R, { hauteur, haut, bas }: { hauteur: number; haut: number; bas: number }): R {
  const visible = hauteur - haut - bas;
  if (hauteur <= 0 || visible <= 0) return region;
  const echelle = hauteur / visible;
  const latitudeDelta = region.latitudeDelta * echelle;
  const decalage = (hauteur / 2 - (haut + visible / 2)) / hauteur; // > 0 : la zone libre est au-dessus du centre de l'écran
  return { ...region, latitude: region.latitude - latitudeDelta * decalage, latitudeDelta, longitudeDelta: region.longitudeDelta * echelle };
}

/** Distance approchée (m) entre deux points proches (projection à plat, suffisante pour une trace de quelques km). */
function distance(a: PointTrace, b: PointTrace): number {
  const k = Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180);
  const dx = (b.longitude - a.longitude) * k * 111320;
  const dy = (b.latitude - a.latitude) * 111320;
  return Math.hypot(dx, dy);
}

/** Le point de la trace situé à `fraction` (0 à 1) de la distance totale parcourue ; null si la trace est vide. */
export function pointAuFraction(trace: PointTrace[], fraction: number): PointTrace | null {
  if (!trace.length) return null;
  if (trace.length === 1) return trace[0];
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const cumul = [0];
  for (let i = 1; i < trace.length; i++) cumul.push(cumul[i - 1] + distance(trace[i - 1], trace[i]));
  const total = cumul[cumul.length - 1];
  if (total === 0) return trace[0];
  const cible = f * total;
  let i = 1;
  while (i < cumul.length - 1 && cumul[i] < cible) i++;
  const [d0, d1] = [cumul[i - 1], cumul[i]];
  const t = d1 > d0 ? (cible - d0) / (d1 - d0) : 0;
  return {
    latitude: trace[i - 1].latitude + (trace[i].latitude - trace[i - 1].latitude) * t,
    longitude: trace[i - 1].longitude + (trace[i].longitude - trace[i - 1].longitude) * t,
  };
}
