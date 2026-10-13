"""Tests des fonctions de jetons du script Garmin (faux client Supabase : aucun réseau, aucune vraie clé).
Lancer : python3 -m unittest tools/test_garmin_jetons.py"""
import os
import sys
import unittest

import requests

sys.path.insert(0, os.path.dirname(__file__))
import garmin_sync as g  # noqa: E402


def erreur_http(code):
    r = requests.Response()
    r.status_code = code
    return requests.HTTPError(response=r)


class FauxSb:
    def __init__(self, rpc=None, get=None, erreur_rpc=None):
        self.appels, self._rpc, self._get, self._err = [], rpc, get, erreur_rpc

    def rpc(self, fonction, args):
        self.appels.append(("rpc", fonction, args))
        if self._err:
            raise self._err
        return self._rpc

    def get(self, table, params):
        self.appels.append(("get", table, params))
        return self._get or []

    def patch(self, table, params, champs, retour=False):
        self.appels.append(("patch", table, champs))


class JetonsGarmin(unittest.TestCase):
    def test_lecture_via_le_coffre(self):
        sb = FauxSb(rpc={"access_token": "a", "oauth1_token": "o", "oauth1_secret": "s"})
        self.assertEqual(g.lire_jetons(sb, "u1")["oauth1_secret"], "s")
        self.assertEqual(sb.appels[0], ("rpc", "rpc_connection_secrets", {"p_user_id": "u1", "p_app": "garmin"}))
        self.assertEqual(len(sb.appels), 1, "pas de lecture de l'ancien emplacement si le coffre répond")

    def test_repli_si_la_fonction_sql_n_existe_pas_encore(self):
        sb = FauxSb(erreur_rpc=erreur_http(404), get=[{"access_token": "vieux", "oauth1_token": "o", "oauth1_secret": "s"}])
        self.assertEqual(g.lire_jetons(sb, "u1")["access_token"], "vieux")

    def test_une_vraie_erreur_n_est_pas_avalee(self):
        with self.assertRaises(requests.HTTPError):
            g.lire_jetons(FauxSb(erreur_rpc=erreur_http(500)), "u1")
        with self.assertRaises(requests.HTTPError):
            g.lire_jetons(FauxSb(erreur_rpc=erreur_http(401)), "u1")

    def test_connexion_absente(self):
        self.assertEqual(g.lire_jetons(FauxSb(rpc=None, get=[]), "u1"), {})

    def test_ecriture_via_le_coffre(self):
        sb = FauxSb()
        g.sauver_jetons(sb, "u1", "nouveau", "2030-01-01T00:00:00+00:00")
        nom, fonction, args = sb.appels[0]
        self.assertEqual((nom, fonction), ("rpc", "rpc_save_connection_secrets"))
        self.assertEqual(args["p_payload"], {"access_token": "nouveau"})
        self.assertEqual(args["p_expires_at"], "2030-01-01T00:00:00+00:00")

    def test_ecriture_repli_et_erreur(self):
        sb = FauxSb(erreur_rpc=erreur_http(404))
        g.sauver_jetons(sb, "u1", "nouveau", "2030-01-01T00:00:00+00:00")
        self.assertEqual(sb.appels[-1][:2], ("patch", "connexions_app"))
        with self.assertRaises(requests.HTTPError):
            g.sauver_jetons(FauxSb(erreur_rpc=erreur_http(500)), "u1", "x", "2030-01-01T00:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
