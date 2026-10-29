"""Eigenschappen van de Python-rekenkern die los van de pariteit moeten gelden.

De pariteitstest bewijst dat Python hetzelfde doet als JavaScript; deze tests bewijzen dat dat
"hetzelfde" ook klopt met wat de gebruiker verwacht (zelfde eisen als ``test_rp2.mjs``).
"""
from rasterplanner.flex import flex_uitgangspunt, materialize_flex
from rasterplanner.hulp.ids import met_teller
from rasterplanner.hulp.spoor import Spoor
from rasterplanner.hulp.tijd import to_min
from rasterplanner.jobs import voer_job_uit
from rasterplanner.opzoeken import get_entry, kamer_by_id, mod_plangroepen, mod_sessies
from rasterplanner.plaatsing import plaats_op_tijd, voeg_afspraak_toe
from rasterplanner.regels import toegestaan
from rasterplanner.statistiek import balans
from rasterplanner.voorstel import voorstel


def test_flexregels_gecombineerd():
    s = {"start": "08:00", "eind": "12:00"}
    regels = [{"type": "tijd", "minuten": 15, "tijd": "10:00"}, {"type": "einde", "minuten": 10}, {"type": "interval", "minuten": 5, "per": 30}]
    with met_teller():
        fx = materialize_flex(s, regels)
    assert sum(f["end"] - f["start"] for f in fx) == 15 + 10 + 7 * 5
    assert all(480 <= f["start"] and f["end"] <= 720 for f in fx)


def test_uitgangspunt_invoerlijst_1():
    u = flex_uitgangspunt({"benutting": 78, "sessieduur": 240})
    assert u["doelFlex"] == 52.8 and u["ingesteld"] == 0 and u["benutting"] == 100


def test_voorstel_alles_binnen_regels(ct_state):
    state, mod = ct_state
    for k in state["kamers"]:
        k["planregels"] = {"grouping": "gespreid", "methoden": [], "flexRules": [{"type": "einde", "minuten": 20}]}
    with met_teller():
        r = voorstel(state, mod)
    st = r["state"]
    assert sum(b["rest"] for b in balans(st, mod)) == 0, r["meldingen"]
    for s in mod_sessies(st, mod):
        e = get_entry(st["plan"], s["id"])
        k = kamer_by_id(st, s["kamerId"])
        for a in e["appts"]:
            assert to_min(s["start"]) <= a["start"] and a["end"] <= to_min(s["eind"])
            assert not any(a["start"] < f["end"] and a["end"] > f["start"] for f in e["flex"])
            assert toegestaan(next(p for p in st["plangroepen"] if p["id"] == a["pgId"]), k, s)["ok"]


def test_voorstel_raakt_invoer_niet_aan(ct_state):
    import copy
    state, mod = ct_state
    voor = copy.deepcopy(state)
    voorstel(state, mod)
    assert state == voor


def test_handmatig_toevoegen_en_verkeerde_kamer(ct_state):
    state, mod = ct_state
    ct1 = next(k for k in state["kamers"] if k["naam"] == "CT 1")
    s = next(x for x in mod_sessies(state, mod) if x["kamerId"] == ct1["id"])
    thorax = next(p for p in mod_plangroepen(state, mod) if p["naam"] == "CT Thorax met contrast")
    assert "CT 1" in voeg_afspraak_toe(state, s["id"], thorax["id"])["error"]
    hersenen = next(p for p in mod_plangroepen(state, mod) if p["naam"] == "CT Hersenen zonder contrast")
    r = voeg_afspraak_toe(state, s["id"], hersenen["id"])
    assert "error" not in r and len(r["state"]["plan"][s["id"]]["appts"]) == 1


def test_plaats_op_tijd_schuift_door():
    s = {"id": "x", "start": "08:00", "eind": "12:00", "dag": "ma", "dagdeel": "ochtend"}
    entry = {"appts": [{"id": "a1", "pgId": "A", "start": 480, "end": 500}, {"id": "a2", "pgId": "A", "start": 500, "end": 520},
                       {"id": "a3", "pgId": "B", "start": 520, "end": 535}], "flex": [{"id": "f", "start": 540, "end": 550}]}
    with met_teller():
        r = plaats_op_tijd(s, entry, {"pgId": "C", "duur": 15}, 500)
    starts = {a["id"]: a["start"] for a in r["appts"]}
    assert r["appt"]["start"] == 500 and starts["a1"] == 480 and starts["a2"] == 515 and starts["a3"] == 550


def test_job_met_spoor(ct_state):
    state, mod = ct_state
    uit = voer_job_uit({"type": "voorstel", "args": [state, mod], "trace": True})
    stappen = [s["stap"] for s in uit["spoor"]]
    assert stappen[0] == "start" and "capaciteit" in stappen and "verdeling.pg" in stappen and stappen[-1] == "klaar"
    assert set(uit) == {"plan", "onplaatsbaar", "meldingen", "spoor"}


def test_spoor_uit_kost_niets():
    s = Spoor(aan=False)
    s.stap("x", a=1)
    assert s.lijst() == []
