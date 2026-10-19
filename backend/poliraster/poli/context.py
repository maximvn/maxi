"""PlanContext: alle gedeelde invoer en afgeleide grootheden van één engine-aanroep.

Wat doet dit onderdeel
----------------------
De JavaScript-engine (``computeRasterInner``) is één grote functie waarin alle
fasen dezelfde lokale variabelen delen: de spreekuurtijden, de benuttingsband,
de dagdelen die open zijn, het aantal kamers, de pool met afspraak-instanties,
het opgebouwde raster per dag, de restlijst en een rits tellers voor het
rapport. In Python zetten we die gedeelde staat in één object, ``PlanContext``,
dat elke fase meekrijgt. Zo blijft elke fase een los bestand, terwijl de
getallen die ze delen op één plek staan en één keer worden berekend.

Plaats in de keten
------------------
Stap 0 van de poli-engine (zie ``engine.py``): wordt als eerste aangemaakt en
daarna door alle fasen gelezen en bijgewerkt.

Invoer
------
``cfg`` (newPat, ctrlPat), ``newRows``/``ctrlRows`` (codes), ``m2`` (tijden,
benutting, weekdag-%, dagdelen), ``rules`` (planregels), ``capacity`` (mode, kamers).

Uitvoer
-------
Het contextobject zelf, met o.a.: tijden in minuten (``och_start`` …), de
bruikbare minuten per dagdeel (``m_usable`` …), de lijst dagdelen ``DD``, de
gewichten per dagdeel, de band-functies (``ondergrens_cap``, ``bovengrens_cap``,
``haalbaar_onder``, ``haalbaar_boven``), het aantal kamers (``max_parallel``), de
minimumbezetting en de werkstructuren ``grouped``, ``built``, ``overflow_inst``.

Hoe het werkt
-------------
1. Tijden omzetten naar minuten en de bruikbare capaciteit per dagdeel afleiden
   (``Math.max(15, Math.round(duur × benutting/100))``).
2. Lege codelijsten en aantallen vervangen door de JavaScript-standaarden
   (geen nieuwe codes → één 'NP' van 20 min; newPat 0 → 5 patiënten, enz.).
3. Dagdelen: welke bestaan (avond alleen als er een avonddag is aangevinkt) en
   op welke weekdagen ze open zijn.
4. De benuttingsband per dagdeel, inclusief de "haalbare" band (veelvouden van
   de grootste gemene deler van de consultduren, ``dur_stap``).
5. Capaciteit (auto → onbegrensd, vast → ``kamers``) en minimumbezetting.

Waar kan het misgaan en hoe zie je dat
--------------------------------------
- Alle spreekuren te vol of te leeg: controleer ``m_usable``/``a_usable`` en de
  bandgrenzen in het spoor (stap ``context``).
- Een dagdeel ontbreekt in het raster: kijk naar ``DD`` en ``dd_dagen`` — de avond
  bestaat alleen als ``m2.ddDagen.A`` ergens waar is.
- Afspraken van een code ontbreken: ``dur_stap`` kan door een vreemde duur (bv. 7)
  op 1 vallen, waardoor de haalbare band gelijk is aan de rekenkundige band.
"""
from __future__ import annotations

import logging
import math
from typing import Any

from poliraster.hulp.js import INF, getal, js_ceil, js_floor, js_round, nn, of, waar
from poliraster.hulp.spoor import Spoor
from poliraster.hulp.tijd import DD_INDEX, DD_PREFIX, WEEKDAY_KEYS, dd_dagen_van, to_min

log = logging.getLogger(__name__)

# Standaardcodes als de gebruiker (nog) geen codes heeft ingevoerd (JS: eNew/eCtrl).
_STANDAARD_NIEUW = [{"afspraakcode": "NP", "omschrijving": "Nieuwe patiënt", "duur": 20, "digitaal": False, "spoed": False,
                     "percentage": 100, "weekdagen": {"MA": True, "DI": True, "WO": True, "DO": True, "VR": True}}]
_STANDAARD_CONTROLE = [{"afspraakcode": "CP", "omschrijving": "Controle", "duur": 15, "digitaal": False, "spoed": False,
                        "percentage": 100, "weekdagen": {"MA": True, "DI": True, "WO": True, "DO": True, "VR": True}}]


def _heel(x: float) -> float:
    """Een float met een hele waarde als int teruggeven (510.0 → 510); NaN en breuken blijven zoals ze zijn."""
    return int(x) if isinstance(x, float) and x == x and x.is_integer() else x


class PlanContext:
    """Gedeelde staat van één ``computeRasterInner``-aanroep (JS: de lokale variabelen bovenin).

    De velden met een JavaScript-naam in het commentaar zijn één-op-één overgenomen.
    Werkstructuren die fasen bijwerken:

    - ``all_inst``: alle afspraak-instanties (JS ``allInst``).
    - ``grouped``: per dag (0–4) de lijst instanties (JS ``grouped``); wordt door digitaal,
      bandplan en bundelen herschikt.
    - ``built``: per dag een dict dagdeel → lijst kamers (lijsten afspraken) of ``None``
      voor een gesloten dag (JS ``built``).
    - ``overflow_inst``: de restlijst "nog te plannen" (JS ``overflowInst``).
    - tellers voor het rapport (``dichtgezet_dd``, ``navul_totaal``, …).
    """

    def __init__(self, cfg: dict, new_rows: list, ctrl_rows: list, m2: dict, rules: dict, capacity: dict,
                 spoor: Spoor) -> None:
        self.cfg, self.m2, self.rules, self.capacity = cfg, m2, rules, capacity
        self.spoor = spoor

        # ── Tijden (JS: ochStart, ochEnd, midStart, midEnd, ochDur, midDur) ──
        # to_min geeft een float (zoals JavaScript's Number); hele waarden maken we int, zodat
        # 510 in teksten en id's als "510" verschijnt en niet als "510.0".
        self.och_start = _heel(to_min(m2["ochStart"]))
        self.och_end = _heel(to_min(m2["ochEnd"]))
        self.mid_start = _heel(to_min(m2["midStart"]))
        self.mid_end = _heel(to_min(m2["midEnd"]))
        self.och_dur = self.och_end - self.och_start
        self.mid_dur = self.mid_end - self.mid_start
        self.benutting = m2["benutting"]
        # Bruikbare capaciteit per slot = dagdeelduur × benutting% (JS: mUsable, aUsable)
        self.m_usable = max(15, js_round(self.och_dur * (self.benutting / 100)))
        self.a_usable = max(15, js_round(self.mid_dur * (self.benutting / 100)))

        # ── Codes en aantallen met JavaScript-terugval (JS: eNew, eCtrl, eNPat, eCPat) ──
        # Let op: newPat 0 (of leeg) betekent in JavaScript 5 fictieve patiënten en
        # ctrlPat 0 betekent 10. Dat is bewust letterlijk overgenomen voor de pariteit.
        self.e_new = new_rows if len(new_rows) > 0 else _STANDAARD_NIEUW
        self.e_ctrl = ctrl_rows if len(ctrl_rows) > 0 else _STANDAARD_CONTROLE
        self.e_npat = cfg["newPat"] if getal(cfg.get("newPat")) > 0 else 5
        self.e_cpat = cfg["ctrlPat"] if getal(cfg.get("ctrlPat")) > 0 else 10

        # ── Dagdelen en weekdagen (JS: ddDagen, ddOpenOp, avondOn, DD, ddWeight) ──
        # De avond bestaat alleen als er ook daadwerkelijk een dag voor is aangevinkt.
        self.dd_dagen = dd_dagen_van(m2)
        self.avond_on = any(waar(self.dd_dagen["A"].get(k)) for k in WEEKDAY_KEYS)
        self.avond_start = _heel(to_min(of(m2.get("avondStart"), "17:00")))
        self.avond_end = _heel(to_min(of(m2.get("avondEnd"), "20:00")))
        self.av_dur = max(0, self.avond_end - self.avond_start)
        self.av_usable = max(15, js_round(self.av_dur * (self.benutting / 100)))
        self.DD: list[str] = ["O", "M", "A"] if self.avond_on else ["O", "M"]
        ver_av = of(m2.get("verAvond"), 0) if self.avond_on else 0
        ver_och = m2["verOch"]
        self.dd_weight = {"O": ver_och, "M": max(0, 100 - ver_och - ver_av), "A": ver_av}
        self.dd_index = DD_INDEX
        self.dd_prefix = DD_PREFIX

        # ── Capaciteit (JS: capMode, maxParallel) ──
        self.cap_mode = of(capacity.get("mode"), "auto")
        self.max_parallel: float = max(1, of(capacity.get("kamers"), 1)) if self.cap_mode == "vast" else INF

        # ── Minimumbezetting (JS: minBezPct, minBezAan) ──
        # De drempel kan nooit hoger liggen dan de ondergrens van de band: een spreekuur dat
        # de band haalt is per definitie niet dun. Zonder die begrenzing sloopte een drempel
        # van 75% bij een benutting van 70% precies de spreekuren die keurig op 71% zaten.
        self.min_bez_pct = min(max(0, min(100, nn(rules.get("minBezetting"), 75))), max(0, self.benutting - 2.5))
        self.min_bez_aan = rules.get("restOpruimen") is not False and self.min_bez_pct > 0

        # ── Werkstructuren, gevuld door de fasen ──
        self.all_inst: list[dict] = []
        self.dur_stap: int = 1
        self.grouped: dict[int, list[dict]] = {}
        self.built: dict[int, Any] = {}
        self.overflow_inst: list[dict] = []
        self.per_dagdeel_need: list[dict] = []
        self.max_rooms = 1
        self.needed_rooms = 1
        self.dig_plan: dict = {"gepland": [], "mogelijk": 0, "rest": 0, "gevraagd": 0, "nietGelukt": [], "aan": False}
        self.week_plan: dict | None = None
        self.band_plan: dict | None = None
        self.week_dagen: list[int] = []
        # tellers voor meldingen en rapport
        self.dichtgezet_dd = 0
        self.naar_restlijst = 0
        self.gedwongen_open = 0
        self.navul_totaal = 0
        self.ruil_totaal = 0
        self.rest_dag_gebundeld = 0
        self.rest_dag_kamer: int | None = None
        self.rest_dag_buiten_grens = 0
        self.tel_redmiddel = 0
        self.flex_verruimd: list[dict] = []
        self.flex_surplus: list[dict] = []

        self.spoor.stap("context", och_dur=self.och_dur, mid_dur=self.mid_dur, m_usable=self.m_usable,
                        a_usable=self.a_usable, DD=self.DD, max_parallel=None if self.max_parallel == INF else self.max_parallel,
                        min_bez_pct=self.min_bez_pct)

    # ── Dagdelen ────────────────────────────────────────────────────────────────
    def dd_open_op(self, dd: str, di: int) -> bool:
        """JS ``ddOpenOp(x,di)``: is dagdeel ``dd`` op weekdag ``di`` (0=ma) open?"""
        return waar(self.dd_dagen.get(dd, {}).get(WEEKDAY_KEYS[di]))

    def dag_open(self, di: int) -> bool:
        """JS ``dagOpen``/``dagOpenW``-kern: weekdag-% groter dan 0."""
        return of(self.m2["days"].get(WEEKDAY_KEYS[di]), 0) > 0

    def open_dd(self, di: int) -> list[str]:
        """De dagdelen die op dag ``di`` open zijn, in DD-volgorde (JS: ``DD.filter(x=>ddOpenOp(x,di))``)."""
        return [x for x in self.DD if self.dd_open_op(x, di)]

    def usable_for(self, dd: str) -> int:
        """JS ``usableFor``: bruikbare minuten per dagdeel op de doelbenutting."""
        return self.m_usable if dd == "O" else self.a_usable if dd == "M" else self.av_usable

    def dur_for(self, dd: str) -> float:
        """JS ``durFor``/``durFor2``: bruto duur van het dagdeel in minuten."""
        return self.och_dur if dd == "O" else self.mid_dur if dd == "M" else self.av_dur

    # ── Benuttingsband ──────────────────────────────────────────────────────────
    # Onder- en bovengrens van de benuttingsband per dagdeel (in minuten). De band is
    # hard: naar BENEDEN afronden mag de bovengrens nooit overschrijden en naar boven
    # afronden mag nooit onder de ondergrens duiken. Met gewoon afronden werd 95% + 2,5
    # stiekem 205 min = 97,6% — buiten de band die je hebt ingesteld.
    def ondergrens_cap(self, dd: str) -> int:
        """JS ``ondergrensCap``: ⌈duur × (benutting−2,5)/100 − 1e-9⌉."""
        return js_ceil(self.dur_for(dd) * max(0, (self.benutting - 2.5)) / 100 - 1e-9)

    def bovengrens_cap(self, dd: str) -> int:
        """JS ``bovengrensCap``: ⌊duur × min(100, benutting+2,5)/100 + 1e-9⌋."""
        return js_floor(self.dur_for(dd) * min(100, self.benutting + 2.5) / 100 + 1e-9)

    # HAALBARE BAND. Een spreekuur wordt gevuld met hele consulten, dus de bezetting is
    # altijd een veelvoud van de grootste gemene deler van de consultduren (bij 10/15/20/30
    # min is dat 5). De rekenkundige band 173,25–183,75 min is daarmee in de praktijk
    # 175–180 min. Rekenen met de rekenkundige grenzen ging structureel mis: het weekplan
    # mikte op 173,4 min per spreekuur — onbereikbaar — waardoor elke dag één spreekuur te
    # veel opende, dat niet vulde, en de afspraken op "nog te plannen" belandden. Alle
    # AANTALLEN en DOELEN rekenen daarom met de haalbare band; de harde toets blijft de echte band.
    def bepaal_dur_stap(self) -> None:
        """JS ``durStap``: ggd van alle (afgeronde) consultduren, of 1 als die onbruikbaar is."""
        g = 0
        for a in self.all_inst:
            d = js_round(a["duur"])
            if d > 0:
                g = math.gcd(g, int(d))
        self.dur_stap = g if (g > 0 and g <= 60) else 1

    def haalbaar_onder(self, dd: str) -> float:
        """JS ``haalbaarOnder``: ondergrens opgerond naar een veelvoud van ``dur_stap`` (als dat nog binnen de band valt)."""
        L, U = self.ondergrens_cap(dd), self.bovengrens_cap(dd)
        q = js_ceil(L / self.dur_stap) * self.dur_stap
        return q if q <= U else L

    def haalbaar_boven(self, dd: str) -> float:
        """JS ``haalbaarBoven``: bovengrens afgerond naar een veelvoud van ``dur_stap`` (als dat nog binnen de band valt)."""
        L, U = self.ondergrens_cap(dd), self.bovengrens_cap(dd)
        q = js_floor(U / self.dur_stap) * self.dur_stap
        return q if q >= L else U

    def dig_band(self, dd: str) -> dict:
        """JS ``digBand``: band voor een eigen digitaal spreekuur (met ``Math.round``, anders dan de harde band)."""
        b = of(self.benutting, 85)
        return {"onder": js_round(self.dur_for(dd) * max(0, b - 2.5) / 100),
                "boven": js_round(self.dur_for(dd) * min(100, b + 2.5) / 100)}

    def band_cap(self, dd: str) -> int:
        """JS ``bandCap`` (bundelen): ``Math.round(duur × min(100, benutting+2,5)/100)``."""
        return js_round(self.dur_for(dd) * min(100, of(self.benutting, 85) + 2.5) / 100)

    def min_bez_cap(self, dd: str) -> float:
        """JS ``minBezCap``: minuten die een dagdeel minstens gevuld moet zijn voor de minimumbezetting."""
        return self.dur_for(dd) * self.min_bez_pct / 100

    # ── Vraag per dag ──────────────────────────────────────────────────────────
    def vraag_van(self, di: int) -> float:
        """JS ``vraagVan``: som van de duren van alle instanties die op dag ``di`` liggen."""
        return sum(q["duur"] for q in self.grouped.get(di, []))

    def max_room(self) -> int:
        """JS ``maxRoom``/``maxParallel===Infinity?99:maxParallel``: kamerlimiet voor het bundelen en bandplan."""
        return 99 if self.max_parallel == INF else int(self.max_parallel)
