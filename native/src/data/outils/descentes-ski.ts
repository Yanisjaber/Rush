// Les chiffres du ski calculés depuis les flux d'une sortie : le dénivelé descendu, le nombre de descentes, la vitesse max et l'altitude max.
// On lisse l'altitude, puis on repère les sommets et les creux (un mouvement de moins de 8 m n'est que du bruit). Une descente est une baisse d'au moins 40 m
// parcourue à plus de 7 km/h en moyenne (une remontée en télésiège ou à peaux ne descend pas). Fonction pure, aucun écran, aucun réseau.
import type { FluxBruts } from './courbes-sortie.ts';

export interface StatsSki {
  /** Somme de toutes les baisses (m, entier). */
  descenteM: number;
  /** Les descentes d'au moins 40 m. */
  descentes: number;
  /** Vitesse la plus haute (km/h, entier), sans les points aberrants. */
  vmaxKmh: number | null;
  /** Altitude la plus haute (m, entier). */
  altMax: number | null;
}

const SEUIL_BRUIT_M = 8;
const DESCENTE_MIN_M = 40;
const VITESSE_MIN_MS = 2; // 7 km/h
const VITESSE_ARRET_MS = 0.8; // en dessous, on est à l'arrêt
const VITESSE_MAX_KMH = 150; // au-delà, un point de GPS faux

const fini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function lisser(a: number[], fenetre: number): number[] {
  const demi = Math.floor(fenetre / 2);
  return a.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - demi); j <= Math.min(a.length - 1, i + demi); j++) {
      if (fini(a[j])) {
        s += a[j];
        n++;
      }
    }
    return n ? s / n : NaN;
  });
}

/** Les sommets et les creux de l'altitude lissée : on suit l'extrême courant, et on le valide quand l'altitude s'en éloigne de plus que le bruit. */
function sommets(alt: number[]): { i: number; v: number }[] {
  const points: { i: number; v: number }[] = [];
  let ext = { i: 0, v: alt.find(fini) ?? 0 };
  let sens = 0; // 0 = pas encore décidé, 1 = on monte (on cherche un sommet), -1 = on descend (on cherche un creux)
  alt.forEach((v, i) => {
    if (!fini(v)) return;
    if (sens === 0) {
      if (v - ext.v >= SEUIL_BRUIT_M || ext.v - v >= SEUIL_BRUIT_M) {
        points.push(ext);
        sens = v > ext.v ? 1 : -1;
        ext = { i, v };
      }
    } else if (sens === 1) {
      if (v > ext.v) ext = { i, v };
      else if (ext.v - v >= SEUIL_BRUIT_M) {
        points.push(ext);
        sens = -1;
        ext = { i, v };
      }
    } else if (v < ext.v) ext = { i, v };
    else if (v - ext.v >= SEUIL_BRUIT_M) {
      points.push(ext);
      sens = 1;
      ext = { i, v };
    }
  });
  points.push(ext);

  return points;
}

export function statsSki(brut: FluxBruts | null | undefined): StatsSki | null {
  const altBrute = brut?.altitude;
  if (!brut || !altBrute || altBrute.length < 30) return null;
  const alt = lisser(altBrute, 7);
  const vit = brut.vitesse && brut.vitesse.length === alt.length ? brut.vitesse : null;

  const points = sommets(alt);

  let descenteM = 0;
  let descentes = 0;
  for (let k = 1; k < points.length; k++) {
    const baisse = points[k - 1].v - points[k].v;
    if (baisse <= 0) continue;
    descenteM += baisse;
    if (baisse < DESCENTE_MIN_M) continue;
    if (vit) {
      const tranche = vit.slice(points[k - 1].i, points[k].i + 1).filter(fini);
      if (!tranche.length || tranche.reduce((a, b) => a + b, 0) / tranche.length < VITESSE_MIN_MS) continue;
    }
    descentes++;
  }

  // Le nombre de descentes est celui de la chronologie (même définition : l'attente au pied des remontées n'y change rien)
  const journee = journeeSki(brut);
  if (journee) descentes = journee.filter((e) => e.type === 'descente').length;

  const vmax = vit ? Math.max(0, ...vit.filter((v) => fini(v) && v * 3.6 <= VITESSE_MAX_KMH)) * 3.6 : 0;
  const altitudes = alt.filter(fini);
  return {
    descenteM: Math.round(descenteM),
    descentes,
    vmaxKmh: vmax > 0 ? Math.round(vmax) : null,
    altMax: altitudes.length ? Math.round(Math.max(...altitudes)) : null,
  };
}

export interface EtapeSki {
  type: 'montee' | 'descente';
  /** Secondes depuis le début de la sortie. */
  debutS: number;
  dureeS: number;
  /** Dénivelé monté (montée) ou descendu (descente), en mètres. */
  deniveleM: number;
  /** Descente seulement : la vitesse moyenne (km/h) et la vitesse max (km/h) ; null sans les flux nécessaires. */
  vmoyKmh: number | null;
  vmaxKmh: number | null;
}

const MARGE_M = 5; // une descente commence quand on quitte le sommet (à 5 m près) et finit quand on arrive au creux (à 5 m près) : l'attente en haut ou en bas n'en fait pas partie

/**
 * La journée de ski en étapes : les descentes, et entre elles les remontées (télésiège, peaux, marche, file d'attente comprise). Une baisse trop courte ou trop lente
 * n'est pas une descente. Le temps d'une descente va du départ au sommet à l'arrivée au creux : l'attente au pied des remontées, à vitesse nulle, n'est pas comptée.
 * Null sans altitude ni temps.
 */
export function journeeSki(brut: FluxBruts | null | undefined): EtapeSki[] | null {
  const altBrute = brut?.altitude;
  const temps = brut?.temps;
  if (!brut || !altBrute || !temps || altBrute.length < 30 || temps.length !== altBrute.length) return null;
  const alt = lisser(altBrute, 7);
  const vit = brut.vitesse && brut.vitesse.length === alt.length ? brut.vitesse : null;
  const dist = brut.distance && brut.distance.length === alt.length ? brut.distance : null;
  const points = sommets(alt);
  if (points.length < 2) return null;
  const n = alt.length;

  // Les descentes : début réel (dernier point encore au sommet) et fin réelle (premier point arrivé au creux)
  const descentes: { deb: number; fin: number; duree: number; vmax: number | null; vmoy: number | null }[] = [];
  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1], points[k]];
    if (a.v - b.v < DESCENTE_MIN_M) continue;
    let deb = a.i;
    for (let i = a.i; i <= b.i; i++) if (alt[i] >= a.v - MARGE_M) deb = i;
    let fin = b.i;
    for (let i = b.i; i >= deb; i--) if (alt[i] <= b.v + MARGE_M) fin = i;
    if (fin <= deb) continue;
    const tranche = vit ? vit.slice(deb, fin + 1).filter(fini) : [];
    const moyenne = tranche.length ? tranche.reduce((x, y) => x + y, 0) / tranche.length : null;
    if (moyenne != null && moyenne < VITESSE_MIN_MS) continue;
    // Le temps de glisse : les arrêts au milieu de la piste (attendre un ami, une photo) ne comptent pas, ni dans la durée ni dans la vitesse moyenne.
    // La distance parcourue est comptée sur les mêmes intervalles que le temps (un trou du GPS compte si on avançait encore à ce rythme-là).
    let duree = temps[fin] - temps[deb];
    let parcouru = dist ? dist[fin] - dist[deb] : 0;
    if (vit) {
      let mouvement = 0;
      let metres = 0;
      for (let i = deb; i < fin; i++) {
        const dt = temps[i + 1] - temps[i];
        if (dt <= 0) continue;
        const dm = dist ? dist[i + 1] - dist[i] : 0;
        const roule = dt <= 10 ? fini(vit[i]) && vit[i] >= VITESSE_ARRET_MS : dist ? dm / dt >= VITESSE_ARRET_MS : false;
        if (roule) {
          mouvement += dt;
          metres += dm;
        }
      }
      if (mouvement > 0) {
        duree = mouvement;
        parcouru = metres;
      }
    }
    const vmoy = dist && duree > 0 ? (parcouru / duree) * 3.6 : null;
    const sain = tranche.filter((v) => v * 3.6 <= VITESSE_MAX_KMH);
    descentes.push({ deb, fin, duree, vmax: sain.length ? Math.max(...sain) * 3.6 : null, vmoy });
  }
  if (!descentes.length) return null;

  const etapes: EtapeSki[] = [];
  const montee = (de: number, a: number) => {
    const gain = Math.round(alt[a] - alt[de]);
    const duree = temps[a] - temps[de];
    if (duree >= 30 && gain >= 10) etapes.push({ type: 'montee', debutS: temps[de], dureeS: duree, deniveleM: gain, vmoyKmh: null, vmaxKmh: null });
  };
  let curseur = 0;
  for (const d of descentes) {
    montee(curseur, d.deb);
    etapes.push({
      type: 'descente',
      debutS: temps[d.deb],
      dureeS: d.duree,
      deniveleM: Math.round(alt[d.deb] - alt[d.fin]),
      vmoyKmh: d.vmoy != null ? Math.round(d.vmoy) : null,
      vmaxKmh: d.vmax != null && d.vmax > 0 ? Math.round(d.vmax) : null,
    });
    curseur = d.fin;
  }
  montee(curseur, n - 1);
  return etapes;
}
