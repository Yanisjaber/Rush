import { decoderStreams, valeursDuFlux } from './trace-sortie.ts';

// Les courbes d'une sortie (vitesse, cœur, altitude, cadence, puissance) en fonction de la distance, prêtes à dessiner : une valeur par tranche de distance, toutes alignées.
// Viennent des flux stockés (activities.streams_gz). Fonctions pures : aucun écran, aucun réseau.
/** Les flux point par point (sans regroupement par distance), pour le temps passé par zone. NaN = valeur manquante. */
export interface FluxBruts {
  /** Secondes écoulées à chaque point. */
  temps?: number[];
  fc?: number[];
  watts?: number[];
  /** Vitesse en m/s. */
  vitesse?: number[];
}

export interface CourbesSortie {
  /** Les flux point par point, quand ils existent. */
  brut?: FluxBruts;
  /** Nombre de points de chaque courbe. */
  n: number;
  /** Distance totale (km) lue dans les flux, ou null sans flux de distance (l'axe est alors celui de la distance de la sortie). */
  km: number | null;
  /** Vitesse en m/s : l'allure s'en déduit (1000 / v). */
  vitesse?: number[];
  fc?: number[];
  altitude?: number[];
  cadence?: number[];
  watts?: number[];
}

const N = 120;
const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Moyenne par tranche (distance égale, ou durée égale sans distance), les tranches vides prenant la valeur voisine. Null si moins de 70 % des tranches ont une valeur. */
export function moyennesParTranche(valeurs: unknown[], tranche: number[], n: number, valide: (v: number) => boolean): number[] | null {
  const somme = new Array<number>(n).fill(0);
  const compte = new Array<number>(n).fill(0);
  valeurs.forEach((v, i) => {
    if (ok(v) && valide(v) && tranche[i] >= 0 && tranche[i] < n) {
      somme[tranche[i]] += v;
      compte[tranche[i]]++;
    }
  });
  const sortie: (number | null)[] = somme.map((s, k) => (compte[k] ? s / compte[k] : null));
  if (sortie.filter((v) => v !== null).length < n * 0.7) return null;
  let dernier: number | null = null;
  for (let k = 0; k < n; k++) {
    if (sortie[k] === null) sortie[k] = dernier;
    else dernier = sortie[k];
  }
  dernier = null;
  for (let k = n - 1; k >= 0; k--) {
    if (sortie[k] === null) sortie[k] = dernier;
    else dernier = sortie[k];
  }
  return sortie as number[];
}

/** Les courbes d'un `streams_gz`. Null sans aucune courbe exploitable. */
export function courbesDepuisStreams(base64: string | null | undefined, n = N): CourbesSortie | null {
  return courbesDepuisFlux(decoderStreams(base64), n);
}

/** Les courbes de flux déjà décodés (ceux de `streams_gz`, ou la réponse de la fonction strava-trace) : { type: { data } } ou [{ type, data }]. */
export function courbesDepuisFlux(flux: unknown, n = N): CourbesSortie | null {
  if (!flux) return null;
  const liste = (type: string): unknown[] => {
    const v = valeursDuFlux(flux, type);
    return Array.isArray(v) ? v : [];
  };
  const dist = liste('distance');
  const longueur = Math.max(dist.length, ...['velocity_smooth', 'heartrate', 'altitude', 'cadence', 'watts'].map((t) => liste(t).length));
  if (longueur < 20) return null;
  const dmax = dist.length ? Math.max(...dist.filter(ok)) : 0;
  const parDistance = dist.length === longueur && dmax > 0;
  const tranche = Array.from({ length: longueur }, (_, i) => {
    const t = parDistance ? (ok(dist[i]) ? Math.floor((dist[i] / dmax) * n) : -1) : Math.floor((i / longueur) * n);
    return t === n ? n - 1 : t; // le dernier point (distance maximale) va dans la dernière tranche
  });
  const courbes: CourbesSortie = { n, km: parDistance ? dmax / 1000 : null };
  const vitesse = moyennesParTranche(liste('velocity_smooth'), tranche, n, (v) => v >= 0.8);
  const fc = moyennesParTranche(liste('heartrate'), tranche, n, (v) => v >= 30 && v <= 250);
  const altitude = moyennesParTranche(liste('altitude'), tranche, n, () => true);
  const cadence = moyennesParTranche(liste('cadence'), tranche, n, (v) => v > 0);
  const watts = moyennesParTranche(liste('watts'), tranche, n, (v) => v >= 0);
  // Les flux bruts, gardés tels quels (alignés sur la même longueur) pour calculer le temps par zone
  const brut: FluxBruts = {};
  const garder = (type: string): number[] | undefined => {
    const l = liste(type);
    return l.length === longueur ? l.map((v) => (ok(v) ? v : NaN)) : undefined;
  };
  const [t, f, w, vv] = [garder('time'), garder('heartrate'), garder('watts'), garder('velocity_smooth')];
  if (t) brut.temps = t;
  if (f) brut.fc = f;
  if (w) brut.watts = w;
  if (vv) brut.vitesse = vv;
  if (Object.keys(brut).length) courbes.brut = brut;
  if (vitesse) courbes.vitesse = vitesse;
  if (fc) courbes.fc = fc;
  if (altitude) courbes.altitude = altitude;
  if (cadence) courbes.cadence = cadence;
  if (watts) courbes.watts = watts;
  return courbes.vitesse || courbes.fc || courbes.altitude || courbes.cadence || courbes.watts ? courbes : null;
}
