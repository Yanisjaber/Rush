import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { decalerMois, grilleMois, JOURS_SEMAINE } from '@/data/calendrier/calendrier';
import { joursDuCycle, toucherJourPeriode, type ChoixPeriode } from '@/data/calendrier/cycles';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un mini-calendrier pour choisir une période : on touche le jour de début, puis le jour de fin, et la période se colore (couleur du cycle).
// Les flèches changent de mois ; toucher un jour avant le début recommence la période à ce jour (voir toucherJourPeriode).
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const court = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function CalendrierPeriode({ debut, fin, couleur, onChange }: { debut: string; fin: string; couleur: string; onChange: (debut: string, fin: string) => void }) {
  const p = usePalette();
  const [vue, setVue] = useState({ annee: Number(debut.slice(0, 4)), mois: Number(debut.slice(5, 7)) - 1 });
  const [attenteFin, setAttenteFin] = useState(false);

  // Quand le début change de l'extérieur (ouverture d'un cycle existant), le calendrier se place sur son mois ; pendant un choix, il reste où l'on est
  useEffect(() => {
    if (!attenteFin) setVue({ annee: Number(debut.slice(0, 4)), mois: Number(debut.slice(5, 7)) - 1 });
    // seul un changement de début compte ici
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debut]);

  const semaines = useMemo(() => grilleMois(vue.annee, vue.mois, {}, new Date()).semaines, [vue]);

  const toucher = (iso: string) => {
    const suite = toucherJourPeriode({ debut, fin, attenteFin }, iso);
    setAttenteFin(suite.attenteFin);
    onChange(suite.debut, suite.fin);
  };

  const jours = fin >= debut ? joursDuCycle({ from_date: debut, to_date: fin }) : 0;
  const resume = attenteFin ? `${court(debut)} → touche le jour de fin` : `${court(debut)} → ${court(fin)} · ${jours} jour${jours > 1 ? 's' : ''}`;

  return (
    <View style={[styles.carte, { backgroundColor: p.surface }]}>
      <View style={styles.entete}>
        <Pressable onPress={() => setVue((v) => decalerMois(v.annee, v.mois, -1))} accessibilityRole="button" accessibilityLabel="Mois précédent" style={styles.fleche}>
          <Text style={{ color: p.texte, fontSize: 26, lineHeight: 30 }}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[typo.corpsFort, { color: p.texte }]}>
          {`${MOIS[vue.mois][0].toUpperCase()}${MOIS[vue.mois].slice(1)} ${vue.annee}`}
        </Text>
        <Pressable onPress={() => setVue((v) => decalerMois(v.annee, v.mois, 1))} accessibilityRole="button" accessibilityLabel="Mois suivant" style={styles.fleche}>
          <Text style={{ color: p.texte, fontSize: 26, lineHeight: 30 }}>›</Text>
        </Pressable>
      </View>
      <View style={styles.rangee} accessible={false} importantForAccessibility="no-hide-descendants">
        {JOURS_SEMAINE.map((n, i) => (
          <Text key={i} style={[typo.micro, styles.lettre, { color: p.texteMuet }]}>
            {n.charAt(0)}
          </Text>
        ))}
      </View>
      {semaines.map((semaine) => (
        <View key={semaine[0].iso} style={styles.rangee}>
          {semaine.map((j) => {
            const dedans = j.iso >= debut && j.iso <= fin;
            const premier = j.iso === debut;
            const dernier = j.iso === fin;
            const plein = premier || dernier;
            return (
              <Pressable
                key={j.iso}
                onPress={() => toucher(j.iso)}
                accessibilityRole="button"
                accessibilityState={{ selected: dedans }}
                accessibilityLabel={`${court(j.iso)}${premier ? ', début' : ''}${dernier ? ', fin' : ''}`}
                style={styles.casePeriode}
              >
                <View
                  style={[
                    styles.fondJour,
                    dedans && { backgroundColor: plein ? couleur : avecAlpha(couleur, 0.4) },
                    premier && !dernier && styles.arrondiGauche,
                    dernier && !premier && styles.arrondiDroit,
                    premier && dernier && styles.arrondiTout,
                  ]}
                >
                  <Text style={[typo.corpsFort, { color: plein ? p.encreSurCouleur : j.dansMois ? p.texte : p.texteMuet }]}>{j.num}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text accessibilityLiveRegion="polite" style={[typo.petit, styles.resume, { color: p.texteDoux }]}>
        {resume}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: rayon.bloc, padding: espace.e3, gap: 2 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  fleche: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rangee: { flexDirection: 'row' },
  lettre: { width: `${100 / 7}%`, textAlign: 'center', paddingBottom: 4 },
  casePeriode: { width: `${100 / 7}%`, height: 44, justifyContent: 'center' },
  fondJour: { height: 36, alignItems: 'center', justifyContent: 'center' },
  arrondiGauche: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  arrondiDroit: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  arrondiTout: { borderRadius: 10 },
  resume: { textAlign: 'center', marginTop: 6 },
});
