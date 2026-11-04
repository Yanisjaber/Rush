// ============================================================
// Remplit le COMPTE DE DÉMO de la vraie base : un compte normal dont les activités sont simulées (six ans et plus, avec streams de puissance, cardio, cadence, vitesse, altitude),
// des séries de muscu, des tests Hyrox, des objectifs, des séances prévues, du sommeil, etc. L'app lit tout ça comme pour n'importe quel compte : aucune donnée fabriquée dans l'app.
//
// Les courbes de records, les métriques et le profil de puissance sont calculés par la VRAIE fonction du serveur (Edge Function strava-streams, mode `courbes_seulement`)
// à partir des streams stockés : rien n'est recopié ici. Les streams sont gardés seulement pour les 60 derniers jours (la base est presque pleine) : les courbes restent.
//
// Usage (depuis la racine du dépôt) :
//   node --experimental-strip-types supabase/seed-demo/semer-demo.mts [--etape=utilisateur|donnees|activites|tout]   (défaut : tout)
// Il lit le fichier .env à la racine (jamais affiché) : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Le compte de démo est le seul touché (id fixe ci-dessous).
// Le mot de passe du compte est tiré au hasard à chaque exécution et rangé dans les secrets des Edge Functions (DEMO_EMAIL, DEMO_PASSWORD) : il n'est jamais dans le code.
// ============================================================
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { activitesBilanDemo, donneesDemo, objectifHyroxDemo, objectifsAnnuelsDemo, programmesDemo, seriesForceHistoriqueDemo, testsHyroxHistoriqueDemo } from '../../native/src/data/demo/demo.ts';
import { genererFlux } from '../../native/src/data/demo/flux-demo.ts';
import type { Seance } from '../../native/src/data/types.ts';

// --- Réglages ---------------------------------------------------------------------------------------------------------------

/** Le compte de démo : identifiant fixe (les règles « lecture seule » de la base le connaissent) et adresse. */
export const ID_DEMO = '7b0e2f4a-5d3c-4e8a-9a61-2c4f8d1e6b90';
const EMAIL_DEMO = 'demo@rush-demo.app';
const JOURS_STREAMS_GARDES = 60;
const TAILLE_LOT = 60;

const racine = ((): string => {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, '.env'))) return d;
    d = dirname(d);
  }
  throw new Error('.env introuvable');
})();
const env: Record<string, string> = {};
for (const l of readFileSync(join(racine, '.env'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_BASE = env.SUPABASE_URL;
const CLE_SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const CLE_PUBLIQUE = /SUPABASE_CLE_PUBLIQUE = '([^']+)'/.exec(readFileSync(join(racine, 'native/src/config.ts'), 'utf8'))?.[1] ?? '';
if (!URL_BASE || !CLE_SERVICE || !CLE_PUBLIQUE) throw new Error('Configuration Supabase incomplète');

const argEtape = process.argv.find((a) => a.startsWith('--etape='))?.split('=')[1] ?? 'tout';
const maintenant = new Date();

// --- Outils -----------------------------------------------------------------------------------------------------------------

/** Un UUID stable à partir d'un identifiant de la démo (relancer le script ne change pas les identifiants). */
function uuidDe(id: string): string {
  const h = createHash('sha1').update(`rush-demo:${id}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

async function appel(chemin: string, init: RequestInit & { cle?: string } = {}): Promise<Response> {
  const cle = init.cle ?? CLE_SERVICE;
  return fetch(`${URL_BASE}${chemin}`, { ...init, headers: { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) } });
}

async function rest(methode: string, chemin: string, corps?: unknown): Promise<void> {
  const r = await appel(`/rest/v1/${chemin}`, { method: methode, headers: { Prefer: 'return=minimal' }, body: corps === undefined ? undefined : JSON.stringify(corps) });
  if (!r.ok) throw new Error(`${methode} ${chemin.split('?')[0]} : ${r.status} ${(await r.text()).slice(0, 400)}`);
}

async function inserer(table: string, lignes: Record<string, unknown>[], taille = 200): Promise<void> {
  for (let i = 0; i < lignes.length; i += taille) await rest('POST', table, lignes.slice(i, i + taille));
  console.log(`  ${table} : ${lignes.length} lignes`);
}

const jour = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nombre = (v: unknown): number | null => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// --- Le compte --------------------------------------------------------------------------------------------------------------

async function preparerUtilisateur(): Promise<void> {
  const motDePasse = randomBytes(24).toString('base64url');
  let r = await appel('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ id: ID_DEMO, email: EMAIL_DEMO, password: motDePasse, email_confirm: true, user_metadata: { demo: true } }) });
  if (!r.ok) {
    // Il existe déjà : on lui donne un nouveau mot de passe
    r = await appel(`/auth/v1/admin/users/${ID_DEMO}`, { method: 'PUT', body: JSON.stringify({ password: motDePasse, email_confirm: true }) });
    if (!r.ok) throw new Error(`Compte de démo : ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  // Le mot de passe va dans les secrets des Edge Functions (jamais affiché, jamais dans le code)
  const s = spawnSync('supabase', ['secrets', 'set', `DEMO_EMAIL=${EMAIL_DEMO}`, `DEMO_PASSWORD=${motDePasse}`, '--project-ref', env.SUPABASE_URL.replace(/^https:\/\/([^.]+)\..*$/, '$1')], {
    cwd: racine, encoding: 'utf8', env: { ...process.env, ...env, SUPABASE_ACCESS_TOKEN: env.SSUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN },
  });
  if (s.status !== 0) throw new Error('Impossible de ranger les secrets du compte de démo');
  jetonConnexion = await connecter(motDePasse);
  console.log('Compte de démo prêt (mot de passe rangé dans les secrets).');
}

let jetonConnexion = '';
async function connecter(motDePasse: string): Promise<string> {
  const r = await appel('/auth/v1/token?grant_type=password', { method: 'POST', cle: CLE_PUBLIQUE, body: JSON.stringify({ email: EMAIL_DEMO, password: motDePasse }) });
  if (!r.ok) throw new Error(`Connexion du compte de démo : ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

/** Vide les données du compte de démo (jamais celles d'un autre compte : tout est filtré sur l'identifiant de démo). */
async function viderDonnees(): Promise<void> {
  const tables = ['strength_sets', 'hyrox_efforts', 'activity_edits', 'activities', 'strength_programs', 'strength_exercises', 'hyrox_tests', 'hyrox_objectif', 'yearly_goals', 'activity_planned', 'day_notes', 'rest_day', 'training_cycles', 'health_metrics', 'garmin_sleep', 'daily_metrics', 'power_profile', 'power_profile_sport', 'user_preferences', 'user_profiles'];
  for (const t of tables) {
    const r = await appel(`/rest/v1/${t}?user_id=eq.${ID_DEMO}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    if (!r.ok && r.status !== 404) console.log(`  (suppression ${t} : ${r.status})`);
  }
  console.log('Données du compte de démo vidées.');
}

// --- Les données simples ----------------------------------------------------------------------------------------------------

async function semerDonnees(): Promise<void> {
  const d = donneesDemo(maintenant);
  await inserer('user_profiles', [{ user_id: ID_DEMO, ftp: d.profil.ftp, hr_max: d.profil.hr_max, lthr: d.profil.lthr, weight: d.profil.weight, extras: d.profil.extras }]);
  await inserer('user_preferences', [{ user_id: ID_DEMO, sports: ['course', 'velo', 'natation', 'muscu', 'hyrox', 'triathlon', 'duathlon', 'autre'] }]);
  await inserer('strength_programs', programmesDemo().map((p) => ({ id: uuidDe(p.id), user_id: ID_DEMO, name: p.name, exercises: p.exercises, notes: p.notes })));
  await inserer('hyrox_tests', testsHyroxHistoriqueDemo(maintenant).map((t) => ({ id: uuidDe(t.id), user_id: ID_DEMO, date: t.date, label: t.label, kind: t.kind, segments: t.segments, total_s: t.total_s, source: t.source, notes: t.notes })));
  const o = objectifHyroxDemo();
  await inserer('hyrox_objectif', [{ user_id: ID_DEMO, total_s: o.total_s, segments: o.segments }]);
  await inserer('yearly_goals', objectifsAnnuelsDemo(maintenant).map((g) => ({ id: uuidDe(g.id), user_id: ID_DEMO, year: g.annee, sport: g.sport, template: g.template, target: g.target, current_manual: g.currentManual ?? null })));
}

// --- Les activités ----------------------------------------------------------------------------------------------------------

const AVEC_PUISSANCE = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide']);
const AVEC_STREAMS = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'Run', 'TrailRun', 'Triathlon', 'Duathlon']);

function ligneActivite(s: Seance, numero: number, aStreams: boolean): Record<string, unknown> {
  const velo = AVEC_PUISSANCE.has(s.sport);
  return {
    id: uuidDe(s.id), user_id: ID_DEMO, strava_id: 9_000_000_000 + numero, source: 'strava', name: s.name, sport: s.sport, start_date_local: s.start_date_local,
    elapsed_time: nombre(s.elapsed_time), moving_time: s.moving_time, distance_km: nombre(s.distance_km), total_elevation_gain: nombre(s.total_elevation_gain),
    avg_speed_kmh: nombre(s.avg_speed_kmh), avg_heartrate: nombre(s.avg_heartrate), max_heartrate: nombre(s.max_heartrate),
    avg_watts: velo ? nombre(s.avg_watts) : null, max_watts: velo ? nombre(s.max_watts) : null, np: velo ? nombre(s.np) : null, ftp_at_time: velo ? nombre(s.ftp_at_time) : null,
    avg_cadence: nombre(s.avg_cadence), kj: velo ? nombre(s.kj) : null, tss: nombre(s.tss),
    has_heartrate: true, has_power: velo, device_watts: velo, category: s.category, streams_synced_at: maintenant.toISOString(), streams_format: aStreams ? 'gzip+base64+json-array' : 'none',
  };
}

/** Les streams d'une séance au format de Strava, rangés comme le fait le serveur : [{type, data}] compressé en gzip puis base64. */
function streamsGz(s: Seance): string {
  const f = genererFlux(s, 1);
  const tableaux: [string, number[] | null][] = [['time', f.time], ['distance', f.distance], ['velocity_smooth', f.velocity_smooth], ['heartrate', f.heartrate], ['watts', f.watts], ['cadence', f.cadence], ['altitude', f.altitude]];
  const arr = tableaux.filter(([, v]) => v).map(([type, data]) => ({ type, data }));
  return gzipSync(JSON.stringify(arr)).toString('base64');
}

async function lancerCalculs(): Promise<number> {
  // La vraie fonction du serveur recalcule, depuis les streams stockés, les courbes de records, les métriques et le profil de puissance (aucun appel à Strava)
  let restant = Infinity;
  for (let i = 0; i < 400 && restant > 0; i++) {
    const r = await appel('/functions/v1/strava-streams', { method: 'POST', cle: CLE_PUBLIQUE, headers: { Authorization: `Bearer ${jetonConnexion}` }, body: JSON.stringify({ courbes_seulement: true, limit: 200 }) });
    if (!r.ok) throw new Error(`strava-streams : ${r.status} ${(await r.text()).slice(0, 300)}`);
    restant = Number(((await r.json()) as { power_curve_remaining?: number }).power_curve_remaining ?? 0);
  }
  return restant;
}

async function semerActivites(): Promise<void> {
  const toutes = activitesBilanDemo(maintenant); // de la plus ancienne à la plus récente
  const limite = jour(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - JOURS_STREAMS_GARDES));
  console.log(`${toutes.length} activités à créer, par lots de ${TAILLE_LOT}…`);
  for (let i = 0; i < toutes.length; i += TAILLE_LOT) {
    const lot = toutes.slice(i, i + TAILLE_LOT);
    const lignes = lot.map((s, k) => {
      const l = ligneActivite(s, i + k + 1, AVEC_STREAMS.has(s.sport) || s.start_date_local.slice(0, 10) >= limite);
      if (AVEC_STREAMS.has(s.sport) || s.start_date_local.slice(0, 10) >= limite) l.streams_gz = streamsGz(s);
      return l;
    });
    await rest('POST', 'activities', lignes);
    const restant = await lancerCalculs();
    if (restant > 0) console.log(`  (il reste ${restant} courbes à calculer)`);
    // Les streams anciens ne sont pas gardés (la base est presque pleine) : les courbes calculées restent
    const anciens = lot.filter((s) => s.start_date_local.slice(0, 10) < limite).map((s) => uuidDe(s.id));
    if (anciens.length) await rest('PATCH', `activities?user_id=eq.${ID_DEMO}&id=in.(${anciens.join(',')})`, { streams_gz: null });
    process.stdout.write(`  ${Math.min(i + TAILLE_LOT, toutes.length)}/${toutes.length}\r`);
  }
  console.log('\nActivités créées, courbes calculées par le serveur.');
}

async function semerForce(): Promise<void> {
  // Les séries de force sont rattachées aux séances de muscu (identifiants déjà posés ci-dessus)
  const series = seriesForceHistoriqueDemo(maintenant);
  await inserer('strength_sets', series.map((x) => ({ id: uuidDe(x.id), user_id: ID_DEMO, activity_id: uuidDe(String(x.activity_id)), date: x.date, exercise_key: x.exercise_key, exercise_name: x.exercise_name, muscle_group: x.muscle_group, position: x.position, set_no: x.set_no, reps: x.reps, weight_kg: x.weight_kg, rir: x.rir ?? null })), 500);
}

// --- Orchestration ----------------------------------------------------------------------------------------------------------

if (argEtape === 'utilisateur' || argEtape === 'tout') await preparerUtilisateur();
if (argEtape === 'tout') await viderDonnees();
if (argEtape === 'donnees' || argEtape === 'tout') await semerDonnees();
if (argEtape === 'activites' || argEtape === 'tout') {
  if (!jetonConnexion) throw new Error("Étape « activites » seule : relance avec « tout » (le jeton de connexion vient de l'étape utilisateur).");
  await semerActivites();
  await semerForce();
}
console.log('Terminé.');
