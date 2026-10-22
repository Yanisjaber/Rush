import { FondDegrade } from '@/components/FondDegrade';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bientot } from '@/actions/bientot';
import { BarreSports } from '@/components/BarreSports';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { chargeJour, decalerMois, grilleMois, JOURS_SEMAINE, jourVide, profilSemaine, resumeSemaine, secondesJour, teinteJour, type JourGrille } from '@/data/calendrier';
import { couleurNote, libelleNote } from '@/data/annotations';
import { familleAffichage, garderSeance } from '@/data/familles';
import { dateIsoLocale, formatDuree } from '@/data/format';
import { useDonneesCalendrier } from '@/hooks/useDonneesCalendrier';
import { useMenu } from '@/stores/menu';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const nomSport = (sport: string) => SPORTS[familleAffichage(sport) as CleSport]?.court ?? SPORTS.autre.court;
const BARRE_ONGLETS = 72;
// Jusqu'à 5 séances se voient d'un coup d'œil sur un jour (un point chacune) : au-delà, un « + »
const MAX_POINTS = 5;
const dateLongue = (iso: string) => {
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Le calendrier d'un mois en grille (lundi à dimanche) : chaque jour montre des points, plein = séance faite (couleur du sport), contour = séance
// prévue, carré noir = compétition. Un appui sur un jour affiche son détail dessous. Peu de texte : le mois se lit d'un coup d'œil.
// Lecture seule pour l'instant : ajouter une séance, une note ou un repos arrive avec leurs panneaux.
export default function Calendrier() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { filtre } = useMenu();
  const maintenant = useMemo(() => new Date(), []);
  const aujourdhui = dateIsoLocale(maintenant);
  const [cible, setCible] = useState({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() });
  const [choisi, setChoisi] = useState(aujourdhui);
  const { donnees, chargement, erreur, actualisation, recharger } = useDonneesCalendrier(cible.annee, cible.mois);

  const grille = useMemo(() => {
    const garde = (x: { sport?: string }) => garderSeance(x, filtre);
    return grilleMois(
      cible.annee,
      cible.mois,
      {
        seances: donnees.seances.filter(garde),
        planifiees: donnees.planifiees.filter(garde),
        objectifs: donnees.objectifs,
        notes: donnees.notes,
        repos: donnees.repos,
      },
      maintenant,
    );
  }, [cible, donnees, filtre, maintenant]);

  const jours = grille.semaines.flat();
  const dansMois = jours.filter((j) => j.dansMois);
  const seancesDuMois = dansMois.flatMap((j) => j.seances);
  const tempsDuMois = seancesDuMois.reduce((t, s) => t + (s.moving_time || 0), 0);
  const titre = grille.titre.charAt(0).toUpperCase() + grille.titre.slice(1);
  const estMoisCourant = cible.annee === maintenant.getFullYear() && cible.mois === maintenant.getMonth();
  const detail = jours.find((j) => j.iso === choisi) ?? null;
  // Le jour le plus long du mois (au moins 1 h 30) : c'est lui qui donne la hauteur d'une barre pleine dans la colonne de la semaine
  const maxiJour = Math.max(90 * 60, ...jours.map(secondesJour));

  // En changeant de mois, on choisit aujourd'hui (mois courant), sinon le premier jour qui a quelque chose, sinon le 1er
  useEffect(() => {
    if (estMoisCourant) setChoisi(aujourdhui);
    else setChoisi(dansMois.find((j) => !jourVide(j))?.iso ?? dansMois[0]?.iso ?? choisi);
    // le choix suit le mois affiché et l'arrivée des données, pas chaque rendu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible, chargement]);

  return (
    <View style={[styles.page, { backgroundColor: 'transparent' }]}>
      <FondDegrade />
      <BarreSports />
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS }]}
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={recharger} tintColor={p.texteDoux} />}
      >
        <View style={styles.navigation}>
          <Fleche sens={-1} onPress={() => setCible((c) => decalerMois(c.annee, c.mois, -1))} />
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[typo.titre2, styles.titreMois, { color: p.texte }]}>
            {titre}
          </Text>
          <Fleche sens={1} onPress={() => setCible((c) => decalerMois(c.annee, c.mois, 1))} />
        </View>

        <View style={styles.resume}>
          <View accessible accessibilityLabel={`${seancesDuMois.length} séance${seancesDuMois.length > 1 ? 's' : ''} ce mois-ci, ${formatDuree(tempsDuMois)}`} style={styles.chiffres}>
            <Chiffre valeur={String(seancesDuMois.length)} unite={seancesDuMois.length > 1 ? 'séances' : 'séance'} />
            <Chiffre valeur={formatDuree(tempsDuMois)} />
          </View>
          {!estMoisCourant ? (
            <Pressable
              onPress={() => setCible({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() })}
              accessibilityRole="button"
              accessibilityLabel="Revenir à aujourd'hui"
              style={[styles.retour, { borderColor: p.contourChamp }]}
            >
              <Text style={[typo.corpsFort, { color: p.texte }]}>Aujourd'hui</Text>
            </Pressable>
          ) : null}
        </View>

        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}

        {chargement ? (
          <View accessible accessibilityLabel="Chargement du calendrier" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : (
          <>
            <View style={[styles.grille, { backgroundColor: p.surface }]}>
              <View style={styles.rangee} accessible={false} importantForAccessibility="no-hide-descendants">
                <View style={styles.jours}>
                  {JOURS_SEMAINE.map((n, i) => (
                    <Text key={i} style={[typo.micro, styles.entete, { color: p.texteMuet }]}>
                      {n.charAt(0)}
                    </Text>
                  ))}
                </View>
                <Text style={[typo.micro, styles.enteteSemaine, { color: p.texteMuet }]}>Sem.</Text>
              </View>
              {grille.semaines.map((semaine) => (
                <View key={semaine[0].iso} style={styles.rangee}>
                  <View style={styles.jours}>
                    {semaine.map((j) => (
                      <Case key={j.iso} jour={j} choisi={j.iso === choisi} onPress={() => setChoisi(j.iso)} />
                    ))}
                  </View>
                  <ProfilSemaine semaine={semaine} maxi={maxiJour} />
                </View>
              ))}
            </View>

            {detail ? <Detail jour={detail} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Fleche({ sens, onPress }: { sens: -1 | 1; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sens < 0 ? 'Mois précédent' : 'Mois suivant'}
      hitSlop={4}
      style={({ pressed }) => [styles.fleche, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.chevron, { borderColor: p.texte, transform: [{ rotate: sens < 0 ? '-135deg' : '45deg' }] }]} />
    </Pressable>
  );
}

function Chiffre({ valeur, unite }: { valeur: string; unite?: string }) {
  const p = usePalette();
  return (
    <View style={styles.chiffre}>
      <Text style={[styles.chiffreValeur, { color: p.texte }]}>{valeur}</Text>
      {unite ? <Text style={[typo.petit, { color: p.texteDoux }]}>{unite}</Text> : null}
    </View>
  );
}

// Les marques d'un jour (au plus cinq points) : séance faite = point plein de la couleur du sport, prévue = contour, compétition = carré.
// Une note n'est pas un point : elle plie le coin de la case (voir CoinPlie).
function marquesDe(j: JourGrille): { cle: string; type: 'fait' | 'prevu' | 'objectif'; couleur?: string }[] {
  return [
    ...j.objectifs.map((o) => ({ cle: `o${o.id}`, type: 'objectif' as const })),
    ...j.seances.map((s) => ({ cle: `s${s.id}`, type: 'fait' as const, couleur: familleAffichage(s.sport) })),
    ...j.planifiees.map((x) => ({ cle: `p${x.id}`, type: 'prevu' as const, couleur: familleAffichage(x.sport) })),
  ];
}

// Le coin plié : « il y a une note sur ce jour ». Le coin supérieur droit de la case se replie comme un coin de page, dans la couleur de la note
// (orange pour une blessure, rouge pour une maladie…). Un triangle plus sombre fait le pli. La case l'arrondit (overflow caché), il ne touche jamais le chiffre.
function CoinPlie({ couleur }: { couleur: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 20 20" accessible={false}>
      <Path d="M0 0H20V20Z" fill={couleur} />
      <Path d="M20 20L8 8H20Z" fill="rgba(0,0,0,0.28)" />
    </Svg>
  );
}

function Case({ jour, choisi, onPress }: { jour: JourGrille; choisi: boolean; onPress: () => void }) {
  const p = usePalette();
  const marques = jour.dansMois ? marquesDe(jour) : [];
  const label = [
    dateLongue(jour.iso),
    ...jour.objectifs.map((o) => `compétition : ${o.name}`),
    ...(jour.repos ? ['repos'] : []),
    ...jour.notes.map(libelleNote),
    ...jour.seances.map((s) => `${s.name || nomSport(s.sport)}, ${formatDuree(s.moving_time)}`),
    ...jour.planifiees.map((x) => `séance prévue : ${x.name || nomSport(x.sport)}`),
  ].join(', ');
  if (!jour.dansMois) return <View style={styles.case} />;
  // Le jour se teinte de la couleur de son sport dominant, d'autant plus fort que sa charge est grande (de 14 % à 50 % d'opacité)
  const teinte = teinteJour(jour);
  const fond = teinte ? avecAlpha(couleurSport(p, teinte.famille), 0.14 + 0.36 * teinte.force) : undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: choisi }}
      accessibilityLabel={label}
      style={[styles.case, fond ? { backgroundColor: fond } : null, choisi && { borderColor: p.texte, borderWidth: 2 }]}
    >
      {jour.notes.length ? (
        <View style={styles.coin} pointerEvents="none">
          <CoinPlie couleur={couleurNote(jour.notes[0].color)} />
        </View>
      ) : null}
      <View style={[styles.numero, jour.aujourdhui && { backgroundColor: p.texte }]}>
        <Text style={[styles.numeroTexte, { color: jour.aujourdhui ? p.fond : jour.futur ? p.texteDoux : p.texte }]}>{jour.num}</Text>
      </View>
      <View style={styles.points}>
        {marques.slice(0, MAX_POINTS).map((m) =>
          m.type === 'fait' ? (
            <View key={m.cle} style={[styles.point, { backgroundColor: couleurSport(p, m.couleur) }]} />
          ) : m.type === 'prevu' ? (
            <View key={m.cle} style={[styles.point, { borderColor: couleurSport(p, m.couleur), borderWidth: 1.5 }]} />
          ) : (
            <View key={m.cle} style={[styles.carre, { backgroundColor: p.dossardFond, borderColor: p.texte }]} />
          ),
        )}
        {jour.repos && !marques.length ? <View style={[styles.barre, { backgroundColor: p.traitFort }]} /> : null}
        {marques.length > MAX_POINTS ? <Text style={[styles.plus, { color: p.texteDoux }]}>+</Text> : null}
      </View>
    </Pressable>
  );
}

const heures = (secondes: number) => String(Math.round((secondes / 3600) * 10) / 10).replace('.', ',');
const HAUTEUR_PROFIL = 24;

// Le profil de la semaine : sept petites barres (une par jour, de lundi à dimanche) à la hauteur du temps du jour, de la couleur de son sport dominant,
// pâles quand il n'y a que du prévu ; les heures de la semaine (faites + prévues) dessous.
function ProfilSemaine({ semaine, maxi }: { semaine: JourGrille[]; maxi: number }) {
  const p = usePalette();
  const r = resumeSemaine(semaine);
  const total = r.faites + r.prevues;
  const jours = profilSemaine(semaine);
  return (
    <View
      accessible
      accessibilityLabel={total ? `Semaine du ${dateLongue(semaine[0].iso)} : ${formatDuree(r.faites)} faites${r.prevues ? `, ${formatDuree(r.prevues)} prévues` : ''}, ${r.charge} points de charge` : `Semaine du ${dateLongue(semaine[0].iso)} : rien`}
      style={styles.semaine}
    >
      <View style={styles.profil}>
        {jours.map((j) => (
          <View
            key={j.iso}
            style={[
              styles.jourProfil,
              { height: j.secondes ? Math.max(3, (j.secondes / maxi) * HAUTEUR_PROFIL) : 2, backgroundColor: j.famille ? couleurSport(p, j.famille) : p.traitFort, opacity: j.fait || !j.secondes ? 1 : 0.35 },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.heures, { color: total ? p.texteDoux : p.texteMuet }]}>{total ? heures(total) : '—'}</Text>
    </View>
  );
}

// Le détail du jour choisi : ses séances en pastilles pleines, ses séances prévues en pointillés, sa compétition, son repos, ses notes
function Detail({ jour }: { jour: JourGrille }) {
  const router = useRouter();
  const p = usePalette();
  // « 2h14 faites · 110 pts · 54 min prévues » : ce que le jour pèse, d'un coup d'œil
  const faites = jour.seances.reduce((t, s) => t + (s.moving_time || 0), 0);
  const prevues = jour.planifiees.reduce((t, x) => t + (Number(x.duration) > 0 ? Number(x.duration) * 60 : 0), 0);
  const morceaux = [faites ? `${formatDuree(faites)} faites · ${chargeJour(jour)} pts` : '', prevues ? `${formatDuree(prevues)} prévues` : ''].filter(Boolean);
  const resume = morceaux.length ? { texte: morceaux.join(' · '), etiquette: morceaux.join(', ').replace('pts', 'points de charge') } : null;
  return (
    <Bloc titre={dateLongue(jour.iso)}>
      {resume ? (
        <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 8 }]} accessibilityLabel={resume.etiquette}>
          {resume.texte}
        </Text>
      ) : null}
      {jourVide(jour) ? (
        <Text style={[styles.tiret, { color: p.texteMuet }]}>—</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {jour.objectifs.map((o) => (
            <View key={o.id} accessible accessibilityLabel={`Compétition : ${o.name}`} style={[styles.objectif, { backgroundColor: p.dossardFond }]}>
              <Text numberOfLines={1} style={[styles.objectifTexte, { color: p.dossardTexte }]}>
                {o.name}
              </Text>
            </View>
          ))}
          {jour.repos ? (
            <View style={[styles.etiquette, { borderColor: p.traitFort }]}>
              <Text style={[typo.petit, { color: p.texteDoux }]}>Repos</Text>
            </View>
          ) : null}
          {jour.notes.map((n) => (
            <View key={n.id} style={[styles.note, { borderLeftColor: couleurNote(n.color), backgroundColor: p.surface2 }]}>
              <Text numberOfLines={2} style={[typo.petit, { color: p.texte }]}>
                {libelleNote(n)}
              </Text>
            </View>
          ))}
          {jour.seances.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push({ pathname: '/seance', params: { id: s.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${s.name || nomSport(s.sport)}, ${formatDuree(s.moving_time)}`}
              style={[styles.seance, { backgroundColor: couleurSport(p, familleAffichage(s.sport)) }]}
            >
              <Text numberOfLines={1} style={[typo.corpsFort, { color: p.encreSurCouleur, flex: 1 }]}>
                {s.name || nomSport(s.sport)}
              </Text>
              <Text style={[typo.corpsFort, { color: p.encreSurCouleur }]}>{formatDuree(s.moving_time)}</Text>
            </Pressable>
          ))}
          {jour.planifiees.map((x) => (
            <Pressable
              key={x.id}
              onPress={() => bientot('La modification de séance prévue')}
              accessibilityRole="button"
              accessibilityLabel={`Séance prévue : ${x.name || nomSport(x.sport)}`}
              style={[styles.seance, { borderColor: couleurSport(p, familleAffichage(x.sport)), borderWidth: 2, borderStyle: 'dashed' }]}
            >
              <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
                {x.name || nomSport(x.sport)}
              </Text>
              {x.duration ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{formatDuree(x.duration * 60)}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ marginTop: 12 }}>
        <Bouton variante="discret" onPress={() => bientot('La planification de séance')}>
          + Planifier une séance
        </Bouton>
      </View>
    </Bloc>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e3 },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fleche: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 12, height: 12, borderTopWidth: 2.5, borderRightWidth: 2.5 },
  titreMois: { flex: 1, textAlign: 'center' },
  resume: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace.e3, minHeight: 44 },
  chiffres: { flexDirection: 'row', alignItems: 'baseline', gap: espace.e5 },
  chiffre: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  chiffreValeur: { fontFamily: police.titre800, fontSize: 32, lineHeight: 36, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  retour: { minHeight: 44, borderWidth: 1.5, borderRadius: rayon.rond, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  grille: { borderRadius: rayon.bloc, paddingHorizontal: 8, paddingVertical: 10, gap: 4 },
  rangee: { flexDirection: 'row', alignItems: 'stretch' },
  jours: { flex: 1, flexDirection: 'row' },
  entete: { width: `${100 / 7}%`, textAlign: 'center', paddingBottom: 4 },
  enteteSemaine: { width: 46, textAlign: 'right', paddingBottom: 4, paddingRight: 4 },
  semaine: { width: 46, justifyContent: 'center', alignItems: 'flex-end', gap: 3, paddingRight: 4 },
  heures: { fontFamily: police.titre700, fontSize: 12, lineHeight: 15, fontVariant: ['tabular-nums'] },
  profil: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: HAUTEUR_PROFIL },
  jourProfil: { width: 4, borderRadius: 2 },
  case: { width: `${100 / 7}%`, minHeight: 58, alignItems: 'center', paddingTop: 4, borderRadius: rayon.base, borderWidth: 1, borderColor: 'transparent', gap: 4, overflow: 'hidden' },
  numero: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numeroTexte: { fontFamily: police.titre700, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  points: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 10 },
  point: { width: 6, height: 6, borderRadius: 3 },
  carre: { width: 6, height: 6, borderRadius: 1.5, borderWidth: 1 },
  coin: { position: 'absolute', top: 0, right: 0 },
  barre: { width: 10, height: 3, borderRadius: 2 },
  plus: { fontSize: 10, lineHeight: 10, fontFamily: police.texte600 },
  tiret: { fontSize: 28, lineHeight: 32 },
  seance: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: rayon.base, paddingHorizontal: 14 },
  objectif: { borderRadius: rayon.base, paddingHorizontal: 12, paddingVertical: 8 },
  objectifTexte: { fontFamily: police.titre800, fontSize: 15, lineHeight: 19 },
  etiquette: { alignSelf: 'flex-start', borderRadius: rayon.rond, borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 12, paddingVertical: 6 },
  note: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 10, paddingVertical: 8 },
});
