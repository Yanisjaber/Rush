import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { calendrierApercu, friseApercu, type EtatMarque, type Marque, type VueApercu } from '@/data/coach/apercu-plan';
import { nomSport } from '@/data/coach/libelles';
import type { LignePlan } from '@/data/coach/types';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le dessin d'un plan : un calendrier de trois semaines et une frise de 14 jours (maquette « le mélange 7 + 2 + 3 »).
// Vue « avant » : les séances touchées à leur jour d'origine. Vue « après » : les retirées en pointillé, les nouvelles pleines, la période hachurée.
// C'est un dessin : il est caché de VoiceOver (le détail en texte est dans la carte, avec le résumé du plan).

/** Les hachures d'une période (maladie, blessure…) : des traits en diagonale, avec un contour pointillé */
export function Hachure({ couleur, trait }: { couleur: string; trait: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.hachure, { borderColor: couleur }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="hachure" patternUnits="userSpaceOnUse" width={7} height={7}>
            <Line x1={-1} y1={8} x2={8} y2={-1} stroke={trait} strokeWidth={1.2} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#hachure)" />
      </Svg>
    </View>
  );
}

/** Une petite barre de séance : pleine (prévue ou nouvelle) ou en pointillé (retirée) */
function BarreMarque({ marque, hauteur }: { marque: Marque; hauteur: number }) {
  const p = usePalette();
  const couleur = couleurSport(p, marque.sport);
  return marque.etat === 'retiree' ? (
    <View style={{ height: hauteur, borderRadius: 2, borderWidth: 1, borderStyle: 'dashed', borderColor: p.texteMuet }} />
  ) : (
    <View style={{ height: hauteur, borderRadius: 2, backgroundColor: couleur }} />
  );
}

export function CalendrierPlan({ lignes, vue, aujourdhui }: { lignes: LignePlan[]; vue: VueApercu; aujourdhui: string }) {
  const p = usePalette();
  const { entetes, semaines } = calendrierApercu(lignes, vue, aujourdhui);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 2 }}>
      <View style={styles.rang}>
        {entetes.map((e, i) => (
          <Text key={i} style={[typo.micro, styles.entete, { color: p.texteMuet, textTransform: 'none', letterSpacing: 0 }]}>
            {e}
          </Text>
        ))}
      </View>
      {semaines.map((semaine, s) => (
        <View key={s} style={styles.rang}>
          {semaine.map((j) => (
            <View
              key={j.iso}
              style={[
                styles.jour,
                { backgroundColor: p.surface2, opacity: j.passe ? 0.5 : 1 },
                j.aujourdhui ? { borderWidth: 2, borderColor: p.texte } : null,
              ]}
            >
              {j.periode ? <Hachure couleur={p.danger} trait={p.texteMuet} /> : null}
              <Text style={[typo.micro, { color: p.texte, textTransform: 'none', letterSpacing: 0, fontVariant: ['tabular-nums'] }]}>{j.numero}</Text>
              {j.repos ? <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none', letterSpacing: 0 }]}>repos</Text> : null}
              <View style={{ gap: 3 }}>
                {j.marques.map((m, k) => (
                  <BarreMarque key={k} marque={m} hauteur={8} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const CASE_FRISE = 28;

export function FrisePlan({ lignes, vue, aujourdhui }: { lignes: LignePlan[]; vue: VueApercu; aujourdhui: string }) {
  const p = usePalette();
  const { jours, rangees } = friseApercu(lignes, vue, aujourdhui);
  const n = jours.length;
  // La période traverse toutes les rangées : on cherche ses jours dans la frise
  const dansPeriode = jours.map((j, i) => (j.periode ? i : -1)).filter((i) => i >= 0);
  const debut = dansPeriode.length ? dansPeriode[0] : -1;
  const longueur = dansPeriode.length;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 4 }}>
      <View style={styles.rang}>
        {jours.map((j) => (
          <View key={j.iso} style={styles.colonneFrise}>
            <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'none', letterSpacing: 0 }]}>{j.lettre}</Text>
            <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'none', letterSpacing: 0, fontVariant: ['tabular-nums'] }]}>{j.numero}</Text>
          </View>
        ))}
      </View>
      <View style={{ paddingVertical: espace.e1 }}>
        {rangees.map((r) => {
          const couleur = couleurSport(p, r.sport);
          return (
            <View key={r.sport} style={{ gap: 3, marginBottom: espace.e2 }}>
              <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none', letterSpacing: 0, paddingLeft: 4 }]}>{nomSport(r.sport)}</Text>
              {/* Les hachures de la période sont posées sous les cases de CETTE rangée : le nom du sport reste lisible */}
              <View style={{ height: CASE_FRISE }}>
                {debut >= 0 ? (
                  <View pointerEvents="none" style={{ position: 'absolute', top: -2, bottom: -2, left: `${(debut / n) * 100}%`, width: `${(longueur / n) * 100}%` }}>
                    <Hachure couleur={p.danger} trait={p.texteMuet} />
                  </View>
                ) : null}
                <View style={styles.rang}>
                  {r.cases.map((c) => (
                    <View key={c.iso} style={{ flex: 1, height: CASE_FRISE }}>
                      <CaseFrise etat={c.etat} couleur={couleur} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          );
        })}
        {rangees.length === 0 && debut >= 0 ? (
          <View style={{ height: 40 }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${(debut / n) * 100}%`, width: `${(longueur / n) * 100}%` }}>
              <Hachure couleur={p.danger} trait={p.texteMuet} />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CaseFrise({ etat, couleur }: { etat: 'vide' | EtatMarque; couleur: string }) {
  const p = usePalette();
  if (etat === 'vide') return <View style={[styles.caseFrise, { backgroundColor: p.surface2, opacity: 0.55 }]} />;
  // Une case retirée garde un fond : elle reste lisible même sur les hachures
  if (etat === 'retiree') return <View style={[styles.caseFrise, { backgroundColor: p.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: p.texte }]} />;
  return <View style={[styles.caseFrise, { backgroundColor: couleur }]} />;
}

const styles = StyleSheet.create({
  rang: { flexDirection: 'row', gap: 2 },
  entete: { flex: 1, textAlign: 'center' },
  jour: { flex: 1, height: 52, borderRadius: rayon.s, paddingHorizontal: 3, paddingVertical: 4, gap: 3, overflow: 'hidden' },
  hachure: { borderWidth: 1, borderStyle: 'dashed', borderRadius: rayon.s, overflow: 'hidden' },
  colonneFrise: { flex: 1, alignItems: 'center' },
  caseFrise: { flex: 1, borderRadius: 2 },
});
