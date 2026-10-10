#!/usr/bin/env python3
"""
garmin_refresh.py — Refresh du token Garmin EN LOCAL (depuis ton Mac), puis
push dans Supabase (connexions_app) pour que garmin-ingest n'ait plus à
faire l'échange OAuth1 -> OAuth2 lui-même.

Pourquoi : l'échange connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0
est bloqué/rate-limité quand il part des serveurs Supabase (TLS fingerprinting
Garmin). Depuis une IP résidentielle avec garth, il passe. L'Edge Function voit
ensuite un access_token valide (needsRefresh = false) et ne fait plus que les
appels connectapi.

Prérequis :
    pip3 install garth requests
    .garmin_tokens.json  (généré par garmin_auth.py)
    .env avec :
        SUPABASE_URL=https://gfavgstyyaaidkpadkxz.supabase.co
        SUPABASE_SERVICE_ROLE_KEY=...

Usage :
    python3 garmin_refresh.py          # refresh seulement si expire dans < 2h
    python3 garmin_refresh.py --force  # refresh dans tous les cas
"""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import garth
from garth import sso
from garth.auth_tokens import OAuth1Token

ROOT = Path(__file__).parent
TOKEN_FILE = ROOT / ".garmin_tokens.json"
ENV_FILE = ROOT / ".env"
MARGIN_SEC = 2 * 3600


def load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not env.get(k):
            sys.exit(f"[X] {k} manquant dans .env")
    return env


def main():
    force = "--force" in sys.argv
    env = load_env()
    rest = env["SUPABASE_URL"].rstrip("/") + "/rest/v1/connexions_app"
    headers = {
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
    }

    # 1) Ligne garmin actuelle dans Supabase
    r = requests.get(rest, headers=headers, params={
        "app": "eq.garmin", "select": "user_id,expires_at,oauth1_token,oauth1_secret"}, timeout=20)
    r.raise_for_status()
    rows = r.json()
    if not rows:
        sys.exit("[X] Aucune ligne garmin dans connexions_app.")
    row = rows[0]

    if not force and row.get("expires_at"):
        exp = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
        left = (exp - datetime.now(timezone.utc)).total_seconds()
        if left > MARGIN_SEC:
            print(f"[OK] Token encore valide ({left/3600:.1f} h) — rien à faire.")
            return

    # 2) oauth1 : fichier local en priorité, sinon Supabase
    oauth1_token = row.get("oauth1_token")
    oauth1_secret = row.get("oauth1_secret")
    if TOKEN_FILE.exists():
        local = json.loads(TOKEN_FILE.read_text())
        oauth1_token = local.get("oauth1_token") or oauth1_token
        oauth1_secret = local.get("oauth1_secret") or oauth1_secret
    if not oauth1_token or not oauth1_secret:
        sys.exit("[X] Pas d'oauth1_token — relance garmin_auth.py.")

    # 3) Échange OAuth1 -> OAuth2 via garth (depuis ton IP)
    client = garth.http.Client()
    oauth1 = OAuth1Token(oauth_token=oauth1_token, oauth_token_secret=oauth1_secret)
    try:
        oauth2 = sso.exchange(oauth1, client)
    except Exception as e:
        msg = str(e)
        if "401" in msg:
            sys.exit(f"[X] oauth1_token refusé (401) — relance garmin_auth.py. ({msg[:150]})")
        if "429" in msg:
            sys.exit(f"[X] Rate-limit Garmin (429) — attends ~30 min. ({msg[:150]})")
        sys.exit(f"[X] Échange échoué : {msg[:200]}")

    expires_iso = datetime.fromtimestamp(oauth2.expires_at, timezone.utc).isoformat()
    print(f"[OK] access_token obtenu, expire {time.strftime('%Y-%m-%d %H:%M', time.localtime(oauth2.expires_at))}")

    # 4) Push dans Supabase + reset de l'erreur (lève aussi le cooldown)
    r = requests.patch(rest, headers={**headers, "Prefer": "return=minimal"},
                       params={"app": "eq.garmin", "user_id": f"eq.{row['user_id']}"},
                       json={
                           "access_token": oauth2.access_token,
                           "expires_at": expires_iso,
                           "oauth1_token": oauth1_token,
                           "oauth1_secret": oauth1_secret,
                           "last_sync_error": None,
                           "last_sync_status": "token_refreshed_locally",
                       }, timeout=20)
    r.raise_for_status()

    # 5) Copie locale à jour
    TOKEN_FILE.write_text(json.dumps({
        "oauth1_token": oauth1_token, "oauth1_secret": oauth1_secret,
        "access_token": oauth2.access_token, "expires_at": oauth2.expires_at,
    }, indent=2), encoding="utf-8")
    print("[OK] Token poussé dans Supabase — relance la synchro dans l'app.")


if __name__ == "__main__":
    main()
