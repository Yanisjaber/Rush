import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/ui/Bouton';
import { Dossard } from '@/components/ui/Dossard';
import type { Comparaison, LigneComparaison } from '@/data/calendrier/comparaison-sortie';
import type { MotCoach, PropositionCoach } from '@/data/calendrier/mot-coach-sortie';
import { espace, rayon, sombre } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page 4 d'une sortie : le dossard de la comparaison (de combien tu as été plus vite ou plus lent que d'habitude), une bande par mesure
// (un point de la couleur du sport pour cette sortie, des points gris pour tes sorties proches), puis le mot du coach et, quand la sortie a coûté, une proposition à valider.
// Le coach décrit, il n'écrit jamais seul : la proposition n'entre au calendrier que sur un toucher de « Ajouter ».
interface Props {
  sport: string;
  couleur: string;
  comparaison: Comparaison | null;
  mot: MotCoach;
  /** Écrit la séance proposée dans le calendrier ; renvoie un message d'erreur, vide si tout s'est bien passé. */
  onAjouter: (proposition: PropositionCoach) => Promise<string>;
}

export function PageCoachSortie({ sport, couleur, comparaison, mot, onAjouter }: Props) {
  const p = usePalette();
  const [ajout, setAjout] = useState<'repos' | 'encours' | 'fait' | 'ecarte'>('repos');
  const [erreur, setErreur] = useState('');
  // En thème clair la couleur du sport reste réservée aux aplats et aux contours (contraste, voir IDENTITE.md)
  const couleurTexte = p.fond === sombre.fond ? couleur : p.texte;
  const proposition = mot.proposition;

  const ajouter = async () => {
    if (!proposition) return;
    setAjout('encours');
    setErreur('');
    const e = await onAjouter(proposition);
    if (e) {
      setErreur(e);
      setAjout('repos');
      return;
    }
    setAjout('fait');
  };

  return (
    <>
      {comparaison?.hero ? <Dossard etiquette={comparaison.hero.etiquette.toUpperCase()} valeur={comparaison.hero.valeur} uniteValeur={comparaison.hero.unite} detail={comparaison.hero.detail} sport={sport} taille="l" chiffreMax={56} /> : null}

      {comparaison && comparaison.lignes.length ? (
        <View style={[styles.bloc, { backgroundColor: p.surface }]}>
          {comparaison.lignes.map((l, i) => (
            <Ligne key={l.cle} ligne={l} couleur={couleur} premiere={i === 0} />
          ))}
          <View style={styles.legende}>
            <View style={styles.rangeeLegende}>
              <View style={[styles.pointLegende, { backgroundColor: couleur }]} />
              <Text style={[typo.micro, { color: p.texteDoux }]}>CETTE SORTIE</Text>
            </View>
            <View style={styles.rangeeLegende}>
              <View style={[styles.pointLegende, { backgroundColor: p.texteMuet, opacity: 0.7 }]} />
              <Text style={[typo.micro, { color: p.texteDoux }]}>TES {comparaison.n} AUTRES</Text>
            </View>
          </View>
        </View>
      ) : (
        <Text style={[typo.petit, { color: p.texteMuet }]}>Pas assez de sorties proches pour comparer : il en faut au moins 3, du même sport et d'une distance voisine.</Text>
      )}

      <View style={{ gap: espace.e2 }}>
        <Text style={[typo.micro, styles.titreCoach, { color: couleurTexte }]}>LE MOT DU COACH</Text>
        <View accessible accessibilityLabel={[mot.titre, ...mot.paragraphes].join(' ')} style={[styles.bloc, styles.mot, { backgroundColor: p.surface }]}>
          <Text style={[typo.titre3, { color: p.texte }]}>{mot.titre}</Text>
          {mot.paragraphes.map((t) => (
            <Text key={t} style={[typo.corps, { color: p.texteDoux }]}>
              {t}
            </Text>
          ))}
        </View>
      </View>

      {proposition && ajout !== 'ecarte' ? (
        <View style={[styles.proposition, { borderColor: couleur, backgroundColor: p.surface }]}>
          <Text style={[typo.micro, { color: couleurTexte }]}>PROPOSITION</Text>
          <Text style={[typo.corpsFort, { color: p.texte }]}>{proposition.texte}</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{proposition.sousTexte}</Text>
          {erreur ? (
            <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
              {erreur}
            </Text>
          ) : null}
          {ajout === 'fait' ? (
            <Text accessibilityLiveRegion="polite" style={[typo.corpsFort, { color: p.ok }]}>
              ✓ Ajouté au calendrier
            </Text>
          ) : (
            <View style={styles.boutons}>
              <View style={{ flex: 1 }}>
                <Bouton onPress={() => void ajouter()} disabled={ajout === 'encours'} accessibilityLabel={`Ajouter au calendrier : ${proposition.texte}`}>
                  {ajout === 'encours' ? 'Ajout…' : 'Ajouter au calendrier'}
                </Bouton>
              </View>
              <Bouton variante="discret" onPress={() => setAjout('ecarte')}>
                Pas maintenant
              </Bouton>
            </View>
          )}
        </View>
      ) : null}
    </>
  );
}

/** Une mesure : son nom et sa valeur, un mot de verdict, et la bande avec les points. */
function Ligne({ ligne, couleur, premiere }: { ligne: LigneComparaison; couleur: string; premiere: boolean }) {
  const p = usePalette();
  const couleurVerdict = ligne.verdict === 'mieux' ? p.ok : ligne.verdict === 'moins' ? p.alerte : p.texteDoux;
  return (
    <View
      accessible
      accessibilityLabel={`${ligne.libelle} ${ligne.texte}, ${ligne.mot}`}
      style={[styles.ligne, !premiere && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={styles.rangee}>
        <Text style={[typo.petit, { color: p.texteDoux }]}>{ligne.libelle}</Text>
        <Text style={styles.valeur}>
          <Text style={{ color: p.texte }}>{ligne.texte}</Text>
          <Text style={[styles.mot2, { color: couleurVerdict }]}> · {ligne.mot}</Text>
        </Text>
      </View>
      <View style={styles.bande}>
        <View style={[styles.axe, { backgroundColor: p.trait }]} />
        {ligne.autres.map((a, i) => (
          <View key={i} style={[styles.autre, { left: `${a * 100}%`, backgroundColor: p.texteMuet }]} />
        ))}
        <View style={[styles.moi, { left: `${ligne.position * 100}%`, backgroundColor: couleur, borderColor: p.surface }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { borderRadius: rayon.base, paddingHorizontal: 14, paddingVertical: 8 },
  mot: { paddingVertical: 14, gap: espace.e2 },
  ligne: { paddingVertical: 10, gap: 8 },
  rangee: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  valeur: { fontFamily: police.titre700, fontSize: 15, fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  mot2: { fontFamily: police.texte600, fontSize: 13 },
  bande: { height: 20, justifyContent: 'center', marginHorizontal: 8 },
  axe: { height: 2, borderRadius: 1 },
  autre: { position: 'absolute', width: 10, height: 10, borderRadius: 5, marginLeft: -5, top: 5, opacity: 0.7 },
  moi: { position: 'absolute', width: 18, height: 18, borderRadius: 9, marginLeft: -9, top: 1, borderWidth: 2 },
  legende: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 6 },
  rangeeLegende: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointLegende: { width: 10, height: 10, borderRadius: 5 },
  titreCoach: { fontFamily: police.titre700, letterSpacing: 1 },
  proposition: { borderWidth: 1.5, borderRadius: rayon.bloc, padding: 14, gap: 6 },
  boutons: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
});
