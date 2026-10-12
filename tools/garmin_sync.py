#!/usr/bin/env python3
"""
garmin_sync.py — Synchro Garmin complète, hors Supabase (port Python de la
Edge Function garmin-ingest).

Pourquoi hors Supabase : Garmin bloque l'échange de token OAuth1 -> OAuth2
quand il vient des serveurs Supabase. Ce script tourne ailleurs (GitHub
Actions, ou ton Mac) et fait tout :
  1. lit la connexion garmin dans connexions_app (service role)
  2. rafraîchit le token si besoin (échange via garth, qui gère la clé
     consumer lui-même : plus de téléchargement depuis un S3 tiers)
  3. récupère sommeil + FC repos + stream FC des N derniers jours
  4. upsert dans garmin_sleep

Variables d'environnement (GitHub Secrets, ou fichier .env en local) :
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

Usage :
    python3 tools/garmin_sync.py [--days 3]

Sécurité : ce script ne doit JAMAIS afficher un token ni la clé service_role.
Les logs d'un workflow GitHub sur un dépôt public sont lisibles par tout le monde.
"""
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
import garth
from garth import sso
from garth.auth_tokens import OAuth1Token

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT_API = "GCM-iOS-5.7.2.1"
MARGIN_SEC = 2 * 3600   # on rafraîchit si le token expire dans moins de 2 h
DEFAULT_DAYS = 3


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


# ============ MAIN ============
def main():
    jours = DEFAULT_DAYS
    if "--days" in sys.argv:
        jours = max(1, min(30, int(sys.argv[sys.argv.index("--days") + 1])))

    env = charger_env()
    base = env["SUPABASE_URL"].rstrip("/") + "/rest/v1"
    h = {
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
    }

    def maj_connexion(user_id, champs):
        requests.patch(f"{base}/connexions_app", headers={**h, "Prefer": "return=minimal"},
                       params={"app": "eq.garmin", "user_id": f"eq.{user_id}"},
                       json=champs, timeout=20).raise_for_status()

    r = requests.get(f"{base}/connexions_app", headers=h, timeout=20, params={
        "app": "eq.garmin",
        "select": "user_id,access_token,expires_at,oauth1_token,oauth1_secret"})
    r.raise_for_status()
    lignes = r.json()
    if not lignes:
        sys.exit("[X] Aucune connexion garmin dans connexions_app.")
    conn = lignes[0]
    user_id = conn["user_id"]
    maintenant = datetime.now(timezone.utc).isoformat()
    maj_connexion(user_id, {"last_sync_status": "running", "last_sync_at": maintenant})

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
            maj_connexion(user_id, {"last_sync_status": "error",
                                    "last_sync_error": f"token_refresh_failed: {court(e)}"})
            sys.exit(f"[X] Échange de token échoué : {court(e)}")
        access_token = oauth2.access_token
        maj_connexion(user_id, {
            "access_token": access_token,
            "expires_at": datetime.fromtimestamp(oauth2.expires_at, timezone.utc).isoformat()})
        print("[OK] Token rafraîchi.")

    # 2) Profil (displayName requis par l'endpoint sommeil)
    try:
        nom = garmin_get("/userprofile-service/socialProfile", access_token)["displayName"]
    except Exception as e:
        maj_connexion(user_id, {"last_sync_status": "error",
                                "last_sync_error": f"profile_fetch: {court(e, 80)}"})
        sys.exit(f"[X] Profil Garmin : {court(e)}")

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
        maintenant = datetime.now(timezone.utc).isoformat()
        lignes_sommeil = [{**n, "user_id": user_id, "updated_at": maintenant} for n in nuits]
        r = requests.post(f"{base}/garmin_sleep", headers={
            **h, "Prefer": "resolution=merge-duplicates,return=minimal"},
            params={"on_conflict": "user_id,date"}, json=lignes_sommeil, timeout=30)
        if not r.ok:
            maj_connexion(user_id, {"last_sync_status": "error",
                                    "last_sync_error": f"upsert_{r.status_code}"})
            sys.exit(f"[X] Upsert garmin_sleep refusé ({r.status_code}).")

    maj_connexion(user_id, {"last_sync_status": "ok", "last_sync_error": None,
                            "last_sync_at": datetime.now(timezone.utc).isoformat()})
    print(f"[OK] {len(nuits)} nuit(s) synchronisée(s).")


if __name__ == "__main__":
    main()
