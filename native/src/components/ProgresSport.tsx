import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { CourbeLissee } from '@/components/CourbeLissee';
import { IconeSport } from '@/components/IconeSport';
import { StatCle } from '@/components/StatCle';
import { PERIODES_PROGRESSION, type PeriodeProgression, type Progression } from '@/data/bilan/progression';
import { MOT, formatPct, formatValeurProgression } from '@/data/bilan/progression-texte';
import { avecAlpha, rayon } from '@/theme/couleurs';
import { SPORTS, couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le bloc d'un sport dans l'onglet Progrès du Bilan : le verdict en gros, la courbe de la période (100 = ton niveau d'avant), puis l'ancienne et la nouvelle valeur.
// `courbe` : voir courbeProgression (data/progression.ts), vide quand il n'y a rien à tracer.
export function ProgresSport({ progression, courbe, jours }: { progression: Progression; courbe: number[]; jours: PeriodeProgression }) {
  const p = usePalette();
  const periode = PERIODES_PROGRESSION.find((x) => x.jours === jours)!;
  const nom = (SPORTS as Record<string, { nom: string }>)[progression.famille]?.nom ?? progression.famille;
  const couleur = couleurSport(p, progression.famille);
  const mesure = progression.statut !== 'insuffisant';
  const couleurVerdict = progression.statut === 'hausse' ? p.ok : progression.statut === 'baisse' ? p.alerte : p.texteDoux;
  // La courbe tient toujours autour de 100 : sans ça, un petit écart ressemblerait à un grand bond
  const bas = Math.min(100, ...courbe);
  const haut = Math.max(100, ...courbe);
  const marge = Math.max(2, (haut - bas) * 0.15);

  return (
    <Bloc>
      <View style={styles.tete}>
        <IconeSport sport={progression.famille} taille={22} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>{nom}</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{progression.indicateur}</Text>
        </View>
      </View>

      {mesure ? (
        <>
          <View style={styles.verdict}>
            <Text style={[styles.pct, { color: couleurVerdict }]}>{formatPct(progression.variationPct!)}</Text>
            <View style={[styles.mot, { backgroundColor: progression.statut === 'stable' ? p.surface2 : avecAlpha(couleurVerdict, 0.16) }]}>
              <Text style={[typo.petit, styles.motTexte, { color: couleurVerdict }]}>{MOT[progression.statut]}</Text>
            </View>
          </View>
          <Text style={[typo.petit, { color: p.texteDoux }]}>sur {periode.nom}, comparés aux {periode.nom} d'avant</Text>
          {courbe.length >= 2 ? (
            <View style={styles.courbe}>
              <CourbeLissee
                valeurs={courbe}
                couleur={couleur}
                hauteur={110}
                min={bas - marge}
                max={haut + marge}
                etiquette={`Évolution de ton niveau en ${nom} sur ${periode.nom} : ${courbe.map((v) => Math.round(v)).join(', ')}, où 100 est ton niveau de la période d'avant`}
              />
              <Text style={[typo.micro, { color: p.texteMuet }]}>100 = ton niveau d'avant · au-dessus, tu progresses</Text>
            </View>
          ) : null}
          <View style={styles.reperes}>
            <StatCle etiquette="Avant" valeur={formatValeurProgression(progression, progression.avant)} petit />
            <StatCle etiquette="Maintenant" valeur={formatValeurProgression(progression, progression.actuel)} petit couleur={couleurVerdict} />
          </View>
        </>
      ) : (
        <Text style={[typo.corps, styles.vide, { color: p.texteDoux }]}>{progression.manque}</Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verdict: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  pct: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  mot: { borderRadius: rayon.rond, paddingHorizontal: 10, paddingVertical: 3 },
  motTexte: { fontFamily: police.texte600 },
  courbe: { marginTop: 12, gap: 4 },
  reperes: { flexDirection: 'row', gap: 32, marginTop: 14 },
  vide: { marginTop: 10 },
});
