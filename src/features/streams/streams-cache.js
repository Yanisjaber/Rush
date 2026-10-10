/* src/features/streams/streams-cache.js — extrait de l'ancien app.js (découpage par fonctionnalité). */


// ========= API CLIENT INTERVALS.ICU (via Cloudflare Worker proxy) =========
export const streamsCache = {};

const activityCache = {};

const STREAMS_LS_KEY = 'coach_ia_streams_cache_v1';

const STREAMS_LS_MAX = 30;


async function apiFetch(path) {
  const resp = await fetch(`/api/intervals${path}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.json();
}


function _lsGet() {
  try { return JSON.parse(localStorage.getItem(STREAMS_LS_KEY) || '{}'); }
  catch { return {}; }
}

function _lsSet(cache) {
  try { localStorage.setItem(STREAMS_LS_KEY, JSON.stringify(cache)); }
  catch (e) {
    console.warn('LS streams cache plein, on vide');
    try { localStorage.removeItem(STREAMS_LS_KEY); } catch {}
  }
}

export function loadStreamsFromLS(activityId) {
  const cache = _lsGet();
  return cache[activityId] ? cache[activityId].data : null;
}

function saveStreamsToLS(activityId, data) {
  let cache = _lsGet();
  cache[activityId] = { data, ts: Date.now() };
  const entries = Object.entries(cache);
  if (entries.length > STREAMS_LS_MAX) {
    entries.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    cache = Object.fromEntries(entries.slice(0, STREAMS_LS_MAX));
  }
  _lsSet(cache);
}


export async function loadStreams(activityId) {
  if (!activityId) return null;
  const idKey = String(activityId);
  // 0. Pre-fetched côté serveur (streams.js, dispo dès le chargement)
  if (window.STREAMS_CACHE && window.STREAMS_CACHE[idKey]) {
    return window.STREAMS_CACHE[idKey];
  }
  // 1. Cache mémoire de la session courante
  if (streamsCache[activityId] !== undefined) return streamsCache[activityId];
  // 2. Cache localStorage (persiste entre sessions)
  const cached = loadStreamsFromLS(activityId);
  if (cached) {
    streamsCache[activityId] = cached;
    return cached;
  }
  // 3. Supabase : streams stockés compressés (gzip+base64) dans activities.streams_gz.
  //    On les récupère à la demande pour CETTE activité uniquement.
  try {
    const data = await loadStreamsFromSupabase(activityId);
    if (data) {
      streamsCache[activityId] = data;
      saveStreamsToLS(activityId, data);
      return data;
    }
  } catch (e) {
    console.error('loadStreams (supabase):', e);
  }
  // 4. Pas de streams disponibles (activité sans capteur, ou pas encore syncée)
  streamsCache[activityId] = null;
  return null;
}


// Récupère et décompresse les streams d'une activité depuis Supabase.
// activityId = strava_id (tel que stocké dans DASHBOARD_DATA).
export async function loadStreamsFromSupabase(activityId) {
  const sb = window.sb;
  const user = window._coachIaUser || (sb && (await sb.auth.getUser()).data.user);
  if (!sb || !user || activityId == null) return null;
  // strava_id est un bigint : n'utiliser ce filtre QUE pour un id numérique
  // (les entrées manuelles/compétitions ont des UUID -> 400 PostgREST sinon).
  const idStr = String(activityId).replace(/^[si]/, '');
  let q = sb.from('activities').select('streams_gz, streams_format').eq('user_id', user.id);
  if (/^\d+$/.test(idStr)) q = q.eq('strava_id', idStr);
  else q = q.or(`id.eq.${idStr},client_id.eq.${idStr}`);
  const { data, error } = await q.maybeSingle();
  if (error || !data || !data.streams_gz || data.streams_format === 'none') return null;
  return await gunzipBase64ToJson(data.streams_gz);
}


// Décompresse une string base64(gzip(JSON)) → objet JS (via DecompressionStream).
async function gunzipBase64ToJson(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const text = await new Response(ds.readable).text();
  return JSON.parse(text);
}


async function loadActivityFull(activityId) {
  if (!activityId) return null;
  if (activityCache[activityId] !== undefined) return activityCache[activityId];
  try {
    const data = await apiFetch(`/activity/${activityId}`);
    activityCache[activityId] = data;
    return data;
  } catch (e) {
    console.error('loadActivityFull:', e);
    activityCache[activityId] = null;
    return null;
  }
}


// Downsample un tableau pour rendre Chart.js fluide (séances de 3h+ = 10000+ points)
function downsample(arr, targetSize = 600) {
  if (!arr || arr.length <= targetSize) return arr ? [...arr] : [];
  const step = arr.length / targetSize;
  const out = new Array(targetSize);
  for (let i = 0; i < targetSize; i++) {
    const s = Math.floor(i * step);
    const e = Math.min(arr.length, Math.floor((i + 1) * step));
    let sum = 0, count = 0;
    for (let j = s; j < e; j++) {
      const v = arr[j];
      if (v != null && !isNaN(v)) { sum += v; count++; }
    }
    out[i] = count > 0 ? sum / count : null;
  }
  return out;
}


export function formatHMS(seconds) {
  if (seconds == null || isNaN(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h${m.toString().padStart(2,'0')}`;
  if (m > 0) return `${m}m${s.toString().padStart(2,'0')}`;
  return `${s}s`;
}