import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbeNiveau } from '@/components/graphes/CourbeNiveau';
import { ProgresCourse } from '@/components/graphes/ProgresCourse';
import { ProgresVelo } from '@/components/graphes/ProgresVelo';
import { OngletsSegment } from '@/components/menus/OngletsSegment';
import { Bouton } from '@/components/ui/Bouton';
import { Dossard } from '@/components/ui/Dossard';
import { IconeSport } from '@/components/ui/IconeSport';
import type { DureeRecord, RecordsAnnee, SerieNiveau } from '@/data/bilan/niveau-annees';
import { serieRecord } from '@/data/bilan/niveau-annees';
import { ecartAuSommet, formatMarge, formatNiveau, libellePeriode, type GenreNiveau } from '@/data/bilan/niveau-annees-affichage';
import type { PeriodeProgression, Progression } from '@/data/bilan/progression';
import { formatNum } from '@/data/outils/format';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Progrès du vélo et de la course : le niveau année après année (maquette 1 de « Progrès par année »). Le dossard donne le score de l'année (100 = ton meilleur niveau mesuré),
// la courbe montre le niveau trimestre par trimestre avec sa marge d'erreur, et la liste donne chaque année. Sous la courbe du vélo, un sélecteur change la courbe pour tes records
// (5, 20, 60 minutes : une valeur par année). Le bouton « Comment c'est calculé » ouvre la preuve : les 12 derniers mois contre les 12 mois d'avant (verdict, fourchette, nuage, cascade).
// Calculs : data/bilan/niveau-annees.ts et docs/native/PROGRESSION_NIVEAU.md.
type Choix = 'endurance' | DureeRecord;

const NOMS_CHOIX: Record<Choix, string> = { endurance: 'Endurance', w300: '5 min', w1200: '20 min', w3600: '60 min' };
const NOMS_RECORD: Record<DureeRecord, string> = { w300: 'Meilleur 5 min', w1200: 'Meilleur 20 min', w3600: 'Meilleur 60 min' };

/** Les deux flèches opposées (agrandir) ou face à face (réduire) du bouton en haut à droite de la courbe. */
function IconeElargir({ reduire, couleur }: { reduire: boolean; couleur: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {reduire ? (
        <Path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
      ) : (
        <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      )}
    </Svg>
  );
}

interface Props {
  famille: 'velo' | 'course';
  /** Le niveau d'endurance (watts ou allure à cardio égal). */
  serie: SerieNiveau;
  /** Les records de chaque année (vélo seulement ; vide en course ou le temps du chargement). */
  records: RecordsAnnee[];
  /** La comparaison des 12 derniers mois aux 12 mois d'avant : la preuve du calcul. */
  preuve: Progression | null;
  jours: PeriodeProgression;
}

export function ProgresNiveau({ famille, serie, records, preuve, jours }: Props) {
  const p = usePalette();
  const [choix, setChoix] = useState<Choix>('endurance');
  const [preuveOuverte, setPreuveOuverte] = useState(false);
  const [toutVoir, setToutVoir] = useState(false);
  const couleur = couleurSport(p, famille);
  const seriesRecords = useMemo(() => {
    if (famille !== 'velo') return [];
    return (['w300', 'w1200', 'w3600'] as const).map((d) => ({ duree: d, serie: serieRecord(records, d) })).filter((r): r is { duree: DureeRecord; serie: SerieNiveau } => r.serie !== null);
  }, [famille, records]);
  const choisie = choix === 'endurance' ? null : seriesRecords.find((r) => r.duree === choix);
  const actuelle = choisie ? choisie.serie : serie;
  const genre: GenreNiveau = choisie ? 'record' : famille;
  const mode = choisie ? 'annuel' : 'tranches';
  const ecart = ecartAuSommet(actuelle);
  const nomSport = famille === 'course' ? 'Course à pied' : 'Cyclisme';
  const indicateur = choisie ? NOMS_RECORD[choisie.duree] : famille === 'course' ? 'Allure à cardio égal' : 'Watts à cardio égal';
  const lieu = actuelle.fcReference ? ` à ${actuelle.fcReference} bpm` : '';
  const annees = [...actuelle.annuel].reverse();
  // La courbe montre les 3 dernières années ; la flèche en haut à droite du bloc ouvre tout l'historique (seulement s'il y a plus de 3 ans)
  const peutElargir = actuelle.actuel.an - actuelle.annuel[0].an >= 3;
  const depuisAn = peutElargir && !toutVoir ? actuelle.actuel.an - 2 : undefined;

  return (
    <View style={styles.page}>
      <View style={styles.tete}>
        <IconeSport sport={famille} taille={22} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>{nomSport}</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{indicateur}</Text>
        </View>
      </View>

      {famille === 'velo' && seriesRecords.length ? (
        <OngletsSegment<Choix>
          etiquette="Ce que montre la courbe"
          taille={13}
          onglets={[{ cle: 'endurance', nom: NOMS_CHOIX.endurance }, ...seriesRecords.map((r) => ({ cle: r.duree as Choix, nom: NOMS_CHOIX[r.duree] }))]}
          actuel={choix}
          onChoisir={setChoix}
        />
      ) : null}

      <Dossard
        sport={famille}
        etiquette={`${choisie ? NOMS_RECORD[choisie.duree] : 'Niveau'} en ${actuelle.actuel.an}`}
        valeur={String(Math.round(actuelle.actuel.score))}
        uniteValeur="/ 100"
        detail={`${ecart < 1 ? (actuelle.actuel.cle === actuelle.meilleur.cle ? 'Ton meilleur niveau' : 'Au niveau de ton meilleur') : `${formatNum(ecart)} point${Math.round(ecart) > 1 ? 's' : ''} sous ton meilleur niveau`}\nMeilleur : ${libellePeriode(actuelle.meilleur.cle)} · ${formatNiveau(genre, actuelle.meilleur.niveau)}${lieu}`}
        chiffreMax={64}
      />

      <Bloc>
        <View style={styles.enteteBloc}>
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, styles.flex, { color: p.texte }]}>{choisie ? 'Ton record dans le temps' : 'Ton niveau dans le temps'}</Text>
          {peutElargir ? (
            <Pressable
              onPress={() => setToutVoir((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={toutVoir ? 'Revenir aux 3 dernières années' : "Voir tout l'historique"}
              style={[styles.fleche, { backgroundColor: p.surface2 }]}
            >
              <IconeElargir reduire={toutVoir} couleur={p.texte} />
            </Pressable>
          ) : null}
        </View>
        <CourbeNiveau
          serie={actuelle}
          mode={mode}
          depuisAn={depuisAn}
          couleur={couleur}
          etiquette={`Évolution de ton niveau en ${nomSport}${choisie ? `, ${NOMS_RECORD[choisie.duree]}` : ''}. Score de ${actuelle.annuel.map((a) => `${a.an} : ${Math.round(a.score)}`).join(', ')}, où 100 est ton meilleur niveau.`}
        />
      </Bloc>

      <Bloc titre="Par année">
        <View>
          {annees.map((a, i) => (
            <View
              key={a.cle}
              accessible
              accessibilityLabel={`${a.an} : score ${Math.round(a.score)} sur 100, ${formatNiveau(genre, a.niveau)}${a.demi > 0 ? `, ${formatMarge(genre, a.demi)}` : ''}${a.n !== null ? `, ${a.n} sorties` : ''}${a.an === actuelle.meilleur.an ? ', meilleur niveau' : ''}`}
              style={[styles.ligne, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.trait }]}
            >
              <Text style={[typo.corpsFort, styles.annee, { color: p.texte }]}>{a.an}</Text>
              <View style={styles.flex}>
                <Text style={[typo.petit, { color: p.texte }]}>
                  <Text style={styles.gras}>{formatNiveau(genre, a.niveau)}</Text>
                  {a.demi > 0 ? <Text style={{ color: p.texteDoux }}> {formatMarge(genre, a.demi)}</Text> : null}
                </Text>
                {a.n !== null ? <Text style={[typo.petit, { color: p.texteDoux }]}>{a.n} sortie{a.n > 1 ? 's' : ''}</Text> : null}
              </View>
              <View style={[styles.score, { backgroundColor: a.an === actuelle.meilleur.an ? avecAlpha(couleur, 0.22) : p.surface2 }]}>
                <Text style={[typo.petit, styles.gras, { color: a.an === actuelle.meilleur.an ? couleur : p.texteDoux }]}>{a.an === actuelle.meilleur.an ? 'meilleur' : Math.round(a.score)}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[typo.petit, { color: p.texteDoux }]}>
          {choisie ? 'Score : 100 = ton meilleur record, 0 = un record 30 % en dessous.' : `Niveau${lieu}, sur route. Score : 100 = ton meilleur niveau, 0 = un niveau 30 % en dessous.`}
        </Text>
      </Bloc>

      <Bouton variante="discret" onPress={() => setPreuveOuverte((o) => !o)} accessibilityLabel={preuveOuverte ? 'Masquer le calcul' : "Voir comment c'est calculé"}>
        {preuveOuverte ? 'Masquer le calcul' : "Comment c'est calculé"}
      </Bouton>

      {preuveOuverte ? (
        <View style={styles.preuve}>
          <Text style={[typo.petit, { color: p.texteDoux }]}>
            La preuve : tes 12 derniers mois contre les 12 mois d'avant, avec le calcul étape par étape. Le niveau ci-dessus utilise la même méthode, sur tout ton historique d'un coup.
          </Text>
          {preuve && preuve.detailVelo && famille === 'velo' ? <ProgresVelo progression={preuve} jours={jours} /> : null}
          {preuve && preuve.detailCourse && famille === 'course' ? <ProgresCourse progression={preuve} jours={jours} /> : null}
          {preuve && !preuve.detailVelo && !preuve.detailCourse ? (
            <Bloc>
              <Text style={[typo.corps, { color: p.texteDoux }]}>{preuve.manque}</Text>
            </Bloc>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: espace.e3 },
  flex: { flex: 1, minWidth: 0 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  sous: { marginBottom: 8 },
  enteteBloc: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  fleche: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, minHeight: 44 },
  annee: { width: 46, fontVariant: ['tabular-nums'] },
  gras: { fontFamily: police.texte600, fontVariant: ['tabular-nums'] },
  score: { borderRadius: rayon.rond, paddingHorizontal: 10, paddingVertical: 3, minWidth: 44, alignItems: 'center' },
  preuve: { gap: espace.e3 },
});
