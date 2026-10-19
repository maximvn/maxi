"""Functiekamer-engine: onderzoeken toewijzen aan gekwalificeerde kamers (JS: ``fkBerekenAdvies``).

Wat doet dit onderdeel
----------------------
De poli-modus plant nieuwe en controlepatiënten over onderling gelijke spreekkamers;
deze modus plant ONDERZOEKEN over functiekamers die NIET gelijk zijn: elke kamer heeft
een eigen set kwalificaties (welke afspraakcodes er mogen), en elke code heeft een
vraag per week (aantal × duur), toegestane kamers, dagdelen en weekdagen. De engine
doet drie dingen, in deze volgorde en volledig deterministisch:

1. TOEWIJZING — welke code gaat naar welke kamer (meest beperkte codes eerst,
   apparaat-gebonden codes bij elkaar, gekoppelde codes als één blok).
2. DAGDELEN — per kamer: welke dagdelen gaan open en welke codes daarin (geclusterd
   voor zeldzame/lange onderzoeken, gespreid voor veelvoorkomende), tot de ingestelde
   benutting.
3. TIJDLAYOUT — de afspraken op de tijdas, flexruimte aan het einde, en het
   rasteradvies in gewone taal per kamer.

De uitkomst heeft exact dezelfde vorm als de poli-engine (``days`` / ``ntp`` / ``kpi`` /
``notices`` / ``capacity``), zodat kalender, bezettingskaart, slepen en export gewoon
blijven werken. Alles wat specifiek is voor functiekamers staat onder ``res["fk"]``.

Plaats in de keten
------------------
Dit is de hele functiekamer-keten in één module (zoals in JavaScript één functie).
Ervoor: de invoer uit ``presets.py`` of ``invoer.py`` (Excel). Erna: de frontend, of
``kwalificaties.controleer_kwalificaties`` als de gebruiker blokken heeft versleept.

Invoer
------
- ``kamers``: lijst ``{id, naam, oms, actief, ddDagen:{O:{ma..vr}, M:{..}, A:{..}}}``.
- ``codes``: lijst ``{code, oms, duur, aantalJaar, aantalWeek, bron, kamers:{id:true}, dagdelen:{O,M,A},
  weekdagen:{MA..VR}, voorkeur, apparaat, koppel, spreiden, opmerking}``.
- ``m2``: tijden ``{ochStart, ochEnd, midStart, midEnd, avondOn, avondStart, avondEnd, benutting, ddDagen}``.
- ``regels``: ``{wekenPerJaar, vulwijze:'heleDagen'|'spreiden'|…, spreidVanaf, minBezetting, verdichten, planregels}``.

Uitvoer
-------
Dict met ``numRooms, days{di:{o0:[...],m0:[...]}}, ntp[], kpi, notices, capacity, ddDagen, modus:'functie'``
en ``fk:{advies[], toewijzing[], incidenteel[], geenKamer[], incidenteelMin, samenvatting, planregels, vulwijze, spreidVanaf}``.
Met ``trace=True`` ook ``spoor``: het stappenlogboek.

Hoe het werkt
-------------
1. Sessies: elke combinatie kamer × dag × dagdeel waar die kamer open is, met ``usable``
   (benutting + 2,5% speling) en ``doel`` (benutting) in minuten.
2. Planitems: vraag per week per code, gekoppelde codes samengevoegd tot één blok;
   codes zonder kamer → ``geenKamer``; minder dan ½× per week → ``incidenteel``.
3. Apparaat-groepen: codes met hetzelfde apparaat krijgen dezelfde kandidaat-kamers.
4. Toewijzing: meest beperkte items eerst naar de kamer met de laagste belasting;
   past het niet ruim (>92%) terwijl een andere kamer ruimte heeft, dan verdelen.
5. Dagdelen per kamer openen en vullen (cluster of spreid), dunne dagdelen sluiten
   (verdichten) of juist bijvullen vanuit volle dagdelen.
6. Tijdlayout: zelfde code bij elkaar, lang vooraan, flex aan het einde; KPI's; advies per kamer.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Restlijst (``ntp``) langer dan verwacht: kijk in ``notices`` naar "Restlijst" (reden per kamer)
  en in het spoor naar stap ``dagdelen.<kamer>`` (``rest``).
- Een code staat in een kamer waar hij niet mag: kan alleen na slepen; ``kwalificaties.py`` meldt dat.
- Codes verdwijnen: zonder kamer (``fk.geenKamer``) of incidenteel (``fk.incidenteel``); beide hebben een melding.
- Een ander raster dan JavaScript: controleer de sortering (``_locale_compare``), ``js_round`` en de
  volgorde van de sessies (stap ``sessies``), zie ARCHITECTUUR.md §4.
"""
from __future__ import annotations

import logging
import math
import re
from typing import Any, Callable, Optional

from poliraster.functiekamers.presets import (FK_DAG_ABBR, FK_DAG_KEYS, FK_DAG_NAAM, FK_DD_NAAM, FK_WEKEN_PER_JAAR,
                                              fk_code_label, fk_snap, fk_standaard_regels, fk_week_aantal)
from poliraster.hulp.js import getal, js_entries, js_round, js_sleutels, js_tekst, js_values, of, sorteer, sorteer_in_place, waar
from poliraster.hulp.spoor import Spoor
from poliraster.hulp.tijd import dd_dagen_van, to_min_veilig

log = logging.getLogger(__name__)

_NIET_WOORD = re.compile(r"[^A-Za-z0-9_]")   # JS /[^\w]/g


# ── JavaScript-tekstvergelijking ────────────────────────────────────────────────
# ``a.localeCompare(b)`` gebruikt de ICU-collatie: letters worden eerst hoofdletter-
# ongevoelig vergeleken, interpunctie komt vóór symbolen, die vóór cijfers, die vóór
# letters; pas als alles gelijk is, telt kleine letter vóór hoofdletter. Voor de codes
# en kamer-id's in deze engine (hoofdletters, cijfers, '-', '+', '_') is dit voldoende.
_INTERPUNCTIE = set("_-,;:!?.'\"()[]{}@*/\\&#%`^")
_SYMBOLEN = set("+<=>|~$")


def _col_primair(ch: str) -> tuple[int, str]:
    if ch.isspace():
        return (0, ch)
    if ch in _INTERPUNCTIE:
        return (1, ch)
    if ch in _SYMBOLEN:
        return (2, ch)
    if ch.isdigit():
        return (3, ch)
    return (4, ch.lower())


def _locale_compare(a: str, b: str) -> int:
    """JS ``a.localeCompare(b)`` (benadering van de ICU-root-collatie), geeft -1/0/1."""
    pa = [_col_primair(c) for c in a]
    pb = [_col_primair(c) for c in b]
    if pa != pb:
        return -1 if pa < pb else 1
    # Tertiair: kleine letters vóór hoofdletters.
    ta = [c.isupper() for c in a]
    tb = [c.isupper() for c in b]
    if ta != tb:
        return -1 if ta < tb else 1
    return 0


def _heel(x: float) -> Any:
    """Een geheel getal als geheel getal: JavaScript kent geen 780.0, alleen 780 (telt in id's en handtekeningen)."""
    return int(x) if isinstance(x, float) and x.is_integer() else x


def _tijd(t: Any) -> Any:
    """JS ``toMin`` uit functiekamers.js, als geheel getal waar mogelijk."""
    return _heel(to_min_veilig(t))


def _som(lijst: list, f: Callable[[Any], float]) -> float:
    """JS ``som(arr,f)``: reduce vanaf 0, in volgorde (zelfde drijvende-komma-volgorde)."""
    s = 0
    for x in lijst:
        s = s + f(x)
    return s


def _zin(n: int, enkel: str, meer: str) -> str:
    """JS ``zin``: '1 code' / '3 codes'."""
    return f"{n} {enkel if n == 1 else meer}"


def _uniek(lijst: list) -> list:
    """``new Set(lijst)`` als lijst: ontdubbeld, in volgorde van eerste voorkomen."""
    return list(dict.fromkeys(lijst))


class Item:
    """Planitem: één code (of één blok gekoppelde codes) met zijn vraag en beperkingen (JS ``mkItem``).

    ``kamers`` is een geordende lijst zonder dubbelen (JS: ``Set``); ``n`` het aantal per week
    (afgerond), ``min`` het aantal minuten per week. Instanties in een sessie zijn kopieën met ``n=1``.
    """

    __slots__ = ("code", "oms", "duur", "aw", "kamers", "kamersBuiten", "dagdelen", "weekdagen", "apparaat",
                 "voorkeur", "spreiden", "ci", "bron", "koppel", "n", "min", "appGroep")

    def __init__(self, **velden: Any) -> None:
        self.n = 0
        self.min = 0
        self.appGroep: Optional[str] = None
        self.kamersBuiten: list = []
        for k, v in velden.items():
            setattr(self, k, v)

    def kopie(self, **wijzig: Any) -> "Item":
        """JS ``{...it, n:1}``: ondiepe kopie (kamers/dagdelen/weekdagen gedeeld, zoals in JavaScript)."""
        nieuw = Item.__new__(Item)
        for s in Item.__slots__:
            setattr(nieuw, s, getattr(self, s))
        for k, v in wijzig.items():
            setattr(nieuw, k, v)
        return nieuw


class Sessie:
    """Eén kamer × dag × dagdeel waar de kamer open kan (JS: element van ``sessies``)."""

    __slots__ = ("r", "kamerId", "di", "dd", "ddk", "pre", "start", "bruto", "usable", "doel", "items", "used", "open")

    def __init__(self, r: int, kamer_id: Any, di: int, dd: int, ddk: str, pre: str, start: float, bruto: float,
                 usable: int, doel: int) -> None:
        self.r = r
        self.kamerId = kamer_id
        self.di = di
        self.dd = dd
        self.ddk = ddk
        self.pre = pre
        self.start = start
        self.bruto = bruto
        self.usable = usable
        self.doel = doel
        self.items: list[Item] = []
        self.used: float = 0
        self.open = False


def bereken_functiekamers(kamers: list | None, codes: list | None, m2: dict | None, regels: dict | None,
                          trace: bool = False) -> dict[str, Any]:
    """JS ``fkBerekenAdvies({kamers,codes,m2,regels})``: het volledige rasteradvies voor functiekamers.

    Parameters: zie de module-docstring. Zuiver: de invoer wordt niet gewijzigd, zelfde invoer → zelfde uitvoer.
    Met ``trace=True`` komt ``res["spoor"]`` mee.
    """
    spoor = Spoor(aan=trace)
    m2 = m2 or {}
    reg = {**fk_standaard_regels(), **(regels or {})}
    weken = max(1, of(getal(reg.get("wekenPerJaar"), 0), FK_WEKEN_PER_JAAR))
    benut = min(1, max(0.3, of(getal(m2.get("benutting"), 0), 85) / 100))
    min_bez = min(benut * 100, max(0, of(getal(reg.get("minBezetting"), 0), 0))) / 100
    och_start, och_end = _tijd(m2.get("ochStart")), _tijd(m2.get("ochEnd"))
    mid_start, mid_end = _tijd(m2.get("midStart")), _tijd(m2.get("midEnd"))
    avond_on = waar(m2.get("avondOn"))
    avond_start, avond_end = _tijd(of(m2.get("avondStart"), "17:00")), _tijd(of(m2.get("avondEnd"), "20:00"))
    och_dur, mid_dur, av_dur = max(30, och_end - och_start), max(30, mid_end - mid_start), max(30, avond_end - avond_start)
    DDS = [{"k": "O", "i": 0, "pre": "o", "start": och_start, "dur": och_dur},
           {"k": "M", "i": 1, "pre": "m", "start": mid_start, "dur": mid_dur}]
    if avond_on:
        DDS.append({"k": "A", "i": 2, "pre": "a", "start": avond_start, "dur": av_dur})
    glob = dd_dagen_van(m2)
    actief = [k for k in (kamers or []) if k and k.get("actief") is not False]
    notices: list[dict[str, Any]] = []

    def melding(level: str, rule: str, msg: str, fix: str | None = None) -> None:
        notices.append({"level": level, "rule": rule, "msg": msg, **({"fix": fix} if fix else {})})

    log.debug("functiekamers start: kamers=%d codes=%d benut=%s", len(actief), len(codes or []), benut)

    # ── Sessies: kamer × dag × dagdeel waar die kamer open is ─────────────────────
    sessies: list[Sessie] = []
    for r, k in enumerate(actief):
        for di in range(5):
            for d in DDS:
                dag = FK_DAG_KEYS[di]
                kdd = k.get("ddDagen")
                if kdd and kdd.get(d["k"]):
                    eigen_open = waar(kdd[d["k"]].get(dag))
                else:
                    eigen_open = d["k"] != "A"
                is_open = waar(glob[d["k"]].get(dag)) and eigen_open
                if not is_open:
                    continue
                sessies.append(Sessie(r, k.get("id"), di, d["i"], d["k"], d["pre"], d["start"], d["dur"],
                                      usable=max(5, math.floor(d["dur"] * min(1, benut + 0.025) / 5) * 5),
                                      doel=max(5, math.floor(d["dur"] * benut / 5) * 5)))

    def cap_van(kid: Any) -> float:
        return _som([s for s in sessies if s.kamerId == kid], lambda s: s.usable)

    kwal_tel = {k.get("id"): len([c for c in (codes or []) if c.get("kamers") and waar(c["kamers"].get(k.get("id")))]) for k in actief}
    spoor.stap("sessies", sessies=len(sessies), kamers=len(actief), dagdelen=len(DDS))

    # ── Planitems: vraag per week, koppelingen samengevoegd ──────────────────────
    incidenteel: list[dict[str, Any]] = []
    geen_kamer: list[dict[str, Any]] = []
    items: list[Item] = []
    kamer_ids_alle = [k.get("id") for k in (kamers or []) if k]
    actief_ids = [k.get("id") for k in actief]

    def mk_item(c: dict, ci: int) -> Item:
        ck = c.get("kamers") or {}
        dgd = c.get("dagdelen") or {}
        return Item(code=fk_code_label(c), oms=of(c.get("oms"), c.get("code")), duur=fk_snap(c.get("duur")), aw=fk_week_aantal(c, weken),
                    kamers=_uniek([i for i in js_sleutels(ck) if waar(ck[i]) and i in actief_ids]),
                    kamersBuiten=[i for i in js_sleutels(ck) if waar(ck[i]) and i not in actief_ids and i in kamer_ids_alle],
                    dagdelen={"O": dgd.get("O") is not False, "M": dgd.get("M") is not False, "A": waar(dgd.get("A"))},
                    weekdagen={**{"MA": True, "DI": True, "WO": True, "DO": True, "VR": True}, **(c.get("weekdagen") or {})},
                    apparaat=str(of(c.get("apparaat"), "")).strip(), voorkeur=of(c.get("voorkeur"), ""), spreiden=of(c.get("spreiden"), "auto"),
                    ci=ci, bron=[c], koppel=str(of(c.get("koppel"), "")).strip())

    groepen: dict[str, list[Item]] = {}
    for ci, c in enumerate(codes or []):
        if not fk_code_label(c):
            continue
        it = mk_item(c, ci)
        if it.koppel:
            groepen.setdefault(it.koppel, []).append(it)
            continue
        items.append(it)
    for g, lst in js_entries(groepen):
        if len(lst) == 1:
            items.append(lst[0])
            continue
        eerste = lst[0]
        kam = [i for i in eerste.kamers if all(i in x.kamers for x in lst)]
        if not kam:
            kam = _uniek([i for x in lst for i in x.kamers])
            if kam:
                melding("warn", "Gekoppelde codes", f"De gekoppelde codes {' + '.join(x.code for x in lst)} hebben geen gemeenschappelijke kamer; "
                        "ze zijn samen gepland in een kamer waar één van beide mag.")
        dagdelen = {"O": all(x.dagdelen["O"] for x in lst), "M": all(x.dagdelen["M"] for x in lst), "A": all(x.dagdelen["A"] for x in lst)}
        if not dagdelen["O"] and not dagdelen["M"] and not dagdelen["A"]:
            dagdelen["O"] = any(x.dagdelen["O"] for x in lst)
            dagdelen["M"] = any(x.dagdelen["M"] for x in lst)
            dagdelen["A"] = any(x.dagdelen["A"] for x in lst)
        weekdagen = {d: all(waar(x.weekdagen.get(d)) for x in lst) for d in FK_DAG_ABBR}
        if not any(weekdagen[d] for d in FK_DAG_ABBR):
            weekdagen = {d: any(waar(x.weekdagen.get(d)) for x in lst) for d in FK_DAG_ABBR}
        aw = max(x.aw for x in lst)
        duur_tot = _som(lst, lambda x: x.duur)
        items.append(Item(code="+".join(x.code for x in lst), oms=" + ".join(str(x.oms) for x in lst), duur=duur_tot, aw=aw, kamers=kam,
                          dagdelen=dagdelen, weekdagen=weekdagen,
                          apparaat=of(*([x.apparaat for x in lst] + [""])) if any(waar(x.apparaat) for x in lst) else "",
                          voorkeur=of(*([x.voorkeur for x in lst] + [""])) if any(waar(x.voorkeur) for x in lst) else "",
                          spreiden=eerste.spreiden, ci=eerste.ci, bron=[b for x in lst for b in x.bron], koppel=g))
        melding("info", "Gekoppelde codes", f"{' en '.join(x.code for x in lst)} worden altijd samen gepland als één blok "
                f"\"{'+'.join(x.code for x in lst)}\" van {js_tekst(duur_tot)} min ({js_tekst(js_round(aw * 10) / 10)}× per week, het hoogste van beide aantallen).")
    for it in items:
        it.n = js_round(it.aw)
        it.min = it.n * it.duur
    actieve_items: list[Item] = []
    for it in items:
        if it.aw <= 0:
            continue
        if it.n == 0:
            incidenteel.append({"code": it.code, "oms": it.oms, "aw": it.aw, "duur": it.duur})
            continue
        if not it.kamers:
            buiten = [of(next((k.get("naam") for k in (kamers or []) if k and k.get("id") == i), None), i) for i in (it.kamersBuiten or [])]
            geen_kamer.append({"code": it.code, "oms": it.oms, "n": it.n, "duur": it.duur, "min": it.min, "buiten": buiten,
                               "reden": f"de gekwalificeerde kamer {' / '.join(map(str, buiten))} staat buiten gebruik" if buiten else "nog geen kamer aangevinkt"})
            continue
        actieve_items.append(it)
    if incidenteel:
        melding("info", "Incidentele onderzoeken", f"{_zin(len(incidenteel), 'code komt', 'codes komen')} minder dan eens per twee weken voor "
                f"({', '.join(x['code'] for x in incidenteel)}). Die staan niet in het standaardraster; plan ze op de flexruimte.")
    zonder = [x for x in geen_kamer if not x["buiten"]]
    buiten_gebruik = [x for x in geen_kamer if x["buiten"]]
    if zonder:
        lijst = ", ".join("%s (%s×/wk)" % (x["code"], x["n"]) for x in zonder)
        melding("warn", "Kamer nog te bepalen", f"Voor {_zin(len(zonder), 'code', 'codes')} is nog geen kamer aangevinkt: {lijst}. "
                "Zet bij Gegevens invoer een vinkje bij de kamer(s) waar het onderzoek kan; tot die tijd staan ze op de restlijst.")
    if buiten_gebruik:
        lijst = ", ".join("%s (%s)" % (x["code"], "/".join(map(str, x["buiten"]))) for x in buiten_gebruik)
        melding("warn", "Kamer buiten gebruik", f"{_zin(len(buiten_gebruik), 'code kan', 'codes kunnen')} alleen in een kamer die buiten gebruik staat: {lijst}. "
                "Zet die kamer weer in gebruik of vink een andere kamer aan.")
    spoor.stap("planitems", items=len(items), actief=len(actieve_items), incidenteel=len(incidenteel), geenKamer=len(geen_kamer))

    # ── Apparaat-gebonden codes: één toestel → één kamer, nooit gelijktijdig ───────
    app_groep: dict[str, list[Item]] = {}
    for it in actieve_items:
        if it.apparaat:
            app_groep.setdefault(it.apparaat, []).append(it)
    for app, lst in js_entries(app_groep):
        if len(lst) < 2:
            continue
        kam = [i for i in lst[0].kamers if all(i in x.kamers for x in lst)]
        if not kam:
            kam = _uniek([i for x in lst for i in x.kamers])
            melding("warn", "Apparaat", f"De codes met apparaat \"{app}\" ({', '.join(x.code for x in lst)}) hebben geen gemeenschappelijke kamer; "
                    "ze kunnen daardoor gelijktijdig in het raster staan.")
        for x in lst:
            x.kamers = kam          # gedeelde lijst, zoals de gedeelde Set in JavaScript
            x.appGroep = app

    # ── TOEWIJZING code → kamer ─────────────────────────────────────────────────────
    cap: dict[Any, float] = {k.get("id"): cap_van(k.get("id")) for k in actief}
    load: dict[Any, float] = {k.get("id"): 0 for k in actief}

    def naam_van(kid: Any) -> Any:
        return of(next((k.get("naam") for k in actief if k.get("id") == kid), None), kid)

    toewijzing: list[dict[str, Any]] = []
    delen: list[dict[str, Any]] = []   # {item, kamerId, n}

    def kies(kandidaten: list, minuten: float, voorkeur: Any) -> Any:
        if waar(voorkeur) and voorkeur in kandidaten and load[voorkeur] + minuten <= cap[voorkeur]:
            return voorkeur
        return sorteer(kandidaten, lambda a, b: of((load[a] + minuten) / max(1, cap[a]) - (load[b] + minuten) / max(1, cap[b]),
                                                  kwal_tel[a] - kwal_tel[b], _locale_compare(str(a), str(b))))[0]

    gedaan: set[int] = set()
    volgorde = sorteer(actieve_items, lambda a, b: of(len(a.kamers) - len(b.kamers), b.min - a.min, _locale_compare(a.code, b.code)))
    for it in volgorde:
        if id(it) in gedaan:
            continue
        groep = app_groep[it.appGroep] if it.appGroep else [it]
        for x in groep:
            gedaan.add(id(x))
        kandidaten = list(it.kamers)
        tot_min = _som(groep, lambda x: x.min)
        redenen: list[str] = []
        if len(groep) > 1:
            redenen.append(f"apparaat \"{it.appGroep}\" — alle {len(groep)} codes samen in één kamer zodat ze nooit gelijktijdig staan")
        if len(kandidaten) == 1:
            redenen.append("enige gekwalificeerde kamer")
        beste = kies(kandidaten, tot_min, it.voorkeur)
        if waar(it.voorkeur) and beste == it.voorkeur and len(kandidaten) > 1:
            redenen.append("voorkeurskamer")
        elif len(kandidaten) > 1:
            redenen.append(f"laagste belasting van {' / '.join(str(naam_van(i)) for i in kandidaten)}")
        # Past het in één kamer zonder die (bijna) vol te trekken, dan gaat alles daarheen.
        # Zou de kamer boven ~92% komen terwijl een andere gekwalificeerde kamer ruimte heeft,
        # dan wordt het volume verdeeld — anders blijft er geen speling voor de grote blokken.
        past_ruim = load[beste] + tot_min <= cap[beste] * 0.92
        if (past_ruim or len(kandidaten) == 1 or len(groep) > 1
                or (load[beste] + tot_min <= cap[beste] and not any(i != beste and load[i] < cap[i] * 0.92 for i in kandidaten))):
            load[beste] += tot_min
            for x in groep:
                delen.append({"item": x, "kamerId": beste, "n": x.n})
                toewijzing.append({"code": x.code, "oms": x.oms, "n": x.n, "duur": x.duur, "min": x.min,
                                   "kamers": [{"kamerId": beste, "naam": naam_van(beste), "n": x.n}], "reden": "; ".join(redenen), "gesplitst": False})
            continue
        # Verdelen over de gekwalificeerde kamers zó dat ze op dezelfde belasting uitkomen.
        tot_cap = _som(kandidaten, lambda i: cap[i])
        tot_load = _som(kandidaten, lambda i: load[i])
        doel_ratio = (tot_load + tot_min) / max(1, tot_cap)
        rest = it.n
        stukken: list[dict[str, Any]] = []
        for i in sorteer(kandidaten, lambda a, b: (cap[b] - load[b]) - (cap[a] - load[a])):
            if rest <= 0:
                continue
            neem = max(0, min(rest, js_round((doel_ratio * cap[i] - load[i]) / it.duur)))
            if neem > 0:
                stukken.append({"kamerId": i, "n": neem})
                load[i] += neem * it.duur
                rest -= neem
        if rest > 0:
            i = sorteer(kandidaten, lambda a, b: (cap[b] - load[b]) - (cap[a] - load[a]))[0]
            s = next((x for x in stukken if x["kamerId"] == i), None)
            if s is None:
                s = {"kamerId": i, "n": 0}
                stukken.append(s)
            s["n"] += rest
            load[i] += rest * it.duur
        for s in stukken:
            delen.append({"item": it, "kamerId": s["kamerId"], "n": s["n"]})
        toewijzing.append({"code": it.code, "oms": it.oms, "n": it.n, "duur": it.duur, "min": it.min,
                           "kamers": [{"kamerId": s["kamerId"], "naam": naam_van(s["kamerId"]), "n": s["n"]} for s in stukken],
                           "reden": "verdeeld over meerdere kamers zodat beide op dezelfde belasting uitkomen" if len(stukken) > 1 else "enige kamer met ruimte",
                           "gesplitst": len(stukken) > 1})
        if len(stukken) > 1:
            lijst = ", ".join("%s× in %s" % (s["n"], naam_van(s["kamerId"])) for s in stukken)
            melding("info", "Verdeeld over kamers", f"{it.code} ({it.n}×/wk) is over meerdere kamers verdeeld zodat ze gelijk belast zijn: {lijst}.")
    spoor.stap("toewijzing", items=len(toewijzing), gesplitst=sum(1 for t in toewijzing if t["gesplitst"]),
               belasting={str(k): v for k, v in load.items()})

    # ── DAGDELEN per kamer: open wat nodig is, cluster of spreid per code ─────────
    # Volgorde waarin dagdelen opengaan. 'heleDagen': een kamer draait bij voorkeur
    # hele dagen (ochtend + middag) en die dagen liggen gespreid over de week; per
    # kamer begint de reeks op een andere dag, zodat niet alle kamers dezelfde dag
    # dicht zijn. 'spreiden': eerst alle ochtenden over de week, dan de middagen.
    basis = [0, 2, 4, 1, 3]
    spreiden_wijze = reg.get("vulwijze") == "spreiden"

    def dag_volgorde(r: int) -> list[int]:
        return [0, 1, 2, 3, 4] if spreiden_wijze else [basis[(i + r * 2) % 5] for i in range(5)]

    def rang(s: Sessie) -> int:
        v = dag_volgorde(s.r)
        return s.dd * 10 + v.index(s.di) if spreiden_wijze else v.index(s.di) * 10 + s.dd

    sorteer_in_place(sessies, lambda a, b: of(a.r - b.r, rang(a) - rang(b)))
    ntp: list[dict[str, Any]] = []
    inst: list[dict[str, Any]] = []   # alle geplaatste instanties {item, sessie}

    def tel_code(s: Sessie, code: str) -> int:
        return len([x for x in s.items if x.code == code])

    spreid_vanaf = of(getal(reg.get("spreidVanaf"), 0), 5)
    verdichten = reg.get("verdichten") is not False
    for k in actief:
        kid = k.get("id")
        mijn = [s for s in sessies if s.kamerId == kid]
        werk = [d for d in delen if d["kamerId"] == kid and d["n"] > 0]

        def mag(it: Item, s: Sessie) -> bool:
            return bool(it.dagdelen[s.ddk]) and waar(it.weekdagen.get(FK_DAG_ABBR[s.di]))

        def n_sess(it: Item) -> int:
            return len([s for s in mijn if mag(it, s)])

        sorteer_in_place(werk, lambda a, b: of(n_sess(a["item"]) - n_sess(b["item"]), b["n"] * b["item"].duur - a["n"] * a["item"].duur,
                                               _locale_compare(a["item"].code, b["item"].code)))
        # Zet vooraf het aantal dagdelen open dat de vraag van deze kamer nodig heeft, in
        # de openingsvolgorde. Zo hebben veelvoorkomende codes (spirometrie, NO) meteen de
        # hele week om over te spreiden, in plaats van pas op de laatste dag te belanden.
        # Dagdelen die daarna leeg blijven, gaan aan het einde gewoon weer dicht.
        vraag_hier = _som(werk, lambda d: d["n"] * d["item"].duur)
        vooraf = min(len(mijn), math.ceil(vraag_hier / max(1, mijn[0].doel if mijn else 1)))
        for s in mijn[:vooraf]:
            s.open = True
        for d in werk:
            it, n = d["item"], d["n"]
            strategie = "spread" if it.spreiden == "ja" else "cluster" if it.spreiden == "nee" else ("spread" if n >= spreid_vanaf else "cluster")
            for _ in range(n):
                kand = [s for s in mijn if mag(it, s) and s.used + it.duur <= s.usable]
                if not kand:
                    ntp.append({"item": it, "kamerId": kid,
                                "reden": f"alle dagdelen van {k.get('naam')} die voor {it.code} mogen, zitten vol" if any(mag(it, s) for s in mijn)
                                else f"{k.get('naam')} heeft geen open dagdeel op de dagen/dagdelen waar {it.code} mag"})
                    continue
                open_ = [s for s in kand if s.open]
                if open_:
                    if strategie == "cluster":
                        doel = sorteer(open_, lambda a, b: of(tel_code(b, it.code) - tel_code(a, it.code), b.used - a.used, rang(a) - rang(b)))[0]
                    else:
                        doel = sorteer(open_, lambda a, b: of(tel_code(a, it.code) - tel_code(b, it.code), a.used - b.used, rang(a) - rang(b)))[0]
                else:
                    doel = kand[0]
                doel.open = True
                doel.items.append(it.kopie(n=1))
                doel.used += it.duur
                inst.append({"item": it, "sessie": doel})
        for s in mijn:
            if not s.items:
                s.open = False

        # Bij gelijke vulling sluit eerst het dagdeel waarvan de andere helft van de dag
        # al dicht is — zo blijven hele dagen zoveel mogelijk intact.
        def partner_open(s: Sessie) -> int:
            return 1 if any(x.open and x.di == s.di and x is not s for x in mijn) else 0

        # Te dunne dagdelen sluiten als álles erin elders past — anders blijft het open.
        verbeterd = True
        while verbeterd:
            verbeterd = False
            # Verdichten (standaard): élk dagdeel dat niet vol is mag dicht als alles erin
            # elders past — de benutting is de hoofdregel. Zonder verdichten gaat alleen
            # een dagdeel onder de drempel dicht (liever meer dagdelen, lager bezet).
            dun = sorteer([s for s in mijn if s.open and (s.used < s.usable if verdichten else s.used < s.bruto * min_bez)],
                          lambda a, b: of(a.used - b.used, partner_open(a) - partner_open(b), rang(b) - rang(a)))
            for s in dun:
                anderen = [x for x in mijn if x.open and x is not s]
                plan: list[tuple[Item, Sessie]] = []
                gebruikt: dict[str, float] = {}
                lukt = True
                for x in s.items:
                    t = next((a for a in anderen if mag(x, a) and a.used + gebruikt.get(f"{a.di}{a.ddk}", 0) + x.duur <= a.usable), None)
                    if t is None:
                        lukt = False
                        break
                    gebruikt[f"{t.di}{t.ddk}"] = gebruikt.get(f"{t.di}{t.ddk}", 0) + x.duur
                    plan.append((x, t))
                if not lukt:
                    continue
                for x, t in plan:
                    t.items.append(x)
                    t.used += x.duur
                s.items = []
                s.used = 0
                s.open = False
                verbeterd = True
                break
        # Blijft een dagdeel dun omdat zijn werk nergens anders past, dan trekken we werk
        # uit de volste dagdelen naar dat dunne toe — zolang de gever boven de drempel
        # blijft. Zo wordt 11/11/11/3 alsnog 9/9/9/9 in plaats van één dagdeel op 21%.
        for s in [s for s in mijn if s.open and s.used < s.bruto * min_bez]:
            door = True
            while door and s.used < s.bruto * min_bez:
                door = False
                gevers = sorteer([g for g in mijn if g.open and g is not s and g.used > s.used], lambda a, b: b.used - a.used)
                for g in gevers:
                    x = next((x for x in sorteer(g.items, lambda a, b: a.duur - b.duur)
                              if mag(x, s) and s.used + x.duur <= s.usable and g.used - x.duur >= g.bruto * min_bez
                              and g.used - x.duur > s.used + x.duur - x.duur), None)
                    if x is None:
                        continue
                    g.items.remove(x)      # identiteit: elke instantie is een eigen kopie
                    g.used -= x.duur
                    s.items.append(x)
                    s.used += x.duur
                    door = True
                    break
        spoor.stap(f"dagdelen.{k.get('naam')}", open=sum(1 for s in mijn if s.open), beschikbaar=len(mijn), geplaatst=sum(len(s.items) for s in mijn),
                   rest=sum(1 for x in ntp if x["kamerId"] == kid))

    # ── TIJDLAYOUT + resultaat in de vorm van de poli-engine ───────────────────────
    num_rooms = max(1, len(actief))
    res: dict[str, Any] = {"numRooms": num_rooms, "mUsable": math.floor(och_dur * benut), "aUsable": math.floor(mid_dur * benut),
                           "avUsable": math.floor(av_dur * benut), "ochDur": och_dur, "midDur": mid_dur, "avDur": av_dur, "avondOn": avond_on,
                           "ochStart": och_start, "ochEnd": och_end, "midStart": mid_start, "midEnd": mid_end, "avondStart": avond_start, "avondEnd": avond_end,
                           "days": {}, "ntp": [], "ddDagen": glob,
                           "capacity": {"mode": "vast", "kamers": num_rooms, "maxParallel": num_rooms, "needed": num_rooms, "used": num_rooms,
                                        "overflow": 0, "fits": True},
                           "modus": "functie"}
    kleur_idx: dict[str, int] = {}

    def ci_van(code: str) -> int:
        if code not in kleur_idx:
            kleur_idx[code] = len(kleur_idx)
        return kleur_idx[code]

    def mk_appt(x: Item, s: Sessie, idx: int, t: float) -> dict[str, Any]:
        anderen = [naam_van(i) for i in x.kamers if i != s.kamerId]
        return {"id": f"fk_{s.r}_{s.di}_{s.ddk}_{idx}_{_NIET_WOORD.sub('', x.code)}",
                "code": x.code, "description": x.oms, "duur": x.duur, "digitaal": False, "modaliteit": "fysiek", "spoed": False, "onzeker": "gemiddeld",
                "category": "onderzoek", "ci": ci_van(x.code), "fkKamer": s.kamerId, "fkCi": x.ci, "day": s.di, "dd": s.ddk, "dagdeel": s.dd, "room": s.r,
                "start": t, "end": t + x.duur,
                "_why": [f"{x.code} mag in {naam_van(s.kamerId)}" + (f" (ook in {', '.join(map(str, anderen))})" if len(x.kamers) > 1 else " — de enige gekwalificeerde kamer") + ".",
                         f"Gepland in het {FK_DD_NAAM[s.ddk]} van {FK_DAG_NAAM[s.di].lower()}: "
                         + ("dit dagdeel had ruimte" if x.dagdelen["O"] and x.dagdelen["M"] else f"{x.code} mag alleen in het {FK_DD_NAAM[s.ddk]}") + "."]}

    for di in range(5):
        slots: dict[str, list] = {}
        for r in range(num_rooms):
            for d in DDS:
                slots[d["pre"] + str(r)] = []
        for s in [s for s in sessies if s.di == di]:
            if not s.items:
                continue
            # Zelfde code bij elkaar; lange onderzoeken vooraan, korte erna (vult het dagdeel strak).
            groep: dict[str, list[Item]] = {}
            for x in s.items:
                groep.setdefault(x.code, []).append(x)
            volg = [x for lst in sorteer(js_values(groep), lambda a, b: of(b[0].duur - a[0].duur, _locale_compare(a[0].code, b[0].code))) for x in lst]
            t = s.start
            arr: list[dict[str, Any]] = []
            for i, x in enumerate(volg):
                arr.append(mk_appt(x, s, i, t))
                t += x.duur
            rest = s.start + s.bruto - t
            if rest >= 5:
                arr.append({"id": f"flex_{s.r}_{di}_{s.ddk}", "isFlex": True, "dagdeel": s.dd, "room": s.r, "start": t, "end": t + rest, "duur": rest,
                            "code": "Flex", "description": "Flexruimte / buffer", "category": "flex"})
            slots[s.pre + str(s.r)] = arr
        res["days"][di] = slots
    for i, x in enumerate(ntp):
        it = x["item"]
        dag = next((j for j, d in enumerate(FK_DAG_ABBR) if waar(it.weekdagen.get(d))), -1)
        ddk = "O" if it.dagdelen["O"] else "M" if it.dagdelen["M"] else "A"
        res["ntp"].append({"id": f"fkntp_{i}_{_NIET_WOORD.sub('', it.code)}", "code": it.code, "description": it.oms, "duur": it.duur, "digitaal": False,
                           "modaliteit": "fysiek", "spoed": False, "onzeker": "gemiddeld", "category": "onderzoek", "ci": ci_van(it.code),
                           "fkKamer": x["kamerId"], "fkCi": it.ci, "day": max(0, dag), "dd": ddk, "_reden": x["reden"]})
    for i, g in enumerate(geen_kamer):
        for kk in range(g["n"]):
            res["ntp"].append({"id": f"fkgeen_{i}_{kk}", "code": g["code"], "description": g["oms"], "duur": g["duur"], "digitaal": False, "modaliteit": "fysiek",
                               "spoed": False, "onzeker": "gemiddeld", "category": "onderzoek", "ci": ci_van(g["code"]), "fkKamer": None, "day": 0, "dd": "O",
                               "_reden": g["reden"]})
    res["capacity"]["overflow"] = len(res["ntp"])
    res["capacity"]["fits"] = len(res["ntp"]) == 0
    per_kamer_ntp: dict[Any, int] = {}
    for x in ntp:
        per_kamer_ntp[x["kamerId"]] = per_kamer_ntp.get(x["kamerId"], 0) + 1
    for kid, n in js_entries(per_kamer_ntp):
        eerste_reden = next(x for x in ntp if x["kamerId"] == kid)["reden"]
        melding("warn", "Restlijst", f"{naam_van(kid)}: {_zin(n, 'onderzoek past', 'onderzoeken passen')} niet meer in de open dagdelen van deze kamer. {eerste_reden}.",
                "Zet de kamer op meer dagdelen open, verhoog de benutting, of vink voor die codes een tweede gekwalificeerde kamer aan.")
    spoor.stap("tijdlayout", afspraken=sum(len([a for a in arr if not a.get("isFlex")]) for sl in res["days"].values() for arr in sl.values()), rest=len(res["ntp"]))

    # ── KPI (zelfde definitie als de poli-engine) ─────────────────────────────────
    kpi: dict[str, Any] = {"perDay": {}, "week": {"appts": 0, "planned": 0, "capacity": 0, "flex": 0}, "issues": []}
    for di in range(5):
        slots = res["days"][di]
        appts = planned = flex = capacity = 0
        for key, arr in slots.items():
            d = 0 if key[0] == "o" else 1 if key[0] == "m" else 2
            if any(not a.get("isFlex") for a in (arr or [])):
                capacity += och_dur if d == 0 else mid_dur if d == 1 else av_dur
            for a in (arr or []):
                if a.get("isFlex"):
                    flex += a["duur"]
                    continue
                appts += 1
                planned += a["duur"]
        kpi["perDay"][di] = {"appts": appts, "planned": planned, "flex": flex, "capacity": capacity,
                             "benutting": js_round(planned / capacity * 100) if capacity > 0 else 0}
        kpi["week"]["appts"] += appts
        kpi["week"]["planned"] += planned
        kpi["week"]["capacity"] += capacity
        kpi["week"]["flex"] += flex
    kpi["week"]["benutting"] = js_round(kpi["week"]["planned"] / kpi["week"]["capacity"] * 100) if kpi["week"]["capacity"] > 0 else 0
    day_loads = [kpi["perDay"][d]["planned"] for d in range(5)]
    avg = _som(day_loads, lambda v: v) / 5
    sd = math.sqrt(_som(day_loads, lambda v: (v - avg) ** 2) / 5)
    kpi["week"]["spreiding"] = max(0, js_round(100 - (sd / avg) * 100)) if avg > 0 else 100
    wissels = 0
    for slots in res["days"].values():
        for arr in slots.values():
            v = None
            for a in arr:
                if a.get("isFlex"):
                    continue
                if v and v != a["code"]:
                    wissels += 1
                v = a["code"]
    kpi["week"]["wissels"] = wissels
    res["kpi"] = kpi
    res["notices"] = notices
    res["digPlan"] = None
    res["aanpassingen"] = []

    # ── RASTERADVIES per kamer, in gewone taal ────────────────────────────────────
    advies: list[dict[str, Any]] = []
    for r, k in enumerate(actief):
        kid = k.get("id")
        mijn = [s for s in sessies if s.kamerId == kid]
        open_s = [s for s in mijn if s.open]
        mijn_delen = [d for d in delen if d["kamerId"] == kid]
        vraag_min = _som(mijn_delen, lambda d: d["n"] * d["item"].duur)
        codes_hier: dict[str, dict[str, Any]] = {}
        for d in mijn_delen:
            c = codes_hier.setdefault(d["item"].code, {"code": d["item"].code, "oms": d["item"].oms, "duur": d["item"].duur, "n": 0, "min": 0, "gepland": 0})
            c["n"] += d["n"]
            c["min"] += d["n"] * d["item"].duur
        for s in open_s:
            for x in s.items:
                if x.code in codes_hier:
                    codes_hier[x.code]["gepland"] += 1
        profiel: dict[str, list[str]] = {"O": [], "M": [], "A": []}
        per_dag = []
        for di in range(5):
            o: dict[str, Any] = {}
            for d in DDS:
                s = next((x for x in mijn if x.di == di and x.ddk == d["k"]), None)
                if s is None:
                    o[d["k"]] = {"beschikbaar": False}
                    continue
                cs: dict[str, dict[str, Any]] = {}
                for x in s.items:
                    c = cs.setdefault(x.code, {"code": x.code, "n": 0, "min": 0})
                    c["n"] += 1
                    c["min"] += x.duur
                o[d["k"]] = {"beschikbaar": True, "open": s.open, "used": s.used, "bruto": s.bruto, "usable": s.usable,
                             "pct": js_round(s.used / s.bruto * 100), "codes": sorteer(js_values(cs), lambda a, b: b["min"] - a["min"])}
                if s.open:
                    for c in js_sleutels(cs):
                        if c not in profiel[d["k"]]:
                            profiel[d["k"]].append(c)
            per_dag.append(o)
        nodig = math.ceil(vraag_min / max(1, mijn[0].usable if mijn else 1))
        rest_hier = len([x for x in ntp if x["kamerId"] == kid])
        dagen = []
        for di in range(5):
            o_ = [s for s in open_s if s.di == di]
            if not o_:
                continue
            dagen.append({"di": di, "dd": [s.ddk for s in o_], "heleDag": any(s.ddk == "O" for s in o_) and any(s.ddk == "M" for s in o_)})
        advies.append({"kamerId": kid, "naam": k.get("naam"), "oms": k.get("oms"), "r": r, "nOpen": len(open_s), "nBeschikbaar": len(mijn), "nodig": nodig,
                       "perDd": {"O": len([s for s in open_s if s.ddk == "O"]), "M": len([s for s in open_s if s.ddk == "M"]), "A": len([s for s in open_s if s.ddk == "A"])},
                       "vraagMin": vraag_min, "capMin": _som(mijn, lambda s: s.usable),
                       "benutting": js_round(_som(open_s, lambda s: s.used) / _som(open_s, lambda s: s.bruto) * 100) if open_s else 0,
                       "codes": sorteer(js_values(codes_hier), lambda a, b: b["min"] - a["min"]), "profiel": profiel, "perDag": per_dag, "rest": rest_hier,
                       "dagen": dagen})
    tot_vraag = _som(actieve_items, lambda x: x.min) + _som(geen_kamer, lambda x: x["min"])
    tot_cap = _som(sessies, lambda s: s.usable)
    res["fk"] = {"advies": advies, "toewijzing": sorteer_in_place(toewijzing, lambda a, b: b["min"] - a["min"]), "incidenteel": incidenteel, "geenKamer": geen_kamer,
                 "incidenteelMin": js_round(_som(incidenteel, lambda x: x["aw"] * x["duur"])),
                 "samenvatting": {"codes": len(actieve_items) + len(geen_kamer), "afspraken": _som(actieve_items, lambda x: x.n) + _som(geen_kamer, lambda x: x["n"]),
                                  "vraagMin": tot_vraag, "capMin": tot_cap, "dekking": js_round(tot_cap / tot_vraag * 100) if tot_vraag > 0 else 100,
                                  "dagdelenOpen": len([s for s in sessies if s.open]), "dagdelenBeschikbaar": len(sessies),
                                  "rest": len(res["ntp"]), "weken": weken, "benutting": js_round(benut * 100)},
                 "planregels": of(reg.get("planregels"), []), "vulwijze": reg.get("vulwijze"), "spreidVanaf": reg.get("spreidVanaf")}
    spoor.stap("klaar", afspraken=kpi["week"]["appts"], rest=len(res["ntp"]), dagdelenOpen=res["fk"]["samenvatting"]["dagdelenOpen"],
               benutting=kpi["week"]["benutting"])
    log.debug("functiekamers klaar: afspraken=%d rest=%d dagdelen=%d/%d", kpi["week"]["appts"], len(res["ntp"]),
              res["fk"]["samenvatting"]["dagdelenOpen"], len(sessies))
    if trace:
        res["spoor"] = spoor.lijst()
    return res
