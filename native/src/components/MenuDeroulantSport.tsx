import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SPORTS_CYCLE } from '@/data/cycles';
import { rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un choix de sport en menu déroulant : un champ qui montre le sport choisi (avec son point de couleur), et une liste qui s'ouvre juste dessous,
// comme le menu des sports de l'accueil. `null` = « Tous les sports » (le sport est facultatif).
export function MenuDeroulantSport({ valeur, onChoisir, etiquette = 'Sport' }: { valeur: string | null; onChoisir: (sport: string | null) => void; etiquette?: string }) {
  const p = usePalette();
  const champRef = useRef<ComponentRef<typeof View>>(null);
  const [ouvert, setOuvert] = useState(false);
  const [zone, setZone] = useState({ haut: 0, bas: 0, gauche: 0, largeur: 0 });
  const hauteurEcran = useWindowDimensions().height;

  // On mesure où est le champ pour poser la liste juste dessous, à sa largeur
  const ouvrir = () =>
    champRef.current?.measureInWindow((x, y, w, h) => {
      setZone({ haut: y, bas: y + h, gauche: x, largeur: w });
      setOuvert(true);
    });

  // La liste s'ouvre sous le champ ; s'il n'y a pas assez de place dessous (champ en bas de l'écran) et plus dessus, elle s'ouvre vers le haut
  const placeDessous = hauteurEcran - zone.bas - 24;
  const placeDessus = zone.haut - 60;
  const versLeHaut = placeDessous < 380 && placeDessus > placeDessous;
  const placement = versLeHaut ? { bottom: hauteurEcran - zone.haut + 6, maxHeight: Math.max(160, placeDessus) } : { top: zone.bas + 6, maxHeight: Math.max(160, placeDessous) };

  const nom = valeur && Object.hasOwn(SPORTS, valeur) ? SPORTS[valeur as CleSport].nom : 'Tous les sports';
  const options: { cle: string | null; nom: string; couleur: string }[] = [
    { cle: null, nom: 'Tous les sports', couleur: p.texteMuet },
    ...SPORTS_CYCLE.map((cle) => ({ cle, nom: SPORTS[cle as CleSport].nom, couleur: couleurSport(p, cle) })),
  ];
  const point = (couleur: string, vide = false) => <View style={[styles.point, vide ? { borderColor: couleur, borderWidth: 2 } : { backgroundColor: couleur }]} />;

  return (
    <>
      <Pressable
        ref={champRef}
        onPress={ouvrir}
        accessibilityRole="button"
        accessibilityLabel={`${etiquette} : ${nom}. Changer`}
        accessibilityState={{ expanded: ouvert }}
        style={[styles.champ, { backgroundColor: p.surface2, borderColor: p.contourChamp }]}
      >
        {point(valeur ? couleurSport(p, valeur) : p.texteMuet, !valeur)}
        <Text style={[typo.corps, { color: p.texte, flex: 1 }]}>{nom}</Text>
        <Text style={{ color: p.texteDoux, fontSize: 18 }}>⌄</Text>
      </Pressable>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOuvert(false)} accessibilityLabel="Fermer la liste des sports" accessibilityRole="button" />
        <View accessibilityViewIsModal style={[styles.panneau, placement, { left: zone.gauche, width: zone.largeur, backgroundColor: p.surface, borderColor: p.traitFort }]}>
          <ScrollView contentContainerStyle={{ padding: 6 }} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const actif = (valeur ?? null) === o.cle;
              return (
                <Pressable
                  key={o.cle ?? 'tous'}
                  onPress={() => {
                    onChoisir(o.cle);
                    setOuvert(false);
                  }}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: actif }}
                  accessibilityLabel={o.nom}
                  style={({ pressed }) => [styles.ligne, (pressed || actif) && { backgroundColor: p.surface2 }]}
                >
                  {point(o.couleur, o.cle === null)}
                  <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>{o.nom}</Text>
                  {actif ? <Text style={[typo.corpsFort, { color: p.texte }]}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  champ: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
  point: { width: 10, height: 10, borderRadius: 5 },
  panneau: { position: 'absolute', borderWidth: 1, borderRadius: rayon.bloc, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, borderRadius: 12 },
});
