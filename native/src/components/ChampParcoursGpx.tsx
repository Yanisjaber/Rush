import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/Bouton';
import { formatNombre } from '@/data/outils/format';
import { nomDeFichier, resumerGpx, TAILLE_MAX_GPX, type ParcoursGpx, type ResumeGpx } from '@/data/outils/gpx';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le parcours GPX d'une séance ou d'une compétition : le choix du fichier dans le téléphone (sélecteur du système), sa lecture sécurisée, puis son nom, sa distance et son dénivelé
// avec « Retirer » et « Reprendre distance et D+ ». Le module du sélecteur est chargé au moment du choix : tant que l'app n'a pas été reconstruite avec lui, on le dit clairement.
export interface ParcoursChoisi {
  fichier: ParcoursGpx;
  resume: ResumeGpx;
}

export function ChampParcoursGpx({ etiquette, parcours, onChange, onReprendre, onErreur }: { etiquette: string; parcours: ParcoursChoisi | null; onChange: (p: ParcoursChoisi | null) => void; onReprendre: (r: ResumeGpx) => void; onErreur: (message: string) => void }) {
  const p = usePalette();

  async function choisir() {
    onErreur('');
    let selecteur: typeof import('expo-document-picker');
    try {
      selecteur = await import('expo-document-picker');
    } catch {
      return Alert.alert('Nouvelle version nécessaire', "Le choix d'un fichier demande de reconstruire l'app avec son module natif.");
    }
    try {
      const r = await selecteur.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (r.canceled || !r.assets?.length) return;
      const fichier = r.assets[0];
      if (fichier.size != null && fichier.size > TAILLE_MAX_GPX) return onErreur('Le fichier est trop gros (5 Mo maximum).');
      const texte = await (await fetch(fichier.uri)).text();
      const lu = resumerGpx(texte);
      if (!lu.ok) return onErreur(lu.erreur);
      onChange({ fichier: { nom: nomDeFichier(fichier.name), contenu: texte }, resume: lu.resume });
    } catch {
      onErreur('Impossible de lire ce fichier.');
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{etiquette}</Text>
      {parcours ? (
        <View style={[styles.parcours, { backgroundColor: p.surface }]}>
          <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
            {parcours.fichier.nom}
          </Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>
            {`${String(parcours.resume.distanceKm).replace('.', ',')} km`}
            {parcours.resume.denivele != null ? ` · ${formatNombre(parcours.resume.denivele)} m D+` : ''}
          </Text>
          <View style={styles.boutons}>
            <Bouton petit variante="discret" onPress={() => onChange(null)}>
              Retirer
            </Bouton>
            <Bouton petit onPress={() => onReprendre(parcours.resume)}>
              Reprendre distance et D+
            </Bouton>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => void choisir()} accessibilityRole="button" accessibilityLabel="Ajouter un parcours GPX" style={[styles.ajout, { borderColor: p.traitFort }]}>
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}>+ Ajouter un parcours GPX</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  parcours: { borderRadius: rayon.bloc, padding: espace.e3, gap: 4 },
  boutons: { flexDirection: 'row', gap: espace.e2, justifyContent: 'flex-end', marginTop: 4 },
  ajout: { minHeight: 48, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center' },
});
