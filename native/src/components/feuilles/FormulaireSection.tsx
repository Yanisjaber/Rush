import { usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { Bouton } from '@/components/ui/Bouton';
import { Pastille } from '@/components/ui/Pastille';
import type { Champ } from '@/data/reglages/profil';
import { useProfilSection } from '@/hooks/useProfilSection';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le formulaire d'une section du profil, construit à partir de la définition des champs (data/profil.ts).
export function FormulaireSection({ id }: { id: string }) {
  const p = usePalette();
  const f = useProfilSection(id);
  // Quitter l'écran avec des modifications non enregistrées : on demande, plutôt que de les perdre en silence.
  // usePreventRemove bloque aussi le bouton retour natif d'iOS (un simple écouteur « beforeRemove » n'y suffit pas).
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
      <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
        <Text style={[typo.petit, { color: p.texte }]}>{f.erreur}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: espace.e4 }}>
      {f.demo ? <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : rien n'est enregistré.</Text> : null}
      {f.erreur ? (
        <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
          <Text style={[typo.petit, { color: p.texte }]}>{f.erreur}</Text>
        </View>
      ) : null}
      {f.section.groupes.map((g, i) => (
        <Bloc key={g.titre ?? i} titre={g.titre}>
          <View style={styles.champs}>
            {g.champs.map((c) => (
              // Les champs courts (nombre, date, temps) vont par deux ; les textes longs et les choix prennent toute la largeur
              <View key={c.cle} style={c.type === 'nombre' || c.type === 'temps' || c.type === 'date' ? styles.demi : styles.plein}>
                <ChampSaisie champ={c} valeur={f.valeurs[c.cle]} erreur={f.erreurs[c.cle]} onChange={(v) => f.modifier(c.cle, v)} />
              </View>
            ))}
          </View>
        </Bloc>
      ))}
      {Object.keys(f.erreurs).length ? (
        // Le champ en erreur peut être hors de l'écran : on le dit près du bouton
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
          {Object.keys(f.erreurs).length > 1 ? `${Object.keys(f.erreurs).length} champs sont à corriger (en rouge).` : 'Un champ est à corriger (en rouge).'}
        </Text>
      ) : null}
      <Bouton onPress={() => void f.enregistrer()}>{f.envoi ? 'Enregistrement…' : f.sale ? 'Enregistrer' : 'Enregistré'}</Bouton>
      {f.message ? (
        <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok }]}>
          {f.message}
        </Text>
      ) : null}
    </View>
  );
}

function ChampSaisie({ champ, valeur, erreur, onChange }: { champ: Champ; valeur: string | boolean | undefined; erreur?: string; onChange: (v: string) => void }) {
  const p = usePalette();
  const texte = typeof valeur === 'string' ? valeur : '';
  const etiquette = champ.unite ? `${champ.label} (${champ.unite})` : champ.label;
  return (
    <View style={{ marginTop: espace.e3 }}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>{etiquette}</Text>
      {champ.type === 'choix' ? (
        <View style={styles.choix}>
          {(champ.options ?? []).map(([cle, nom]) => (
            <Pastille key={cle} nom={nom} actif={texte === cle} onPress={() => onChange(texte === cle ? '' : cle)} />
          ))}
        </View>
      ) : (
        <TextInput
          value={texte}
          onChangeText={onChange}
          style={[styles.champ, typo.corps, { color: p.texte, backgroundColor: p.surface2, borderColor: erreur ? p.danger : p.contourChamp }]}
          placeholder={champ.type === 'date' ? 'AAAA-MM-JJ' : champ.exemple ?? ''}
          placeholderTextColor={p.texteMuet}
          keyboardType={champ.type === 'nombre' ? 'decimal-pad' : champ.type === 'date' || champ.type === 'temps' ? 'numbers-and-punctuation' : 'default'}
          autoCorrect={false}
          maxLength={champ.type === 'texte' ? champ.max : 20}
          accessibilityLabel={etiquette}
        />
      )}
      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, marginTop: 4 }]}>
          {erreur}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  champ: { marginTop: espace.e1, minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: espace.e3 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: espace.e1 },
  champs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  demi: { width: '47%', flexGrow: 1 },
  plein: { width: '100%' },
});
