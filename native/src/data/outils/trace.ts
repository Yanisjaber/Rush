// Relier le profil d'altitude à la carte : le profil est pris à pas de distance réguliers, la trace non. Fonctions pures, sans écran ni réseau.
export interface PointTrace {
  latitude: number;
  longitude: number;
}

/** Distance approchée (m) entre deux points proches (projection à plat, suffisante pour une trace de quelques km). */
function distance(a: PointTrace, b: PointTrace): number {
  const k = Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180);
  const dx = (b.longitude - a.longitude) * k * 111320;
  const dy = (b.latitude - a.latitude) * 111320;
  return Math.hypot(dx, dy);
}

/** La longueur de la trace en km (0 si elle a moins de deux points). */
export function longueurKm(trace: PointTrace[]): number {
  let total = 0;
  for (let i = 1; i < trace.length; i++) total += distance(trace[i - 1], trace[i]);
  return total / 1000;
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
