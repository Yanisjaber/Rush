import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EcranSection } from '@/components/ecrans/EcranSection';
import { Bloc } from '@/components/feuilles/Bloc';
import { BarreZones, teinteZone } from '@/components/reglages/BarreZones';
import { PasZone } from '@/components/reglages/PasZone';
import { Bouton } from '@/components/ui/Bouton';
import { Pastille } from '@/components/ui/Pastille';
import { SelecteurSegments } from '@/components/ui/SelecteurSegments';
import { chargerSeances, chargerTrace, enregistrerProfil } from '@/data/acces/api';
import { formatDureePrecise } from '@/data/outils/format';
import { repartitionsSortie } from '@/data/outils/repartition-zones';
import {
  bornesPourcent, calculerZones, deplacerBorne, lireValeurZone, MODELES_ZONES, pasZone, persoValide, referenceCardio, texteAllure, zonesPersoDuProfil,
  type ModeleZones, type ZonesPerso,
} from '@/data/reglages/profil';
import { familleAffichage } from '@/data/sports/familles';
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

  const revenirAuCalcul = () => {
    setMessage('');
    setPerso((a) => {
      const suite = { ...a };
      delete suite[onglet];
      return suite;
    });
  };
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
  const enregistrer = async () => {
    if (!ligne || envoi) return;
    setEnvoi(true);
    setMessage('');
    const zonesPerso: ZonesPerso = {};
    for (const o of ONGLETS) {
      const v = persoValide(o.cle, perso[o.cle]);
      if (v) zonesPerso[o.cle] = v;
    }
    const suite = { ...extras } as Record<string, unknown>;
    if (Object.keys(zonesPerso).length) suite.zones_perso = zonesPerso;
    else delete suite.zones_perso;
    const r = demo ? { erreur: '' } : userId ? await enregistrerProfil(userId, {}, suite) : { erreur: 'Reconnecte-toi.' };
    setEnvoi(false);
    if (r.erreur) return setMessage(r.erreur);
    setEnregistre(JSON.stringify(zonesPerso));
    setMessage('Enregistré. Les courbes et le temps par zone utilisent tes zones.');
  };

  // L'aperçu : le temps par zone de ta dernière sortie avec les zones en cours de réglage (chargé à l'ouverture de l'onglet)
  const apercu = useApercu(onglet, ref > 0, userId && !demo ? userId : null, ligne, perso);

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
                figees={onglet === 'cardio'}
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

              <View style={{ gap: espace.e2 }}>
                <Text style={[typo.petit, { color: p.texteMuet }]}>
                  {personnalisees
                    ? 'Zones réglées par toi : elles suivent ta référence si tu la changes.'
                    : `Zones calculées depuis ta référence${onglet === 'cardio' && cardio?.estimee ? ' (FC au seuil estimée depuis ta FC max)' : ''}. Règle le début de chaque zone avec − et +, ou tape la valeur.`}
                  {onglet === 'allure' ? ' Pour l’allure, + va vers plus rapide.' : ''}
                </Text>
                {personnalisees ? (
                  <Bouton variante="discret" onPress={revenirAuCalcul}>Revenir aux zones calculées</Bouton>
                ) : null}
                {apercu ? <Apercu apercu={apercu} couleur={couleur} /> : null}
              </View>
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

interface ApercuDonnees {
  titre: string;
  zones: { court: string; secondes: number }[];
}

type FluxApercu = { brut: NonNullable<Parameters<typeof repartitionsSortie>[0]>; course: boolean; dureeS: number | null; titre: string };

/** Le temps par zone de la dernière sortie qui a les courbes voulues, calculé avec les zones en cours de réglage. Rien en démo ou sans sortie utilisable. */
function useApercu(onglet: ModeleZones, actif: boolean, userId: string | null, ligne: ReturnType<typeof useProfilSection>['ligne'], perso: ZonesPerso): ApercuDonnees | null {
  const [flux, setFlux] = useState<Partial<Record<ModeleZones, FluxApercu>>>({});
  const demande = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!actif || !userId || demande.current.has(onglet)) return;
    demande.current.add(onglet);
    void (async () => {
      const r = await chargerSeances(userId, 60, 60);
      const choisie = (r.data ?? []).find((s) => {
        if (!s.strava_id) return false;
        const f = familleAffichage(s.sport);
        if (onglet === 'allure') return f === 'course';
        if (onglet === 'puissance') return f === 'velo' && !!s.device_watts;
        return (f === 'course' || f === 'velo') && Number(s.avg_heartrate) > 0;
      });
      if (!choisie) return;
      const t = await chargerTrace(userId, choisie.id, choisie.strava_id);
      const brut = t.courbes?.brut;
      if (!brut) return;
      const date = String(choisie.start_date_local).slice(0, 10).split('-').reverse().slice(0, 2).join('/');
      setFlux((a) => ({ ...a, [onglet]: { brut, course: familleAffichage(choisie.sport) === 'course', dureeS: choisie.moving_time ?? null, titre: `${choisie.name || 'Dernière sortie'} · ${date}` } }));
    })();
  }, [actif, onglet, userId]);
  return useMemo(() => {
    const f = flux[onglet];
    if (!f || !ligne) return null;
    const extras = (ligne.extras ?? {}) as Record<string, unknown>;
    const cle = onglet === 'cardio' ? 'fc' : onglet === 'puissance' ? 'watts' : 'allure';
    const m = repartitionsSortie(f.brut, { perso, lthr: referenceCardio(ligne), ftp: Number(ligne.ftp) || null, seuilKmh: Number(extras.threshold_speed) || null }, f.course, f.dureeS).find(
      (x) => x.cle === cle && x.zones.length > 0,
    );
    return m ? { titre: f.titre, zones: m.zones.map((z) => ({ court: z.court, secondes: z.secondes })) } : null;
  }, [flux, onglet, ligne, perso]);
}

function Apercu({ apercu, couleur }: { apercu: ApercuDonnees; couleur: string }) {
  const p = usePalette();
  const total = apercu.zones.reduce((a, z) => a + z.secondes, 0);
  if (total <= 0) return null;
  const n = apercu.zones.length;
  return (
    <View
      accessible
      accessibilityLabel={`Aperçu sur ${apercu.titre} : ${apercu.zones.filter((z) => z.secondes > 0).map((z) => `${z.court} ${formatDureePrecise(z.secondes)}`).join(', ')}`}
      style={[styles.apercu, { backgroundColor: p.surface2 }]}
    >
      <Text style={[typo.micro, { color: p.texteDoux, letterSpacing: 1.2 }]}>{`APERÇU · ${apercu.titre.toUpperCase()}`}</Text>
      <View style={styles.pile}>
        {apercu.zones.map((z, i) => (z.secondes > 0 ? <View key={z.court} style={{ flex: z.secondes, backgroundColor: teinteZone(couleur, i, n) }} /> : null))}
      </View>
      <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux }]}>
        {apercu.zones.filter((z) => z.secondes >= 60).map((z) => `${formatDureePrecise(z.secondes)} en ${z.court}`).join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, borderTopWidth: StyleSheet.hairlineWidth },
  puce: { width: 12, height: 12, borderRadius: 6 },
  pas: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vide: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tiret: { fontSize: 32, lineHeight: 36 },
  apercu: { borderRadius: rayon.l, padding: espace.e3, gap: espace.e2 },
  pile: { flexDirection: 'row', height: 18, borderRadius: rayon.rond, overflow: 'hidden', gap: 2 },
});
