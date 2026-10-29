"""Unit-tests voor de JavaScript-semantiek-helpers (rasterplanner/hulp/js.py) en tijd.py."""
from rasterplanner.hulp.js import (UNDEF, getal, jmax, jmin, js_is, js_max, js_round, js_sleutels, js_sort_string, js_tekst,
                                   json_schoon, nn, of, prop, slice_tot, sorteer, to_fixed, waar)
from rasterplanner.hulp.tijd import fmt, snap, to_min


def test_js_round_halve_naar_boven():
    assert js_round(2.5) == 3 and js_round(3.5) == 4 and js_round(-2.5) == -2 and js_round(0.49999) == 0


def test_js_sleutels_getallen_eerst():
    assert js_sleutels({20: 1, 15: 2, "x": 3}) == [15, 20, "x"]


def test_js_sort_string():
    assert js_sort_string([10, 9, 1]) == [1, 10, 9]


def test_of_en_nn():
    assert of(0, "", None, 7) == 7 and of(0, 0) == 0 and nn(0, 5) == 0 and nn(None, 5) == 5 and nn(UNDEF, 5) == 5
    assert of([], 1) == [] and of({}, 1) == {}   # lege lijst/dict is in JavaScript waar


def test_undefined_tegenover_null():
    assert js_is(UNDEF, UNDEF) and not js_is(UNDEF, None) and js_is(None, None)
    assert not js_is(True, 1) and not js_is(float("nan"), float("nan")) and js_is(5, 5.0)
    assert prop({"a": None}, "a") is None and prop({}, "a") is UNDEF and not waar(UNDEF)
    assert json_schoon({"a": UNDEF, "b": [UNDEF, 1]}) == {"b": [None, 1]}


def test_getal():
    assert getal("12") == 12 and getal("x", 3) == 3 and getal(None) == 0 and getal(True) == 1 and getal(UNDEF, 4) == 4


def test_max_min_met_nan():
    assert js_max([]) == float("-inf") and jmax() == float("-inf") and jmin() == float("inf")
    nan = float("nan")
    assert jmax(0, nan) != jmax(0, nan) and jmin(nan, 1) != jmin(nan, 1)   # NaN blijft NaN (Python's max slikt het in)


def test_slice_tot_kapt_af():
    assert slice_tot(2.7) == 2 and slice_tot(0) == 0 and [1, 2, 3][: slice_tot(2.7)] == [1, 2]


def test_sorteer_stabiel():
    assert [x["n"] for x in sorteer([{"k": 1, "n": "a"}, {"k": 0, "n": "b"}, {"k": 1, "n": "c"}], lambda a, b: a["k"] - b["k"])] == ["b", "a", "c"]


def test_to_fixed_en_tekst():
    assert to_fixed(1.25, 1) == "1.3" and to_fixed(2.0, 1) == "2.0"
    assert js_tekst(540.0) == "540" and js_tekst(52.8) == "52.8" and js_tekst(None) == "null" and js_tekst(UNDEF) == "undefined"


def test_tijd():
    assert to_min("08:30") == 510 and to_min("8.30") == 510 and to_min("0830") == 510 and to_min("8u30") == 510
    assert to_min("25:00") != to_min("25:00") and to_min(None) != to_min(None) and to_min(600) == 600
    assert fmt(510) == "08:30" and fmt(-5) == "00:00" and snap(512) == 510 and snap(512.5) == 515
