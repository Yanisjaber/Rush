import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boite, Emplacement, GrilleWidgets } from '@/components/GrilleWidgets';
import { Pastille } from '@/components/Pastille';
import { construireContexte } from '@/data/accueil/contexte';
import { WIDGETS } from '@/data/accueil/registre';
import type { Taille } from '@/data/types';
import { useDonneesAccueil } from '@/hooks/useDonneesAccueil';
import { useAuth } from '@/stores/auth';
import { espace } from '@/theme/couleurs';
import { clair, sombre } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { ContextePalette, usePalette } from '@/theme/usePalette';
import { COMPOSANTS, WidgetBientot } from '@/widgets/registre-composants';

// Catalogue des widgets (outil de démo) : un widget à la fois, dans ses 4 tailles, en bloc normal puis en dossard,
// en sombre ou en clair. Les données viennent de la démo ; le look dossard est forcé (à l'accueil, seul le premier widget l'a).
const TAILLES: Taille[] = ['xs', 's', 'm', 'l'];
const IDS = Object.keys(WIDGETS);

export default function CatalogueWidgets() {
  const { demo } = useAuth();
  // Outil de démo : un lien profond ne l'ouvre pas sur un vrai compte
  return demo ? <Catalogue /> : <View style={{ flex: 1 }} />;
}

function Catalogue() {
  const systeme = usePalette();
  const insets = useSafeAreaInsets();
  const { donnees } = useDonneesAccueil();
  // Paramètres de lien (rush://parametres/widgets?id=forme&theme=clair&vue=dossard&taille=xs,s) : ouvrir une forme précise, pour les captures
  const params = useLocalSearchParams<{ id?: string; theme?: string; vue?: string; taille?: string; nu?: string }>();
  const [id, setId] = useState(params.id && IDS.includes(params.id) ? params.id : IDS[0]);
  const [theme, setTheme] = useState<'sombre' | 'clair'>(params.theme === 'clair' || params.theme === 'sombre' ? params.theme : systeme === clair ? 'clair' : 'sombre');
  // Le lien peut changer sans que l'écran soit recréé : on suit ses paramètres
  useEffect(() => {
    if (params.id && IDS.includes(params.id)) setId(params.id);
    if (params.theme === 'clair' || params.theme === 'sombre') setTheme(params.theme);
  }, [params.id, params.theme]);
  const tailles = params.taille ? TAILLES.filter((t) => params.taille!.split(',').includes(t)) : TAILLES;
  const p = theme === 'clair' ? clair : sombre;

  // Un widget propre à un sport est montré avec les données de ce sport ; les autres avec « tout »
  const def = (WIDGETS as Record<string, { nom: string; description: string; sports: 'tous' | readonly string[] }>)[id];
  const filtre = Array.isArray(def.sports) ? def.sports[0] : 'tout';
  const contexte = useMemo(() => (donnees ? construireContexte(donnees, filtre) : null), [donnees, filtre]);
  const Composant = COMPOSANTS[id];

  const forme = (taille: Taille, dossard: boolean) => (
    <Emplacement key={`${taille}-${dossard}`} taille={taille}>
      <Text style={[typo.micro, { color: p.texteDoux, marginBottom: espace.e2 }]}>{taille.toUpperCase()}</Text>
      <Boite taille={taille} heros={dossard ? { couleur: couleurSport(p, filtre === 'tout' ? undefined : filtre) } : null}>
        {!contexte ? null : Composant ? <Composant contexte={contexte} taille={taille} tuile={taille !== 'l'} /> : <WidgetBientot id={id} />}
      </Boite>
    </Emplacement>
  );

  return (
    <ContextePalette.Provider value={p}>
      <View style={{ flex: 1, backgroundColor: p.fond }}>
        <ScrollView contentContainerStyle={{ padding: espace.e4, paddingBottom: insets.bottom + espace.e6, gap: espace.e4 }}>
          {params.nu ? null : <>
          <View style={styles.rangee} accessibilityRole="radiogroup">
            <Pastille nom="Sombre" couleur={p.texte} actif={theme === 'sombre'} onPress={() => setTheme('sombre')} />
            <Pastille nom="Clair" couleur={p.texte} actif={theme === 'clair'} onPress={() => setTheme('clair')} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee}>
            {IDS.map((w) => (
              <Pastille key={w} nom={(WIDGETS as Record<string, { nom: string }>)[w].nom} couleur={p.texte} actif={w === id} onPress={() => setId(w)} />
            ))}
          </ScrollView>

          <Text style={[typo.titre2, { color: p.texte }]}>{def.nom}</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{def.description}</Text>
          </>}

          {params.vue !== 'dossard' ? (
            <>
              <Text style={[typo.corpsFort, { color: p.texte }]}>Bloc normal</Text>
              <GrilleWidgets>{tailles.map((t) => forme(t, false))}</GrilleWidgets>
            </>
          ) : null}
          {params.vue !== 'normal' ? (
            <>
              <Text style={[typo.corpsFort, { color: p.texte }]}>Dossard</Text>
              <GrilleWidgets>{tailles.map((t) => forme(t, true))}</GrilleWidgets>
            </>
          ) : null}
        </ScrollView>
      </View>
    </ContextePalette.Provider>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', gap: espace.e2 },
});
