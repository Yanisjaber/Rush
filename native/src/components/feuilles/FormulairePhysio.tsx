import { usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, type ScrollViewInstance, type LayoutChangeEvent, KeyboardAvoidingView, type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/ui/Bouton';
import { FondDegrade } from '@/components/ui/FondDegrade';
import { Pastille } from '@/components/ui/Pastille';
import type { Champ } from '@/data/reglages/profil';
import { useProfilSection } from '@/hooks/useProfilSection';
import { espace, rayon, type Palette } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La couleur d'un bloc : celle de son sport. Le cardiaque n'appartient à aucun sport, il reste neutre.
function couleurDuBloc(titre: string | undefined, p: Palette): string {
  if (titre === 'Vélo') return p.sportVelo;
  if (titre === 'Course') return p.sportCourse;
  if (titre === 'Natation') return p.sportNatation;
  return p.sportNeutre;
}

// Une phrase de contexte sous le titre de chaque bloc (pas de jargon sans explication)
const ABREGE = (titre?: string) => (titre === 'Cardiaque' ? 'Cœur' : titre ?? '');

// Écran Physiologie : pastilles de repères en haut (elles font défiler vers un bloc), blocs par sport, bouton Enregistrer fixé en bas.
// Même logique que FormulaireSection (chargement, validation, enregistrement, sortie avec modifications non enregistrées).
export function FormulairePhysio() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const f = useProfilSection('physiologie');
  const defilement = useRef<ScrollViewInstance>(null);
  const positions = useRef<number[]>([]);
  const [actif, setActif] = useState(0);
  const [quitte, setQuitte] = useState(false);

  usePreventRemove(f.sale && !quitte, ({ repeat }) => {
    Alert.alert('Modifications non enregistrées', 'Tu perds ce que tu viens de saisir.', [
      { text: 'Rester', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: () => {
          setQuitte(true);
          repeat();
        },
      },
    ]);
  });

  if (!f.section) return null;
  if (f.chargement) {
    return (
      <View accessible accessibilityLabel="Chargement du profil" style={styles.attente}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  // Profil non chargé : on n'affiche que l'erreur. Un formulaire vide enregistré écraserait le vrai profil.
  if (f.erreur && !f.ligne) {
    return (
      <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte, margin: espace.e4 }]}>
        <Text style={[typo.petit, { color: p.texte }]}>{f.erreur}</Text>
      </View>
    );
  }

  const groupes = f.section.groupes;
  const nbErreurs = Object.keys(f.erreurs).length;

  const aller = (i: number) => {
    setActif(i);
    defilement.current?.scrollTo({ y: Math.max(0, (positions.current[i] ?? 0) - 8), animated: true });
  };
  // La pastille active suit le bloc qui est en haut de l'écran
  const surDefilement = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y + 40;
    let i = 0;
    positions.current.forEach((pos, k) => {
      if (pos != null && pos <= y) i = k;
    });
    if (i !== actif) setActif(i);
  };
  const mesure = (i: number) => (e: LayoutChangeEvent) => {
    positions.current[i] = e.nativeEvent.layout.y;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'transparent' }}>
      <FondDegrade />
      <ScrollView
        ref={defilement}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        onScroll={surDefilement}
        scrollEventThrottle={64}
        contentContainerStyle={{ paddingHorizontal: espace.e4, paddingBottom: 120 }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reperes} accessibilityRole="tablist">
          {groupes.map((g, i) => (
            <Pressable
              key={g.titre ?? i}
              onPress={() => aller(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: actif === i }}
              accessibilityLabel={`Aller à ${ABREGE(g.titre)}`}
              style={[styles.repere, { backgroundColor: actif === i ? p.texte : p.surface, borderColor: actif === i ? p.texte : p.contourChamp }]}
            >
              <View style={[styles.point, { backgroundColor: couleurDuBloc(g.titre, p) }]} />
              <Text style={[typo.corpsFort, { color: actif === i ? p.fond : p.texte }]}>{ABREGE(g.titre)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {f.erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte, marginBottom: espace.e3 }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{f.erreur}</Text>
          </View>
        ) : null}

        {groupes.map((g, i) => (
          <View key={g.titre ?? i} onLayout={mesure(i)} style={{ marginTop: i === 0 ? espace.e2 : espace.e5 }}>
            <View accessible accessibilityRole="header" accessibilityLabel={ABREGE(g.titre)} style={styles.titreBloc}>
              <View style={[styles.barre, { backgroundColor: couleurDuBloc(g.titre, p) }]} />
              <Text style={[typo.titre3, { color: p.texte }]}>{ABREGE(g.titre)}</Text>
            </View>
            {g.champs.map((c) => (
              <Ligne key={c.cle} champ={c} valeur={f.valeurs[c.cle]} erreur={f.erreurs[c.cle]} onChange={(v) => f.modifier(c.cle, v)} />
            ))}
          </View>
        ))}
        {f.message ? (
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok, marginTop: espace.e3 }]}>
            {f.message}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.barreBas, { backgroundColor: p.fond, borderTopColor: p.trait, paddingBottom: Math.max(insets.bottom, espace.e3) }]}>
        {nbErreurs ? (
          <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, marginBottom: espace.e2 }]}>
            {nbErreurs > 1 ? `${nbErreurs} champs sont à corriger (en rouge).` : 'Un champ est à corriger (en rouge).'}
          </Text>
        ) : null}
        <Bouton onPress={() => void f.enregistrer()}>{f.envoi ? 'Enregistrement…' : f.sale ? 'Enregistrer' : 'Enregistré'}</Bouton>
      </View>
    </KeyboardAvoidingView>
  );
}

// Une ligne : le nom à gauche, la valeur à droite, l'unité juste après. Les choix (liste fermée) passent en pastilles sous le nom.
function Ligne({ champ, valeur, erreur, onChange }: { champ: Champ; valeur: string | boolean | undefined; erreur?: string; onChange: (v: string) => void }) {
  const p = usePalette();
  const texte = typeof valeur === 'string' ? valeur : '';
  const etiquette = champ.unite ? `${champ.label} (${champ.unite})` : champ.label;

  if (champ.type === 'choix') {
    return (
      <View style={[styles.ligneChoix, { borderTopColor: p.trait }]}>
        <Text style={[typo.corps, { color: p.texte }]}>{champ.label}</Text>
        <View style={styles.choix}>
          {(champ.options ?? []).map(([cle, nom]) => (
            <Pastille key={cle} nom={nom} actif={texte === cle} onPress={() => onChange(texte === cle ? '' : cle)} />
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.ligne, { borderTopColor: p.trait }]}>
      <Text style={[typo.corps, { color: p.texte, flex: 1 }]}>{champ.label}</Text>
      <TextInput
        value={texte}
        onChangeText={onChange}
        style={[styles.champ, typo.corpsFort, { color: p.texte, backgroundColor: p.surface2, borderColor: erreur ? p.danger : p.contourChamp }]}
        placeholder={champ.exemple ?? '—'}
        placeholderTextColor={p.texteMuet}
        keyboardType={champ.type === 'nombre' ? 'decimal-pad' : 'numbers-and-punctuation'}
        autoCorrect={false}
        maxLength={20}
        accessibilityLabel={etiquette}
        textAlign="right"
      />
      <Text style={[typo.petit, { color: p.texteDoux, width: 52 }]}>{champ.unite ?? ''}</Text>
      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, position: 'absolute', right: 0, bottom: -2 }]}>
          {erreur}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  reperes: { gap: 8, paddingVertical: espace.e3 },
  repere: { minHeight: 44, borderWidth: 1.5, borderRadius: rayon.rond, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  point: { width: 8, height: 8, borderRadius: 4 },
  titreBloc: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: espace.e1 },
  barre: { width: 20, height: 5 },
  ligne: { minHeight: 56, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  ligneChoix: { borderTopWidth: 1, paddingVertical: espace.e3, gap: espace.e2 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  champ: { width: 96, minHeight: 44, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: espace.e3 },
  barreBas: { paddingHorizontal: espace.e4, paddingTop: espace.e3, borderTopWidth: 1 },
});
