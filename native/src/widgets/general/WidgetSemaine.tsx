import { StyleSheet, Text, View } from 'react-native';
import { courtDuType } from '@/data/sports/catalogue-sports';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { MiniBarres } from '@/components/graphes/MiniBarres';
import { Tuile } from '@/components/ui/Tuile';
import { formatDuree } from '@/data/outils/format';
import { carresDuJour, semaineCourante } from '@/data/bilan/synthese';
import type { WidgetProps } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La semaine en cours, du lundi au dimanche. Sur le web, sept colonnes côte à côte ; sur téléphone,
// une ligne par jour (sept colonnes de 46 pt seraient illisibles). Mêmes calculs, autre mise en page.
// Séance faite : aplat de la couleur du sport. Séance prévue : simple contour.
const nom = courtDuType;

// tuile : le nombre de séances de la semaine + une barre par jour (lundi → dimanche).
export function WidgetSemaine({ contexte, taille, tuile = false }: WidgetProps) {
  const p = usePalette();
  const { seances, planifiees } = contexte;
  const aujourdhui = new Date();
  const jours = semaineCourante(seances, aujourdhui, planifiees);
  const nbSeances = jours.reduce((n, j) => n + j.seances.length, 0);

  // En M (une ligne entière) la semaine garde sa version large : c'est le héros de l'accueil « Tous »
  if (tuile && taille !== 'm') {
    const parJour = jours.map((j) => j.seances.length);
    const prevues = jours.reduce((n, j) => n + j.prevues.length, 0);
    return (
      <Tuile
        titre="Cette semaine"
        valeur={String(nbSeances)}
        unite={nbSeances > 1 ? 'séances' : 'séance'}
        note={prevues ? `${prevues} prévue${prevues > 1 ? 's' : ''} à venir` : nbSeances > 1 ? 'faites' : 'faite'}
      >
        <MiniBarres valeurs={parJour} max={Math.max(2, ...parJour)} couleur={p.sportNeutre} etiquette="Séances par jour cette semaine, du lundi au dimanche" />
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Cette semaine">
      <CorpsHero jours={jours} grand={taille === 'l'} />
    </CadreWidget>
  );
}

// Version large (héros de l'accueil « Tous ») : le chiffre de la semaine en gros (séances, durée), puis les sept jours en une
// ligne serrée : le jour, puis un carré par séance (plein : faite, contour : prévue).
// Dans un composant à part : il lit la palette fournie par le cadre (inversée quand le widget est en look dossard).
// grand (L, 320 pt de haut) : chaque jour est une colonne où les séances s'empilent en pastilles de la couleur du sport avec leur durée.
function CorpsHero({ jours, grand = false }: { jours: ReturnType<typeof semaineCourante>; grand?: boolean }) {
  const p = usePalette();
  const nbSeances = jours.reduce((n, j) => n + j.seances.length, 0);
  const duree = jours.reduce((t, j) => t + j.seances.reduce((n, s) => n + s.moving_time, 0), 0);
  const prevues = jours.reduce((n, j) => n + j.prevues.length, 0);
  return (
    <View style={[styles.hero, grand && styles.heroGrand]}>
      <View style={styles.chiffres} accessible accessibilityLabel={`${nbSeances} séance${nbSeances > 1 ? 's' : ''}, ${formatDuree(duree)}${prevues ? `, ${prevues} prévue${prevues > 1 ? 's' : ''} à venir` : ''}`}>
        <Text style={[styles.grand, { color: p.texte }]}>
          {nbSeances}
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}> séance{nbSeances > 1 ? 's' : ''}</Text>
        </Text>
        <View style={styles.droite}>
          <Text style={[styles.duree, { color: p.texte }]}>{formatDuree(duree)}</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{prevues ? `${prevues} prévue${prevues > 1 ? 's' : ''} à venir` : 'rien de prévu'}</Text>
        </View>
      </View>
      <View style={[styles.semaine, grand && styles.semaineGrande]}>
        {jours.map((j) => {
          const libelle = [
            `${j.jour} ${j.num}`,
            ...j.seances.map((s) => `${nom(s.sport)} ${formatDuree(s.moving_time)}`),
            ...j.prevues.map((x) => `prévu : ${nom(x.sport)}`),
          ].join(', ');
          const carres = carresDuJour(j, (f) => couleurSport(p, f));
          return (
            <View key={j.iso} accessible accessibilityLabel={libelle} style={styles.colonne}>
              <View style={[styles.date, j.aujourdhui && { backgroundColor: p.texte }]}>
                <Text style={[typo.micro, { color: j.aujourdhui ? p.fond : p.texteDoux }]}>{j.jour}</Text>
                <Text style={[styles.num, { color: j.aujourdhui ? p.fond : p.texte }]}>{j.num}</Text>
              </View>
              {grand ? (
                <View style={styles.pile}>
                  {[...j.seances.map((x) => ({ cle: `f${x.id}`, fait: true, sport: x.sport, duree: formatDuree(x.moving_time) })), ...j.prevues.map((x) => ({ cle: `p${x.id}`, fait: false, sport: x.sport, duree: x.duration ? formatDuree(x.duration * 60) : '' }))]
                    .slice(0, 4)
                    .map((c) => {
                      const couleur = couleurSport(p, c.sport);
                      return (
                        <View key={c.cle} style={[styles.pastilleJour, c.fait ? { backgroundColor: couleur } : [styles.prevue, { borderColor: couleur }]]}>
                          <Text numberOfLines={1} style={[styles.dureeJour, { color: c.fait ? p.encreSurCouleur : p.texte }]}>
                            {c.duree || '·'}
                          </Text>
                        </View>
                      );
                    })}
                  {j.seances.length + j.prevues.length > 4 ? <Text style={[styles.plus, { color: p.texteDoux }]}>+{j.seances.length + j.prevues.length - 4}</Text> : null}
                </View>
              ) : (
              <View style={styles.carres}>
                {/* Jusqu'à 3 séances : un carré chacune (plein : faite, contour : prévue). Au-delà : 2 carrés puis « +N » (la colonne ne fait que 44 pt) */}
                {carres.visibles.map((c) => (
                  <View key={c.cle} style={[styles.carre, c.fait ? { backgroundColor: c.couleur } : [styles.prevue, { borderColor: c.couleur }]]} />
                ))}
                {carres.cachees > 0 ? (
                  <Text style={[styles.plus, { color: p.texteDoux }]}>+{carres.cachees}</Text>
                ) : null}
              </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, gap: 6, justifyContent: 'flex-end' },
  heroGrand: { gap: 16, justifyContent: 'flex-start' },
  chiffres: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  grand: { fontFamily: police.titre800, fontSize: 32, lineHeight: 34, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  droite: { alignItems: 'flex-end' },
  duree: { fontFamily: police.titre700, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
  semaine: { flexDirection: 'row', gap: 4 },
  semaineGrande: { flex: 1 },
  colonne: { flex: 1, alignItems: 'center', gap: 3 },
  // Le bloc du jour : le nom du jour au-dessus du numéro, aujourd'hui en inversé
  date: { alignSelf: 'stretch', alignItems: 'center', borderRadius: rayon.base, paddingVertical: 1 },
  num: { fontFamily: police.titre700, fontSize: 15, lineHeight: 18 },
  carres: { height: 12, flexDirection: 'row', gap: 3 },
  carre: { width: 12, height: 12, borderRadius: 4 },
  plus: { fontFamily: police.texte600, fontSize: 11, lineHeight: 12, alignSelf: 'center' },
  pile: { flex: 1, gap: 4, alignSelf: 'stretch', alignItems: 'stretch' },
  pastilleJour: { height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dureeJour: { fontFamily: police.texte600, fontSize: 12, lineHeight: 14, fontVariant: ['tabular-nums'] },
  prevue: { backgroundColor: 'transparent', borderWidth: 2 },
});
