"""pytest-wrapper om de pariteitscontrole: elk geval moet dezelfde handtekening geven als JavaScript."""
import pytest

from tests.pariteit.handtekening import handtekening
from tests.pariteit.vergelijk import eerste_verschil, laad_cases, laad_verwacht, normaliseer, reken

CASES = laad_cases()
VERWACHT = laad_verwacht()


@pytest.mark.parametrize("case", CASES, ids=[c["naam"] for c in CASES])
def test_pariteit(case):
    h = normaliseer(handtekening(reken(case)))
    v = eerste_verschil(VERWACHT[case["naam"]], h)
    assert v is None, v
