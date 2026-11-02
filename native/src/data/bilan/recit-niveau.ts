// Le récit du niveau global du vélo (1re carte de Bilan › Progrès › Cyclisme) : une phrase d'ouverture, les repères écrits sur la courbe (creux, reprise, record)
// et trois lignes (le point fort, ce qui a le plus bougé, ce qui tire vers le bas). Calculs purs, testés dans tests/bilan/recit-niveau.test.ts.
import { ecartsPiliers, PILIERS, type NiveauGlobal, type NiveauGlobalAnnee, type PilierCle } from './piliers-niveau.ts';

export interface RepereRecit {
  an: number;
  score: number;
  titre: string;
  detail: string;
  /** Le texte s'écrit au-dessus du point (un sommet) ou en dessous (un creux). */
  dessus: boolean;
}

export interface LigneRecit {
  /** Le chiffre en gros à gauche (« 100 », « +11 »). */
  valeur: string;
  /** Le mot en gras qui ouvre la phrase. */
  gras: string;
  texte: string;
}

export interface RecitNiveau {
  phrase: string;
  reperes: RepereRecit[];
  lignes: LigneRecit[];
}

const nomPilier = (cle: PilierCle): string => PILIERS.find((q) => q.cle === cle)!.nom;
const points = (n: number): string => `${n} point${n > 1 ? 's' : ''}`;

const FORCE: Record<PilierCle, string> = {
  puissance: 'tes meilleurs watts, du sprint à l’heure, sont ton point fort.',
  endurance: 'tu pousses plus de watts au même cardio : c’est ton point fort.',
  durabilite: 'tu tiens tes watts après 2 h 30 : c’est ton point fort.',
  repetabilite: 'tu enchaînes les efforts sans trop baisser : c’est ton point fort.',
  charge: 'tu encaisses beaucoup d’entraînement : c’est ce qui porte ton score.',
};

/** La phrase d'ouverture : l'écart avec l'an dernier, avec le creux, et le meilleur s'il n'est pas cette année. */
function phraseDe(g: NiveauGlobal): string {
  const actuel = g.actuel.global!;
  if (!g.precedent) return `Ta première année mesurée : ${actuel} sur 100.`;
  const ecart = actuel - g.precedent.global!;
  const debut = ecart === 0 ? `Le même score qu'en ${g.precedent.an}` : `${points(Math.abs(ecart))} de ${ecart > 0 ? 'plus' : 'moins'} qu'en ${g.precedent.an}`;
  const creux = creuxDe(g);
  const suite = creux && creux.an !== g.precedent.an && actuel - creux.global! >= 5 ? `, et ${actuel - creux.global!} de plus qu'au creux de ${creux.an}` : '';
  const meilleur = g.meilleur.an !== g.actuel.an && g.meilleur.global! > actuel ? ` Ton meilleur : ${g.meilleur.global} en ${g.meilleur.an}.` : '';
  return `${debut}${suite}.${meilleur}`;
}

/** L'année la plus basse avant l'année actuelle (la plus ancienne en cas d'égalité). */
function creuxDe(g: NiveauGlobal): NiveauGlobalAnnee | null {
  const avant = g.annees.filter((a) => a.an !== g.actuel.an);
  return avant.length ? avant.reduce((m, a) => (a.global! < m.global! ? a : m)) : null;
}

/** Le début de la montée actuelle : en remontant depuis l'année actuelle, la dernière année avant que le score cesse de baisser. Null sans montée d'au moins 2 ans. */
function repriseDe(g: NiveauGlobal): NiveauGlobalAnnee | null {
  const a = g.annees;
  let i = a.length - 1;
  while (i > 0 && a[i - 1].global! < a[i].global!) i--;
  return a.length - 1 - i >= 2 ? a[i] : null;
}

/** Les repères écrits sur la courbe : le creux, la reprise, le record (et l'année actuelle si ce n'est pas le record). Deux repères à moins de 2 ans d'écart : on garde le premier de la liste. */
function reperesDe(g: NiveauGlobal): RepereRecit[] {
  if (g.annees.length < 2) return [];
  const actuelEstRecord = g.meilleur.an === g.actuel.an;
  const candidats: RepereRecit[] = [
    { an: g.meilleur.an, score: g.meilleur.global!, titre: 'Record', detail: actuelEstRecord ? String(g.meilleur.global) : `${g.meilleur.global} en ${g.meilleur.an}`, dessus: true },
  ];
  if (!actuelEstRecord) candidats.push({ an: g.actuel.an, score: g.actuel.global!, titre: String(g.actuel.an), detail: String(g.actuel.global), dessus: true });
  const creux = creuxDe(g);
  if (creux) candidats.push({ an: creux.an, score: creux.global!, titre: 'Creux', detail: `${creux.global} en ${creux.an}`, dessus: false });
  const reprise = repriseDe(g);
  if (reprise) candidats.push({ an: reprise.an, score: reprise.global!, titre: 'Reprise', detail: `${reprise.global} en ${reprise.an}`, dessus: false });
  const gardes: RepereRecit[] = [];
  for (const c of candidats) if (gardes.every((r) => Math.abs(r.an - c.an) >= 2)) gardes.push(c);
  return gardes.sort((x, y) => x.an - y.an);
}

/** Les trois lignes : le point fort, ce qui a le plus bougé depuis l'an dernier (au moins 1 point), ce qui tire vers le bas (si ce n'est pas le point fort ;
 *  fusionné avec la ligne d'avant quand c'est le même pilier). */
function lignesDe(g: NiveauGlobal): LigneRecit[] {
  const lignes: LigneRecit[] = [];
  const fort = g.actuel.piliers[g.fort]!;
  lignes.push({ valeur: String(Math.round(fort)), gras: nomPilier(g.fort), texte: FORCE[g.fort] });
  const ecarts = ecartsPiliers(g).filter((e) => e.ecart !== 0);
  const plus = ecarts.length ? ecarts.reduce((m, e) => (Math.abs(e.ecart) > Math.abs(m.ecart) ? e : m)) : null;
  // Le pilier qui a le plus bougé est aussi le plus bas : une seule ligne pour les deux (pas deux fois le même nom)
  const memeQueFaible = plus !== null && plus.cle === g.faible && g.faible !== g.fort;
  if (plus) {
    const sens = `ta plus grosse ${plus.ecart > 0 ? 'hausse' : 'baisse'} depuis ${g.precedent!.an}`;
    lignes.push({
      valeur: `${plus.ecart > 0 ? '+' : '−'}${Math.abs(plus.ecart)}`,
      gras: nomPilier(plus.cle),
      texte: memeQueFaible ? `${sens}, mais encore ton pilier le plus bas (${Math.round(g.actuel.piliers[g.faible]!)}) : à travailler.` : `${sens}.`,
    });
  }
  if (g.faible !== g.fort && !memeQueFaible) {
    lignes.push({ valeur: String(Math.round(g.actuel.piliers[g.faible]!)), gras: nomPilier(g.faible), texte: 'c’est ce qui te tire vers le bas : à travailler.' });
  }
  return lignes;
}

export function recitNiveau(g: NiveauGlobal): RecitNiveau {
  return { phrase: phraseDe(g), reperes: reperesDe(g), lignes: lignesDe(g) };
}
