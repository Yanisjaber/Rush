import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { EcranSection } from '@/components/ecrans/EcranSection';
import { Bouton } from '@/components/ui/Bouton';
import { Dossard } from '@/components/ui/Dossard';
import { avancement, avancerAffichage, formaterDuree, formaterPourcent, tempsCalcul } from '@/data/synchro/estimation';
import { TAILLE_LOT, useSynchroStrava, type PhaseSynchro } from '@/hooks/useSynchroStrava';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const nb = (n: number): string => n.toLocaleString('fr-FR');

// La synchro des flux et des courbes (maquette 1 : le dossard héros). Le pourcentage (« 2,3 % ») est la donnée héros, la barre le suit, et les sorties s'ajoutent une par une
// à vitesse régulière ; la barre et « environ… de calcul » ne comptent que le temps de calcul. Pas de pause automatique : si Strava atteint sa limite, le calcul s'arrête et un bouton le relance. Calculs : data/synchro/estimation.ts, doc : docs/native/SYNCHRO_STRAVA.md.
export default function SynchroStrava() {
  const p = usePalette();
  const s = useSynchroStrava();
  const couleur = couleurSport(p, 'velo');
  // Le compteur est continu : pendant le calcul il avance 10 fois par seconde à vitesse constante (la vitesse moyenne mesurée), sans sauter à chaque réponse du serveur
  // (il rattrape le chiffre confirmé en glissant). Voir avancerAffichage. Hors calcul, on montre le chiffre confirmé.
  const dernier = useRef(s);
  dernier.current = s;
  const afficheRef = useRef(s.faites);
  const [affiche, setAffiche] = useState(s.faites);
  useEffect(() => {
    if (s.phase === 'calcul') return;
    afficheRef.current = s.faites;
    setAffiche(s.faites);
  }, [s.phase, s.faites]);
  useEffect(() => {
    if (s.phase !== 'calcul') return;
    let avant = Date.now();
    const t = setInterval(() => {
      const maintenant = Date.now();
      const c = dernier.current;
      afficheRef.current = avancerAffichage(afficheRef.current, c.faites, c.total, c.secParSortie > 0 ? 1 / c.secParSortie : 0, (maintenant - avant) / 1000, TAILLE_LOT);
      avant = maintenant;
      setAffiche(afficheRef.current);
    }, 100);
    return () => clearInterval(t);
  }, [s.phase]);
  const exacte = s.phase === 'calcul' ? affiche : s.faites;
  const faites = Math.floor(exacte);
  const restantes = Math.max(0, s.total - faites);
  const part = avancement(exacte, s.total);
  const calcul = tempsCalcul(restantes, s.secParSortie);

  const statut: Record<PhaseSynchro, { mot: string; pastille: string }> = {
    chargement: { mot: 'Lecture…', pastille: p.traitFort },
    vide: { mot: 'Rien à calculer', pastille: p.traitFort },
    repos: { mot: 'Arrêtée', pastille: p.traitFort },
    calcul: { mot: 'Calcul en cours', pastille: couleur },
    fini: { mot: 'À jour', pastille: p.ok },
    erreur: { mot: 'Interrompue', pastille: p.danger },
    demo: { mot: 'Mode démo', pastille: p.traitFort },
  };

  const reste =
    s.phase === 'fini' ? `Tes ${nb(s.total)} sorties sont importées avec leurs courbes.`
    : s.phase === 'erreur' ? `${nb(faites)} sorties sur ${nb(s.total)}. Rien n'est perdu : ça reprend à la sortie ${nb(faites + 1)}.`
    : s.phase === 'calcul' ? `${nb(faites)} sorties sur ${nb(s.total)}, environ ${formaterDuree(calcul)} de calcul.`
    : s.phase === 'repos' ? `${nb(faites)} sorties sur ${nb(s.total)}.`
    : '';

  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        {s.phase === 'demo' ? <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : pas de Strava à synchroniser.</Text> : null}
        {s.phase === 'chargement' ? <ActivityIndicator color={p.texteDoux} /> : null}
        {s.phase === 'vide' ? (
          <Bloc titre="Flux des sorties">
            <Text style={[typo.corps, { color: p.texteDoux }]}>Tu n'as aucune sortie importée : il n'y a rien à calculer.</Text>
          </Bloc>
        ) : null}

        {s.total > 0 ? (
          <>
            <Dossard sport="velo" etiquette="Flux et courbes" valeur={formaterPourcent(part)} uniteValeur="%" detail={reste} chiffreMax={64}>
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
            {(s.phase === 'erreur' || s.phase === 'repos') && s.message ? (
              <Text accessibilityRole={s.phase === 'erreur' ? 'alert' : undefined} style={[typo.petit, { color: s.phase === 'erreur' ? p.danger : p.texteDoux }]}>{s.message}</Text>
            ) : null}

            {s.phase === 'calcul' ? (
              <Bouton variante="discret" onPress={s.arreter}>Arrêter</Bouton>
            ) : s.phase === 'repos' ? (
              <Bouton onPress={s.demarrer}>Reprendre</Bouton>
            ) : s.phase === 'erreur' ? (
              <Bouton onPress={s.demarrer}>Réessayer</Bouton>
            ) : null}
            {s.phase === 'calcul' ? (
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
});
