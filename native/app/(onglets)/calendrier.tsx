import { FondDegrade } from '@/components/FondDegrade';
import { courtDuType } from '@/data/catalogue-sports';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bientot } from '@/actions/bientot';
import { BarreSports } from '@/components/BarreSports';
import { Bloc } from '@/components/Bloc';
import { ApercuCycle } from '@/components/ApercuCycle';
import { MenuAjout, type ChoixAjout } from '@/components/MenuAjout';
import { FeuilleNote } from '@/components/FeuilleNote';
import { LegendeCalendrier } from '@/components/LegendeCalendrier';
import { LogoNote } from '@/components/LogoNote';
import { ResumeJour } from '@/components/ResumeJour';
import { SelecteurMois } from '@/components/SelecteurMois';
import { chargeJour, chargeSeance, chiffresSemaine, decalerMois, grilleMois, JOURS_SEMAINE, jourVide, profilSemaine, resumeSemaine, secondesJour, teinteJour, type JourGrille, type UniteSemaine } from '@/data/calendrier';
import { couleurNote, libelleNote } from '@/data/annotations';
import { titreNote } from '@/data/sante-notes';
import { avancementCycle, cycleVisible } from '@/data/cycles';
import { familleAffichage, garderSeance } from '@/data/familles';
import { dateIsoLocale, formatDistanceSport, formatDuree, formatHeuresMinutes, formatNombre } from '@/data/format';
import { useAjouts } from '@/hooks/useAjouts';
import { useDonneesCalendrier } from '@/hooks/useDonneesCalendrier';
import { useMenu } from '@/stores/menu';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import type { Cycle, Note } from '@/data/types';

const nomSport = courtDuType;
const BARRE_ONGLETS = 72;
// Jusqu'à 4 marques se voient d'un coup d'œil sur un jour (un point chacune) ; au-delà, 3 points puis « +N » (le nombre qui reste), pour tenir dans la case
const MAX_POINTS = 4;
const POINTS_SI_PLUS = 3;
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
  const [moisOuvert, setMoisOuvert] = useState(false);
  const [basTitre, setBasTitre] = useState(0);
  const titreRef = useRef<ComponentRef<typeof View>>(null);
  // On mesure où est le titre pour poser le panneau juste dessous
  const ouvrirMois = () =>
    titreRef.current?.measureInWindow((_x, y, _w, h) => {
      setBasTitre(y + h);
      setMoisOuvert(true);
    });
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
        // Sous un sport, on ne voit que les cycles de ce sport et ceux qui concernent tous les sports
        cycles: donnees.cycles.filter((c) => cycleVisible(c, filtre)),
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
          {/* Le titre ouvre le calendrier des mois ; sur un autre mois, l'icône ↺ à côté ramène à aujourd'hui */}
          <View style={styles.titreZone}>
            <Pressable
              ref={titreRef}
              onPress={ouvrirMois}
              accessibilityRole="button"
              accessibilityLabel={`${titre}. Choisir un mois`}
              style={styles.titreBouton}
            >
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[typo.titre2, { color: p.texte }]}>
                {titre}
              </Text>
            </Pressable>
            {!estMoisCourant ? (
              <Pressable
                onPress={() => setCible({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() })}
                accessibilityRole="button"
                accessibilityLabel="Revenir à aujourd'hui"
                hitSlop={8}
                style={[styles.retourIcone, { borderColor: p.contourChamp }]}
              >
                <Text style={[styles.retourFleche, { color: p.texteDoux }]}>↺</Text>
              </Pressable>
            ) : null}
          </View>
          <Fleche sens={1} onPress={() => setCible((c) => decalerMois(c.annee, c.mois, 1))} />
        </View>

        {/* Les chiffres du mois en cartes : séances, temps, charge et, pour un sport qui en a une, son info principale (kilomètres ou séries, comme la colonne « Sem. ») */}
        <View style={styles.cartes}>
          <Carte valeur={String(seancesDuMois.length)} unite="séan." legende={seancesDuMois.length > 1 ? 'séances' : 'séance'} serree={!!principaleDuMois} />
          <Carte valeur={formatDuree(tempsDuMois)} legende="de sport" serree={!!principaleDuMois} />
          <Carte valeur={chargeDuMois.toLocaleString('fr-FR')} unite="pts" legende="points de charge" serree={!!principaleDuMois} />
          {principaleDuMois ? <Carte valeur={nombre(principaleDuMois.valeur, principaleDuMois.unite)} unite={UNITES[principaleDuMois.unite].court} legende={UNITES[principaleDuMois.unite].dit} serree /> : null}
        </View>

        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, styles.avisTexte, { color: p.texte }]}>{erreur}</Text>
            <Pressable
              onPress={recharger}
              accessibilityRole="button"
              accessibilityLabel="Réessayer de charger le calendrier"
              style={({ pressed }) => [styles.reessayer, { borderColor: p.texte, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[typo.corpsFort, { color: p.texte }]}>Réessayer</Text>
            </Pressable>
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

            <LegendeCalendrier />

            {detail ? <Detail jour={detail} /> : null}
          </>
        )}
      </ScrollView>
      <SelecteurMois
        ouvert={moisOuvert}
        onFermer={() => setMoisOuvert(false)}
        affiche={cible}
        aujourdhui={{ annee: maintenant.getFullYear(), mois: maintenant.getMonth() }}
        haut={basTitre}
        onChoisir={(annee, mois) => {
          setCible({ annee, mois });
          setMoisOuvert(false);
        }}
      />
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
function Carte({ valeur, unite, legende, serree }: { valeur: string; unite?: string; legende: string; serree?: boolean }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={`${valeur} ${legende}`} style={[styles.carte, serree && styles.carteSerree, { backgroundColor: p.surface }]}>
      <Text numberOfLines={1} style={[styles.carteValeur, { color: p.texte }]}>
        {valeur}
        {unite ? <Text style={[styles.carteUnite, { color: p.texteDoux }]}> {unite}</Text> : null}
      </Text>
    </View>
  );
}

// Les marques d'un jour (au plus cinq points) : séance faite = point plein de la couleur du sport, prévue = contour, compétition = carré.
// Une note n'est pas un point : elle met un petit logo dans le coin de la case (voir LogosNotes).
function marquesDe(j: JourGrille): { cle: string; type: 'fait' | 'prevu' | 'objectif'; couleur?: string }[] {
  return [
    ...j.objectifs.map((o) => ({ cle: `o${o.id}`, type: 'objectif' as const })),
    ...j.seances.map((s) => ({ cle: `s${s.id}`, type: 'fait' as const, couleur: s.sport })),
    ...j.planifiees.map((x) => ({ cle: `p${x.id}`, type: 'prevu' as const, couleur: x.sport })),
  ];
}

// Les logos des notes du jour : un petit pictogramme par type (note, maladie, blessure, indisponible), dans la couleur de la note, alignés en ligne, centrés au-dessus du chiffre.
// Un seul logo par type (quatre types, donc quatre logos au plus) ; le détail du jour liste toutes les notes.
function LogosNotes({ notes }: { notes: Note[] }) {
  const vus = new Set<string>();
  const logos = notes.filter((n) => (vus.has(n.type) ? false : (vus.add(n.type), true)));
  return (
    <View style={styles.coin} pointerEvents="none">
      {logos.map((n) => (
        <LogoNote key={n.id} type={n.type} couleur={couleurNote(n.color)} taille={8} />
      ))}
    </View>
  );
}

function Case({ jour, choisi, onPress }: { jour: JourGrille; choisi: boolean; onPress: () => void }) {
  const p = usePalette();
  const marques = marquesDe(jour);
  const label = [
    dateLongue(jour.iso),
    ...jour.objectifs.map((o) => `compétition : ${o.name}`),
    ...(jour.repos ? ['repos'] : []),
    ...jour.cycles.map((c) => `cycle : ${c.name}`),
    ...jour.notes.map(libelleNote),
    ...jour.seances.map((s) => `${s.name || nomSport(s.sport)}, ${formatDuree(s.moving_time)}`),
    ...jour.planifiees.map((x) => `séance prévue : ${x.name || nomSport(x.sport)}`),
  ].join(', ');
  // Un jour d'un autre mois s'affiche comme les autres (ses séances comptent dans la colonne « Sem. »), mais atténué
  const voisin = !jour.dansMois;
  // Le jour se teinte de gris, d'autant plus fort que sa charge est grande (de 10 % à 40 % d'opacité) : aucune couleur de sport sur les cases, les pastilles les portent
  const teinte = teinteJour(jour);
  const fond = teinte ? avecAlpha(p.sportNeutre, 0.1 + 0.3 * teinte.force) : undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: choisi }}
      accessibilityLabel={label}
      style={[styles.case, fond ? { backgroundColor: fond } : null, choisi && { borderColor: p.texte }, voisin && styles.voisin]}
    >
      {jour.cycles.length ? (
        // Les cycles d'entraînement : une bande de la couleur du cycle au bas de la case, deux au plus (l'une au-dessus de l'autre)
        <View style={styles.bandes} pointerEvents="none">
          {jour.cycles.map((c) => (
            <View key={c.id} style={[styles.bande, { backgroundColor: couleurNote(c.color) }]} />
          ))}
        </View>
      ) : null}
      {jour.notes.length ? <LogosNotes notes={jour.notes} /> : null}
      <View style={[styles.numero, jour.aujourdhui && styles.aujourdhui, jour.aujourdhui && { backgroundColor: p.texte }]}>
        <Text style={[styles.numeroTexte, { color: jour.aujourdhui ? p.fond : jour.futur ? p.texteDoux : p.texte }]}>{jour.num}</Text>
      </View>
      <View style={styles.points}>
        {(marques.length > MAX_POINTS ? marques.slice(0, POINTS_SI_PLUS) : marques).map((m) =>
          m.type === 'fait' ? (
            <View key={m.cle} style={[styles.point, { backgroundColor: couleurSport(p, m.couleur) }]} />
          ) : m.type === 'prevu' ? (
            <View key={m.cle} style={[styles.point, { borderColor: couleurSport(p, m.couleur), borderWidth: 1.5 }]} />
          ) : (
            <View key={m.cle} style={[styles.carre, { backgroundColor: p.dossardFond, borderColor: p.texte }]} />
          ),
        )}
        {jour.repos && !marques.length ? <View style={[styles.barre, { backgroundColor: p.traitFort }]} /> : null}
        {marques.length > MAX_POINTS ? <Text style={[styles.plus, { color: p.texteDoux }]}>+{marques.length - POINTS_SI_PLUS}</Text> : null}
      </View>
    </Pressable>
  );
}

// « 08:10 » depuis la date locale d'une séance ; rien si elle n'a pas d'heure (minuit = saisie sans heure)
const heureDe = (iso: string | null | undefined): string => {
  const h = String(iso ?? '').slice(11, 16);
  return /^\d\d:\d\d$/.test(h) && h !== '00:00' ? h : '';
};
const HAUTEUR_PROFIL = 22;

// Les deux infos de la colonne de la semaine : le temps (toujours) et, pour un sport choisi, son info principale (voir METRIQUE_DU_SPORT : kilomètres, séries, dénivelé)
const UNITES: Record<UniteSemaine, { court: string; dit: string }> = {
  km: { court: 'km', dit: 'kilomètres' },
  m: { court: 'm', dit: 'mètres' },
  series: { court: 'sér.', dit: 'séries' },
};
// Au-delà de 100, les décimales n'apportent rien et prennent de la place : 266 km, pas 266,4 km
const nombre = (n: number, unite?: UniteSemaine) => (unite === 'm' ? formatNombre(n) : String(n >= 100 ? Math.round(n) : n).replace('.', ','));

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
          ? `Semaine du ${dateLongue(semaine[0].iso)} : ${formatDuree(r.faites)} faites${r.prevues ? `, ${formatDuree(r.prevues)} prévues` : ''}${c.principale ? `, ${nombre(c.principale.valeur, c.principale.unite)} ${UNITES[c.principale.unite].dit}` : ''}, ${r.charge} points de charge`
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
            {nombre(c.principale.valeur, c.principale.unite)}
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
              // Un jour sans séance : un point de 4 pt, donc une semaine vide fait un pointillé
              { height: j.secondes ? Math.max(6, (j.secondes / maxi) * HAUTEUR_PROFIL) : 4, backgroundColor: j.famille ? (mono ? p.sportNeutre : couleurSport(p, j.famille)) : p.traitFort, opacity: j.fait || !j.secondes ? 1 : 0.35 },
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
  const [menuAjout, setMenuAjout] = useState(false); // le menu du « + »
  const [noteOuverte, setNoteOuverte] = useState<Note | null>(null); // la note qu'on modifie
  const [cycleOuvert, setCycleOuvert] = useState<Cycle | null>(null); // le cycle qu'on regarde
  const { basculerRepos } = useAjouts();
  const [erreurRepos, setErreurRepos] = useState('');
  // Ce que fait chaque ligne du menu : un écran pour la date du jour (ceux qui n'existent pas encore disent « Bientôt »), ou le repos d'un toucher
  const choisirAjout = (c: ChoixAjout) => {
    if (c === 'repos') return void (async () => setErreurRepos(await basculerRepos(jour.iso, !jour.repos)))();
    if (c === 'cycle') return router.push({ pathname: '/cycle', params: { debut: jour.iso } });
    if (c === 'competition') return router.push({ pathname: '/ajout-competition', params: { date: jour.iso } });
    if (c === 'note') return router.push({ pathname: '/ajout-note', params: { date: jour.iso } });
    if (c === 'sortie') return router.push({ pathname: '/ajout-sortie', params: { date: jour.iso } });
    if (c === 'import') return router.push({ pathname: '/ajout-import', params: { date: jour.iso } });
    if (c === 'seance') return router.push({ pathname: '/ajout-seance', params: { date: jour.iso } });
  };
  return (
    <Bloc>
      <View style={styles.detailTete}>
        <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
          {dateLongue(jour.iso)}
        </Text>
        <Pressable
          onPress={() => setMenuAjout(true)}
          accessibilityRole="button"
          accessibilityLabel="Ajouter : séance, activité, import de fichier, compétition, note, cycle ou repos"
          accessibilityState={{ expanded: menuAjout }}
          style={[styles.detailPlus, { backgroundColor: p.texte }]}
        >
          <Text style={[styles.detailPlusTexte, { color: p.fond }]}>+</Text>
        </Pressable>
      </View>
      {/* Les notes de santé du jour : une pastille par note (logo + titre), on la touche pour le détail */}
      {jour.notes.length ? (
        <View style={styles.notesPastilles}>
          {jour.notes.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => setNoteOuverte(n)}
              accessibilityRole="button"
              accessibilityLabel={`${libelleNote(n)}. Voir le détail`}
              hitSlop={5}
              style={[styles.notePastille, { backgroundColor: p.surface2 }]}
            >
              <LogoNote type={n.type} couleur={couleurNote(n.color)} taille={14} />
              <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flexShrink: 1 }]}>
                {titreNote(n)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {/* Ce que le jour pèse, d'un coup d'œil : temps fait, charge, et la part du prévu, par sport */}
      <ResumeJour jour={jour} />
      {erreurRepos ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, marginBottom: 6 }]}>
          {erreurRepos}
        </Text>
      ) : null}
      {jourVide(jour) && !jour.cycles.length ? (
        <Text style={[styles.tiret, { color: p.texteMuet }]}>—</Text>
      ) : (
        <View>
          {jour.objectifs.map((o) => (
            <View key={o.id} accessible accessibilityLabel={`Compétition : ${o.name}`} style={[styles.objectif, { backgroundColor: p.dossardFond, marginTop: 8 }]}>
              <Text numberOfLines={1} style={[styles.objectifTexte, { color: p.dossardTexte }]}>
                {o.name}
              </Text>
            </View>
          ))}
          {jour.seances.map((s) => {
            const nom = s.name || nomSport(s.sport);
            const detail = [formatDistanceSport(s.distance_km, familleAffichage(s.sport)), `${chargeSeance(s)} pts`, heureDe(s.start_date_local)].filter(Boolean).join(' · ');
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/seance', params: { id: s.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${nom}, ${formatDuree(s.moving_time)}`}
                style={[styles.ligneSeance, { borderTopColor: p.trait }]}
              >
                <View style={[styles.ligneBarre, { backgroundColor: couleurSport(p, s.sport) }]} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>{nom}</Text>
                  <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>{detail}</Text>
                </View>
                <Text style={[typo.corpsFort, { color: p.texte }]}>{formatDuree(s.moving_time)}</Text>
              </Pressable>
            );
          })}
          {jour.planifiees.map((x) => {
            const nom = x.name || nomSport(x.sport);
            const couleur = couleurSport(p, x.sport);
            const detail = ['Prévue', formatDistanceSport(x.km, familleAffichage(x.sport))].filter(Boolean).join(' · ');
            return (
              <Pressable
                key={x.id}
                onPress={() => bientot('La modification de séance prévue')}
                accessibilityRole="button"
                accessibilityLabel={`Séance prévue : ${nom}`}
                style={[styles.ligneSeance, { borderTopColor: p.trait }]}
              >
                <View style={[styles.ligneBarre, { borderColor: couleur, borderWidth: 2, borderStyle: 'dotted' }]} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>{nom}</Text>
                  <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>{detail}</Text>
                </View>
                {x.duration ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{formatDuree(x.duration * 60)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      {/* Sous les séances : les cycles du jour, deux par ligne (nom, jour x sur y, barre d'avancement) */}
      {jour.cycles.length ? (
        <View style={styles.cyclesLigne}>
          {jour.cycles.map((c) => {
            const av = avancementCycle(c, jour.iso);
            return (
              <Pressable
                key={c.id}
                onPress={() => setCycleOuvert(c)}
                accessibilityRole="button"
                accessibilityLabel={`Cycle ${c.name}, jour ${av.jour} sur ${av.total}. Voir`}
                style={[styles.cycleTuile, { backgroundColor: p.surface2 }]}
              >
                <View style={styles.cycleLigne}>
                  <View style={[styles.cyclePoint, { backgroundColor: couleurNote(c.color) }]} />
                  <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
                    {c.name}
                  </Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>
                    {av.jour}/{av.total}
                  </Text>
                </View>
                <View style={[styles.cycleBarre, { backgroundColor: p.trait }]}>
                  <View style={[styles.cycleBarreRemplie, { width: `${Math.round(av.part * 100)}%`, backgroundColor: couleurNote(c.color) }]} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <MenuAjout
        ouvert={menuAjout}
        onFermer={() => setMenuAjout(false)}
        repos={jour.repos}
        onChoisir={(c) => {
          setMenuAjout(false);
          choisirAjout(c);
        }}
      />
      <FeuilleNote note={noteOuverte} onFermer={() => setNoteOuverte(null)} />
      <ApercuCycle
        cycle={cycleOuvert}
        jour={jour.iso}
        onFermer={() => setCycleOuvert(null)}
        onModifier={(c) => {
          setCycleOuvert(null);
          router.push({ pathname: '/cycle', params: { id: c.id } });
        }}
      />
    </Bloc>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e3 },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fleche: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 12, height: 12, borderTopWidth: 2.5, borderRightWidth: 2.5 },
  titreZone: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  // Titre sur un autre mois : au moins 44 pt de haut pour le toucher, sans fond
  titreBouton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  retourIcone: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  retourFleche: { fontSize: 15, lineHeight: 18 },
  cartes: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  // Des pastilles compactes, centrées : leur largeur suit leur contenu
  carte: { minHeight: 40, borderRadius: rayon.rond, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  // Avec quatre pastilles, on resserre un peu pour que tout tienne sur une ligne
  carteSerree: { paddingHorizontal: 11 },
  carteUnite: { fontFamily: police.texte600, fontSize: 11, letterSpacing: 0 },
  carteValeur: { fontFamily: police.titre800, fontSize: 18, lineHeight: 22, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avisTexte: { flex: 1 },
  reessayer: { minHeight: 44, borderRadius: rayon.rond, borderWidth: 1.5, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
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
  case: { width: '100%', minHeight: 58, alignItems: 'center', paddingTop: 7, borderRadius: rayon.base, borderWidth: 2, borderColor: 'transparent', gap: 2, overflow: 'hidden' },
  numero: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  // Aujourd'hui : un carré arrondi, serré autour du chiffre (la même hauteur totale que les autres jours : 22 + 2 × 2)
  aujourdhui: { width: 24, height: 22, borderRadius: 6, marginVertical: 2 },
  numeroTexte: { fontFamily: police.titre700, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  voisin: { opacity: 0.5 },
  points: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 10 },
  point: { width: 6, height: 6, borderRadius: 3 },
  carre: { width: 6, height: 6, borderRadius: 1.5, borderWidth: 1 },
  coin: { position: 'absolute', top: 1, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 1 },
  bandes: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 1 },
  bande: { height: 4 },
  barre: { width: 10, height: 3, borderRadius: 2 },
  plus: { fontSize: 8, lineHeight: 8, fontFamily: police.texte600 },
  detailTete: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailPlus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detailPlusTexte: { fontFamily: police.titre800, fontSize: 26, lineHeight: 30 },
  // Une séance du jour : une barre de la couleur du sport (en pointillés si elle est prévue), son nom et ses détails, sa durée à droite
  ligneSeance: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderTopWidth: 1 },
  ligneBarre: { width: 6, alignSelf: 'stretch', marginVertical: 8, borderRadius: 3 },
  tiret: { fontSize: 28, lineHeight: 32 },
  seance: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: rayon.base, paddingHorizontal: 14 },
  objectif: { borderRadius: rayon.base, paddingHorizontal: 12, paddingVertical: 8 },
  objectifTexte: { fontFamily: police.titre800, fontSize: 15, lineHeight: 19 },
  // Les notes du jour (pastilles) et les cycles du jour (tuiles : nom, « 21/23 », fine barre de progression)
  notesPastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 6 },
  notePastille: { minHeight: 34, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: rayon.rond, paddingLeft: 10, paddingRight: 12 },
  cyclesLigne: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cycleTuile: { flexGrow: 1, flexBasis: '45%', minHeight: 44, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 6, justifyContent: 'center' },
  cycleLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cyclePoint: { width: 8, height: 8, borderRadius: 4 },
  cycleBarre: { height: 5, borderRadius: 3, overflow: 'hidden' },
  cycleBarreRemplie: { height: '100%', borderRadius: 3 },
});
