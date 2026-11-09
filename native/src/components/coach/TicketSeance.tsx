import { StyleSheet, Text, View } from 'react-native';
import { ProfilSeance } from '@/components/graphes/ProfilSeance';
import { resumeBlocs } from '@/data/coach/profil-seance';
import { dureeMinutes } from '@/data/coach/libelles';
import type { BlocStructure } from '@/data/coach/types';
import { indiceZone, milieu, texteCible, texteDuree, ZONES } from '@/data/calendrier/structure';
import type { Reference, Segment } from '@/data/calendrier/structure';
import { useReferences } from '@/hooks/useReferences';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le « ticket » d'une séance : le jour et la durée, le nom, le profil par zones (le même graphe que l'écran Séance prévue : largeur = durée, hauteur et couleur = zone), la phrase de structure. Sert seul pour une séance proposée, et dans un plan (derrière le bouton « Détail » de chaque séance).
// Le liseré du haut porte la couleur du sport. Tout vient du serveur (structure construite par le code) : l'écran ne calcule rien d'autre que le dessin.
interface Props {
  couleur: string;
  /** « jeu. 12 nov. » */
  jour: string;
  titre: string;
  minutes: number;
  blocs?: BlocStructure[];
  /** La structure en une phrase, si le serveur l'a envoyée ; sinon on la tire des blocs */
  resume?: string;
  /** Le sport du coach (course, velo, natation) : sert à traduire les pourcentages en watts ou en battements */
  sport?: string;
  /** Pourquoi le coach la propose */
  raison?: string;
  /** Sans liseré (quand le ticket est déjà dans une carte qui a le sien) */
  sansLisere?: boolean;
  /** Version réduite, dans un plan : le jour et le nom sont déjà sur la ligne juste au-dessus, on ne les répète pas, le profil est plus bas et les zones abrégées */
  compact?: boolean;
}

const HAUTEUR_PROFIL = 44;
const HAUTEUR_PROFIL_COMPACT = 30;

/** Le sport du coach → le type de sport de l'app (celui que lit `texteCible`) */
const SPORT_APP: Record<string, string> = { course: 'Run', velo: 'Ride', natation: 'Swim' };

/**
 * La cible d'un segment. Watts et battements se calculent d'après le profil du sportif (FTP, FC max). Pour une allure on ne calcule RIEN :
 * l'allure de base du sportif n'est pas connue ici (une valeur par défaut serait fausse), le nom du bloc écrit par le serveur porte déjà la vraie allure ; on ne garde que la zone.
 */
function cible(seg: Segment, metric: BlocStructure['metric'], reference: Reference, sport: string): string {
  if (metric === 'pace') return ZONES.pace.noms[indiceZone(milieu(seg), 'pace')];
  return texteCible(seg, metric, reference, sport);
}

/** « Z1 Footing » devient « Z1 » en version réduite (le nom du bloc dit déjà ce qu'on fait) */
const zone = (texte: string, compact?: boolean): string => (compact ? texte.replace(/^(Z\d)\s[^·]*$/, '$1') : texte);

export function TicketSeance({ couleur, jour, titre, minutes, blocs, resume, sport, raison, sansLisere, compact }: Props) {
  const p = usePalette();
  const reference = useReferences();
  const sportApp = SPORT_APP[sport ?? ''] ?? 'Run';
  const phrase = resume || resumeBlocs(blocs);
  const lignes = blocs && blocs.length > 0;

  return (
    <View>
      {sansLisere ? null : <View style={[styles.lisere, { backgroundColor: couleur }]} />}
      <View style={[styles.corps, compact && styles.corpsCompact]}>
        {compact ? null : (
          <>
            <Text style={[typo.micro, { color: p.texteMuet }]}>
              {jour ? `${jour} · ` : ''}
              {dureeMinutes(minutes)}
            </Text>
            <Text style={[typo.titre2, { color: p.texte }]}>{titre}</Text>
          </>
        )}

        {blocs && blocs.length > 0 ? (
          <View accessible accessibilityLabel={phrase ? `Profil de la séance : ${phrase}` : 'Profil de la séance'}>
            <ProfilSeance blocs={blocs} hauteur={compact ? HAUTEUR_PROFIL_COMPACT : HAUTEUR_PROFIL} />
          </View>
        ) : null}
        {lignes ? (
          <View>
            {blocs.map((b, i) => (
              <View key={i} style={[styles.bloc, compact && styles.blocCompact, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.blocLigne}>
                  <Text numberOfLines={2} style={[typo.petit, { color: p.texte, fontFamily: police.texte600, flex: 1 }]}>
                    {b.name}
                  </Text>
                  <Text style={[typo.petit, { color: p.texteDoux, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>
                    {b.type === 'interval' && b.reps > 1 ? `${b.reps} × ${texteDuree(b.work.min)}` : texteDuree(b.work.min)} · {zone(cible(b.work, b.metric, reference, sportApp), compact)}
                  </Text>
                </View>
                {b.type === 'interval' && b.rec ? (
                  <Text style={[typo.petit, { color: p.texteMuet }]}>
                    récupération {texteDuree(b.rec.min)} · {zone(cible(b.rec, b.metric, reference, sportApp), compact)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : phrase ? (
          <Text style={[typo.petit, { color: p.texteDoux }]}>{phrase}</Text>
        ) : null}

        {raison ? <Text style={[typo.petit, { color: p.texteDoux, fontFamily: police.texte400 }]}>{raison}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lisere: { height: 4 },
  corps: { padding: espace.e3, gap: espace.e2 },
  corpsCompact: { padding: espace.e2, gap: espace.e1 },
  bloc: { paddingVertical: espace.e2, gap: 1 },
  blocCompact: { paddingVertical: 6 },
  blocLigne: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espace.e2 },
});
