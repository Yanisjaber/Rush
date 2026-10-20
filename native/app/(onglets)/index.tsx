import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BandeauEdition } from '@/components/BandeauEdition';
import { BarreSports } from '@/components/BarreSports';
import { BibliothequeWidgets } from '@/components/BibliothequeWidgets';
import { Bouton } from '@/components/Bouton';
import { FeuilleWidget } from '@/components/FeuilleWidget';
import { Boite, Emplacement, GrilleWidgets } from '@/components/GrilleWidgets';
import { solitaires } from '@/data/grille';
import { ListeTriable } from '@/components/ListeTriable';
import { Onboarding } from '@/components/Onboarding';
import { construireContexte } from '@/data/contexte';
import { disponibles, disponiblesOnglet, ONGLETS_PERSONNALISABLES, WIDGETS, type IdWidget, composerOnglet, compositionAuto, type WidgetPlace } from '@/data/registre';
import { onboardingNecessaire } from '@/data/sports-choisis';
import { useDonneesAccueil } from '@/hooks/useDonneesAccueil';
import { useAuth } from '@/stores/auth';
import { ajouter, annulerEdition, changerTaille, chargerDisposition, deplacerWidget, demarrerEdition, listeEnEdition, reinitialiserAuto, retirer, terminerEdition, useDisposition } from '@/stores/disposition';
import { useMenu } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { COMPOSANTS, WidgetBientot } from '@/widgets/composants';

// Un compte neuf (aucune donnée) ne voit que l'essentiel
const COMPTE_VIDE = new Set(['objectif', 'semaine', 'avenir']);
// Hauteur de la barre d'onglets flottante (Liquid Glass) à réserver en bas de la liste, pour que le dernier widget ne passe pas dessous
const BARRE_ONGLETS = 72;

// Accueil : les widgets du sport choisi dans la barre du haut, avec les données du compte (ou la démo).
export default function Accueil() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { filtre, familles } = useMenu();
  const { donnees, chargement, actualisation, demo, recharger } = useDonneesAccueil();

  const contexte = useMemo(() => (donnees ? construireContexte(donnees, filtre) : null), [donnees, filtre]);

  // Compte neuf : aucune séance, rien de prévu, aucun objectif, ni force ni Hyrox
  const compteVide =
    !!donnees &&
    !demo &&
    !donnees.erreur &&
    !donnees.seances.length &&
    !donnees.dernieres.length &&
    !donnees.planifiees.length &&
    !donnees.objectifs.length &&
    !donnees.force.series.length &&
    !donnees.force.programmes.length &&
    !donnees.hyrox.tests.length;

  // Compte neuf qui n'a jamais choisi ses sports : on les lui demande d'abord (voir onboardingNecessaire)
  const onboarding =
    !!donnees &&
    !donnees.erreur &&
    onboardingNecessaire({
      demo,
      sportsEnregistres: donnees.sportsChoisis,
      nbSeances: donnees.seances.length + donnees.dernieres.length,
      aForce: donnees.force.series.length > 0 || donnees.force.programmes.length > 0,
      aHyrox: donnees.hyrox.tests.length > 0,
    });

  // La disposition (celle de l'utilisateur ou l'automatique) se charge une fois les données là, et se recompose quand ses sports changent
  const { session } = useAuth();
  const disp = useDisposition();
  const cleFamilles = familles.join(',');
  const uid = demo ? 'demo' : session?.user.id ?? null;
  useEffect(() => {
    if (donnees && uid && familles.length) void chargerDisposition(uid, familles);
    // cleFamilles : la liste change d'identité à chaque rendu du store, son contenu seul compte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!donnees, uid, cleFamilles]);

  const enEdition = disp.enEdition;
  // Le widget dont la fenêtre de modification (crayon) est ouverte
  const [modif, setModif] = useState('');
  const [enGlisse, setEnGlisse] = useState(false);
  const defile = useRef<ComponentRef<typeof ScrollView>>(null);
  const decalageDefilement = useRef(0);
  const hauteurEcran = Dimensions.get('window').height;
  // En quittant l'édition (Terminer, Annuler, réinitialisation), la fenêtre de modification se ferme
  useEffect(() => {
    if (!enEdition) setModif('');
  }, [enEdition]);
  const base = disp.pret ? disp.widgets : compositionAuto(familles);
  const widgets = useMemo(() => {
    if (enEdition) return listeEnEdition(disp);
    const liste = filtre === 'tout' ? base : composerOnglet(base, filtre, disp.onglets);
    return compteVide ? liste.filter((w) => COMPTE_VIDE.has(w.id)) : liste;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disp, base, filtre, compteVide, enEdition]);
  // Onglet qu'on modifie : Muscu ou Hyrox ont leur propre composition ; ailleurs on modifie l'onglet « Tout »
  const ongletAModifier = ONGLETS_PERSONNALISABLES.includes(filtre) ? filtre : 'tout';
  const aAjouter = enEdition ? (disp.ongletEdition !== 'tout' ? disponiblesOnglet(widgets, disp.ongletEdition) : disponibles({ widgets }, familles)) : [];

  const nomPersonnaliser = ONGLETS_PERSONNALISABLES.includes(filtre) ? `Personnaliser l'onglet ${filtre === 'muscu' ? 'Muscu' : 'Hyrox'}` : "Personnaliser l'accueil";

  // Un S seul sur sa ligne est centré (voir solitaires)
  const seuls = solitaires(widgets.map((w) => w.taille));

  // Le premier widget de la page prend le look dossard, avec le liseré de la couleur du sport de la page (neutre sur « Tous »)
  const herosDePage = { couleur: couleurSport(p, filtre === 'tout' ? undefined : filtre) };

  const rendre = (w: WidgetPlace) => {
    if (!contexte) return null;
    const Composant = COMPOSANTS[w.id];
    return (
      <Boite key={w.id} taille={w.taille} heros={widgets[0]?.id === w.id ? herosDePage : null}>
        {/* XS, S et M : la tuile (chiffre clé) ; L : le grand format du widget */}
        {Composant ? <Composant contexte={contexte} taille={w.taille} tuile={w.taille !== 'l'} /> : <WidgetBientot id={w.id} />}
      </Boite>
    );
  };

  // Compte neuf qui n'a jamais choisi ses sports : on les lui demande d'abord
  if (onboarding) return <Onboarding />;

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <BarreSports />
      <ScrollView
        ref={defile}
        scrollEnabled={!enGlisse}
        scrollEventThrottle={16}
        onScroll={(e) => {
          decalageDefilement.current = e.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS + (enEdition ? 100 : 0) }]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={enEdition ? undefined : <RefreshControl refreshing={actualisation} onRefresh={recharger} tintColor={p.texteDoux} />}
      >
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
            Accueil
          </Text>
          {demo ? <Text style={[typo.micro, { color: p.texteMuet }]}>Mode démo</Text> : null}
        </View>

        {chargement ? (
          <View accessible accessibilityLabel="Chargement de tes données" style={styles.attente}>
            <ActivityIndicator color={p.texteDoux} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>Chargement de tes données…</Text>
          </View>
        ) : (
          <>
            {donnees?.erreur ? <Avis texte={donnees.erreur} /> : null}
            {donnees?.erreurSport ? <Avis texte={donnees.erreurSport} /> : null}
            {compteVide ? (
              <Avis texte="Ton compte est neuf : rien à afficher pour l'instant. Tes séances arriveront dès que tu auras connecté Strava ou saisi une séance." info />
            ) : null}
            {disp.message && !enEdition ? <Avis texte={disp.message} /> : null}
            {enEdition ? (
              <ListeTriable
                ids={widgets.map((w) => w.id)}
                onModifier={setModif}
                onDeplacer={deplacerWidget}
                onGlisse={setEnGlisse}
                defilement={{ decalage: decalageDefilement, vers: (y) => defile.current?.scrollTo({ y, animated: false }), haut: 140, bas: hauteurEcran - 120 }}
                nom={(id) => WIDGETS[id as IdWidget]?.nom ?? id}
                taille={(id) => widgets.find((w) => w.id === id)?.taille ?? 'm'}
                rendre={(id) => rendre(widgets.find((w) => w.id === id) as WidgetPlace)}
              />
            ) : null}
            {enEdition ? null : (
              <GrilleWidgets>
                {widgets.map((w, i) => (
                  <Emplacement key={w.id} taille={w.taille} seul={seuls[i]}>
                    {rendre(w)}
                  </Emplacement>
                ))}
              </GrilleWidgets>
            )}
            {enEdition ? <BibliothequeWidgets ids={aAjouter} onAjouter={ajouter} /> : null}
            {!enEdition && !compteVide && disp.pret ? (
              <Bouton variante="discret" onPress={() => demarrerEdition(ongletAModifier)}>
                {nomPersonnaliser}
              </Bouton>
            ) : null}
          </>
        )}
      </ScrollView>
      {enEdition ? (
        // En bas, au-dessus du menu : Terminer, Annuler, Réinitialiser
        <View pointerEvents="box-none" style={[styles.bas, { bottom: bas + 16 }]}>
          <BandeauEdition onTerminer={() => void terminerEdition()} onAnnuler={annulerEdition} onAuto={() => void reinitialiserAuto()} />
        </View>
      ) : null}
      <FeuilleWidget
        id={enEdition && widgets.some((w) => w.id === modif) ? modif : null}
        taille={widgets.find((w) => w.id === modif)?.taille ?? 'm'}
        onTaille={changerTaille}
        onSupprimer={(id) => {
          setModif('');
          retirer(id);
        }}
        onFermer={() => setModif('')}
      />
    </View>
  );
}

// Un message qui accompagne l'écran (erreur de lecture, compte neuf) : jamais de texte brut venu de la base
function Avis({ texte, info = false }: { texte: string; info?: boolean }) {
  const p = usePalette();
  return (
    <View accessible accessibilityRole={info ? undefined : 'alert'} style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: info ? p.sportNeutre : p.alerte }]}>
      <Text style={[typo.petit, { color: p.texte }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bas: { position: 'absolute', left: 12, right: 12, gap: 8 },
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  attente: { alignItems: 'center', gap: espace.e3, paddingVertical: espace.e7 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
});
