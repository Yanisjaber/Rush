import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import type { Champ } from '@/data/profil';
import { useProfilSection } from '@/hooks/useProfilSection';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le formulaire d'une section du profil, construit à partir de la définition des champs (data/profil.ts).
export function FormulaireSection({ id }: { id: string }) {
  const p = usePalette();
  const f = useProfilSection(id);
  if (!f.section) return null;
  if (f.chargement) {
    return (
      <View accessible accessibilityLabel="Chargement du profil" style={styles.attente}>
        <ActivityIndicator color={p.texteDoux} />
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
          {g.champs.map((c) => (
            <ChampSaisie key={c.cle} champ={c} valeur={f.valeurs[c.cle]} erreur={f.erreurs[c.cle]} onChange={(v) => f.modifier(c.cle, v)} />
          ))}
        </Bloc>
      ))}
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
          {(champ.options ?? []).map(([cle, nom]) => {
            const actif = texte === cle;
            return (
              <Pressable
                key={cle}
                onPress={() => onChange(actif ? '' : cle)}
                accessibilityRole="radio"
                accessibilityState={{ selected: actif }}
                style={[styles.option, { borderColor: actif ? p.texte : p.contourChamp, backgroundColor: actif ? p.surface2 : 'transparent' }]}
              >
                <Text style={[typo.petit, { color: p.texte }]}>{nom}</Text>
              </Pressable>
            );
          })}
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
  option: { minHeight: 44, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 12, justifyContent: 'center' },
});
