import { useContext, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget, TitreWidget } from '@/components/widgets/CadreWidget';
import { ContexteTaille } from '@/components/ui/taille';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le contenu « chiffre clé » d'un widget en taille XS, S ou M : un titre, un gros chiffre, une note et (en dessous ou à droite) une mini visualisation.
// Le cadre (arrondi, marges, titre en pastille) est celui de tous les widgets : voir CadreWidget. Port de components/Tuile.svelte.
//  - S : une demi-ligne (160 pt de haut) : le chiffre, la note, puis le visuel en bas.
//  - M : toute la largeur, une ligne : le chiffre et la note à gauche, le visuel à droite.
//  - XS : une ligne fine (60 pt) : titre et chiffre à gauche, la note à droite, pas de visuel.
interface Props {
  titre: string;
  valeur: string;
  unite?: string;
  note?: string;
  /** Un chiffre plus gros (écrans qui mettent leurs chiffres clés en avant, comme Santé). */
  gros?: boolean;
  /** En M : la partie visuelle prend 60 % de la largeur (un vrai graphique ou une liste détaillée) au lieu de 42 %. */
  large?: boolean;
  children?: ReactNode;
}

export function Tuile({ titre, valeur, unite, note, gros, large, children }: Props) {
  const taille = useContext(ContexteTaille);
  return (
    <CadreWidget titre={taille === 'xs' ? undefined : titre} serre>
      <Contenu titre={titre} valeur={valeur} unite={unite} note={note} gros={gros} large={large}>
        {children}
      </Contenu>
    </CadreWidget>
  );
}

// Une note ne se coupe pas après une barre oblique (« 5'05"/km » restait coupé en « 5'05"/ » puis « km »)
const sansCoupure = (texte: string) => texte.replace(/\/(?=\S)/g, '/\u2060');

// Dans un composant à part : il lit la palette fournie par le cadre (inversée quand le widget est en look dossard)
function Contenu({ titre, valeur, unite, note, gros, large, children }: Props) {
  const p = usePalette();
  const taille = useContext(ContexteTaille);
  const chiffre = (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.valeur, gros && styles.valeurGrosse, taille === 'xs' && styles.valeurFine, { color: p.texte }]}>
      {valeur}
      {unite ? <Text style={[typo.petit, { color: p.texteDoux }]}> {unite}</Text> : null}
    </Text>
  );

  if (taille === 'xs') {
    return (
      <View accessible accessibilityLabel={[titre, valeur, unite, note].filter(Boolean).join(' ')} style={styles.fine}>
        <View style={styles.gauche}>
          <TitreWidget titre={titre} serre petit />
          {chiffre}
        </View>
        {note ? (
          <Text numberOfLines={2} style={[typo.petit, styles.noteFine, { color: p.texteDoux }]}>
            {sansCoupure(note)}
          </Text>
        ) : null}
      </View>
    );
  }

  const texte = (
    <View style={taille === 'm' ? styles.gauche : undefined}>
      {chiffre}
      {note ? (
        // En S avec un mini-graphique, une seule ligne de note : un titre sur deux lignes ne doit pas pousser le graphique hors du cadre
        <Text numberOfLines={taille === 's' && children ? 1 : 2} style={[typo.petit, { color: p.texteDoux }]}>
          {sansCoupure(note)}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View accessible accessibilityLabel={[titre, valeur, unite, note].filter(Boolean).join(' ')} style={taille === 'm' ? styles.ligne : styles.colonne}>
      {texte}
      {children ? <View style={taille === 'm' ? [styles.visuelLigne, large && styles.visuelLarge] : styles.visuel}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  valeur: { fontFamily: police.titre700, fontSize: 28, lineHeight: 32, marginTop: 6 },
  valeurGrosse: { fontSize: 38, lineHeight: 42 },
  // 60 pt de haut : le chiffre est plus petit que dans les autres tailles
  valeurFine: { marginTop: 0, fontSize: 22, lineHeight: 26 },
  fine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  gauche: { flex: 1, minWidth: 0 },
  noteFine: { flexShrink: 1, maxWidth: '42%', textAlign: 'right' },
  colonne: { flex: 1 },
  ligne: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  visuelLigne: { width: '42%', justifyContent: 'center' },
  visuelLarge: { width: '60%' },
  visuel: { marginTop: 'auto', paddingTop: 8 },
});
