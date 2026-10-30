import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { EcranSection } from '@/components/ecrans/EcranSection';
import { Bouton } from '@/components/ui/Bouton';
import { Dossard } from '@/components/ui/Dossard';
import { avancement, formaterCompteARebours, formaterDuree, pausesAPrevoir, tempsCalcul } from '@/data/synchro/estimation';
import { useSynchroStrava, type PhaseSynchro } from '@/hooks/useSynchroStrava';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const nb = (n: number): string => n.toLocaleString('fr-FR');

// La synchro des courbes de puissance (maquette 1 : le dossard héros). Le compteur de sorties est la donnée héros ; la barre et « il reste environ… » ne comptent que le
// temps de calcul ; les pauses imposées par Strava sont annoncées à part, avec leur compte à rebours. Calculs : data/synchro/estimation.ts, doc : docs/native/SYNCHRO_STRAVA.md.
export default function SynchroStrava() {
  const p = usePalette();
  const s = useSynchroStrava();
  const couleur = couleurSport(p, 'velo');
  const restantes = Math.max(0, s.total - s.faites);
  const part = avancement(s.faites, s.total);
  const calcul = tempsCalcul(restantes, s.secParSortie);
  // L'heure ne bouge chaque seconde que pendant une pause ; sinon on prend celle du rendu (chaque lot recalcule l'écran)
  const pauses = pausesAPrevoir(restantes, s.quota, s.phase === 'pause' ? s.maintenant : Date.now(), s.secParSortie);
  const compteARebours = s.reprise ? Math.max(0, (s.reprise - s.maintenant) / 1000) : 0;

  const statut: Record<PhaseSynchro, { mot: string; pastille: string }> = {
    chargement: { mot: 'Lecture…', pastille: p.traitFort },
    vide: { mot: 'Rien à calculer', pastille: p.traitFort },
    repos: { mot: 'Arrêtée', pastille: p.traitFort },
    calcul: { mot: 'Calcul en cours', pastille: couleur },
    pause: { mot: 'En pause : limite Strava', pastille: p.traitFort },
    fini: { mot: 'À jour', pastille: p.ok },
    erreur: { mot: 'Interrompue', pastille: p.danger },
    demo: { mot: 'Mode démo', pastille: p.traitFort },
  };

  const reste =
    s.phase === 'fini' ? `Tes ${nb(s.total)} sorties avec capteur ont leur courbe.`
    : s.phase === 'pause' ? `${nb(restantes)} sorties restantes.`
    : s.phase === 'erreur' ? `Rien n'est perdu : ça reprend à la sortie ${nb(s.faites + 1)}.`
    : s.phase === 'calcul' || s.phase === 'repos' ? `${nb(restantes)} sorties restantes, environ ${formaterDuree(calcul)} de calcul.`
    : '';

  const uneLigne = (nom: string, valeur: string) => (
    <View style={[styles.ligne, { borderTopColor: p.trait }]}>
      <Text style={[typo.corps, { color: p.texte, flex: 1 }]}>{nom}</Text>
      <Text style={[typo.corpsFort, { color: p.texteDoux, fontVariant: ['tabular-nums'] }]}>{valeur}</Text>
    </View>
  );

  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        {s.phase === 'demo' ? <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : pas de Strava à synchroniser.</Text> : null}
        {s.phase === 'chargement' ? <ActivityIndicator color={p.texteDoux} /> : null}
        {s.phase === 'vide' ? (
          <Bloc titre="Courbes de puissance">
            <Text style={[typo.corps, { color: p.texteDoux }]}>Aucune de tes sorties n'a de capteur de puissance : il n'y a pas de courbe de watts à calculer.</Text>
          </Bloc>
        ) : null}

        {s.total > 0 ? (
          <>
            <Dossard sport="velo" etiquette="Courbes de puissance" valeur={nb(s.faites)} uniteValeur={`/ ${nb(s.total)}`} detail={reste} chiffreMax={64}>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Avancement du calcul"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(part * 100) }}
                style={[styles.rail, { backgroundColor: avecAlpha(p.dossardTexte, 0.18) }]}
              >
                <View style={[styles.remplissage, { width: `${part * 100}%`, backgroundColor: couleur }]} />
              </View>
            </Dossard>

            <View accessible accessibilityLabel={`Synchro : ${statut[s.phase].mot}`} style={styles.statut}>
              <View style={[styles.pastille, { backgroundColor: statut[s.phase].pastille }]} />
              <Text style={[styles.mot, { color: p.texte }]}>{statut[s.phase].mot}</Text>
            </View>
            {s.phase === 'erreur' && s.message ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>{s.message}</Text> : null}

            {s.phase !== 'fini' ? (
              <Bloc titre="Le temps">
                <View>
                  {uneLigne('Calcul restant', restantes ? `environ ${formaterDuree(calcul)}` : '—')}
                  {s.phase === 'pause' ? uneLigne('Reprise dans', formaterCompteARebours(compteARebours)) : null}
                  {pauses.nombre > 0 ? uneLigne('Pauses Strava à prévoir', `${pauses.nombre} · environ ${formaterDuree(pauses.secondes)}`) : null}
                </View>
                <Text style={[typo.petit, { color: p.texteDoux }]}>
                  Strava limite les demandes (100 par quart d'heure, environ 1 000 par jour pour toute l'app). Le calcul se met en pause tout seul et reprend à la remise à zéro.
                </Text>
              </Bloc>
            ) : null}

            {s.phase === 'calcul' || s.phase === 'pause' ? (
              <Bouton variante="discret" onPress={s.arreter}>Arrêter</Bouton>
            ) : s.phase === 'repos' ? (
              <Bouton onPress={s.demarrer}>Reprendre</Bouton>
            ) : s.phase === 'erreur' ? (
              <Bouton onPress={s.demarrer}>Réessayer</Bouton>
            ) : null}
            {s.phase === 'calcul' || s.phase === 'pause' ? (
              <Text style={[typo.petit, { color: p.texteMuet, textAlign: 'center' }]}>Garde cet écran ouvert. Si tu le fermes, le calcul s'arrête et reprend à ton retour, là où il en était.</Text>
            ) : null}
          </>
        ) : null}
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  rail: { height: 8, borderRadius: rayon.rond, overflow: 'hidden', marginTop: 10 },
  remplissage: { height: '100%', borderRadius: rayon.rond },
  statut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pastille: { width: 18, height: 18, borderRadius: 9 },
  mot: { fontSize: 22, lineHeight: 28, fontFamily: police.titre700 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth },
});
