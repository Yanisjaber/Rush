import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ZoneClavier } from '@/components/ZoneClavier';
import { Bouton } from '@/components/Bouton';
import { PastillesChoix } from '@/components/ChampsFeuille';
import { ChampTexte } from '@/components/ChampTexte';
import { formulaireBlocVide, formulaireDepuisBloc, validerBloc, type FormulaireBloc, type FormulaireSegment } from '@/data/calendrier/blocs-formulaire';
import { COULEURS_ZONE, lireDuree, NOM_METRIQUE, NOM_TYPE, texteCible, texteDuree, TYPES_BLOC, ZONES, type Bloc, type Metrique, type Reference, type TypeBloc } from '@/data/calendrier/structure';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La feuille qui crée ou modifie un bloc de séance : son type, sa durée et son intensité (une zone, ou un pourcentage libre) et, pour des intervalles, le nombre
// de répétitions et la récupération. En dessous, la cible traduite en watts, battements ou allure d'après tes références.
interface Props {
  ouvert: boolean;
  /** Le bloc modifié ; null pour un nouveau bloc. */
  bloc: Bloc | null;
  /** Les mesures permises pour le sport (watts/cardio, allure/cardio…) ; la première sert de départ. */
  metriques: Metrique[];
  /** Le type brut du sport, pour écrire les cibles (allure au km ou aux 100 m). */
  sport: string;
  reference: Reference;
  /** Les actions sur un bloc existant ; absentes pour un nouveau bloc. */
  onSupprimer?: () => void;
  onDupliquer?: () => void;
  onDeplacer?: (sens: -1 | 1) => void;
  onFermer: () => void;
  onValider: (b: Bloc) => void;
}

export function FeuilleBloc({ ouvert, bloc, metriques, sport, reference, onSupprimer, onDupliquer, onDeplacer, onFermer, onValider }: Props) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const [f, setF] = useState<FormulaireBloc>(formulaireBlocVide('steady', metriques[0]));
  const [erreur, setErreur] = useState('');

  // À chaque ouverture : le formulaire du bloc modifié, ou un bloc neuf (continu, dans la première mesure du sport)
  useEffect(() => {
    if (!ouvert) return;
    setF(bloc ? formulaireDepuisBloc(bloc) : formulaireBlocVide('steady', metriques[0]));
    setErreur('');
    // l'ouverture seule remplit le formulaire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  const change = (suite: FormulaireBloc) => {
    setF(suite);
    setErreur('');
  };

  const etiquette = (t: string) => <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16, fontFamily: police.texte600 }]}>{t}</Text>;

  // Un segment (durée + intensité) : la durée s'écrit librement, l'intensité se choisit par zone ou en pourcentage
  const segment = (titre: string, s: FormulaireSegment, maj: (s: FormulaireSegment) => void) => {
    const zones = ZONES[f.metric];
    const lu = lireDuree(s.duree);
    return (
      <View style={{ gap: 8 }}>
        {etiquette(titre)}
        <View style={styles.ligne}>
          <View style={{ flex: 1 }}>
            <ChampTexte sur="surface" value={s.duree} onChangeText={(t) => maj({ ...s, duree: t })} placeholder="4, 30s, 1h…" autoCorrect={false} accessibilityLabel={`Durée : ${titre}`} />
          </View>
          <Text style={[typo.corpsFort, { color: p.texteDoux, minWidth: 64, textAlign: 'right' }]}>{lu ? texteDuree(lu) : ''}</Text>
        </View>
        <View style={styles.zones} accessibilityRole="radiogroup" accessibilityLabel={`Intensité : ${titre}`}>
          {zones.noms.map((nom, i) => {
            const actif = s.zone === i;
            return (
              <Pressable
                key={nom}
                onPress={() => maj({ ...s, zone: i })}
                accessibilityRole="radio"
                accessibilityState={{ selected: actif }}
                accessibilityLabel={nom}
                style={[styles.zone, { borderColor: COULEURS_ZONE[i], backgroundColor: actif ? COULEURS_ZONE[i] : 'transparent' }]}
              >
                <Text style={[typo.corpsFort, { color: actif ? '#14161b' : p.texte }]}>{nom.split(' ')[0]}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => maj({ ...s, zone: 'perso' })}
            accessibilityRole="radio"
            accessibilityState={{ selected: s.zone === 'perso' }}
            accessibilityLabel="Pourcentage libre"
            style={[styles.zone, { borderColor: p.contourChamp, backgroundColor: s.zone === 'perso' ? p.texte : 'transparent' }]}
          >
            <Text style={[typo.corpsFort, { color: s.zone === 'perso' ? p.fond : p.texte }]}>%</Text>
          </Pressable>
        </View>
        {s.zone === 'perso' ? (
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <ChampTexte sur="surface" etiquette="De (%)" value={s.int} onChangeText={(t) => maj({ ...s, int: t })} keyboardType="decimal-pad" maxLength={6} accessibilityLabel="Intensité basse en pourcentage" />
            </View>
            <View style={{ flex: 1 }}>
              <ChampTexte sur="surface" etiquette="À (%, facultatif)" value={s.intHi} onChangeText={(t) => maj({ ...s, intHi: t })} keyboardType="decimal-pad" maxLength={6} accessibilityLabel="Intensité haute en pourcentage" />
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  // La cible traduite, pour que tu voies ce que ça donne (« 4 min · 228–263 W · Z4 »)
  const apercu = (s: FormulaireSegment): string => {
    const r = validerBloc({ ...f, type: 'interval', reps: '1', travail: s, recup: s });
    return r.ok ? texteCible(r.bloc.work, f.metric, reference, sport) : '';
  };

  function valider() {
    const r = validerBloc(f);
    if (!r.ok) return setErreur(r.erreur);
    onValider(r.bloc);
  }

  function confirmerSuppression() {
    Alert.alert('Supprimer ce bloc ?', 'Il disparaît de la séance.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => onSupprimer?.() },
    ]);
  }

  const interval = f.type === 'interval';
  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityLabel="Fermer" accessibilityRole="button" onPress={onFermer} style={styles.fond} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.conteneur} pointerEvents="box-none">
        <ZoneClavier modale style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas + espace.e4 }]}>
          <View style={[styles.poignee, { backgroundColor: p.traitFort }]} />
          <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
            {bloc ? 'Modifier le bloc' : 'Nouveau bloc'}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: espace.e3, paddingBottom: espace.e2 }}>
            <PastillesChoix
              valeurs={TYPES_BLOC.map((t) => ({ cle: t as TypeBloc, nom: NOM_TYPE[t] }))}
              actuel={f.type}
              onChoisir={(t) => change(bloc ? { ...f, type: t } : { ...formulaireBlocVide(t, f.metric), nom: f.nom })}
              etiquette="Type de bloc"
            />
            {metriques.length > 1 ? (
              <>
                {etiquette('Mesure')}
                <PastillesChoix valeurs={metriques.map((m) => ({ cle: m, nom: NOM_METRIQUE[m] }))} actuel={f.metric} onChoisir={(m) => change({ ...f, metric: m, travail: { ...f.travail, zone: Math.min(typeof f.travail.zone === 'number' ? f.travail.zone : 0, ZONES[m].bas.length - 1) }, recup: { ...f.recup, zone: Math.min(typeof f.recup.zone === 'number' ? f.recup.zone : 0, ZONES[m].bas.length - 1) } })} etiquette="Mesure de l'intensité" />
              </>
            ) : null}
            <ChampTexte sur="surface" etiquette="Nom (facultatif)" value={f.nom} onChangeText={(t) => change({ ...f, nom: t })} maxLength={60} placeholder={NOM_TYPE[f.type]} returnKeyType="done" accessibilityLabel="Nom du bloc" />
            {interval ? (
              <View style={{ width: 130 }}>
                <ChampTexte sur="surface" etiquette="Répétitions" value={f.reps} onChangeText={(t) => change({ ...f, reps: t })} keyboardType="number-pad" maxLength={2} accessibilityLabel="Nombre de répétitions" />
              </View>
            ) : null}
            {segment(interval ? 'Effort' : 'Durée et intensité', f.travail, (s) => change({ ...f, travail: s }))}
            {apercu(f.travail) ? <Text style={[typo.petit, { color: p.texteDoux }]}>{apercu(f.travail)}</Text> : null}
            {interval ? segment('Récupération', f.recup, (s) => change({ ...f, recup: s })) : null}
            {interval && apercu(f.recup) ? <Text style={[typo.petit, { color: p.texteDoux }]}>{apercu(f.recup)}</Text> : null}
          </ScrollView>
          {erreur ? (
            <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
              {erreur}
            </Text>
          ) : null}
          <Bouton onPress={valider}>{bloc ? 'Enregistrer le bloc' : 'Ajouter le bloc'}</Bouton>
          {bloc ? (
            <View style={styles.actions}>
              {onDeplacer ? (
                <>
                  <Bouton petit variante="discret" onPress={() => onDeplacer(-1)} accessibilityLabel="Monter le bloc">
                    Monter
                  </Bouton>
                  <Bouton petit variante="discret" onPress={() => onDeplacer(1)} accessibilityLabel="Descendre le bloc">
                    Descendre
                  </Bouton>
                </>
              ) : null}
              {onDupliquer ? (
                <Bouton petit variante="discret" onPress={onDupliquer}>
                  Dupliquer
                </Bouton>
              ) : null}
              {onSupprimer ? (
                <Bouton petit variante="discret" onPress={confirmerSuppression}>
                  Supprimer
                </Bouton>
              ) : null}
            </View>
          ) : null}
        </ZoneClavier>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  conteneur: { flex: 1, justifyContent: 'flex-end' },
  feuille: { maxHeight: '92%', borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  zone: { minHeight: 44, minWidth: 48, borderWidth: 2, borderRadius: rayon.rond, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
});
