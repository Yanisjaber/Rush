import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import type { RecordTop } from '@/data/bilan/records';
import { texteRecordSimple, texteValeurRecord, EnAnnee, enAnnee } from '@/data/bilan/records-texte';
import { formatDateLongue } from '@/data/outils/format';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les records basiques d'un sport : de mini tuiles (quatre par rangée). On en touche une, son détail sort dessous :
// la valeur et ce que vaut l'autre période, et le classement des 30 meilleures séances (on touche une ligne pour l'ouvrir).
// Le même écran sert au vélo, à la course, à la natation, à la musculation et à l'Hyrox : seuls les records changent.
interface Props {
  records: RecordTop[];
  /** Les mêmes records sur l'autre période (« Tous temps » si on regarde une année, l'année sinon), pour dire « Ton record absolu » ou « Record absolu : … ». */
  recordsAutre: RecordTop[];
  /** La période choisie dans le menu de l'année : l'année (« annee ») ou tout l'historique (« tout »). */
  portee: 'annee' | 'tout';
  annee: number;
  maintenant: Date;
  couleur: string;
  onOuvrir: (id: string) => void;
}

/** « Lundi 6 avril 2026 » : avec l'année, qui compte en « Tous temps ». */
const dateAnnee = (iso: string): string => `${formatDateLongue(iso)} ${iso.slice(0, 4)}`;

/** La hauteur d'une ligne du classement : la zone qui défile en montre exactement trois. */
const HAUTEUR_LIGNE = 70;

/** Le nom d'un record sur une mini tuile (quatre par rangée, donc très étroite) : le détail, qui sort au toucher, donne le nom entier. */
const NOM_TUILE: Record<string, string> = { duree: 'Durée', distance: 'Distance', dplus: 'D+', tss: 'Charge', vmoy: 'Vitesse moy.', pmoy: 'Puiss. moy.', fcmoy: 'FC moy.', kj: 'Énergie' };

export function TuilesRecords({ records, recordsAutre, portee, annee, maintenant, couleur, onOuvrir }: Props) {
  const p = usePalette();
  const [ouvert, setOuvert] = useState<string | null>(null); // le record dont le détail est sorti

  /** Ce que vaut l'autre période pour un record : une coche quand c'est le même record. */
  const comparaison = (a: number | undefined, b: number | undefined, unite: string): { texte: string; ok: boolean } | null => {
    if (a == null) return null;
    if (portee === 'annee') {
      if (b == null) return null;
      return a >= b - 1e-9 ? { texte: 'Ton record absolu', ok: true } : { texte: `Record absolu : ${texteRecordSimple(b, unite)}`, ok: false };
    }
    if (b == null) return { texte: `Rien ${enAnnee(annee, maintenant)}`, ok: false };
    return Math.abs(a - b) < 1e-9 ? { texte: `Fait ${enAnnee(annee, maintenant)}`, ok: true } : { texte: `${EnAnnee(annee, maintenant)} : ${texteRecordSimple(b, unite)}`, ok: false };
  };

  const r = records.find((x) => x.cle === ouvert);
  return (
    <>
      {/* De mini tuiles, quatre par rangée ; on en touche une pour que son détail sorte dessous */}
      <View style={styles.mini}>
        {records.map((x) => {
          const t = texteValeurRecord(x.top[0].valeur, x.unite);
          const actif = ouvert === x.cle;
          return (
            <Pressable
              key={x.cle}
              onPress={() => setOuvert(actif ? null : x.cle)}
              accessibilityRole="button"
              accessibilityState={{ expanded: actif }}
              accessibilityLabel={`${x.libelle}, ${texteRecordSimple(x.top[0].valeur, x.unite)}. Voir le détail`}
              style={[styles.tuileMini, { backgroundColor: p.surface, borderTopColor: couleur }, actif && { borderColor: p.texte, borderWidth: 1.5, borderTopWidth: 3, borderTopColor: couleur }]}
            >
              <Text numberOfLines={2} style={[styles.nomMini, { color: p.texteDoux }]}>
                {NOM_TUILE[x.cle] ?? x.libelle}
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.valeurMini, { color: p.texte }]}>
                {t.nombre}
                {t.unite ? <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none' }]}> {t.unite}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {r ? (
        <Bloc titre={r.libelle}>
          <Text style={[styles.valeurDetail, { color: p.texte }]}>
            {texteValeurRecord(r.top[0].valeur, r.unite).nombre}
            {texteValeurRecord(r.top[0].valeur, r.unite).unite ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {texteValeurRecord(r.top[0].valeur, r.unite).unite}</Text> : null}
          </Text>
          {(() => {
            const cmp = comparaison(r.top[0].valeur, recordsAutre.find((x) => x.cle === r.cle)?.top[0]?.valeur, r.unite);
            return cmp ? (
              <Text style={[typo.petit, { color: cmp.ok ? p.texte : p.texteMuet }]}>
                {cmp.ok ? '✓ ' : ''}
                {cmp.texte}
              </Text>
            ) : null;
          })()}

          {/* Le classement : une barre par séance, proportionnelle au record ; on touche une ligne pour ouvrir la séance */}
          <View style={[styles.entete, { borderTopColor: p.trait }]}>
            <Text style={[typo.corpsFort, { color: p.texteDoux, flex: 1 }]}>Classement</Text>
            <Text style={[typo.petit, { color: p.texteMuet }]}>
              {r.top.length} {r.top.length > 1 ? 'séances' : 'séance'}
            </Text>
          </View>
          {/* Une zone de hauteur fixe qui défile : tout le classement (jusqu'à 30 séances) sans allonger la page */}
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.zoneClassement} contentContainerStyle={styles.contenuClassement} accessibilityLabel={`Classement de ${r.top.length} séances`}>
            {r.top.map((x, i) => {
              const tx = texteValeurRecord(x.valeur, r.unite);
              const largeur = `${Math.max(4, Math.min(100, (x.valeur / r.top[0].valeur) * 100))}%` as `${number}%`;
              const contenu = (
                <>
                  <View style={styles.ligneClassement}>
                    <Text numberOfLines={1} style={[styles.rang, { color: i === 0 ? p.texte : p.texteMuet }]}>
                      {i + 1}
                    </Text>
                    <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
                      {x.nom}
                    </Text>
                    <Text style={[styles.valeurPodium, { color: p.texte }]}>
                      {tx.nombre}
                      {tx.unite ? <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none' }]}> {tx.unite}</Text> : null}
                    </Text>
                  </View>
                  <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
                    <View style={{ width: largeur, height: '100%', borderRadius: 3, backgroundColor: couleur, opacity: i === 0 ? 1 : 0.6 }} />
                  </View>
                  <Text style={[typo.petit, styles.dateClassement, { color: p.texteMuet }]}>{dateAnnee(x.iso)}</Text>
                </>
              );
              const etiquette = `${i + 1}, ${x.nom}, ${dateAnnee(x.iso)}, ${texteRecordSimple(x.valeur, r.unite)}`;
              return x.id ? (
                <Pressable key={`${x.iso}-${i}`} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} onPress={() => onOuvrir(x.id as string)} style={styles.classement}>
                  {contenu}
                </Pressable>
              ) : (
                <View key={`${x.iso}-${i}`} accessible accessibilityLabel={etiquette} style={styles.classement}>
                  {contenu}
                </View>
              );
            })}
          </ScrollView>
        </Bloc>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  mini: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tuileMini: { width: '23.1%', minHeight: 70, borderRadius: rayon.base, borderTopWidth: 3, borderWidth: 0, paddingHorizontal: 7, paddingTop: 8, paddingBottom: 8, gap: 1 },
  nomMini: { fontFamily: police.texte600, fontSize: 10, lineHeight: 13, letterSpacing: 0.2, textTransform: 'uppercase', minHeight: 28 },
  valeurMini: { fontFamily: police.titre800, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  valeurDetail: { fontFamily: police.titre800, fontSize: 18, lineHeight: 22, marginBottom: 0, fontVariant: ['tabular-nums'] },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  // La zone déborde de 10 pt dans la marge de la carte : la barre de défilement s'y dessine, pas sur les valeurs
  zoneClassement: { height: HAUTEUR_LIGNE * 3, marginRight: -10 },
  contenuClassement: { paddingRight: 14 },
  classement: { height: HAUTEUR_LIGNE, paddingVertical: 8 },
  ligneClassement: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  piste: { height: 6, borderRadius: 3, marginLeft: 38, marginTop: 4, overflow: 'hidden' },
  dateClassement: { marginLeft: 38, marginTop: 2 },
  rang: { width: 30, fontFamily: police.titre800, fontSize: 18 },
  valeurPodium: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
});
