import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EcranSection } from '@/components/ecrans/EcranSection';
import { Bloc } from '@/components/feuilles/Bloc';
import { BarreZones, teinteZone } from '@/components/reglages/BarreZones';
import { PasZone } from '@/components/reglages/PasZone';
import { Bouton } from '@/components/ui/Bouton';
import { Pastille } from '@/components/ui/Pastille';
import { SelecteurSegments } from '@/components/ui/SelecteurSegments';
import { demanderZonesAuCoach, enregistrerProfil, type PropositionZones } from '@/data/acces/api';
import {
  bornesPourcent, calculerZones, deplacerBorne, lireValeurZone, MODELES_ZONES, pasZone, persoValide, referenceCardio, texteAllure, zonesPersoDuProfil,
  type ModeleZones, type ZonesPerso,
} from '@/data/reglages/profil';
import { useProfilSection } from '@/hooks/useProfilSection';
import { useAuth } from '@/stores/auth';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Paramètres › Zones : trois onglets (puissance, cœur, allure). Les zones partent du calcul depuis ta référence (FTP, FC au seuil, vitesse seuil) et sont toujours réglables :
// tu règles le début de chaque zone avec − / + (qui répètent en restant appuyé) ou au clavier, et les courbes, le temps par zone et l'analyse suivent partout dans l'app.
// Les zones perso sont rangées dans `extras.zones_perso` du profil, en % de la référence ; si la référence change, elles suivent.
const ONGLETS: { cle: ModeleZones; libelle: string }[] = [
  { cle: 'puissance', libelle: 'Puissance' },
  { cle: 'cardio', libelle: 'Cœur' },
  { cle: 'allure', libelle: 'Allure' },
];

export default function Zones() {
  const p = usePalette();
  const router = useRouter();
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const { ligne, chargement } = useProfilSection('physiologie');
  const [onglet, setOnglet] = useState<ModeleZones>('puissance');
  const [perso, setPerso] = useState<ZonesPerso>({});
  const [enregistre, setEnregistre] = useState('{}');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [coach, setCoach] = useState<{ etat: 'repos' | 'calcul' | 'erreur' | 'proposition'; message?: string; resultat?: PropositionZones }>({ etat: 'repos' });

  // Les zones perso du profil, une fois chargé
  useEffect(() => {
    if (!ligne) return;
    const z = zonesPersoDuProfil(ligne);
    setPerso(z);
    setEnregistre(JSON.stringify(z));
  }, [ligne]);

  const extras = (ligne?.extras ?? {}) as Record<string, unknown>;
  const cardio = referenceCardio(ligne);
  const refs: Record<ModeleZones, number> = {
    puissance: Number(ligne?.ftp) || 0,
    cardio: cardio?.bpm ?? 0,
    allure: Number(extras.threshold_speed) || 0,
  };
  const couleurs: Record<ModeleZones, string> = { puissance: p.sportVelo, cardio: p.sportVelo, allure: p.sportCourse };
  const modele = MODELES_ZONES[onglet];
  const ref = refs[onglet];
  const personnalisees = persoValide(onglet, perso[onglet]) !== null;
  const bornes = bornesPourcent(onglet, perso[onglet]);
  const zones = calculerZones(onglet, ref, perso[onglet]);
  const couleur = couleurs[onglet];
  const sale = JSON.stringify(perso) !== enregistre;

  const unite = onglet === 'allure' ? '/km' : modele.unite;
  const texteValeur = useCallback((v: number) => (onglet === 'allure' ? texteAllure(v).replace('/km', '') : String(Math.round(v))), [onglet]);
  const valeurBorne = (i: number) => (ref * bornes[i]) / 100;

  const deplacer = (i: number, valeur: number) => {
    const n = deplacerBorne(onglet, ref, bornes, i, valeur);
    if (n) {
      setPerso((a) => ({ ...a, [onglet]: n.slice(1) }));
      setMessage('');
    }
  };
  // Un cran = 1 bpm ou 1 W, ou 0,1 km/h (soit environ 2 à 5 s/km selon l'allure) ; `n` crans quand la flèche répète
  const pousser = (i: number, sens: 1 | -1, n = 1) => deplacer(i, valeurBorne(i) + sens * n * pasZone(onglet));
  const saisir = (i: number, texte: string) => {
    const v = lireValeurZone(onglet, texte);
    if (v === null) return false;
    deplacer(i, v);
    return true;
  };
  const enregistrer = async (surcharge?: ZonesPerso) => {
    if (!ligne || envoi) return;
    const source = surcharge ?? perso;
    setEnvoi(true);
    setMessage('');
    const zonesPerso: ZonesPerso = {};
    for (const o of ONGLETS) {
      const v = persoValide(o.cle, source[o.cle]);
      if (v) zonesPerso[o.cle] = v;
    }
    const suite = { ...extras } as Record<string, unknown>;
    if (Object.keys(zonesPerso).length) suite.zones_perso = zonesPerso;
    else delete suite.zones_perso;
    const r = demo ? { erreur: '' } : userId ? await enregistrerProfil(userId, {}, suite) : { erreur: 'Reconnecte-toi.' };
    setEnvoi(false);
    if (r.erreur) return setMessage(r.erreur);
    setPerso(zonesPerso);
    setEnregistre(JSON.stringify(zonesPerso));
    setMessage('Enregistré. Les courbes et le temps par zone utilisent tes zones.');
  };

  const demanderAuCoach = async () => {
    setCoach({ etat: 'calcul' });
    setMessage('');
    const r = await demanderZonesAuCoach();
    setCoach(r.ok ? { etat: 'proposition', resultat: r.resultat } : { etat: 'erreur', message: r.message });
  };
  const appliquerCoach = async () => {
    const prop = coach.resultat?.proposition;
    if (!prop) return;
    setCoach({ etat: 'repos' });
    await enregistrer({ ...perso, ...prop });
  };

  if (chargement) return <EcranSection><Text style={[typo.corps, { color: p.texteDoux }]}>Chargement…</Text></EcranSection>;
  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        <SelecteurSegments
          options={ONGLETS}
          choix={onglet}
          onChoix={(c) => {
            setOnglet(c as ModeleZones);
            setMessage('');
          }}
        />
        <Bloc titre={modele.titre}>
          {zones ? (
            <View style={{ gap: espace.e3 }}>
              <BarreZones
                bornes={bornes}
                axeMax={Math.max(bornes[bornes.length - 1] * 1.3, onglet === 'puissance' ? 160 : onglet === 'cardio' ? 120 : 115)}
                couleur={couleur}
                noms={zones.map((z) => z.nom.split(' ')[0])}
                figees
                texte={(i) => texteValeur(valeurBorne(i))}
              />

              <View>
                {zones.map((z, i) => (
                  <View key={z.nom} style={[styles.ligne, { borderTopColor: p.trait }]}>
                    <View style={[styles.puce, { backgroundColor: teinteZone(couleur, i, zones.length) }]} />
                    <Text numberOfLines={1} style={[typo.corps, { color: p.texte, flex: 1 }]}>{z.nom}</Text>
                    {i > 0 ? (
                      <PasZone
                        texte={texteValeur(z.de)}
                        nom={z.nom}
                        unite={unite}
                        onPas={(sens, n) => pousser(i, sens, n)}
                        onSaisie={(t) => saisir(i, t)}
                        moins={onglet === 'allure' ? 'plus lent' : 'plus bas'}
                        plus={onglet === 'allure' ? 'plus rapide' : 'plus haut'}
                      />
                    ) : (
                      <Text style={[typo.corpsFort, { color: p.texte }]}>{plageZone(onglet, z, i, zones.length, unite)}</Text>
                    )}
                  </View>
                ))}
              </View>


              {!demo ? (
                <View style={{ gap: espace.e2 }}>
                  {coach.etat !== 'proposition' ? (
                    <Bouton variante="discret" onPress={() => void demanderAuCoach()} disabled={coach.etat === 'calcul'}>
                      {coach.etat === 'calcul' ? 'Le coach calcule…' : 'Faire calculer mes zones par le coach'}
                    </Bouton>
                  ) : null}
                  {coach.etat === 'erreur' ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>{coach.message}</Text> : null}
                  {coach.etat === 'proposition' && coach.resultat ? (
                    <PropositionCoach
                      resultat={coach.resultat}
                      perso={perso}
                      refs={refs}
                      couleurs={couleurs}
                      envoi={envoi}
                      onAppliquer={() => void appliquerCoach()}
                      onIgnorer={() => setCoach({ etat: 'repos' })}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.vide}>
              <Text style={[styles.tiret, { color: p.texteMuet }]}>—</Text>
              <Pastille nom={`Renseigner ${modele.reference}`} actif={false} onPress={() => router.push('/parametres/physiologie')} aide="Ouvre la physiologie" />
            </View>
          )}
        </Bloc>

        {sale || message ? (
          <View style={{ gap: espace.e2 }}>
            {sale ? <Bouton onPress={() => void enregistrer()} disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer mes zones'}</Bouton> : null}
            {message ? (
              <Text accessibilityRole="alert" style={[typo.petit, { color: message.startsWith('Enregistré') ? p.texteDoux : p.danger }]}>{message}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </EcranSection>
  );
}

/** La plage lisible d'une zone, avec l'unité. En allure, du plus lent au plus rapide (les zones vont du plus lent au plus rapide). */
function plageZone(modele: ModeleZones, z: { de: number; a: number }, i: number, n: number, unite: string): string {
  const al = (kmh: number) => texteAllure(kmh).replace('/km', '');
  if (modele === 'allure') return i === 0 ? `> ${al(z.a)} /km` : i === n - 1 ? `< ${al(z.de)} /km` : `${al(z.de)} – ${al(z.a)} /km`;
  if (i === 0) return `0 – ${z.a} ${unite}`;
  if (i === n - 1) return `≥ ${z.de} ${unite}`;
  return `${z.de} – ${z.a} ${unite}`;
}

/** La proposition du coach : l'explication, puis ce qui change zone par zone (avant → après), à valider ou à ignorer. */
function PropositionCoach({ resultat, perso, refs, couleurs, envoi, onAppliquer, onIgnorer }: {
  resultat: PropositionZones;
  perso: ZonesPerso;
  refs: Record<ModeleZones, number>;
  couleurs: Record<ModeleZones, string>;
  envoi: boolean;
  onAppliquer: () => void;
  onIgnorer: () => void;
}) {
  const p = usePalette();
  const lignes: { cle: string; modele: ModeleZones; titre: string; avant: string; apres: string }[] = [];
  for (const m of ['puissance', 'cardio', 'allure'] as const) {
    const prop = resultat.proposition[m];
    if (!prop) continue;
    const avant = calculerZones(m, refs[m], perso[m]);
    const apres = calculerZones(m, refs[m], prop);
    if (!avant || !apres) continue;
    const t = (v: number) => (m === 'allure' ? texteAllure(v).replace('/km', '') : String(Math.round(v)));
    avant.forEach((z, i) => {
      if (i > 0 && z.de !== apres[i].de) lignes.push({ cle: `${m}${i}`, modele: m, titre: z.nom, avant: t(z.de), apres: t(apres[i].de) });
    });
  }
  return (
    <View style={[styles.proposition, { backgroundColor: p.surface2 }]}>
      <Text style={[typo.micro, { color: p.texteDoux, letterSpacing: 1.2 }]}>PROPOSITION DU COACH</Text>
      <Text style={[typo.corps, { color: p.texte }]}>{resultat.explication}</Text>
      {lignes.length ? (
        <View>
          {lignes.map((l) => (
            <View key={l.cle} style={styles.diff}>
              <View style={[styles.puce, { backgroundColor: couleurs[l.modele] }]} />
              <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux, flex: 1 }]}>{`${MODELES_ZONES[l.modele].titre} · ${l.titre}`}</Text>
              <Text style={[typo.corpsFort, { color: p.texte }]}>{`${l.avant} → ${l.apres}`}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[typo.petit, { color: p.texteDoux }]}>Aucune limite ne change : tes zones actuelles lui conviennent.</Text>
      )}
      <View style={{ gap: espace.e2 }}>
        {lignes.length ? <Bouton onPress={onAppliquer} disabled={envoi}>{envoi ? 'Enregistrement…' : 'Appliquer ces zones'}</Bouton> : null}
        <Bouton variante="discret" onPress={onIgnorer}>{lignes.length ? 'Ignorer' : 'OK'}</Bouton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, borderTopWidth: StyleSheet.hairlineWidth },
  puce: { width: 12, height: 12, borderRadius: 6 },
  pas: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  proposition: { borderRadius: rayon.l, padding: espace.e3, gap: espace.e3 },
  diff: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  vide: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tiret: { fontSize: 32, lineHeight: 36 },
});
