"""Regression test comparing API outputs against saved reference fixtures.

Ensures that performance optimizations have zero impact on response shapes,
field names, key ordering, or numeric values (tolerance 1e-9 on floats).
"""

import json
import math
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def assert_matches_fixture(actual: Any, expected: Any, path: str = "") -> None:
    """Recursively assert actual matches expected with 1e-9 float tolerance and identical key ordering."""
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"{path}: expected dict, got {type(actual)}"
        assert list(actual.keys()) == list(expected.keys()), (
            f"{path}: keys or order mismatch: {list(actual.keys())} != {list(expected.keys())}"
        )
        for k in expected:
            assert_matches_fixture(actual[k], expected[k], f"{path}.{k}")
    elif isinstance(expected, list):
        assert isinstance(actual, list), f"{path}: expected list, got {type(actual)}"
        assert len(actual) == len(expected), (
            f"{path}: length mismatch {len(actual)} != {len(expected)}"
        )
        for idx, (a_item, e_item) in enumerate(zip(actual, expected, strict=True)):
            assert_matches_fixture(a_item, e_item, f"{path}[{idx}]")
    elif isinstance(expected, float):
        assert isinstance(actual, (float, int)), (
            f"{path}: expected float, got {type(actual)}"
        )
        assert math.isclose(float(actual), expected, rel_tol=1e-9, abs_tol=1e-9), (
            f"{path}: float mismatch {actual} != {expected} (diff: {abs(float(actual) - expected)})"
        )
    else:
        assert actual == expected, f"{path}: value mismatch {actual} != {expected}"


@pytest.mark.parametrize(
    ("url", "fixture_name"),
    [
        ("/api/accuracy?cutoff=09:20", "accuracy_0920.json"),
        ("/api/accuracy?cutoff=09:50", "accuracy_0950.json"),
        ("/api/accuracy?cutoff=15:30", "accuracy_1530.json"),
        ("/api/brief?date=2026-01-07&cutoff=09:20", "brief_20260107_0920.json"),
    ],
)
def test_regression_fixture(url: str, fixture_name: str) -> None:
    """Verify endpoint response identically matches reference fixture."""
    fixture_path = FIXTURES_DIR / fixture_name
    assert fixture_path.exists(), f"Fixture file not found: {fixture_path}"

    with open(fixture_path, encoding="utf-8") as f:
        expected = json.load(f)

    response = client.get(url)
    assert response.status_code == 200
    actual = response.json()

    assert_matches_fixture(actual, expected, path=fixture_name)
