import { StyleSheet, Text, View } from 'react-native';
import { BarresHebdo } from '@/components/BarresHebdo';
import { CadreWidget } from '@/components/CadreWidget';
import { MiniBarres } from '@/components/MiniBarres';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import type { Taille } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le squelette des widgets « une valeur de la semaine + une barre par semaine » (tonnage, charge de muscu, natation par semaine).
//  - XS : la valeur et sa note, une ligne ;
//  - S  : + les 8 dernières semaines en mini-barres ;
//  - M  : + les semaines en vraies barres, avec la ligne de ta moyenne en pointillés ;
//  - L  : + le titre complet, le badge, trois repères chiffrés (moyenne, meilleure semaine, écart) et la légende.
interface Props {
  taille?: Taille;
  couleur: string;
  /** Titres : tuile (court) et grand format. */
  titreTuile: string;
  titreL: string;
  /** La valeur de la semaine, déjà formatée, et son unité. */
  valeur: string;
  unite: string;
  /** Une valeur par semaine, de la plus ancienne à la plus récente. */
  parSemaine: number[];
  /** Comment écrire un nombre (milliers, arrondi…). */
  formater: (n: number) => string;
  /** « +11 % vs habitude » : le texte du badge et sa tonalité. Null : pas de comparaison possible. */
  badge: { texte: string; ton: 'ok' | 'alerte' | 'neutre' } | null;
  /** La note de la tuile quand il n'y a pas de badge. */
  periode: string;
  /** La phrase qui explique le calcul, en bas du grand format. */
  pied: string;
  /** Les phrases des cas vides : tuile et grand format. */
  videTuile: string;
  videL: string;
  etiquette: string;
  /** La moyenne s'écrit avec une décimale (des séances par semaine : 1,8). */
  decimale?: boolean;
  /** L'unité du total des semaines, quand elle diffère de celle de la valeur (« séances » pour « /sem. »). */
  uniteTotal?: string;
}

export function SerieHebdo({ taille = 'm', couleur, titreTuile, titreL, valeur, unite, parSemaine, formater, badge, periode, pied, videTuile, videL, etiquette, decimale, uniteTotal }: Props) {
  const p = usePalette();
  const aDesDonnees = parSemaine.some((v) => v > 0);
  const moyenne = parSemaine.length ? parSemaine.reduce((a, b) => a + b, 0) / parSemaine.length : 0;
  const meilleure = Math.max(0, ...parSemaine);
  const note = aDesDonnees ? (badge ? badge.texte : periode) : videTuile;

  if (taille !== 'l') {
    return (
      <Tuile titre={titreTuile} valeur={aDesDonnees ? valeur : '—'} unite={aDesDonnees ? unite : ''} note={note} large>
        {!aDesDonnees ? null : taille === 's' ? (
          <MiniBarres valeurs={parSemaine.slice(-8)} couleur={couleur} etiquette={etiquette} />
        ) : taille === 'm' ? (
          <BarresHebdo valeurs={parSemaine} couleur={couleur} hauteur={78} repere={moyenne} etiquette={`${etiquette}, ligne en pointillés : ta moyenne`} />
        ) : null}
      </Tuile>
    );
  }

  const ton = badge?.ton ?? 'neutre';
  return (
    <CadreWidget titre={titreL}>
      {aDesDonnees ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {valeur}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {unite}</Text>
            </Text>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: ton === 'ok' ? avecAlpha(p.ok, 0.16) : ton === 'alerte' ? avecAlpha(p.alerte, 0.16) : p.surface2 }]}>
                <Text style={[typo.petit, styles.badgeTexte, { color: ton === 'ok' ? p.ok : ton === 'alerte' ? p.alerte : p.texteDoux }]}>{badge.texte}</Text>
              </View>
            ) : null}
          </View>
          <BarresHebdo valeurs={parSemaine} couleur={couleur} hauteur={84} repere={moyenne} etiquette={`${etiquette}, ligne en pointillés : ta moyenne`} />
          <View style={styles.stats}>
            <StatCle etiquette="Moyenne" valeur={decimale ? String(Math.round(moyenne * 10) / 10).replace('.', ',') : formater(Math.round(moyenne))} unite={unite} petit />
            <StatCle etiquette="Meilleure" valeur={formater(meilleure)} unite={unite} petit />
            <StatCle etiquette="Total" valeur={formater(parSemaine.reduce((a, b) => a + b, 0))} unite={uniteTotal ?? unite} petit />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>{pied}</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>{videL}</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 14, rowGap: 6, marginBottom: 12 },
  valeur: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
});
