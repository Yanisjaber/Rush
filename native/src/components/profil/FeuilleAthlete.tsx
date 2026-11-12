import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { FormulaireSection } from '@/components/feuilles/FormulaireSection';
import { PhotoProfil } from '@/components/feuilles/PhotoProfil';
import { Bouton } from '@/components/ui/Bouton';
import { cartesDe, type CarteProfil, type OngletProfil } from '@/data/profil/ecran-profil';
import type { BilanAthlete } from '@/data/reglages/bilan-athlete';
import type { Profil } from '@/data/types';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La feuille du bas de la page Profil : 4 onglets (Identité, Physio, Niveau, Forme), et dans chacun des cartes qu'on balaie.
// On la tire vers le haut ou le bas : replié (onglets seuls), à moitié, ou presque tout l'écran.
// Identité : « Modifier » ouvre le formulaire (prénom, poids, taille…) ; Physio : « Modifier » ouvre l'écran Physiologie.

const ONGLETS: { cle: OngletProfil; label: string }[] = [
  { cle: 'identite', label: 'Identité' },
  { cle: 'physio', label: 'Physio' },
  { cle: 'niveau', label: 'Niveau' },
  { cle: 'forme', label: 'Forme' },
];
const ECART = 10;
const ENTETE = 84; // poignée + onglets : ce qui reste visible quand la feuille est repliée

export type EtatFeuille = 'replie' | 'mi' | 'haut';

export interface OuvertureFeuille {
  onglet: OngletProfil;
  carte: string;
  /** Change à chaque demande : retoucher la même zone rouvre la feuille. */
  n: number;
}

interface Props {
  bilan: BilanAthlete;
  profil: Profil | null | undefined;
  onglet: OngletProfil;
  onOnglet: (o: OngletProfil) => void;
  ouverture: OuvertureFeuille | null;
  /** Hauteur visible de la feuille (pixels) quand elle est posée : le mannequin se recentre au-dessus. */
  onHauteur: (h: number) => void;
  /** Ouvre l'écran de saisie de la physiologie. */
  onModifierPhysio: () => void;
  /** Appelé quand le formulaire d'identité se ferme : il faut relire le profil. */
  onIdentiteEnregistree: () => void;
}

export function FeuilleAthlete({ bilan, profil, onglet, onOnglet, ouverture, onHauteur, onModifierPhysio, onIdentiteEnregistree }: Props) {
  const p = usePalette();
  const { width: largeurEcran, height: hauteurEcran } = useWindowDimensions();
  const snaps = useMemo(() => ({ replie: ENTETE, mi: Math.min(Math.round(hauteurEcran * 0.46), 400), haut: Math.round(hauteurEcran * 0.82) }), [hauteurEcran]);
  const [etat, setEtat] = useState<EtatFeuille>('mi');
  const [edition, setEdition] = useState(false);
  const hauteur = useRef(new Animated.Value(snaps.mi)).current;
  const departRef = useRef(snaps.mi);
  const valeurRef = useRef(snaps.mi);
  const defilement = useRef<ScrollViewInstance>(null);
  const largeurCarte = Math.min(280, Math.round(largeurEcran * 0.74));

  useEffect(() => {
    const id = hauteur.addListener(({ value }) => { valeurRef.current = value; });
    return () => hauteur.removeListener(id);
  }, [hauteur]);

  const poser = useCallback((cible: EtatFeuille) => {
    setEtat(cible);
    Animated.spring(hauteur, { toValue: snaps[cible], useNativeDriver: false, bounciness: 3, speed: 14 }).start();
    onHauteur(snaps[cible]);
  }, [hauteur, snaps, onHauteur]);

  useEffect(() => { onHauteur(snaps.mi); }, [snaps.mi, onHauteur]); // au premier affichage

  const poignee = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => { hauteur.stopAnimation(); departRef.current = valeurRef.current; },
    onPanResponderMove: (_e, g) => { hauteur.setValue(Math.max(snaps.replie, Math.min(snaps.haut, departRef.current - g.dy))); },
    onPanResponderRelease: (_e, g) => {
      const visee = valeurRef.current - g.vy * 140; // un coup de doigt rapide va plus loin
      const choix = (Object.keys(snaps) as EtatFeuille[]).reduce((a, b) => (Math.abs(snaps[b] - visee) < Math.abs(snaps[a] - visee) ? b : a));
      poser(choix);
    },
  }), [hauteur, snaps, poser]);

  // Une zone du mannequin a été touchée : la feuille s'ouvre sur la bonne carte.
  useEffect(() => {
    if (!ouverture) return;
    setEdition(false);
    if (etat === 'replie' || etat === 'haut') poser('mi');
    const index = Math.max(0, cartesDe(ouverture.onglet, bilan, profil).findIndex((c) => c.cle === ouverture.carte));
    const t = setTimeout(() => defilement.current?.scrollTo({ x: index * (largeurCarte + ECART), animated: true }), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule une nouvelle demande (n) doit relancer
  }, [ouverture?.n]);

  const cartes = useMemo(() => cartesDe(onglet, bilan, profil), [onglet, bilan, profil]);

  const choisirOnglet = (o: OngletProfil) => {
    onOnglet(o);
    setEdition(false);
    defilement.current?.scrollTo({ x: 0, animated: false });
    if (etat === 'replie') poser('mi');
  };
  const ouvrirEdition = () => { setEdition(true); poser('haut'); };
  const fermerEdition = () => { setEdition(false); poser('mi'); onIdentiteEnregistree(); };

  return (
    <Animated.View style={[styles.feuille, { height: hauteur, backgroundColor: p.surface, borderColor: p.trait }]}>
      <View {...poignee.panHandlers} style={styles.entete} accessibilityLabel="Tirer pour agrandir ou réduire" accessibilityRole="adjustable">
        <View style={[styles.prise, { backgroundColor: p.traitFort }]} />
        <View style={styles.onglets}>
          {ONGLETS.map((o) => {
            const actif = o.cle === onglet;
            return (
              <Pressable key={o.cle} onPress={() => choisirOnglet(o.cle)} accessibilityRole="tab" accessibilityState={{ selected: actif }} style={[styles.onglet, { backgroundColor: actif ? p.texte : p.surface2 }]}>
                <Text style={[typo.petit, { fontFamily: police.texte600, color: actif ? p.fond : p.texteDoux }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {edition && onglet === 'identite' ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: espace.e4, paddingBottom: 320, gap: espace.e4 }}>
          <View style={styles.titreEdition}>
            <Text style={[typo.titre3, { color: p.texte }]}>Modifier mon identité</Text>
            <Bouton variante="discret" petit onPress={fermerEdition}>Terminé</Bouton>
          </View>
          <PhotoProfil />
          <FormulaireSection id="identite" />
        </ScrollView>
      ) : (
        <ScrollView ref={defilement} horizontal showsHorizontalScrollIndicator={false} snapToInterval={largeurCarte + ECART} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: espace.e4, gap: ECART, paddingTop: espace.e2 }} style={styles.cartes}>
          {cartes.map((c) => <Carte key={c.cle} carte={c} largeur={largeurCarte} />)}
          {onglet === 'identite' || onglet === 'physio' ? (
            <Pressable onPress={onglet === 'identite' ? ouvrirEdition : onModifierPhysio} accessibilityRole="button" accessibilityLabel={onglet === 'identite' ? 'Modifier mon identité' : 'Modifier mes repères physiologiques'} style={[styles.carte, styles.action, { width: Math.min(200, largeurCarte), borderColor: p.contourChamp }]}>
              <Text style={[typo.titre3, { color: p.texte }]}>{onglet === 'identite' ? 'Modifier' : 'Modifier mes repères'}</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>{onglet === 'identite' ? 'Prénom, poids, taille, photo…' : 'FC, FTP, VMA…'}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </Animated.View>
  );
}

function Carte({ carte, largeur }: { carte: CarteProfil; largeur: number }) {
  const p = usePalette();
  return (
    <View style={[styles.carte, { width: largeur, backgroundColor: p.surface2 }]} accessible accessibilityLabel={`${carte.titre}${carte.chiffre ? `, ${carte.chiffre}` : ''}`}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>{carte.titre}</Text>
      {carte.chiffre ? <Text numberOfLines={1} adjustsFontSizeToFit style={[typo.titre2, { color: p.texte }]}>{carte.chiffre}</Text> : null}
      <View style={{ marginTop: espace.e1 }}>
        {carte.lignes.map((l) => (
          <View key={l.label} style={[styles.ligne, { borderTopColor: p.trait }]}>
            <Text style={[typo.petit, { color: p.texteDoux, flexShrink: 1 }]}>{l.label}</Text>
            <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600, fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' }]}>{l.valeur}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  entete: { height: ENTETE, paddingTop: 8, alignItems: 'center', gap: 10 },
  prise: { width: 40, height: 4, borderRadius: 2 },
  onglets: { flexDirection: 'row', gap: 8, paddingHorizontal: espace.e4 },
  onglet: { minHeight: 44, paddingHorizontal: 14, borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center' },
  cartes: { flex: 1 },
  carte: { borderRadius: rayon.carte, padding: 14, gap: 4, alignSelf: 'flex-start' },
  action: { borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', minHeight: 120 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  titreEdition: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
