import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { OngletsSegment } from '@/components/menus/OngletsSegment';
import { activitesAnnee, MESURES_CUMUL, type ActiviteBilan, type MetriqueCumul } from '@/data/bilan/bilan';
import { periodesParSport, seancesLesPlusChargees } from '@/data/bilan/records';
import { dateCourte, jourMois, texteRecordSimple, texteValeurRecord, enAnnee } from '@/data/bilan/records-texte';
import { rayon } from '@/theme/couleurs';
import { SPORTS, couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records de « Tous les sports » : trois vues du même classement, séance par séance, semaine par semaine ou mois par mois.
//  - Séance : les séances les plus chargées, tous sports mélangés (la pastille donne le sport).
//  - Semaine et Mois : les meilleures périodes pour la mesure choisie, chaque barre découpée aux couleurs des sports qui la composent.
interface Props {
  /** La période choisie dans le menu de l'année : l'année (« annee ») ou tout l'historique (« tout »). */
  portee: 'annee' | 'tout';
  toutes: ActiviteBilan[];
  annee: number;
  maintenant: Date;
  mesure: MetriqueCumul;
  onMesure: (m: MetriqueCumul) => void;
  onOuvrir: (id: string) => void;
}

type Vue = 'seance' | 'semaine' | 'mois';
const VUES: { cle: Vue; nom: string }[] = [
  { cle: 'seance', nom: 'Séance' },
  { cle: 'semaine', nom: 'Semaine' },
  { cle: 'mois', nom: 'Mois' },
];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const SEANCES_AFFICHEES = 10;
const PERIODES_AFFICHEES = 6;

/** Le nom court d'un sport pour la légende : « Vélo », « Course »… ; une famille inconnue garde son nom. */
const nomSport = (famille: string): string => (Object.hasOwn(SPORTS, famille) ? SPORTS[famille as keyof typeof SPORTS].court : famille);

export function OngletRecordsTous({ portee, toutes, annee, maintenant, mesure, onMesure, onOuvrir }: Props) {
  const p = usePalette();
  const [vue, setVue] = useState<Vue>('seance');
  const nomPortee = portee === 'annee' ? String(annee) : 'Tous temps';
  const acts = useMemo(() => (portee === 'annee' ? activitesAnnee(toutes, annee, maintenant) : toutes), [portee, toutes, annee, maintenant]);
  const mesureInfo = MESURES_CUMUL.find((m) => m.cle === mesure) ?? MESURES_CUMUL[0];

  const seances = useMemo(() => seancesLesPlusChargees(acts, SEANCES_AFFICHEES), [acts]);
  const periodes = useMemo(() => (vue === 'seance' ? [] : periodesParSport(acts, mesure, vue, PERIODES_AFFICHEES)), [acts, mesure, vue]);
  const sports = useMemo(() => [...new Set(periodes.flatMap((x) => x.parts.map((y) => y.famille)))], [periodes]);
  const vide = `Pas encore de record${portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.`;

  return (
    <>
      <OngletsSegment<Vue> etiquette="Records par séance, semaine ou mois" onglets={VUES} actuel={vue} onChoisir={setVue} />

      {vue === 'seance' ? (
        <Bloc titre={`Séances les plus chargées · ${nomPortee}`}>
          {seances.length ? (
            seances.map((s, i) => {
              const etiquette = `${i + 1}, ${s.nom}, ${nomSport(s.famille ?? '')}, ${dateCourte(s.iso)}, ${texteRecordSimple(s.valeur, 'TSS')}`;
              const contenu = (
                <>
                  <Text numberOfLines={1} style={[styles.rang, { color: i === 0 ? p.texte : p.texteMuet }]}>
                    {i + 1}
                  </Text>
                  <View style={[styles.pastille, { backgroundColor: couleurSport(p, s.famille) }]} />
                  <View style={styles.centre}>
                    <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
                      {s.nom}
                    </Text>
                    <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet }]}>
                      {nomSport(s.famille ?? '')} · {dateCourte(s.iso)}
                    </Text>
                  </View>
                  <Text style={[styles.valeur, { color: p.texte }]}>
                    {texteValeurRecord(s.valeur, 'TSS').nombre}
                    <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none' }]}> TSS</Text>
                  </Text>
                </>
              );
              return s.id ? (
                <Pressable key={`${s.id}-${i}`} onPress={() => onOuvrir(s.id as string)} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} style={styles.ligne}>
                  {contenu}
                </Pressable>
              ) : (
                <View key={`${s.iso}-${i}`} accessible accessibilityLabel={etiquette} style={styles.ligne}>
                  {contenu}
                </View>
              );
            })
          ) : (
            <Text style={[typo.corps, { color: p.texteDoux }]}>{vide}</Text>
          )}
        </Bloc>
      ) : (
        <Bloc>
          <View style={styles.entete}>
            <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
              {vue === 'semaine' ? 'Meilleures semaines' : 'Meilleurs mois'}
            </Text>
            <MenuMesure etiquette="Mesure des records" valeur={mesure} options={MESURES_CUMUL.map((m) => ({ cle: m.cle, nom: m.nom }))} onChoisir={(c) => onMesure(c as MetriqueCumul)} />
          </View>
          {periodes.length ? (
            <>
              {periodes.map((x, i) => {
                const t = texteValeurRecord(x.total, mesureInfo.unite);
                const titre = vue === 'semaine' ? `Semaine du ${jourMois(x.iso)}` : `${MOIS[Number(x.iso.slice(5, 7)) - 1][0].toUpperCase()}${MOIS[Number(x.iso.slice(5, 7)) - 1].slice(1)} ${x.iso.slice(0, 4)}`;
                const texte = t.unite ? `${t.nombre} ${t.unite}` : t.nombre;
                const detail = x.parts.map((y) => `${nomSport(y.famille)} ${texteRecordSimple(y.valeur, mesureInfo.unite)}`).join(', ');
                return (
                  <View key={x.iso} accessible accessibilityLabel={`${i + 1}, ${titre}, ${texte}. ${detail}`} style={styles.periode}>
                    <View style={styles.ligneTitre}>
                      <Text numberOfLines={1} style={[styles.rang, { color: i === 0 ? p.texte : p.texteMuet }]}>
                        {i + 1}
                      </Text>
                      <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
                        {titre}
                      </Text>
                      <Text style={[styles.valeur, { color: p.texte }]}>{texte}</Text>
                    </View>
                    {/* La barre est proportionnelle au record et découpée par sport */}
                    <View style={styles.zonePiste}>
                      <View style={[styles.piste, { width: `${Math.max(8, (x.total / periodes[0].total) * 100)}%` as `${number}%` }]}>
                        {x.parts.map((y) => (
                          <View key={y.famille} style={{ flex: y.valeur, backgroundColor: couleurSport(p, y.famille) }} />
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}
              <View style={styles.legende} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {sports.map((f) => (
                  <View key={f} style={styles.puce}>
                    <View style={[styles.pastille, { backgroundColor: couleurSport(p, f) }]} />
                    <Text style={[typo.petit, { color: p.texteDoux }]}>{nomSport(f)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={[typo.corps, { color: p.texteDoux }]}>{vide}</Text>
          )}
        </Bloc>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6 },
  periode: { paddingVertical: 8, gap: 6 },
  ligneTitre: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rang: { width: 30, fontFamily: police.titre800, fontSize: 18 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  centre: { flex: 1 },
  valeur: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
  zonePiste: { marginLeft: 40 },
  piste: { height: 10, borderRadius: rayon.s, overflow: 'hidden', flexDirection: 'row' },
  legende: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  puce: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
