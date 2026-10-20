import { Text, View } from 'react-native';
import { BarrePhases } from '@/components/BarrePhases';
import { CadreWidget } from '@/components/CadreWidget';
import { GrandChiffre } from '@/components/GrandChiffre';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { heureDe, phases } from '@/data/sommeil';
import { bandeStress, NOM_QUALIFICATIF, texteHMdepuisSec, type NuitPreparee } from '@/data/score-sommeil';
import { formeActuelle } from '@/data/synthese';
import type { Metrique, Nuit, Taille } from '@/data/types';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les widgets de l'écran principal de Santé. Même cadre que ceux de l'Accueil (CadreWidget, tailles fixes, titre en pastille) ;
// chacun ne dessine que ses chiffres. Ils reçoivent les nuits (de la plus récente à la plus ancienne) et les métriques de charge.
export interface PropsSante {
  nuits: NuitPreparee[];
  metriques: Metrique[];
  taille?: Taille;
  /** XS, S ou M : la version tuile (chiffre clé) ; L : le grand format. */
  tuile?: boolean;
}

const NB_NUITS_COURBE = 14;
const signe = (n: number) => `${n > 0 ? '+' : ''}${n}`;

/** Les N dernières valeurs d'un champ, de la plus ancienne à la plus récente (une valeur absente compte pour 0). */
function serie(nuits: NuitPreparee[], champ: keyof Nuit): number[] {
  return nuits
    .slice(0, NB_NUITS_COURBE)
    .map((n) => Number(n[champ]) || 0)
    .reverse();
}

// Mini histogramme dans un composant à part : il lit la palette du cadre (inversée quand le widget est en look dossard)
function Barres({ valeurs, etiquette }: { valeurs: number[]; etiquette: string }) {
  const p = usePalette();
  if (!valeurs.some((v) => v > 0)) return null;
  return <MiniBarres valeurs={valeurs} couleur={p.sportNeutre} etiquette={etiquette} />;
}

interface SerieProps extends PropsSante {
  titre: string;
  valeur: string;
  unite?: string;
  note: string;
  valeurs: number[];
  etiquette: string;
}

// Un chiffre clé de la nuit avec ses dernières nuits en barres : tuile (XS, S, M) ou grand format (L)
function ChiffreSerie({ tuile, titre, valeur, unite, note, valeurs, etiquette }: SerieProps) {
  if (tuile) {
    return (
      <Tuile titre={titre} valeur={valeur} unite={unite} note={note}>
        <Barres valeurs={valeurs} etiquette={etiquette} />
      </Tuile>
    );
  }
  return (
    <CadreWidget titre={titre}>
      <GrandChiffre valeur={`${valeur}${unite ? ` ${unite}` : ''}`} nom={note}>
        <Barres valeurs={valeurs} etiquette={etiquette} />
      </GrandChiffre>
    </CadreWidget>
  );
}

const STATUT_HRV: Record<string, string> = { BALANCED: 'Équilibrée', LOW: 'Basse', UNBALANCED: 'Déséquilibrée', POOR: 'Faible' };

/** Le sommeil de la dernière nuit : score maison, durée, horaires et phases. */
export function WidgetSommeilNuit({ nuits, tuile = false }: PropsSante) {
  const n = nuits[0];
  const score = n?.score_maison ?? null;
  const duree = n ? texteHMdepuisSec(n.total_sec) : '—';
  const qualificatif = score ? NOM_QUALIFICATIF[score.qualificatif] : '';
  const lesPhases = n ? phases(n) : [];

  if (tuile) {
    return (
      <Tuile titre="Sommeil" valeur={score ? String(score.total) : '—'} unite={score ? '/100' : undefined} note={n ? `${duree}${qualificatif ? ` · ${qualificatif}` : ''}` : 'Aucune nuit'}>
        <BarrePhases phases={lesPhases} />
      </Tuile>
    );
  }
  return (
    <CadreWidget titre="Sommeil de la nuit">
      <GrandChiffre
        valeur={score ? String(score.total) : '—'}
        nom={n ? `${qualificatif ? `${qualificatif} · ` : ''}${duree} de sommeil` : 'Aucune nuit'}
        detail={n ? `${heureDe(n.bedtime) ?? '—'} → ${heureDe(n.wake_time) ?? '—'}` : "Les nuits importées depuis Garmin s'affichent ici."}
      >
        <BarrePhases phases={lesPhases} hauteur={14} />
        {lesPhases.length ? <Legende phases={lesPhases} /> : null}
      </GrandChiffre>
    </CadreWidget>
  );
}

function Legende({ phases: lesPhases }: { phases: ReturnType<typeof phases> }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
      {lesPhases.map((ph) => (
        <Text key={ph.cle} style={[typo.petit, { color: p.texteDoux }]}>
          {ph.nom} {Math.round(ph.part * 100)} %
        </Text>
      ))}
    </View>
  );
}

/** La variabilité cardiaque (HRV) de la dernière nuit. */
export function WidgetHrv(props: PropsSante) {
  const n = props.nuits[0];
  const v = n?.hrv_avg != null ? Math.round(Number(n.hrv_avg)) : null;
  return (
    <ChiffreSerie {...props} titre="HRV" valeur={v != null ? String(v) : '—'} unite={v != null ? 'ms' : undefined} note={n?.hrv_status ? (STATUT_HRV[n.hrv_status] ?? 'Statut inconnu') : 'Pas de mesure'} valeurs={serie(props.nuits, 'hrv_avg')} etiquette="HRV des 14 dernières nuits" />
  );
}

/** La fréquence cardiaque de repos de la nuit (à défaut, la moyenne). */
export function WidgetFcNuit(props: PropsSante) {
  const n = props.nuits[0];
  const repos = n?.resting_heart_rate != null ? Math.round(Number(n.resting_heart_rate)) : null;
  const moy = n?.avg_heart_rate != null ? Math.round(Number(n.avg_heart_rate)) : null;
  const v = repos ?? moy;
  return (
    <ChiffreSerie {...props} titre="FC de nuit" valeur={v != null ? String(v) : '—'} unite={v != null ? 'bpm' : undefined} note={repos != null && moy != null ? `Moyenne ${moy}` : v != null ? 'Sur la nuit' : 'Pas de mesure'} valeurs={serie(props.nuits, repos != null ? 'resting_heart_rate' : 'avg_heart_rate')} etiquette="Fréquence cardiaque de repos des 14 dernières nuits" />
  );
}

/** Le stress moyen de la nuit mesuré par la montre (0 à 100). */
export function WidgetStress(props: PropsSante) {
  const n = props.nuits[0];
  const v = n?.avg_stress != null ? Math.round(Number(n.avg_stress)) : null;
  return (
    <ChiffreSerie {...props} titre="Stress" valeur={v != null ? String(v) : '—'} unite={v != null ? '/100' : undefined} note={v != null ? `Niveau ${bandeStress(v)}` : 'Pas de mesure'} valeurs={serie(props.nuits, 'avg_stress')} etiquette="Stress des 14 dernières nuits" />
  );
}

/** La forme du moment, calculée depuis les entraînements : forme (fraîcheur), condition et fatigue. */
export function WidgetFormeSante({ metriques, tuile = false }: PropsSante) {
  const forme = formeActuelle(metriques);
  if (tuile) {
    return <Tuile titre="Forme" valeur={forme ? signe(forme.tsb) : '—'} note={forme ? `${forme.libelle} · cond. ${forme.ctl}, fat. ${forme.atl}` : 'Pas encore de données'} />;
  }
  return (
    <CadreWidget titre="Forme">
      <GrandChiffre valeur={forme ? signe(forme.tsb) : '—'} nom={forme ? forme.libelle : 'Pas encore de données'} detail={forme ? `Condition ${forme.ctl} · fatigue ${forme.atl}` : undefined} />
    </CadreWidget>
  );
}
