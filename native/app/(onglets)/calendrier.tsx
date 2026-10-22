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
import { chargeJour, chiffresSemaine, decalerMois, grilleMois, JOURS_SEMAINE, jourVide, profilSemaine, resumeSemaine, secondesJour, teinteJour, type JourGrille, type UniteSemaine } from '@/data/calendrier';
import { couleurNote, libelleNote } from '@/data/annotations';
import { familleAffichage, garderSeance } from '@/data/familles';
import { dateIsoLocale, formatDuree, formatHeuresMinutes } from '@/data/format';
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
        cycles: donnees.cycles,
        // Les séries de force ne comptent que pour « Tous » et la musculation
        series: filtre === 'tout' || filtre === 'muscu' ? donnees.series : [],
      },
      maintenant,
    );
  }, [cible, donnees, filtre, maintenant]);

  const jours = grille.semaines.flat();
  const dansMois = jours.filter((j) => j.dansMois);
  const seancesDuMois = dansMois.flatMap((j) => j.seances);
  const tempsDuMois = seancesDuMois.reduce((t, s) => t + (s.moving_time || 0), 0);
  const chargeDuMois = dansMois.reduce((t, j) => t + chargeJour(j), 0);
  const principaleDuMois = chiffresSemaine(dansMois, filtre).principale;
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
          {/* Sur un autre mois, le titre est aussi le bouton de retour à aujourd'hui (titre suivi de l'icône ↺) */}
          <View style={styles.titreZone}>
            {estMoisCourant ? (
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[typo.titre2, { color: p.texte }]}>
                {titre}
              </Text>
            ) : (
              <Pressable
                onPress={() => setCible({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() })}
                accessibilityRole="button"
                accessibilityLabel={`${titre}. Revenir à aujourd'hui`}
                style={styles.titreBouton}
              >
                <Text accessibilityLiveRegion="polite" style={[typo.titre2, { color: p.texte }]}>{titre}</Text>
                <View style={[styles.retourIcone, { borderColor: p.contourChamp }]}>
                  <Text style={[styles.retourFleche, { color: p.texteDoux }]}>↺</Text>
                </View>
              </Pressable>
            )}
          </View>
          <Fleche sens={1} onPress={() => setCible((c) => decalerMois(c.annee, c.mois, 1))} />
        </View>

        {/* Les chiffres du mois en cartes : séances, temps, charge et, pour un sport qui en a une, son info principale (kilomètres ou séries, comme la colonne « Sem. ») */}
        <View style={styles.cartes}>
          <Carte valeur={String(seancesDuMois.length)} unite="séan." legende={seancesDuMois.length > 1 ? 'séances' : 'séance'} />
          <Carte valeur={formatDuree(tempsDuMois)} legende="de sport" />
          <Carte valeur={chargeDuMois.toLocaleString('fr-FR')} unite="pts" legende="points de charge" />
          {principaleDuMois ? <Carte valeur={nombre(principaleDuMois.valeur)} unite={UNITES[principaleDuMois.unite].court} legende={UNITES[principaleDuMois.unite].dit} /> : null}
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
              {/* Le fond de la colonne « Sem. » : une bande un peu plus claire sur toute la hauteur, derrière les lignes */}
              <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.fondSemaine, { backgroundColor: p.surface2 }]} />
              <View style={[styles.rangee, styles.enteteBande, { backgroundColor: p.surface2 }]} accessible={false} importantForAccessibility="no-hide-descendants">
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
                      <View key={j.iso} style={styles.emplacement}>
                        <Case jour={j} choisi={j.iso === choisi} onPress={() => setChoisi(j.iso)} />
                      </View>
                    ))}
                  </View>
                  <ProfilSemaine semaine={semaine} maxi={maxiJour} mono={filtre === 'tout'} filtre={filtre} />
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

// Un chiffre du mois dans sa carte, centré, avec son unité en plus petit juste à côté (« 102 km ») ; la légende complète sert aux lecteurs d'écran
function Carte({ valeur, unite, legende }: { valeur: string; unite?: string; legende: string }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={`${valeur} ${legende}`} style={[styles.carte, { backgroundColor: p.surface }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.carteValeur, { color: p.texte }]}>
        {valeur}
        {unite ? <Text style={[styles.carteUnite, { color: p.texteDoux }]}> {unite}</Text> : null}
      </Text>
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
    ...jour.cycles.map((c) => `cycle : ${c.name}`),
    ...jour.notes.map(libelleNote),
    ...jour.seances.map((s) => `${s.name || nomSport(s.sport)}, ${formatDuree(s.moving_time)}`),
    ...jour.planifiees.map((x) => `séance prévue : ${x.name || nomSport(x.sport)}`),
  ].join(', ');
  // Un jour d'un autre mois : juste son numéro, très pâle (pas de case, pas de points, pas touchable, ignoré des lecteurs d'écran)
  if (!jour.dansMois) {
    return (
      <View style={styles.case} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={styles.numero}>
          <Text style={[styles.numeroTexte, { color: p.texteMuet, opacity: 0.4 }]}>{jour.num}</Text>
        </View>
      </View>
    );
  }
  // Le jour se teinte de gris, d'autant plus fort que sa charge est grande (de 10 % à 40 % d'opacité) : aucune couleur de sport sur les cases, les pastilles les portent
  const teinte = teinteJour(jour);
  const fond = teinte ? avecAlpha(p.sportNeutre, 0.1 + 0.3 * teinte.force) : undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: choisi }}
      accessibilityLabel={label}
      style={[styles.case, fond ? { backgroundColor: fond } : null, choisi && { borderColor: p.texte, borderWidth: 2 }]}
    >
      {jour.cycles.length ? (
        // Les cycles d'entraînement : une bande de la couleur du cycle au bas de la case, deux au plus (l'une au-dessus de l'autre)
        <View style={styles.bandes} pointerEvents="none">
          {jour.cycles.map((c) => (
            <View key={c.id} style={[styles.bande, { backgroundColor: couleurNote(c.color) }]} />
          ))}
        </View>
      ) : null}
      {jour.notes.length ? (
        <View style={styles.coin} pointerEvents="none">
          <CoinPlie couleur={couleurNote(jour.notes[0].color)} />
        </View>
      ) : null}
      <View style={[styles.numero, jour.aujourdhui && styles.aujourdhui, jour.aujourdhui && { backgroundColor: p.texte }]}>
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

const courteDate = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const HAUTEUR_PROFIL = 22;

// Les deux infos de la colonne de la semaine : le temps (toujours) et, pour un sport choisi, son info principale (voir METRIQUE_DU_SPORT : kilomètres, séries, dénivelé)
const UNITES: Record<UniteSemaine, { court: string; dit: string }> = {
  km: { court: 'km', dit: 'kilomètres' },
  series: { court: 'sér.', dit: 'séries' },
};
// Au-delà de 100, les décimales n'apportent rien et prennent de la place : 266 km, pas 266,4 km
const nombre = (n: number) => String(n >= 100 ? Math.round(n) : n).replace('.', ',');

// Le récap de la semaine : le temps et l'info du sport en haut (à la hauteur du haut des cases) et, en bas (à la hauteur du bas des cases), le profil des sept jours :
// une petite barre par jour, de lundi à dimanche, à la hauteur du temps du jour, de la couleur de son sport dominant, pâle quand il n'y a que du prévu.
// Sur « Tous », ses barres sont grises (aucun sport n'est mis en avant) et il n'y a que le temps ; la couleur et l'info du sport reviennent quand on choisit un sport.
function ProfilSemaine({ semaine, maxi, mono, filtre }: { semaine: JourGrille[]; maxi: number; mono: boolean; filtre: string }) {
  const p = usePalette();
  const r = resumeSemaine(semaine);
  const total = r.faites + r.prevues;
  const jours = profilSemaine(semaine);
  const c = chiffresSemaine(semaine, filtre);
  return (
    <View
      accessible
      accessibilityLabel={
        total
          ? `Semaine du ${dateLongue(semaine[0].iso)} : ${formatDuree(r.faites)} faites${r.prevues ? `, ${formatDuree(r.prevues)} prévues` : ''}${c.principale ? `, ${nombre(c.principale.valeur)} ${UNITES[c.principale.unite].dit}` : ''}, ${r.charge} points de charge`
          : `Semaine du ${dateLongue(semaine[0].iso)} : rien`
      }
      style={styles.semaine}
    >
      <View style={styles.chiffresSemaine}>
        <Text style={[styles.chiffreSemaine, { color: total ? p.texteDoux : p.texteMuet }]}>
          {total ? formatHeuresMinutes(c.secondes) : '—'}
        </Text>
        {c.principale ? (
          <Text style={[styles.chiffreSemaine, { color: p.texte }]}>
            {nombre(c.principale.valeur)}
            <Text style={styles.unite}> {UNITES[c.principale.unite].court}</Text>
          </Text>
        ) : null}
      </View>
      <View style={styles.profil}>
        {jours.map((j) => (
          <View
            key={j.iso}
            style={[
              styles.jourProfil,
              { height: j.secondes ? Math.max(3, (j.secondes / maxi) * HAUTEUR_PROFIL) : 2, backgroundColor: j.famille ? (mono ? p.sportNeutre : couleurSport(p, j.famille)) : p.traitFort, opacity: j.fait || !j.secondes ? 1 : 0.35 },
            ]}
          />
        ))}
      </View>
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
      {jour.cycles.length ? (
        <View style={{ gap: 4, marginBottom: 8 }}>
          {jour.cycles.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: '/cycle', params: { id: c.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Cycle ${c.name}, du ${courteDate(c.from_date)} au ${courteDate(c.to_date)}`}
              style={styles.cycleLigne}
            >
              <View style={[styles.cycleBande, { backgroundColor: couleurNote(c.color) }]} />
              <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flexShrink: 1 }]}>
                {c.name}
              </Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                {courteDate(c.from_date)} – {courteDate(c.to_date)}
              </Text>
            </Pressable>
          ))}
        </View>
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
  titreZone: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  // Titre sur un autre mois : au moins 44 pt de haut pour le toucher, sans fond
  titreBouton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  retourIcone: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  retourFleche: { fontSize: 15, lineHeight: 18 },
  cartes: { flexDirection: 'row', gap: 6 },
  carte: { flex: 1, minHeight: 56, borderRadius: rayon.base, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  carteUnite: { fontFamily: police.texte600, fontSize: 11, letterSpacing: 0 },
  carteValeur: { fontFamily: police.titre800, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  cycleLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  cycleBande: { width: 6, height: 26, borderRadius: 3 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  grille: { borderRadius: rayon.bloc, paddingHorizontal: 8, paddingVertical: 10, gap: 4, overflow: 'hidden' },
  rangee: { flexDirection: 'row', alignItems: 'stretch' },
  // Collée au bord droit, en haut et en bas de la carte : c'est la carte (overflow hidden) qui arrondit les coins de la bande
  // La ligne des jours : même teinte que la colonne « Sem. », de bord à bord en haut de la carte (marges négatives = le padding de la carte)
  enteteBande: { marginHorizontal: -8, marginTop: -10, paddingHorizontal: 8, paddingTop: 10 },
  fondSemaine: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 62 },
  jours: { flex: 1, flexDirection: 'row' },
  entete: { width: `${100 / 7}%`, textAlign: 'center', paddingBottom: 8 },
  enteteSemaine: { width: 54, textAlign: 'right', paddingBottom: 8, paddingRight: 4 },
  // Le chiffre en haut, le profil en bas : la colonne a la hauteur des cases, ses deux blocs s'alignent sur leur haut et leur bas
  semaine: { width: 54, justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 4, paddingBottom: 2, paddingRight: 4 },
  chiffresSemaine: { alignItems: 'flex-end' },
  chiffreSemaine: { fontFamily: police.titre700, fontSize: 12, lineHeight: 14, fontVariant: ['tabular-nums'] },
  unite: { fontFamily: police.texte600, fontSize: 9, lineHeight: 14 },
  profil: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: HAUTEUR_PROFIL },
  jourProfil: { width: 4, borderRadius: 2 },
  // Un septième de la rangée, avec un petit vide de chaque côté : c'est lui qui espace les cases entre elles
  emplacement: { width: `${100 / 7}%`, paddingHorizontal: 2 },
  case: { width: '100%', minHeight: 58, alignItems: 'center', paddingTop: 4, borderRadius: rayon.base, borderWidth: 1, borderColor: 'transparent', gap: 2, overflow: 'hidden' },
  numero: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  // Aujourd'hui : un carré arrondi, serré autour du chiffre (la même hauteur totale que les autres jours : 22 + 2 × 2)
  aujourdhui: { width: 24, height: 22, borderRadius: 6, marginVertical: 2 },
  numeroTexte: { fontFamily: police.titre700, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  points: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 10 },
  point: { width: 6, height: 6, borderRadius: 3 },
  carre: { width: 6, height: 6, borderRadius: 1.5, borderWidth: 1 },
  coin: { position: 'absolute', top: 0, right: 0 },
  bandes: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 1 },
  bande: { height: 4 },
  barre: { width: 10, height: 3, borderRadius: 2 },
  plus: { fontSize: 10, lineHeight: 10, fontFamily: police.texte600 },
  tiret: { fontSize: 28, lineHeight: 32 },
  seance: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: rayon.base, paddingHorizontal: 14 },
  objectif: { borderRadius: rayon.base, paddingHorizontal: 12, paddingVertical: 8 },
  objectifTexte: { fontFamily: police.titre800, fontSize: 15, lineHeight: 19 },
  etiquette: { alignSelf: 'flex-start', borderRadius: rayon.rond, borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 12, paddingVertical: 6 },
  note: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 10, paddingVertical: 8 },
});
