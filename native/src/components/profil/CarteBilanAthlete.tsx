import { StyleSheet, Text, View } from 'react-native';
import { RadarAthlete } from '@/components/profil/RadarAthlete';
import { ModeleAthleteRealiste } from '@/components/profil/ModeleAthleteRealiste';
import type { BilanAthlete, StatAthlete } from '@/data/reglages/bilan-athlete';
import { avecAlpha, rayon, espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const HAUTEUR_SCENE = 380;

/** La couleur désigne le sport (charte) : surbrillance, dossard et sélection prennent celle du sport principal. */
function couleurSport(discipline: string, palette: ReturnType<typeof usePalette>): string {
  switch (discipline) {
    case 'Course': return palette.sportCourse;
    case 'Vélo': return palette.sportVelo;
    case 'Natation': return palette.sportNatation;
    case 'Force': return palette.sportMuscu;
    case 'Hyrox': return palette.sportHybride;
    default: return palette.sportNeutre;
  }
}

export function CarteBilanAthlete({ bilan }: { bilan: BilanAthlete }) {
  const p = usePalette();
  const accent = couleurSport(bilan.discipline, p);
  const progression = Math.round((bilan.xp / bilan.xpMax) * 100);
  const heures = bilan.activite.heures.toFixed(1).replace('.0', '');
  const distance = bilan.activite.distance.toFixed(1).replace('.0', '');
  const tonnage = bilan.activite.tonnageForce >= 1000 ? `${(bilan.activite.tonnageForce / 1000).toFixed(1).replace('.0', '')} t` : `${bilan.activite.tonnageForce} kg`;

  return (
    <View style={{ gap: espace.e4 }}>
      <View style={[styles.hero, { backgroundColor: p.surface, borderColor: p.trait }]}>
        <View pointerEvents="none" style={[styles.orbe, styles.orbeHaut, { backgroundColor: avecAlpha(accent, 0.16) }]} />
        <View pointerEvents="none" style={[styles.orbe, styles.orbeBas, { backgroundColor: avecAlpha(accent, 0.1) }]} />

        <View style={styles.heroEntete}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typo.micro, { color: accent }]}>RUSH ATHLETE CARD</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[typo.titre2, { color: p.texte, marginTop: 3 }]}>{bilan.nom}</Text>
            <Text style={[typo.petit, { color: p.texteDoux }]}>{bilan.discipline} · profil de progression</Text>
          </View>
          <View style={[styles.niveau, { backgroundColor: avecAlpha(accent, 0.12), borderColor: avecAlpha(accent, 0.55) }]}>
            <Text style={[typo.micro, { color: accent, fontSize: 10, letterSpacing: 0.7 }]}>NIVEAU</Text>
            <Text style={[typo.titre3, { color: p.texte, fontSize: 22, lineHeight: 25 }]}>{String(bilan.niveau).padStart(2, '0')}</Text>
          </View>
        </View>

        {/* Étape 1 : le mannequin seul, sans légendes ni annotations. */}
        <View style={styles.scene}>
          <ModeleAthleteRealiste palette={p} accent={accent} largeur="100%" hauteur={HAUTEUR_SCENE} />
        </View>

        <View style={styles.xpEntete}>
          <Text style={[typo.micro, { color: p.texteMuet, fontSize: 10, letterSpacing: 0.7 }]}>PROGRESSION</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{bilan.xp} / {bilan.xpMax} XP</Text>
        </View>
        <View accessible accessibilityLabel={`Progression vers le niveau suivant : ${progression} pour cent`} style={[styles.xpPiste, { backgroundColor: p.surface2 }]}>
          <View style={[styles.xpRempli, { width: `${progression}%`, backgroundColor: accent }]} />
        </View>

        <View style={[styles.kpis, { borderTopColor: p.trait }]}>
          <Kpi label="FORME" valeur={bilan.forme.libelle} palette={p} />
          <Kpi label="ACTIF" valeur={`${bilan.activite.jours} j`} palette={p} />
          <Kpi label="CHARGE" valeur={`${bilan.activite.charge}`} palette={p} />
        </View>
      </View>

      <View style={styles.sectionEntete}>
        <Text style={[typo.micro, { color: p.texteMuet }]}>CARACTÉRISTIQUES</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>INDICE / 100</Text>
      </View>

      <View style={[styles.competences, { backgroundColor: avecAlpha(p.surface, 0.8), borderColor: p.trait }]}>
        <Text style={[typo.titre3, { color: p.texte }]}>Ton build d'athlète</Text>
        <Text style={[typo.petit, { color: p.texteDoux, marginTop: 3 }]}>Une vue rapide de tes qualités du moment.</Text>
        <RadarAthlete stats={bilan.stats} palette={p} accent={accent} />
        <View style={styles.listeStats}>
          {bilan.stats.map((stat) => <BarreStat key={stat.cle} stat={stat} accent={accent} />)}
        </View>
      </View>

      <View style={[styles.insight, { backgroundColor: avecAlpha(accent, 0.12), borderColor: avecAlpha(accent, 0.36) }]}>
        <View style={styles.insightLigne}>
          <Text style={[typo.micro, { color: accent }]}>LECTURE DU BUILD</Text>
          <Text style={[typo.micro, { color: p.texteDoux, fontSize: 10, letterSpacing: 0.65 }]}>SCOUT REPORT</Text>
        </View>
        <Text style={[typo.titre3, { color: p.texte, marginTop: 8 }]}>Point fort : {bilan.pointsForts[0]?.label ?? 'régularité'}</Text>
        <Text style={[typo.petit, { color: p.texteDoux, marginTop: 4 }]}>Ton prochain levier : {bilan.axeDeProgres.label.toLowerCase()}. Quelques séances ciblées peuvent vite faire monter cette jauge.</Text>
        <View style={styles.tags}>
          {bilan.pointsForts.map((stat) => <Tag key={stat.cle} texte={`+ ${stat.label}`} accent={accent} />)}
          <Tag texte={`↗ ${bilan.axeDeProgres.label}`} accent={p.texteDoux} />
        </View>
      </View>

      <View style={[styles.activite, { backgroundColor: avecAlpha(p.surface, 0.8), borderColor: p.trait }]}>
        <View style={styles.sectionEntete}>
          <Text style={[typo.titre3, { color: p.texte }]}>Bilan récent</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>28 derniers jours</Text>
        </View>
        <View style={styles.activiteGrille}>
          <Kpi label="SÉANCES" valeur={String(bilan.activite.seances)} palette={p} grand />
          <Kpi label="HEURES" valeur={heures} palette={p} grand />
          <Kpi label="DISTANCE" valeur={distance === '0' ? '—' : `${distance} km`} palette={p} grand />
        </View>
        <View style={[styles.forceResume, { backgroundColor: avecAlpha(p.sportMuscu, 0.11), borderColor: avecAlpha(p.sportMuscu, 0.28) }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typo.micro, { color: p.sportMuscu, fontSize: 10, letterSpacing: 0.7 }]}>FORCE TRACKER</Text>
            <Text style={[typo.petit, { color: p.texteDoux, marginTop: 3 }]}>{bilan.activite.seriesForce > 0 ? `${bilan.activite.seriesForce} séries de musculation enregistrées` : 'Ajoute des séries pour détailler ta force'}</Text>
          </View>
          <Text style={[typo.titre3, { color: p.texte }]}>{bilan.activite.seriesForce > 0 ? tonnage : '—'}</Text>
        </View>
      </View>
    </View>
  );
}

function Kpi({ label, valeur, palette, grand = false }: { label: string; valeur: string; palette: ReturnType<typeof usePalette>; grand?: boolean }) {
  return (
    <View style={styles.kpi}>
      <Text style={[typo.micro, { color: palette.texteMuet, fontSize: 10, letterSpacing: 0.7 }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[grand ? typo.titre2 : typo.corpsFort, { color: palette.texte, marginTop: 2 }]}>{valeur}</Text>
    </View>
  );
}

function BarreStat({ stat, accent }: { stat: StatAthlete; accent: string }) {
  const p = usePalette();
  return (
    <View style={styles.stat}>
      <View style={styles.statEntete}>
        <Text style={[typo.corpsFort, { color: p.texte }]}>{stat.label}</Text>
        <Text style={[typo.corpsFort, { color: accent }]}>{stat.valeur}</Text>
      </View>
      <View style={[styles.statPiste, { backgroundColor: p.surface2 }]}>
        <View style={[styles.statRempli, { width: `${stat.valeur}%`, backgroundColor: accent }]} />
      </View>
      <Text style={[typo.petit, { color: p.texteMuet, marginTop: 2 }]}>{stat.note}</Text>
    </View>
  );
}

function Tag({ texte, accent }: { texte: string; accent: string }) {
  return <View style={[styles.tag, { backgroundColor: avecAlpha(accent, 0.14) }]}><Text style={[typo.petit, { color: accent }]}>{texte}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { borderWidth: 1, borderRadius: rayon.bloc, padding: 18, overflow: 'hidden' },
  orbe: { position: 'absolute', width: 160, height: 160, borderRadius: 80 },
  orbeHaut: { top: -90, right: -48 },
  orbeBas: { bottom: 62, left: -102 },
  heroEntete: { flexDirection: 'row', alignItems: 'flex-start', gap: espace.e3 },
  niveau: { minWidth: 67, borderWidth: 1, borderRadius: rayon.base, paddingHorizontal: 8, paddingVertical: 7, alignItems: 'center' },
  scene: { height: HAUTEUR_SCENE, marginTop: 4, alignItems: 'center' },
  xpEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  xpPiste: { height: 8, borderRadius: 4, marginTop: 7, overflow: 'hidden' },
  xpRempli: { height: '100%', borderRadius: 4 },
  kpis: { flexDirection: 'row', borderTopWidth: 1, marginTop: 16, paddingTop: 13 },
  kpi: { flex: 1, minWidth: 0 },
  sectionEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  competences: { borderWidth: 1, borderRadius: rayon.bloc, padding: 18, alignItems: 'center' },
  listeStats: { width: '100%', gap: 12, marginTop: 5 },
  stat: { width: '100%' },
  statEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statPiste: { height: 7, borderRadius: 4, marginTop: 5, overflow: 'hidden' },
  statRempli: { height: '100%', borderRadius: 4 },
  insight: { borderWidth: 1, borderRadius: rayon.bloc, padding: 18 },
  insightLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  tag: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  activite: { borderWidth: 1, borderRadius: rayon.bloc, padding: 18 },
  activiteGrille: { flexDirection: 'row', gap: 8, marginTop: 18 },
  forceResume: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: rayon.base, padding: 11, marginTop: 15 },
});
