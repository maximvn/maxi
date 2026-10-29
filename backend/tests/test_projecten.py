"""Tests voor projecten.py: opslaan met een naam, versies per project, alleen eigen projecten,
grenzen (naam, grootte, aantallen), verwijderen en het logboek.

Draait over beide opslag-uitvoeringen (fixture ``db``: SQLite en nep-Turso).
"""
from __future__ import annotations

import pytest

import projecten as projecten_mod
from accounts import Accounts, Bron, Fout
from projecten import MAX_NAAM, Projecten, schoon_naam
from stand import MAX_STAND_BYTES
from tests.conftest import GEHEIM

WW = "een-goed-wachtwoord"
BRON = Bron(ip="10.0.0.1", user_agent="pytest")


@pytest.fixture()
def omgeving(db, snel):
    acc = Accounts(db, GEHEIM)
    acc.maak_gebruiker("beheerder", "", "beheer", WW, BRON)
    acc.maak_gebruiker("jan", "", "gebruiker", WW, BRON)
    acc.maak_gebruiker("piet", "", "gebruiker", WW, BRON)
    sessies = {n: acc.login(n, WW, BRON)[2] for n in ("beheerder", "jan", "piet")}
    return acc, Projecten(db, acc), sessies


def test_opslaan_lijst_en_openen(omgeving):
    acc, pr, s = omgeving
    data = {"cfg": {"newPat": 30}, "poli": {"naam": "Dermatologie"}, "lijst": [1, 2.5], "leeg": None}
    a = pr.opslaan(s["jan"], "  Dermatologie  ", data, "poli", BRON)
    assert set(a) == {"id", "naam", "tijd"} and a["naam"] == "Dermatologie" and a["tijd"].endswith("Z")
    b = pr.opslaan(s["jan"], "Urologie", {**data, "cfg": {"newPat": 40}}, "poli", BRON)
    c = pr.opslaan(s["jan"], "dermatologie", {**data, "cfg": {"newPat": 31}}, "poli", BRON)   # zelfde project
    lijst = pr.lijst(s["jan"].uid)
    assert [x["id"] for x in lijst] == [c["id"], b["id"], a["id"]]               # nieuwste eerst
    assert set(lijst[0]) == {"id", "naam", "tijd", "modus", "grootte"}
    assert pr.een(s["jan"], a["id"], BRON) == {"id": a["id"], "naam": "Dermatologie", "tijd": a["tijd"], "modus": "poli", "data": data}
    assert pr.lijst(s["piet"].uid) == []                                          # per gebruiker
    soorten = [r["soort"] for r in acc.lees_logboek()[0]]
    assert soorten.count("project_opgeslagen") == 3 and soorten.count("project_geopend") == 1


def test_alleen_eigen_projecten(omgeving):
    _acc, pr, s = omgeving
    a = pr.opslaan(s["jan"], "Dermatologie", {"x": 1}, "poli", BRON)
    for actie in (lambda: pr.een(s["piet"], a["id"], BRON), lambda: pr.verwijder(s["piet"], a["id"], False, BRON),
                  lambda: pr.verwijder(s["piet"], a["id"], True, BRON), lambda: pr.een(s["jan"], 99999, BRON)):
        with pytest.raises(Fout) as e:
            actie()
        assert e.value.status == 404                                              # vreemd = onbekend
    assert len(pr.lijst(s["jan"].uid)) == 1                                       # niets weg bij jan
    with pytest.raises(Fout) as e:
        pr.een(s["jan"], "1 OR 1=1", BRON)
    assert e.value.status == 400


def test_namen(omgeving):
    assert schoon_naam("  Derma   tologie ") == "Derma tologie"
    assert schoon_naam("Kinder-KNO (Zuid) — ochtend") == "Kinder-KNO (Zuid) — ochtend"
    for slecht in ("", "   ", None, 12, "a\nb", "a\tb", "abc‮evil", "x\u0000y", "x" * (MAX_NAAM + 1)):
        with pytest.raises(Fout) as e:
            schoon_naam(slecht)
        assert e.value.status == 400
    _acc, pr, s = omgeving
    # Tekst die op SQL of HTML lijkt is gewoon een naam: hij wordt als parameter opgeslagen en
    # door React als tekst getoond.
    vreemd = "'); DROP TABLE projecten; -- <script>alert(1)</script>"
    a = pr.opslaan(s["jan"], vreemd, {"x": 1}, None, BRON)
    assert pr.een(s["jan"], a["id"], BRON)["naam"] == vreemd


def test_grootte_en_data(omgeving):
    _acc, pr, s = omgeving
    with pytest.raises(Fout) as e:
        pr.opslaan(s["jan"], "Groot", {"x": "a" * MAX_STAND_BYTES}, None, BRON)
    assert e.value.status == 413
    for slecht in ("tekst", [1, 2], None):
        with pytest.raises(Fout) as e:
            pr.opslaan(s["jan"], "Kapot", slecht, None, BRON)
        assert e.value.status == 400
    with pytest.raises(Fout) as e:
        pr.opslaan(s["jan"], "Kapot", {"x": float("nan")}, None, BRON)
    assert e.value.status == 400
    with pytest.raises(Fout):
        pr.opslaan(s["jan"], "Kapot", {"x": 1}, 5, BRON)                          # modus moet tekst zijn
    assert pr.lijst(s["jan"].uid) == []


def test_versies_per_project_en_grenzen(omgeving, monkeypatch):
    _acc, pr, s = omgeving
    monkeypatch.setattr(projecten_mod, "MAX_VERSIES", 3)
    monkeypatch.setattr(projecten_mod, "MAX_PROJECTEN", 2)
    ids = [pr.opslaan(s["jan"], "Derma", {"n": i}, None, BRON)["id"] for i in range(5)]
    uro = pr.opslaan(s["jan"], "Uro", {"n": 9}, None, BRON)["id"]
    lijst = pr.lijst(s["jan"].uid)
    assert [x["id"] for x in lijst] == [uro] + ids[::-1][:3]                     # oudste Derma-versies weg, Uro blijft
    with pytest.raises(Fout) as e:
        pr.opslaan(s["jan"], "Cardio", {"n": 1}, None, BRON)                      # derde project
    assert e.value.status == 409
    pr.opslaan(s["jan"], "DERMA", {"n": 10}, None, BRON)                          # bestaand project mag wel
    pr.opslaan(s["piet"], "Cardio", {"n": 1}, None, BRON)                         # grens is per gebruiker
    monkeypatch.setattr(projecten_mod, "MAX_TOTAAL_BYTES", 100)
    with pytest.raises(Fout) as e:
        pr.opslaan(s["jan"], "Derma", {"x": "a" * 200}, None, BRON)
    assert e.value.status == 409


def test_verwijderen(omgeving):
    acc, pr, s = omgeving
    d1 = pr.opslaan(s["jan"], "Derma", {"n": 1}, None, BRON)["id"]
    d2 = pr.opslaan(s["jan"], "derma", {"n": 2}, None, BRON)["id"]
    u1 = pr.opslaan(s["jan"], "Uro", {"n": 3}, None, BRON)["id"]
    assert pr.verwijder(s["jan"], d1, False, BRON) == {"verwijderd": 1}
    assert [x["id"] for x in pr.lijst(s["jan"].uid)] == [u1, d2]
    d3 = pr.opslaan(s["jan"], "Derma", {"n": 4}, None, BRON)["id"]
    assert pr.verwijder(s["jan"], d3, True, BRON) == {"verwijderd": 2}           # alle versies van Derma
    assert [x["id"] for x in pr.lijst(s["jan"].uid)] == [u1]
    assert [r["soort"] for r in acc.lees_logboek(soort="project_verwijderd")[0]] == ["project_verwijderd"] * 2
