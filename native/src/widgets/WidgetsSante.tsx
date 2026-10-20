import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget, TitreWidget } from '@/components/CadreWidget';
import { GrandChiffre } from '@/components/GrandChiffre';
import { Tuile } from '@/components/Tuile';
import { lecture, type PointForme } from '@/data/forme-sante';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le widget de l'écran principal de Santé : l'état du jour. Même cadre que ceux de l'Accueil (CadreWidget) ; comme premier bloc de la page,
// il prend le look dossard. Les piliers qui l'expliquent sont dessous, sous forme de cartes identiques (CartePilier).
export interface PropsSante {
  /** L'état de forme jour par jour (de la plus ancienne à la plus récente), voir forme-sante.ts. */
  serie: PointForme[];
  /** XS, S ou M : la version tuile (chiffre clé) ; L : le grand format. */
  tuile?: boolean;
  /** Une seule ligne de 160 pt : le chiffre à gauche, le libellé et la phrase à droite (l'écran principal de Santé). */
  compact?: boolean;
}

const MOT_PRECISION = { basique: 'basique', bonne: 'bonne', elevee: 'élevée' } as const;

const SOUS_TITRE_FAIBLE: Record<string, string> = {
  hrv: 'ta HRV',
  fc: 'ta FC de repos',
  sommeil: 'ton sommeil',
  ressenti: 'ton ressenti du matin',
  stress: 'ton stress de nuit',
  charge: "ta charge d'entraînement",
  resp: 'ta respiration de nuit',
  temperature: 'ta température cutanée',
};

// La précision de l'estimation (combien de piliers sur 8 ont une donnée), puis le frein (malade, blessé) ou ce qui pèse le plus
function LignePrecision({ point, faible }: { point: PointForme; faible?: string }) {
  const p = usePalette();
  const dispo = point.composantes.filter((c) => c.indice != null).length;
  return (
    <View style={{ marginTop: 4, gap: 2 }}>
      <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
        Précision {point.precision ? MOT_PRECISION[point.precision] : 'insuffisante'} · {dispo} piliers sur {point.composantes.length}
      </Text>
      {point.freins.slice(0, 1).map((f) => (
        <Text key={f} numberOfLines={1} style={[typo.petit, { color: p.texte }]}>
          {f}
        </Text>
      ))}
      {!point.freins.length && faible ? (
        <Text numberOfLines={1} style={[typo.petit, { color: p.texte }]}>
          Ce qui pèse le plus : {SOUS_TITRE_FAIBLE[faible]}.
        </Text>
      ) : null}
      <Text style={[typo.petit, { color: p.texteDoux, marginTop: 4 }]}>Voir la courbe et le calcul ›</Text>
    </View>
  );
}

/** L'état du jour : l'indice de forme (0 à 100), une phrase de lecture, la précision et ce qui pèse le plus. */
export function WidgetEtatDuJour({ serie, tuile = false, compact = false }: PropsSante) {
  const point = serie[serie.length - 1] ?? null;
  const l = lecture(point);
  if (compact) return <EtatCompact point={point} />;
  if (tuile) {
    return <Tuile gros titre="État de forme" valeur={l ? String(l.indice) : '—'} unite={l ? '/100' : undefined} note={l ? l.libelle : 'Pas assez de données'} />;
  }
  const detail = l ? l.phrase : 'Il faut quelques semaines de nuits (HRV, FC de repos, sommeil) pour calibrer ta référence personnelle.';
  return (
    <CadreWidget titre="État du jour">
      <GrandChiffre reduit valeur={l ? String(l.indice) : '—'} nom={l ? l.libelle : 'Pas assez de données'} detail={detail}>
        {point ? <LignePrecision point={point} faible={l?.pointFaible?.cle} /> : null}
      </GrandChiffre>
    </CadreWidget>
  );
}

// La version en une ligne : en haut le titre et la précision, dessous le chiffre à gauche, le libellé, la phrase et ce qui pèse le plus à droite.
// Le contenu est un composant à part : il doit lire la palette du cadre (inversée quand le widget est en look dossard), pas celle de l'écran.
function EtatCompact({ point }: { point: PointForme | null }) {
  return (
    <CadreWidget>
      <ContenuCompact point={point} />
    </CadreWidget>
  );
}

function ContenuCompact({ point }: { point: PointForme | null }) {
  const p = usePalette();
  const l = lecture(point);
  const dispo = point ? point.composantes.filter((c) => c.indice != null).length : 0;
  const ligne = point?.freins[0] ?? (l?.pointFaible ? `Pèse le plus : ${SOUS_TITRE_FAIBLE[l.pointFaible.cle]}.` : null);
  return (
    <>
      <View style={styles.tete}>
        <TitreWidget titre="État du jour" serre />
        {point ? (
          <Text numberOfLines={1} style={[typo.petit, styles.precision, { color: p.texteDoux }]}>
            Précision {point.precision ? MOT_PRECISION[point.precision] : 'insuffisante'} · {dispo}/{point.composantes.length}
          </Text>
        ) : null}
      </View>
      <View style={styles.corps}>
        <Text accessibilityLabel={l ? `État de forme ${l.indice} sur 100` : 'État de forme indisponible'} style={[styles.chiffre, { color: p.texte }]}>
          {l ? l.indice : '—'}
        </Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>
            {l ? l.libelle : 'Pas assez de données'}
          </Text>
          <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux }]}>
            {l ? l.phrase : 'Il faut quelques semaines de nuits pour calibrer ta référence.'}
          </Text>
          {ligne ? (
            <Text numberOfLines={1} style={[typo.petit, { color: p.texte }]}>
              {ligne}
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  precision: { flexShrink: 1 },
  corps: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  chiffre: { fontFamily: police.titre800, fontSize: 56, lineHeight: 60, letterSpacing: -1, minWidth: 74 },
});
