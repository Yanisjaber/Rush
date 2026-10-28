import { StyleSheet, Text as TexteRN, View } from 'react-native';
import { TraitTirets } from '@/components/TraitTirets';
import Svg, { Circle, Line, Path, Text } from 'react-native-svg';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { CADRE, CADRE_M, CADRE_S, geometriePuissance, LIBELLES_CLES } from '@/data/sports/puissance';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tes meilleures puissances de 5 secondes à 1 heure, sur 90 jours (trait plein) et sur toute la vie (tirets).
// Chaque taille ajoute à la précédente :
//  - XS : ta meilleure puissance sur 20 minutes, en une ligne ;
//  - S  : le même chiffre et la forme de la courbe (sans libellés) ;
//  - M  : la courbe sur 90 jours avec ses repères (5 s, 1 min, 5 min, 20 min, 1 h) et les watts de chacun ;
//  - L  : la grande courbe, avec la courbe de toute la vie, la légende et tous les libellés qui tiennent.
export function WidgetPuissance({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();

  if (taille === 'xs' || taille === 's') {
    const g = geometriePuissance(contexte.puissance);
    const cle = g?.points.find((pt) => pt.label === '20 min') ?? g?.points[g.points.length - 1];
    // La forme de S ne garde que les 90 jours : l'échelle est celle de cette courbe seule, elle ne s'aplatit pas à cause du record de toute la vie
    const forme = taille === 's' ? geometriePuissance(contexte.puissance?.map((l) => ({ ...l, watts_alltime: 0 })), CADRE_S) : null;
    return (
      <Tuile titre={cle ? `Puissance ${cle.label}` : 'Puissance'} valeur={cle ? String(cle.watts) : '—'} unite={cle ? 'W' : ''} note={cle ? (taille === 's' ? 'Max sur 90 jours' : 'Meilleure sur 90 jours') : 'Pas encore de sortie avec puissance'}>
        {forme ? (
          <Svg accessible accessibilityRole="image" accessibilityLabel="Forme de ta courbe de puissance sur 90 jours" width="100%" viewBox={`0 0 ${CADRE_S.largeur} ${CADRE_S.hauteur}`} style={{ aspectRatio: CADRE_S.largeur / CADRE_S.hauteur }}>
            <Path d={forme.ligne90} fill="none" stroke={p.sportVelo} strokeWidth={3} strokeLinecap="round" />
            {forme.points.filter((pt) => pt.label === cle?.label).map((pt) => (
              <Circle key={pt.label} cx={pt.x} cy={pt.y} r={4} fill={p.sportVelo} />
            ))}
          </Svg>
        ) : null}
      </Tuile>
    );
  }

  const grand = taille === 'l';
  const cadre = grand ? CADRE : CADRE_M;
  const g = geometriePuissance(contexte.puissance, cadre);
  const { largeur, hauteur, gauche, droite } = cadre;
  // Libellés montrés : en L tous ceux qui ne se chevauchent pas (de gauche à droite, 56 unités minimum entre deux), en M les durées clés
  let dernierX = -Infinity;
  const montres = (g?.points ?? []).filter((pt) => {
    if (!grand) return LIBELLES_CLES.includes(pt.label);
    if (pt.x - dernierX < 56) return false;
    dernierX = pt.x;
    return true;
  });

  return (
    <CadreWidget titre="Courbe de puissance">
      {g ? (
        <>
          {grand ? (
            <View style={styles.legende}>
              <View style={styles.item}>
                <View style={[styles.traitPlein, { backgroundColor: p.sportVelo }]} />
                <TexteRN style={[typo.petit, { color: p.texteDoux }]}>90 jours</TexteRN>
              </View>
              <View style={styles.item}>
                <TraitTirets couleur={p.texteDoux} epaisseur={2} largeur={16} />
                <TexteRN style={[typo.petit, { color: p.texteDoux }]}>Toute la vie</TexteRN>
              </View>
            </View>
          ) : null}
          <Svg
            accessible
            accessibilityRole="image"
            accessibilityLabel="Meilleures puissances de 5 secondes à 1 heure, sur 90 jours"
            width="100%"
            viewBox={`0 0 ${largeur} ${hauteur}`}
            style={{ aspectRatio: largeur / hauteur }}
          >
            <Line x1={gauche} y1={g.base} x2={largeur - droite} y2={g.base} stroke={p.traitFort} strokeWidth={1} />
            {grand ? <Path d={g.ligneTout} fill="none" stroke={p.texteDoux} strokeWidth={2} strokeDasharray="6 6" /> : null}
            <Path d={g.ligne90} fill="none" stroke={p.sportVelo} strokeWidth={grand ? 3.4 : 3} strokeLinecap="round" />
            {g.points.map((pt) => (
              <Circle key={pt.label} cx={pt.x} cy={pt.y} r={4.5} fill={!grand && pt.label === '20 min' ? p.sportVelo : p.fond} stroke={p.sportVelo} strokeWidth={2.6} />
            ))}
            {montres.map((pt) => (
              <Text key={`w-${pt.label}`} x={pt.x} y={pt.y - 10} textAnchor="middle" fontFamily={police.titre700} fontSize={15} fill={p.texte}>
                {pt.watts}
              </Text>
            ))}
            {montres.map((pt) => (
              <Text key={`d-${pt.label}`} x={pt.x} y={hauteur - (grand ? 12 : 4)} textAnchor="middle" fontFamily={police.texte400} fontSize={15} fill={p.texteDoux}>
                {pt.label}
              </Text>
            ))}
          </Svg>
          {grand ? <TexteRN style={[typo.petit, { color: p.texteMuet, marginTop: 4 }]}>Watts</TexteRN> : null}
        </>
      ) : (
        <TexteRN style={[typo.corps, { color: p.texteDoux }]}>Pas encore assez de sorties avec puissance pour tracer ta courbe.</TexteRN>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  legende: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  traitPlein: { width: 16, height: 3, borderRadius: 2 },
});
