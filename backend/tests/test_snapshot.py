"""
Snapshot Integrity Tests
Validates row counts, primary keys, lead times, window bounds, and cryptographic hashes.

Run command:
    pytest backend/tests/test_snapshot.py
"""

import hashlib
import json
from pathlib import Path

import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_DIR = PROJECT_ROOT / "data" / "snapshot"
ACTUALS_CSV = SNAPSHOT_DIR / "actuals_halfhourly.csv"
FORECASTS_CSV = SNAPSHOT_DIR / "forecasts.csv"
MANIFEST_JSON = SNAPSHOT_DIR / "manifest.json"


def calculate_sha256(file_path: Path) -> str:
    """Calculate the SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


@pytest.fixture(scope="module")
def snapshot_data():
    """Load actuals, forecasts, and manifest."""
    assert ACTUALS_CSV.exists(), f"Missing snapshot file: {ACTUALS_CSV}"
    assert FORECASTS_CSV.exists(), f"Missing snapshot file: {FORECASTS_CSV}"
    assert MANIFEST_JSON.exists(), f"Missing manifest file: {MANIFEST_JSON}"

    df_act = pd.read_csv(ACTUALS_CSV)
    df_act["startTime_dt"] = pd.to_datetime(df_act["startTime"], utc=True)

    df_fc = pd.read_csv(FORECASTS_CSV)
    df_fc["publishTime_dt"] = pd.to_datetime(df_fc["publishTime"], utc=True)
    df_fc["startTime_dt"] = pd.to_datetime(df_fc["startTime"], utc=True)

    with open(MANIFEST_JSON, encoding="utf-8") as f:
        manifest = json.load(f)

    return df_act, df_fc, manifest


def test_actuals_row_count(snapshot_data):
    """Assert exactly 1,488 actual half-hour rows (31 delivery days x 48 settlement periods)."""
    df_act, _, _ = snapshot_data
    assert len(df_act) == 1488, f"Expected 1488 actual rows, got {len(df_act)}"


def test_no_duplicate_keys(snapshot_data):
    """Assert no duplicate primary keys in either dataset."""
    df_act, df_fc, _ = snapshot_data
    assert not df_act.duplicated(subset=["startTime"]).any(), (
        "Duplicate startTime found in actuals"
    )
    assert not df_fc.duplicated(subset=["publishTime", "startTime"]).any(), (
        "Duplicate (publishTime, startTime) found in forecasts"
    )


def test_all_lead_hours_positive(snapshot_data):
    """Assert all hindcast rows were dropped (lead_hours > 0 for all retained forecasts)."""
    _, df_fc, _ = snapshot_data
    assert (df_fc["lead_hours"] > 0).all(), "Found non-positive lead_hours in forecasts"


def test_forecast_startTime_within_window(snapshot_data):
    """Assert all forecast startTime values fall within the delivery window (2026-01-02T00:00Z to 2026-02-02T00:00Z)."""
    _, df_fc, _ = snapshot_data
    window_start = pd.Timestamp("2026-01-02T00:00:00Z")
    window_end = pd.Timestamp("2026-02-02T00:00:00Z")
    assert (df_fc["startTime_dt"] >= window_start).all(), (
        "Forecast startTime before window start"
    )
    assert (df_fc["startTime_dt"] <= window_end).all(), (
        "Forecast startTime after window end"
    )


def test_forecast_startTime_on_the_hour(snapshot_data):
    """Assert every forecast startTime is aligned strictly to the top of the hour."""
    _, df_fc, _ = snapshot_data
    assert (df_fc["startTime_dt"].dt.minute == 0).all(), (
        "Forecast startTime not on the hour (minute != 0)"
    )
    assert (df_fc["startTime_dt"].dt.second == 0).all(), (
        "Forecast startTime not on the hour (second != 0)"
    )


def test_manifest_hashes_match_files(snapshot_data):
    """Assert cryptographic SHA-256 hashes recorded in manifest match the CSV files on disk."""
    _, _, manifest = snapshot_data

    actuals_hash = calculate_sha256(ACTUALS_CSV)
    forecasts_hash = calculate_sha256(FORECASTS_CSV)

    assert manifest["sha256"]["actuals_halfhourly.csv"] == actuals_hash, (
        f"Manifest hash mismatch for actuals: {manifest['sha256']['actuals_halfhourly.csv']} != {actuals_hash}"
    )
    assert manifest["sha256"]["forecasts.csv"] == forecasts_hash, (
        f"Manifest hash mismatch for forecasts: {manifest['sha256']['forecasts.csv']} != {forecasts_hash}"
    )
