#!/usr/bin/env python3
"""
garmin_sync.py — Synchro Garmin hors Supabase (port Python de l'ancienne Edge
Function garmin-ingest), prévue pour tourner sur un Raspberry Pi chez toi.

Pourquoi hors Supabase : Garmin bloque l'échange de token OAuth1 -> OAuth2
quand il vient des serveurs Supabase ou de GitHub (IP de datacenter). Depuis une
IP résidentielle, ça passe.

Deux modes :
  --si-demande   (cron du Pi, chaque minute) : ne fait RIEN s'il n'y a pas de
                 demande. Quand tu cliques sur « Synchroniser » dans l'appli,
                 elle écrit une ligne 'pending' dans garmin_sync_requests ;
                 le Pi la voit, lance la synchro, puis marque la demande
                 'done' ou 'error' (l'appli lit ce résultat).
  (sans option)  synchro immédiate, à la main : python3 tools/garmin_sync.py

Étapes d'une synchro :
  1. lit la connexion garmin dans connexions_app (service role)
  2. rafraîchit le token si besoin (garth gère la clé consumer lui-même)
  3. récupère sommeil + FC repos + stream FC des N derniers jours
  4. upsert dans garmin_sleep

Variables d'environnement (ou fichier .env à la racine, en chmod 600) :
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

Options :
    --days N       nombre de jours à récupérer (1 à 30, défaut 3)

Sécurité : ce script ne doit JAMAIS afficher un token ni la clé service_role.
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
import garth
from garth import sso
from garth.auth_tokens import OAuth1Token

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT_API = "GCM-iOS-5.7.2.1"
MARGIN_SEC = 2 * 3600        # on rafraîchit si le token expire dans moins de 2 h
DEFAULT_DAYS = 3
DEMANDE_PERIMEE = timedelta(hours=1)   # une demande plus vieille est abandonnée


class GarminErreur(Exception):
    """Erreur de synchro déjà formulée pour être affichée à l'utilisateur."""


def charger_env():
    """Variables d'environnement d'abord, sinon fichier .env à la racine."""
    env = {}
    fichier = ROOT / ".env"
    if fichier.exists():
        for ligne in fichier.read_text().splitlines():
            ligne = ligne.strip()
            if ligne and not ligne.startswith("#") and "=" in ligne:
                k, v = ligne.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if os.environ.get(k):
            env[k] = os.environ[k]
        if not env.get(k):
            sys.exit(f"[X] {k} manquant (variable d'environnement ou .env)")
    return env


def court(msg, n=150):
    """Message d'erreur tronqué pour les logs (jamais de détail sensible)."""
    return str(msg).replace("\n", " ")[:n]


def maintenant():
    return datetime.now(timezone.utc).isoformat()


# ============ EXTRACTION SOMMEIL (même mapping que garmin-ingest) ============
def local_ms_vers_texte(ms):
    if not ms:
        return None
    d = datetime.fromtimestamp(ms / 1000, timezone.utc)
    return d.strftime("%Y-%m-%d %H:%M")


def extraire_segments(d, debut_gmt_ms):
    segments = []
    for seg in d.get("sleepLevels") or []:
        niveau = seg.get("activityLevel")
        if niveau not in (0, 1, 2, 3):
            continue
        try:
            s = datetime.fromisoformat(str(seg["startGMT"]).replace(".0", "") + "+00:00").timestamp() * 1000
            e = datetime.fromisoformat(str(seg["endGMT"]).replace(".0", "") + "+00:00").timestamp() * 1000
        except (KeyError, ValueError):
            continue
        segments.append([round((s - debut_gmt_ms) / 60000), round((e - debut_gmt_ms) / 60000), niveau])
    return segments


def filtrer_stream_fc(brut, debut_ms, fin_ms):
    sortie = []
    for v in (brut or {}).get("heartRateValues") or []:
        if not isinstance(v, list) or len(v) < 2:
            continue
        ts, bpm = v[0], v[1]
        if ts is None or bpm is None or ts < debut_ms or ts > fin_ms:
            continue
        sortie.append([round((ts - debut_ms) / 60000), bpm])
    return sortie


def extraire_nuit(d, date_cible):
    dto = d.get("dailySleepDTO")
    if not dto or not dto.get("sleepTimeSeconds"):
        return None
    scores = dto.get("sleepScores") or {}
    global_ = scores.get("overall") or {}

    def composant(cle):
        v = scores.get(cle)
        if not isinstance(v, dict):
            return None
        return {"qualifierKey": v.get("qualifierKey"), "value": v.get("value")}

    spo2 = d.get("wellnessSpO2SleepSummaryDTO") or {}
    return {
        "date": date_cible,
        "bedtime": local_ms_vers_texte(dto.get("sleepStartTimestampLocal")),
        "wake_time": local_ms_vers_texte(dto.get("sleepEndTimestampLocal")),
        "total_sec": dto.get("sleepTimeSeconds"),
        "deep_sec": dto.get("deepSleepSeconds"),
        "light_sec": dto.get("lightSleepSeconds"),
        "rem_sec": dto.get("remSleepSeconds"),
        "awake_sec": dto.get("awakeSleepSeconds"),
        "awake_count": dto.get("awakeCount"),
        "restless_count": d.get("restlessMomentsCount"),
        "avg_stress": dto.get("avgSleepStress"),
        "avg_heart_rate": dto.get("avgHeartRate"),
        "body_battery_change": d.get("bodyBatteryChange"),
        "resp_avg": dto.get("averageRespirationValue"),
        "resp_min": dto.get("lowestRespirationValue"),
        "resp_max": dto.get("highestRespirationValue"),
        "spo2_avg": spo2.get("averageSPO2"),
        "spo2_min": spo2.get("lowestSPO2"),
        "hrv_avg": d.get("avgOvernightHrv"),
        "hrv_status": d.get("hrvStatus"),
        "score": global_.get("value"),
        "score_qualifier": global_.get("qualifierKey"),
        "score_detail": {k: composant(k) for k in (
            "totalDuration", "stress", "awakeCount", "remPercentage",
            "restlessness", "lightPercentage", "deepPercentage")},
        "segments": extraire_segments(d, dto.get("sleepStartTimestampGMT") or 0),
    }


# ============ APPELS GARMIN ============
def garmin_get(chemin, access_token, params=None):
    r = requests.get(
        f"https://connectapi.garmin.com{chemin}", params=params, timeout=30,
        headers={"Authorization": f"Bearer {access_token}", "User-Agent": USER_AGENT_API})
    if not r.ok:
        raise RuntimeError(f"{r.status_code} sur {chemin}")
    return r.json()


def rafraichir_token(oauth1_token, oauth1_secret):
    client = garth.http.Client()
    oauth1 = OAuth1Token(oauth_token=oauth1_token, oauth_token_secret=oauth1_secret)
    return sso.exchange(oauth1, client)


# ============ ACCÈS SUPABASE (REST, service role) ============
class Supabase:
    def __init__(self, env):
        self.base = env["SUPABASE_URL"].rstrip("/") + "/rest/v1"
        cle = env["SUPABASE_SERVICE_ROLE_KEY"]
        self.h = {"apikey": cle, "Authorization": f"Bearer {cle}", "Content-Type": "application/json"}

    def get(self, table, params):
        r = requests.get(f"{self.base}/{table}", headers=self.h, params=params, timeout=20)
        r.raise_for_status()
        return r.json()

    def patch(self, table, params, champs, retour=False):
        h = {**self.h, "Prefer": "return=representation" if retour else "return=minimal"}
        r = requests.patch(f"{self.base}/{table}", headers=h, params=params, json=champs, timeout=20)
        r.raise_for_status()
        return r.json() if retour else None

    def upsert(self, table, lignes, conflit):
        h = {**self.h, "Prefer": "resolution=merge-duplicates,return=minimal"}
        return requests.post(f"{self.base}/{table}", headers=h,
                             params={"on_conflict": conflit}, json=lignes, timeout=30)


# ============ SYNCHRO ============
def synchroniser(sb, jours=DEFAULT_DAYS, user_id=None):
    """Synchronise le sommeil. Retourne le nombre de nuits. Lève GarminErreur."""
    filtre = {"app": "eq.garmin",
              "select": "user_id,access_token,expires_at,oauth1_token,oauth1_secret"}
    if user_id:
        filtre["user_id"] = f"eq.{user_id}"
    lignes = sb.get("connexions_app", filtre)
    if not lignes:
        raise GarminErreur("Aucune connexion Garmin enregistrée.")
    conn = lignes[0]
    user_id = conn["user_id"]
    cible = {"app": "eq.garmin", "user_id": f"eq.{user_id}"}

    def erreur(msg, detail):
        sb.patch("connexions_app", cible, {"last_sync_status": "error",
                                           "last_sync_error": detail[:500], "last_sync_at": maintenant()})
        raise GarminErreur(msg)

    sb.patch("connexions_app", cible, {"last_sync_status": "running", "last_sync_at": maintenant()})

    # 1) Token : on ne l'échange que s'il expire bientôt
    access_token = conn["access_token"]
    restant = -1
    if conn.get("expires_at"):
        exp = datetime.fromisoformat(conn["expires_at"].replace("Z", "+00:00"))
        restant = (exp - datetime.now(timezone.utc)).total_seconds()
    if restant < MARGIN_SEC:
        try:
            oauth2 = rafraichir_token(conn["oauth1_token"], conn["oauth1_secret"])
        except Exception as e:
            erreur("Garmin a refusé le renouvellement du token.", f"token_refresh_failed: {court(e)}")
        access_token = oauth2.access_token
        sb.patch("connexions_app", cible, {
            "access_token": access_token,
            "expires_at": datetime.fromtimestamp(oauth2.expires_at, timezone.utc).isoformat()})
        print("[OK] Token rafraîchi.")

    # 2) Profil (displayName requis par l'endpoint sommeil)
    try:
        nom = garmin_get("/userprofile-service/socialProfile", access_token)["displayName"]
    except Exception as e:
        erreur("Profil Garmin illisible.", f"profile_fetch: {court(e, 80)}")

    # 3) Sommeil des N derniers jours
    nuits = []
    fin = datetime.now(timezone.utc)
    for i in range(jours - 1, -1, -1):
        ds = (fin - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            brut = garmin_get(f"/wellness-service/wellness/dailySleepData/{nom}", access_token,
                              {"date": ds, "nonSleepBufferMinutes": "60"})
            nuit = extraire_nuit(brut, ds)
            if not nuit:
                continue
            try:
                resume = garmin_get(f"/usersummary-service/usersummary/daily/{nom}",
                                    access_token, {"calendarDate": ds})
                nuit["resting_heart_rate"] = resume.get("restingHeartRate")
            except Exception as e:
                print(f"[!] FC repos {ds} : {court(e)}")
            try:
                dto = brut.get("dailySleepDTO") or {}
                debut = dto.get("sleepStartTimestampGMT")
                fin_ms = dto.get("sleepEndTimestampGMT") or (
                    (debut or 0) + ((nuit["total_sec"] or 0) + (nuit["awake_sec"] or 0)) * 1000)
                if debut:
                    fc = garmin_get(f"/wellness-service/wellness/dailyHeartRate/{nom}",
                                    access_token, {"date": ds})
                    nuit["hr_stream"] = filtrer_stream_fc(fc, debut, fin_ms)
            except Exception as e:
                print(f"[!] Stream FC {ds} : {court(e)}")
            nuits.append(nuit)
        except Exception as e:
            print(f"[!] Sommeil {ds} : {court(e)}")

    # 4) Upsert garmin_sleep
    if nuits:
        horodatage = maintenant()
        r = sb.upsert("garmin_sleep",
                      [{**n, "user_id": user_id, "updated_at": horodatage} for n in nuits],
                      "user_id,date")
        if not r.ok:
            erreur("Écriture du sommeil refusée par la base.", f"upsert_{r.status_code}")

    sb.patch("connexions_app", cible, {"last_sync_status": "ok", "last_sync_error": None,
                                       "last_sync_at": maintenant()})
    return len(nuits)


# ============ MODE « SI DEMANDE » (cron du Pi) ============
def traiter_demande(sb, jours):
    """Ne fait rien (et n'affiche rien) s'il n'y a aucune demande en attente."""
    limite = (datetime.now(timezone.utc) - DEMANDE_PERIMEE).isoformat()
    # Demandes abandonnées (Pi éteint, plantage) : on les clôt pour débloquer le bouton.
    sb.patch("garmin_sync_requests",
             {"status": "in.(pending,running)", "requested_at": f"lt.{limite}"},
             {"status": "error", "error": "Demande expirée (le Pi n'a pas répondu).",
              "finished_at": maintenant()})

    en_attente = sb.get("garmin_sync_requests", {
        "status": "eq.pending", "select": "id,user_id", "order": "requested_at.asc", "limit": "1"})
    if not en_attente:
        return
    demande = en_attente[0]

    # On « réserve » la demande : si une autre exécution l'a déjà prise, on s'arrête.
    prise = sb.patch("garmin_sync_requests",
                     {"id": f"eq.{demande['id']}", "status": "eq.pending"},
                     {"status": "running"}, retour=True)
    if not prise:
        return

    cible = {"id": f"eq.{demande['id']}"}
    try:
        nb = synchroniser(sb, jours, demande["user_id"])
        sb.patch("garmin_sync_requests", cible, {"status": "done", "nights": nb,
                                                 "finished_at": maintenant()})
        print(f"[OK] Demande {demande['id'][:8]} : {nb} nuit(s) synchronisée(s).")
    except GarminErreur as e:
        sb.patch("garmin_sync_requests", cible, {"status": "error", "error": str(e)[:200],
                                                 "finished_at": maintenant()})
        print(f"[X] Demande {demande['id'][:8]} : {e}")
    except Exception as e:
        sb.patch("garmin_sync_requests", cible, {"status": "error", "error": "Erreur inattendue.",
                                                 "finished_at": maintenant()})
        print(f"[X] Demande {demande['id'][:8]} : erreur inattendue ({court(e)})")


def main():
    jours = DEFAULT_DAYS
    if "--days" in sys.argv:
        jours = max(1, min(30, int(sys.argv[sys.argv.index("--days") + 1])))
    sb = Supabase(charger_env())

    if "--si-demande" in sys.argv:
        traiter_demande(sb, jours)
        return

    try:
        nb = synchroniser(sb, jours)
    except GarminErreur as e:
        sys.exit(f"[X] {e}")
    print(f"[OK] {nb} nuit(s) synchronisée(s).")


if __name__ == "__main__":
    main()
