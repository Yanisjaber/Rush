import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BandeauEdition } from '@/components/BandeauEdition';
import { BarreSports } from '@/components/BarreSports';
import { BibliothequeWidgets } from '@/components/BibliothequeWidgets';
import { Bouton } from '@/components/Bouton';
import { BarreSelection } from '@/components/BarreSelection';
import { ListeTriable } from '@/components/ListeTriable';
import { Onboarding } from '@/components/Onboarding';
import { construireContexte } from '@/data/contexte';
import { disponibles, disponiblesOnglet, ONGLETS_PERSONNALISABLES, WIDGETS, type IdWidget, composerOnglet, compositionAuto, grouperTuiles, type WidgetPlace } from '@/data/registre';
import { onboardingNecessaire } from '@/data/sports-choisis';
import { useDonneesAccueil } from '@/hooks/useDonneesAccueil';
import { useAuth } from '@/stores/auth';
import { ajouter, annulerEdition, changerTaille, chargerDisposition, deplacer, deplacerWidget, demarrerEdition, listeEnEdition, reinitialiserAuto, retirer, terminerEdition, useDisposition } from '@/stores/disposition';
import { useMenu } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { COMPOSANTS, WidgetBientot } from '@/widgets/composants';

// Sur l'onglet Muscu, ces widgets passent en tuiles de deux par ligne (comme sur le web, voir Accueil.svelte)
const TUILES = new Set(['tonnage', 'regularite']);
// Ces widgets ne se comprennent que grâce à leur graphique (le corps, la courbe de charge) : ils gardent leur version complète
const GRANDS = new Set(['groupes', 'chargemuscu']);
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
  const [selection, setSelection] = useState('');
  const [enGlisse, setEnGlisse] = useState(false);
  const defile = useRef<ComponentRef<typeof ScrollView>>(null);
  const decalageDefilement = useRef(0);
  const hauteurEcran = Dimensions.get('window').height;
  // En quittant l'édition (Terminer, Annuler, retour à l'automatique), plus rien n'est sélectionné
  useEffect(() => {
    if (!enEdition) setSelection('');
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

  const compactMuscu = filtre === 'muscu' && !enEdition;
  const compactDe = (id: string) => compactMuscu && !GRANDS.has(id);
  // Les tuiles se rangent deux par deux ; les autres widgets prennent toute la largeur
  const blocs = compactMuscu ? grouperTuiles(widgets, (id) => TUILES.has(id)) : widgets;
  const nomPersonnaliser = ONGLETS_PERSONNALISABLES.includes(filtre) ? `Personnaliser l'onglet ${filtre === 'muscu' ? 'Muscu' : 'Hyrox'}` : "Personnaliser l'accueil";

  const rendre = (w: WidgetPlace) => {
    if (!contexte) return null;
    const Composant = COMPOSANTS[w.id];
    return Composant ? <Composant key={w.id} contexte={contexte} taille={w.taille} compact={compactDe(w.id)} /> : <WidgetBientot key={w.id} id={w.id} />;
  };

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
        contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS + (enEdition ? 120 : 0) }]}
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
            {enEdition ? <BandeauEdition onglet={disp.ongletEdition} onTerminer={() => void terminerEdition()} onAnnuler={annulerEdition} onAuto={() => void reinitialiserAuto()} /> : null}
            {disp.message && !enEdition ? <Avis texte={disp.message} /> : null}
            {enEdition ? (
              <ListeTriable
                ids={widgets.map((w) => w.id)}
                selection={selection}
                onSelection={setSelection}
                onDeplacer={deplacerWidget}
                onGlisse={setEnGlisse}
                defilement={{ decalage: decalageDefilement, vers: (y) => defile.current?.scrollTo({ y, animated: false }), haut: 140, bas: hauteurEcran - 120 }}
                nom={(id) => WIDGETS[id as IdWidget]?.nom ?? id}
                rendre={(id) => rendre(widgets.find((w) => w.id === id) as WidgetPlace)}
              />
            ) : null}
            {(enEdition ? [] : blocs).map((b, i) =>
              Array.isArray(b) ? (
                <View key={b.map((w) => w.id).join('+')} style={styles.tuiles}>
                  {b.map(rendre)}
                  {b.length === 1 ? <View style={styles.vide} /> : null}
                </View>
              ) : (
                rendre(b)
              ),
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
      {enEdition && selection && widgets.some((w) => w.id === selection) ? (
        <BarreSelection
          id={selection}
          index={widgets.findIndex((w) => w.id === selection)}
          total={widgets.length}
          taille={(widgets.find((w) => w.id === selection) as WidgetPlace).taille}
          onDeplacer={deplacer}
          onTaille={changerTaille}
          onRetirer={(id) => {
            setSelection('');
            retirer(id);
          }}
        />
      ) : null}
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
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  attente: { alignItems: 'center', gap: espace.e3, paddingVertical: espace.e7 },
  tuiles: { flexDirection: 'row', gap: espace.e3 },
  vide: { flex: 1 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
});
