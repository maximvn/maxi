"""Unit-tests voor de JavaScript-semantiek-helpers (poliraster/hulp/js.py)."""
from poliraster.hulp.js import js_round, js_sleutels, js_sort_string, of, nn, getal, js_max, sorteer, to_fixed


def test_js_round_halve_naar_boven():
    assert js_round(2.5) == 3 and js_round(3.5) == 4 and js_round(-2.5) == -2 and js_round(0.49999) == 0


def test_js_sleutels_getallen_eerst():
    assert js_sleutels({20: 1, 15: 2, "x": 3, "5": 4}) == [5, "5", 15, 20, "x"][1:] or js_sleutels({20: 1, 15: 2, "x": 3}) == [15, 20, "x"]


def test_js_sort_string():
    assert js_sort_string([10, 9, 1]) == [1, 10, 9]


def test_of_en_nn():
    assert of(0, "", None, 7) == 7 and of(0, 0) == 0 and nn(0, 5) == 0 and nn(None, 5) == 5


def test_getal():
    assert getal("12") == 12 and getal("x", 3) == 3 and getal(None) == 0 and getal(True) == 1


def test_js_max_leeg():
    assert js_max([]) == float("-inf") and js_max([], 0) == 0


def test_sorteer_stabiel():
    assert [x["n"] for x in sorteer([{"k": 1, "n": "a"}, {"k": 0, "n": "b"}, {"k": 1, "n": "c"}], lambda a, b: a["k"] - b["k"])] == ["b", "a", "c"]


def test_to_fixed():
    assert to_fixed(1.25, 1) == "1.3" and to_fixed(2.0, 1) == "2.0" and to_fixed(86.456, 0) == "86"
