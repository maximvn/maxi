"""Voorbeeldsets en bouwstenen voor functiekamers (JS: bovenin ``functiekamers.js``).

Wat doet dit onderdeel
----------------------
Hier staan de kleine helpers waarmee kamers en codes worden aangemaakt
(``fk_nieuwe_kamer``, ``fk_nieuwe_code``, ``fk_standaard_regels``), de rekenregels
voor vraag per week en duur op een 5-minutenraster, en de vijf voorbeeldsets
(``FK_PRESETS``): Longfunctie (de echte set uit het wensendocument, cijfers 2025)
en vier vooringevulde vakgroepen met voorbeeldcijfers. De voorbeeldsets zijn
alleen nodig voor tests en de server; de frontend heeft zijn eigen kopie in
JavaScript, en die twee moeten gelijk blijven (dat wordt in de tests gecontroleerd
tegen ``tests/pariteit/cases.json``).

Plaats in de keten
------------------
Voorbereiding: levert de invoer (kamers, codes, regels) waar ``engine.bereken_functiekamers``
mee rekent. Geen eigen rekenstap.

Invoer / Uitvoer
----------------
- ``fk_nieuwe_kamer(naam, oms, id)`` → kamer-dict ``{id, naam, oms, actief, ddDagen}``.
- ``fk_nieuwe_code(**o)`` → code-dict met alle velden (``code, oms, duur, aantalJaar,
  aantalWeek, bron, kamers, dagdelen, weekdagen, voorkeur, apparaat, koppel, spreiden, opmerking``).
- ``fk_week_aantal(code, weken)`` → vraag per week (float).
- ``fk_snap(duur)`` → duur afgerond op 5 minuten, minimaal 5.
- ``FK_PRESETS`` → ``{naam: {naam, voorbeeld, kamers, codes, planregels}}``.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Een preset die afwijkt van de JavaScript-versie: ``tests/test_functiekamers_py.py``
  vergelijkt de kamers en codes letterlijk met ``cases.json`` (door JavaScript gemaakt).
- ``fk_nieuwe_kamer`` zonder id maakt een willekeurig id (zoals ``uid()`` in JavaScript);
  de engine zelf gebruikt dat nooit, dus die blijft deterministisch.
"""
from __future__ import annotations

import random
import string
from typing import Any

from poliraster.hulp.js import getal, js_round, of

FK_WEKEN_PER_JAAR = 48
FK_DAG_KEYS = ["ma", "di", "wo", "do", "vr"]
FK_DAG_ABBR = ["MA", "DI", "WO", "DO", "VR"]
FK_DAG_NAAM = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag"]
FK_DD_NAAM = {"O": "ochtend", "M": "middag", "A": "avond"}

_ALFABET = string.digits + string.ascii_lowercase


def _uid() -> str:
    """JS ``uid()``: ``Math.random().toString(36).slice(2,8)`` — zes tekens in grondtal 36."""
    return "".join(random.choice(_ALFABET) for _ in range(6))


def fk_alle_dagen(aan: bool = True) -> dict[str, bool]:
    """JS ``fkAlleDagen``: ma t/m vr allemaal aan (of uit)."""
    return {"ma": aan, "di": aan, "wo": aan, "do": aan, "vr": aan}


def fk_nieuwe_kamer(naam: str = "", oms: str = "", id: str | None = None) -> dict[str, Any]:
    """JS ``fkNieuweKamer``: een kamer die ochtend en middag open is, de avond dicht.

    Zonder ``id`` krijgt de kamer een willekeurig id ``k_xxxxxx``; de engine rekent daar
    niet mee (alleen als sleutel), dus de uitkomst blijft deterministisch.
    """
    return {"id": of(id, "k_" + _uid()), "naam": naam, "oms": oms, "actief": True,
            "ddDagen": {"O": fk_alle_dagen(True), "M": fk_alle_dagen(True), "A": fk_alle_dagen(False)}}


def fk_nieuwe_code(o: dict[str, Any] | None = None, **extra: Any) -> dict[str, Any]:
    """JS ``fkNieuweCode``: een code met alle standaardvelden; ``o``/``extra`` overschrijven."""
    basis: dict[str, Any] = {"code": "", "oms": "", "duur": 15, "aantalJaar": 0, "aantalWeek": 0, "bron": "jaar", "kamers": {},
                             "dagdelen": {"O": True, "M": True, "A": False},
                             "weekdagen": {"MA": True, "DI": True, "WO": True, "DO": True, "VR": True},
                             "voorkeur": "", "apparaat": "", "koppel": "", "spreiden": "auto", "opmerking": ""}
    basis.update(o or {})
    basis.update(extra)
    return basis


def fk_standaard_regels() -> dict[str, Any]:
    """JS ``fkStandaardRegels``."""
    return {"wekenPerJaar": FK_WEKEN_PER_JAAR, "vulwijze": "heleDagen", "spreidVanaf": 5,
            "minBezetting": 60, "verdichten": True, "planregels": []}


def fk_week_aantal(c: dict[str, Any], weken: Any) -> float:
    """JS ``fkWeekAantal``: vraag per week, rechtstreeks of afgeleid uit het jaartotaal."""
    if c.get("bron") == "week":
        return max(0, of(getal(c.get("aantalWeek"), 0), 0))
    return max(0, of(getal(c.get("aantalJaar"), 0), 0)) / max(1, of(getal(weken, 0), FK_WEKEN_PER_JAAR))


def fk_snap(d: Any) -> int:
    """JS ``fkSnap``: duur op een raster van 5 minuten (20,5 → 20; 60,4 → 60), minimaal 5."""
    return max(5, js_round(of(getal(d, 0), 0) / 5) * 5)


def fk_code_label(c: dict[str, Any]) -> str:
    """JS ``fkCodeLabel``: de code, anders de omschrijving, zonder witruimte eromheen."""
    return str(of(c.get("code"), c.get("oms"), "")).strip()


# ── LONGFUNCTIE — de voorbeeldset uit het wensendocument (aantallen 2025) ──────────
# Kamers A1.243, A1.253, A1.213 en A1.215 met per code de kamers die de functie-
# laborant bij "opmerking" heeft genoemd. Codes waarvan de kamer nog niet bekend is
# ("??", "nog geen plek") staan bewust ZONDER kamer: de tool zet ze op de lijst
# "kamer nog te bepalen" in plaats van er stilzwijgend iets voor te verzinnen.
K243, K253, K213, K215 = "k243", "k253", "k213", "k215"


def _km(*ids: str) -> dict[str, bool]:
    return {i: True for i in ids}


def _dd(o: bool, m: bool, a: bool = False) -> dict[str, bool]:
    return {"O": o, "M": m, "A": a}


def _r(code: str, oms: str, aantal_jaar: float, duur: float, kamers: dict, extra: dict | None = None) -> dict[str, Any]:
    return {"code": code, "oms": oms, "aantalJaar": aantal_jaar, "duur": fk_snap(duur), "bron": "jaar", "kamers": kamers, **(extra or {})}


FK_PRESET_LONGFUNCTIE: dict[str, Any] = {
    "naam": "Longfunctie",
    "kamers": [
        fk_nieuwe_kamer("A1.243", "PG-kamer (polygrafie) — 's ochtends slaaponderzoeken schoonmaken en uitlezen, 's middags meegeven en instellen", K243),
        fk_nieuwe_kamer("A1.253", "ERGO, HVPT, arteriële bloedgas, inspanningstest, spirometrie en br.dil, gevoeligheidstesten, shunt, FeNO", K253),
        fk_nieuwe_kamer("A1.213", "Bodybox, DCO, spirometrie, br.dil, gevoeligheidstesten, shunt, FeNO, arteriële bloedgas", K213),
        fk_nieuwe_kamer("A1.215", "Bodybox, DCO, spirometrie, br.dil, MIP/MEP, FeNO — waarschijnlijk ook de kinderpoli-combinaties", K215),
    ],
    "codes": [fk_nieuwe_code(c) for c in [
        _r("6MWT", "6 minuten looptest", 79, 30.2, {}, {"opmerking": "Locatie nog uitsplitsen tussen inspanningstest, bodybox en gevoeligheidstest."}),
        _r("6MWTZ", "6 minuten looptest met zuurstof", 3, 30, {}, {"opmerking": "Nog geen plek."}),
        _r("AR", "Arteriepunctie", 93, 15, _km(K253, K213)),
        _r("B1", "Bronchusdilatatie, deel 1", 238, 20.5, _km(K253, K213, K215), {"koppel": "B1+B2", "opmerking": "Altijd samen met B2, op A1.253, A1.213 of A1.215."}),
        _r("B2", "Bronchusdilatatie, deel 2", 234, 20, _km(K253, K213, K215), {"koppel": "B1+B2", "opmerking": "Altijd samen met B1."}),
        _r("BA", "Bronchusdilatatie + art. O2", 1, 50, _km(K253, K213)),
        _r("BD", "Bronchusdilatatie + DCO", 418, 50.5, _km(K213, K215)),
        _r("BDA", "Br.dil + DCO + art. O2", 2, 72.5, {}, {"opmerking": "Kamer niet opgegeven in de bron."}),
        _r("BIOI", "Bio-impedantie", 4, 15, {}, {"opmerking": "Kamer nog onbekend (??)."}),
        _r("BNO", "Bronchusdilatatie + NO", 2, 75, _km(K253, K213, K215), {"apparaat": "NO-meter"}),
        _r("BP", "Br.dil + plethysmografie", 8, 51.3, _km(K213, K215)),
        _r("BPA", "Br.dil + pleth + art. O2", 1, 60, _km(K213), {"opmerking": "In de bron eveneens als BPDA gecodeerd."}),
        _r("BPD", "Bronchusdilatatie, plethysmografie, DCO", 553, 60.4, _km(K213, K215)),
        _r("BPDA", "Bronchusdilatatie, plethysmografie, DCO, art. O2", 10, 75, _km(K213)),
        _r("CTHZ", "Thuis polygrafie aansluiten (controle)", 1024, 15, _km(K243), {"dagdelen": _dd(False, True), "opmerking": "'s Middags meegeven en instellen."}),
        _r("D", "DCO", 28, 20, _km(K213, K215)),
        _r("EA", "Ergometrie + art. O2", 51, 90.3, _km(K253)),
        _r("EA-RA", "Ergometrie + art. O2 rust/arbeid", 3, 90, _km(K253)),
        _r("ER", "Ergometrie", 59, 90.3, _km(K253)),
        _r("ERGOM", "Ergometrie beoordelen", 86, 30.3, _km(K253, K213, K215)),
        _r("HPT", "Histamine provocatietest", 158, 75.8, _km(K253, K213), {"voorkeur": K253, "opmerking": "Voorkeur A1.253, kan ook op A1.213."}),
        _r("HVPT", "Hyperventilatie provocatietest", 44, 40, _km(K253)),
        _r("HVPTA", "Hyperventilatie provocatietest met art. O2", 6, 50, _km(K253)),
        _r("IN", "Instructie", 209, 15, _km(K253, K213, K215), {"opmerking": "?? A1.253 / A1.213 / A1.215 — of bij de longverpleegkundige."}),
        _r("KLP-D", "Klierpunctie diagnostisch", 1, 30, {}, {"opmerking": "Waarschijnlijk niet meer."}),
        _r("M", "MIP/MEP", 5, 20, _km(K215)),
        _r("MANT", "Mantoux uitlezen", 66, 15, {}, {"opmerking": "?? Waar wordt het middel bewaard (koelkast); afhankelijk van 2 collega's."}),
        _r("MANTZ", "Mantoux zetten", 66, 15, {}, {"opmerking": "?? Waar wordt het middel bewaard; afhankelijk van 2 collega's."}),
        _r("NO", "NO-meting", 517, 15, _km(K253, K213, K215), {"apparaat": "NO-meter", "opmerking": "Kan maar één tegelijk (één toestel)."}),
        _r("NTHZ", "Thuis polygrafie aansluiten (nieuw)", 633, 15, _km(K243), {"dagdelen": _dd(False, True), "opmerking": "'s Middags meegeven en instellen."}),
        _r("PENTA", "Verneveling pentamidine", 101, 75.3, {}, {"opmerking": "Waarschijnlijk geen plek meer voor: afzuiging en een verpleegkundige nodig."}),
        _r("POLKNO", "Polygrafie KNO", 90, 15, _km(K243), {"dagdelen": _dd(False, True)}),
        _r("POLUIT", "Polygrafie uitlezen", 1732, 15, _km(K243), {"dagdelen": _dd(True, False), "opmerking": "'s Ochtends uitlezen."}),
        _r("SRA", "Spirometrie rust/arbeid", 4, 30, _km(K253)),
        _r("SA", "Spirometrie + art. O2", 10, 33.5, _km(K253, K213, K215)),
        _r("SD", "Spirometrie + DCO", 894, 30.1, _km(K213, K215)),
        _r("SDA", "Spirometrie + DCO + art. O2", 11, 41.8, _km(K213)),
        _r("SK2", "Spirometrie kind + medicatie, deel 2", 214, 15, _km(K253), {"koppel": "SKM+SK2", "opmerking": "Moet met SKM; alleen in IJsselburg bij apparatuuruitbreiding, anders in een kinderpoli-programma op A1.253."}),
        _r("SKM", "Spirometrie kind + medicatie", 220, 15.1, _km(K253), {"koppel": "SKM+SK2", "opmerking": "Zie SK2."}),
        _r("SNO", "Spirometrie + NO", 197, 35, _km(K253, K213, K215), {"apparaat": "NO-meter", "opmerking": "Er kan maar één NO-meting tegelijk, welke combinatie dan ook."}),
        _r("SPA", "Spiro + pleth + art. O2", 1, 40, _km(K213)),
        _r("SPD", "Spirometrie + DCO + plethysmografie", 127, 40.1, _km(K213, K215)),
        _r("SPDA", "Spiro + pleth + DCO + art. O2", 10, 50, _km(K213)),
        _r("SPIR", "Spirometrie", 892, 20.1, _km(K253, K213, K215)),
        _r("SPIRHA", "Spirometrie huisarts", 15, 20, _km(K253, K213, K215)),
        _r("SPIRZL", "Spirometrie zittend en liggend", 2, 40, _km(K253, K213)),
        _r("SPPL", "Spirometrie + plethysmografie", 45, 30.6, _km(K213, K215)),
        _r("VERN", "Vernevelen", 32, 15.9, _km(K253, K213)),
        _r("VO2MX", "Ergometrie voor cardiologie", 49, 60.7, _km(K253)),
    ]],
    "planregels": [
        {"t": "Meerdere onderzoeken bij één patiënt: de losse onderdelen niet in verschillende kamers plannen.", "geborgd": "raster",
         "uitleg": "Combinatie-onderzoeken (BPD, SD, BD, …) zijn in het raster één blok in één kamer."},
        {"t": "Bodybox in A1.213 en DCO in A1.215 nooit bij dezelfde patiënt combineren (richtlijnen en verschil tussen de apparaten).", "geborgd": "planner",
         "uitleg": "Geldt bij het boeken van losse onderdelen voor één patiënt — dat blijft mensenwerk van de planner."},
        {"t": "Inspannings-, provocatie- en gevoeligheidstesten niet op dezelfde dag als bronchusdilatatie-onderzoeken bij dezelfde patiënt.", "geborgd": "planner",
         "uitleg": "Het raster kent geen patiënten; de planner bewaakt dit bij het boeken."},
        {"t": "Bronchusdilatatie deel 1 en deel 2 altijd samen, op A1.253, A1.213 of A1.215.", "geborgd": "raster",
         "uitleg": "B1 en B2 zijn gekoppeld en worden als één blok B1+B2 gepland."},
        {"t": "NO-meting: er kan maar één tegelijk (één toestel), in welke combinatie dan ook.", "geborgd": "raster",
         "uitleg": "Alle codes met het apparaat \"NO-meter\" gaan naar dezelfde kamer, zodat ze nooit gelijktijdig staan."},
    ],
}


# ── ANDERE VAKGROEPEN — een vooringevulde basis om zelf verder in te vullen ───────
# Dit zijn VOORBEELDCIJFERS (herkenbare onderzoeken, plausibele aantallen en duren),
# bedoeld als startpunt; de gebruiker vervangt ze door de eigen jaarcijfers.
def _mk_preset(naam: str, kamers: list, codes: list, planregels: list | None = None, voorbeeld: bool = True) -> dict[str, Any]:
    """JS ``mkPreset``: kamers als ``[id, naam, oms]``, codes als ``[code, oms, aantalJaar, duur, ids, extra?]``."""
    kam = [fk_nieuwe_kamer(kn, oms, kid) for kid, kn, oms in kamers]
    cds = []
    for rij in codes:
        code, oms, aantal_jaar, duur, ids = rij[:5]
        extra = rij[5] if len(rij) > 5 else {}
        cds.append(fk_nieuwe_code({"code": code, "oms": oms, "aantalJaar": aantal_jaar, "duur": fk_snap(duur), "bron": "jaar",
                                   "kamers": _km(*ids), **extra}))
    return {"naam": naam, "voorbeeld": voorbeeld, "kamers": kam, "codes": cds, "planregels": planregels or []}


FK_PRESET_CARDIOLOGIE = _mk_preset(
    "Cardiologie (functie)",
    [["c_ecg", "ECG-kamer", "ECG, holter en eventrecorder aansluiten en uitlezen, 24-uurs bloeddruk"],
     ["c_echo1", "Echo 1", "Echocardiografie"], ["c_echo2", "Echo 2", "Echocardiografie, ook stress-echo"],
     ["c_fiets", "Fietskamer", "Inspannings-ECG en fietsergometrie"], ["c_pm", "Pacemakerkamer", "Pacemaker- en ICD-controles"]],
    [["ECG", "Rust-ECG", 3600, 15, ["c_ecg", "c_fiets"]], ["HOLA", "Holter aansluiten", 900, 15, ["c_ecg"]],
     ["HOLU", "Holter uitlezen", 900, 20, ["c_ecg"], {"dagdelen": _dd(True, False), "opmerking": "'s Ochtends uitlezen"}],
     ["ABPM", "24-uurs bloeddrukmeting", 400, 15, ["c_ecg"]], ["EVR", "Eventrecorder", 200, 15, ["c_ecg"]],
     ["ECHO", "Echocardiografie", 2400, 45, ["c_echo1", "c_echo2"]], ["SECHO", "Stress-echo", 150, 60, ["c_echo2"]],
     ["XECG", "Inspannings-ECG", 900, 30, ["c_fiets"]], ["CPET", "Fietsergometrie met gasanalyse", 200, 60, ["c_fiets"]],
     ["PMC", "Pacemakercontrole", 800, 30, ["c_pm"]], ["ICDC", "ICD-controle", 300, 30, ["c_pm"]]],
    [{"t": "Stress-echo alleen met cardioloog aanwezig; plannen op dagdelen met supervisie.", "geborgd": "planner", "uitleg": ""}])

FK_PRESET_KNF = _mk_preset(
    "Neurologie / KNF",
    [["n_eeg", "EEG-kamer", "EEG, slaap-EEG"], ["n_emg", "EMG-kamer", "EMG, zenuwgeleiding, evoked potentials"], ["n_dup", "Duplexkamer", "Duplex halsvaten, TCD"]],
    [["EEG", "EEG standaard", 800, 60, ["n_eeg"]], ["EEGS", "Slaap-EEG", 240, 90, ["n_eeg"], {"dagdelen": _dd(True, False)}],
     ["EMG", "EMG", 1000, 45, ["n_emg"]], ["ZGO", "Zenuwgeleidingsonderzoek", 600, 30, ["n_emg"]], ["SEP", "Somatosensibele evoked potentials", 120, 60, ["n_emg"]],
     ["VEP", "Visuele evoked potentials", 100, 45, ["n_emg"]], ["DUP", "Duplex halsvaten", 400, 30, ["n_dup"]], ["TCD", "Transcranieel doppler", 80, 45, ["n_dup"]]],
    [])

FK_PRESET_AUDIO = _mk_preset(
    "KNO / Audiologie",
    [["a_cab1", "Audiocabine 1", "Toon- en spraakaudiometrie, tympanometrie, OAE"], ["a_cab2", "Audiocabine 2", "Toon- en spraakaudiometrie, BERA"],
     ["a_vest", "Evenwichtskamer", "ENG/VNG, calorisch onderzoek"]],
    [["TA", "Toonaudiogram", 3000, 20, ["a_cab1", "a_cab2"]], ["SA", "Spraakaudiogram", 1500, 15, ["a_cab1", "a_cab2"]], ["TYMP", "Tympanometrie", 1200, 10, ["a_cab1", "a_cab2"]],
     ["OAE", "Oto-akoestische emissies", 400, 15, ["a_cab1"]], ["BERA", "Hersenstamaudiometrie", 250, 60, ["a_cab2"], {"opmerking": "Stille cabine"}],
     ["VNG", "Videonystagmografie", 300, 60, ["a_vest"]], ["CAL", "Calorisch onderzoek", 150, 45, ["a_vest"]], ["HTC", "Hoortoestelcontrole", 800, 20, ["a_cab1", "a_cab2"]]],
    [{"t": "BERA bij kinderen alleen na melatonine-afspraak; niet in hetzelfde dagdeel als VNG.", "geborgd": "planner", "uitleg": ""}])

FK_PRESET_MDL = _mk_preset(
    "MDL (functie)",
    [["m_man", "Manometrie/pH-kamer", "Slokdarmmanometrie, pH-metrie aansluiten en uitlezen"], ["m_adem", "Ademtestkamer", "Waterstof-ademtesten, FibroScan"]],
    [["MANO", "Slokdarmmanometrie", 250, 45, ["m_man"]], ["PHA", "pH-metrie aansluiten", 200, 30, ["m_man"]],
     ["PHU", "pH-metrie uitlezen", 200, 20, ["m_man"], {"dagdelen": _dd(True, False)}],
     ["H2", "Waterstof-ademtest", 240, 150, ["m_adem"], {"dagdelen": _dd(True, False), "opmerking": "Nuchter, dus alleen ochtend"}],
     ["FIBRO", "FibroScan", 600, 20, ["m_adem"]], ["ARM", "Anorectale manometrie", 120, 45, ["m_man"]]],
    [])

FK_PRESETS: dict[str, dict[str, Any]] = {
    "Longfunctie": {**FK_PRESET_LONGFUNCTIE, "voorbeeld": False},
    "Cardiologie (functie)": FK_PRESET_CARDIOLOGIE,
    "Neurologie / KNF": FK_PRESET_KNF,
    "KNO / Audiologie": FK_PRESET_AUDIO,
    "MDL (functie)": FK_PRESET_MDL,
}
