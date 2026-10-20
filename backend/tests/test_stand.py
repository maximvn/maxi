"""Tests voor stand.py: opslaan, nieuwste, versies (laatste 30), één eigen versie, 1 MB-grens, beheer-inzage.

Draait over beide opslag-uitvoeringen (fixture ``db``: SQLite en nep-Turso).
"""
from __future__ import annotations

import pytest

from accounts import Accounts, Bron, Fout
from stand import BEWAAR_VERSIES, MAX_STAND_BYTES, Standen
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
    return acc, Standen(db, acc), sessies


def test_opslaan_en_nieuwste(omgeving):
    acc, st, s = omgeving
    assert st.nieuwste(s["jan"].uid) is None
    data = {"cfg": {"newPat": 30}, "rules": {"mixNC": True}, "roomNames": ["Kamer 1", "Kamer é"], "leeg": None, "lijst": [1, 2.5]}
    uit = st.opslaan(s["jan"].uid, data, 2, "poli")
    assert set(uit) == {"id", "tijd", "nieuw"} and uit["nieuw"] is True and uit["tijd"].endswith("Z")
    n = st.nieuwste(s["jan"].uid)
    assert n == {"id": uit["id"], "tijd": uit["tijd"], "module": 2, "modus": "poli", "data": data}
    st.opslaan(s["jan"].uid, {**data, "cfg": {"newPat": 31}}, None, None, nieuwe_versie=True)
    n2 = st.nieuwste(s["jan"].uid)
    assert n2["data"]["cfg"]["newPat"] == 31 and n2["module"] is None and n2["id"] > uit["id"]
    assert st.nieuwste(s["piet"].uid) is None   # standen zijn per gebruiker


def test_versies_en_opruimen(omgeving):
    acc, st, s = omgeving
    ids = [st.opslaan(s["jan"].uid, {"n": i}, i % 4, "functie", nieuwe_versie=True)["id"] for i in range(BEWAAR_VERSIES + 5)]
    st.opslaan(s["piet"].uid, {"van": "piet"})
    v = st.versies(s["jan"].uid)
    assert len(v) == BEWAAR_VERSIES
    assert [x["id"] for x in v] == sorted(ids, reverse=True)[:BEWAAR_VERSIES]   # nieuwste eerst, oudste 5 weg
    assert set(v[0]) == {"id", "tijd", "module", "modus", "grootte"} and v[0]["grootte"] == len('{"n":34}')
    assert len(st.versies(s["piet"].uid)) == 1   # opruimen raakt andere gebruikers niet


def test_een_versie_alleen_eigen(omgeving):
    acc, st, s = omgeving
    oud = st.opslaan(s["jan"].uid, {"versie": 1})["id"]
    nieuw = st.opslaan(s["jan"].uid, {"versie": 2}, nieuwe_versie=True)["id"]
    assert st.een(s["jan"], nieuw, BRON)["data"] == {"versie": 2}
    assert acc.lees_logboek(soort="stand_hersteld")[0] == []          # de nieuwste ophalen is geen herstel
    assert st.een(s["jan"], oud, BRON)["data"] == {"versie": 1}
    regel = acc.lees_logboek(soort="stand_hersteld")[0][0]
    assert regel["gebruikersnaam"] == "jan" and regel["details"].startswith(f"versie {oud} van ")
    for vreemd in (oud, 99999):
        with pytest.raises(Fout) as e:
            st.een(s["piet"], vreemd, BRON)
        assert e.value.status == 404


def test_grenzen(omgeving):
    acc, st, s = omgeving
    groot = {"x": "a" * (MAX_STAND_BYTES - 7)}             # {"x":"…"} = 8 tekens extra: 1 byte te groot
    with pytest.raises(Fout) as e:
        st.opslaan(s["jan"].uid, groot)
    assert e.value.status == 413
    st.opslaan(s["jan"].uid, {"x": "a" * (MAX_STAND_BYTES - 8)})    # past precies
    for data, module, modus in (([1, 2], None, None), ("tekst", None, None), ({"a": float("nan")}, None, None),
                                ({}, "twee", None), ({}, 1.5, None), ({}, True, None), ({}, None, 5)):
        with pytest.raises(Fout) as e:
            st.opslaan(s["jan"].uid, data, module, modus)
        assert e.value.status == 400, (data, module, modus)


def test_beheer_inzage(omgeving):
    acc, st, s = omgeving
    assert st.beheer_inzage(s["jan"].uid, s["beheerder"], BRON) is None
    st.opslaan(s["jan"].uid, {"hulpvraag": True}, 1, "poli")
    assert st.beheer_inzage(s["jan"].uid, s["beheerder"], BRON)["data"] == {"hulpvraag": True}
    with pytest.raises(Fout) as e:
        st.beheer_inzage(424242, s["beheerder"], BRON)
    assert e.value.status == 404
    regels = acc.lees_logboek(soort="stand_bekeken")[0]
    assert len(regels) == 2 and regels[0]["details"].startswith("door beheer: beheerder; versie ")


def test_versies_per_werkblok_van_tien_minuten(omgeving):
    """Opslagen binnen 10 minuten werken de nieuwste versie bij; daarna, of met nieuwe_versie, komt er een nieuwe."""
    _acc, st, s = omgeving
    uid = s["piet"].uid
    t0 = 1_800_000_000
    a = st.opslaan(uid, {"x": 1}, 1, "poli", nu=t0)
    b = st.opslaan(uid, {"x": 2}, 2, "poli", nu=t0 + 60)
    assert a["nieuw"] is True and b["nieuw"] is False and b["id"] == a["id"]
    assert st.nieuwste(uid)["data"] == {"x": 2}
    c = st.opslaan(uid, {"x": 3}, 2, "poli", nu=t0 + 11 * 60)
    assert c["nieuw"] is True and c["id"] != a["id"]
    d = st.opslaan(uid, {"x": 4}, 2, "poli", nu=t0 + 11 * 60 + 5, nieuwe_versie=True)
    assert d["nieuw"] is True
    e = st.opslaan(uid, {"x": 5}, 0, "functie", nu=t0 + 11 * 60 + 10)   # andere modus → nieuwe versie
    assert e["nieuw"] is True
    assert len(st.versies(uid)) == 4
