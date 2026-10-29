#!/usr/bin/env python3
"""
Elexon BMRS Data Ingestion Script
Fetches FUELHH (wind actuals) and WINDFOR (wind forecasts), cleans, validates,
and stores snapshot CSVs and manifest.json into data/snapshot/.

Run command:
    python backend/scripts/ingest.py
"""

import hashlib
import json
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

# API Endpoints
BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
FUELHH_STREAM_URL = f"{BASE_URL}/datasets/FUELHH/stream"
WINDFOR_STREAM_URL = f"{BASE_URL}/datasets/WINDFOR/stream"

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_DIR = PROJECT_ROOT / "data" / "snapshot"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


def calculate_sha256(file_path: Path) -> str:
    """Calculate the SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def fetch_with_retry(
    client: httpx.Client,
    url: str,
    params: dict[str, Any],
    max_retries: int = 4,
    timeout: float = 45.0,
) -> list[dict[str, Any]]:
    """Fetch JSON data from API endpoint with exponential backoff retries."""
    for attempt in range(1, max_retries + 1):
        try:
            response = client.get(url, params=params, timeout=timeout)
            if response.status_code == 200:
                return response.json()
            elif response.status_code in (429, 500, 502, 503, 504):
                sleep_sec = 2**attempt
                print(
                    f"HTTP {response.status_code} on {url}. Retrying in {sleep_sec}s (attempt {attempt}/{max_retries})..."
                )
                time.sleep(sleep_sec)
            else:
                response.raise_for_status()
        except (httpx.RequestError, httpx.HTTPStatusError) as exc:
            if attempt == max_retries:
                raise RuntimeError(
                    f"Request failed after {max_retries} retries for {url}: {exc}"
                ) from exc
            sleep_sec = 2**attempt
            print(
                f"Network error ({exc}). Retrying in {sleep_sec}s (attempt {attempt}/{max_retries})..."
            )
            time.sleep(sleep_sec)
    return []


def ingest_data() -> None:
    """Execute ingestion pipeline for actuals and forecasts."""
    fetched_at = datetime.now(UTC).isoformat()
    client = httpx.Client(timeout=45.0)

    print("=" * 70)
    print("STEP 1: Ingesting FUELHH (Actuals) and WINDFOR (Forecasts)")
    print("=" * 70)

    # 1. Fetch FUELHH WIND for settlement dates 2026-01-02..2026-02-01 in 7-day chunks
    fuelhh_records: list[dict[str, Any]] = []
    cur_date = datetime(2026, 1, 2).date()
    end_date = datetime(2026, 2, 1).date()
    chunk_days = 7

    print(f"\nFetching FUELHH WIND: {cur_date} to {end_date} (7-day max chunks)...")
    while cur_date <= end_date:
        chunk_end = min(cur_date + timedelta(days=chunk_days - 1), end_date)
        params = {
            "settlementDateFrom": cur_date.strftime("%Y-%m-%d"),
            "settlementDateTo": chunk_end.strftime("%Y-%m-%d"),
            "fuelType": "WIND",
        }
        data = fetch_with_retry(client, FUELHH_STREAM_URL, params=params)
        fuelhh_records.extend(data)
        print(
            f"  FUELHH chunk {params['settlementDateFrom']} -> {params['settlementDateTo']}: {len(data)} rows"
        )
        cur_date = chunk_end + timedelta(days=1)

    # 2. Fetch WINDFOR for publishDateTime 2025-12-29T00:00Z..2026-02-02T00:00Z
    windfor_records: list[dict[str, Any]] = []
    cur_dt = datetime(2025, 12, 29, 0, 0, 0, tzinfo=UTC)
    end_dt = datetime(2026, 2, 2, 0, 0, 0, tzinfo=UTC)

    print(
        f"\nFetching WINDFOR: {cur_dt.isoformat()} to {end_dt.isoformat()} (7-day chunks)..."
    )
    while cur_dt < end_dt:
        chunk_end_dt = min(cur_dt + timedelta(days=7), end_dt)
        params = {
            "publishDateTimeFrom": cur_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "publishDateTimeTo": chunk_end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        data = fetch_with_retry(client, WINDFOR_STREAM_URL, params=params)
        windfor_records.extend(data)
        print(
            f"  WINDFOR chunk {params['publishDateTimeFrom']} -> {params['publishDateTimeTo']}: {len(data)} rows"
        )
        cur_dt = chunk_end_dt

    # 3. Clean & Validate FUELHH Actuals
    df_actuals = pd.DataFrame(fuelhh_records)
    # Keep: startTime, settlementDate, settlementPeriod, generation as generation_mw
    df_actuals = df_actuals.rename(columns={"generation": "generation_mw"})
    df_actuals = df_actuals[
        ["startTime", "settlementDate", "settlementPeriod", "generation_mw"]
    ]

    # Validate actuals
    df_actuals["startTime_dt"] = pd.to_datetime(df_actuals["startTime"], utc=True)
    df_actuals = df_actuals.sort_values("startTime_dt").reset_index(drop=True)

    assert len(df_actuals) == 1488, (
        f"Expected 1488 actual rows, found {len(df_actuals)}"
    )
    assert not df_actuals.duplicated(subset=["startTime"]).any(), (
        "Found duplicate startTimes in actuals"
    )

    spacing_diffs = df_actuals["startTime_dt"].diff().dropna().unique()
    assert len(spacing_diffs) == 1 and spacing_diffs[0] == pd.Timedelta(minutes=30), (
        f"Expected strictly 30-minute spacing in actuals, found {spacing_diffs}"
    )

    df_actuals_clean = df_actuals[
        ["startTime", "settlementDate", "settlementPeriod", "generation_mw"]
    ]

    # 4. Clean & Validate WINDFOR Forecasts
    df_forecasts = pd.DataFrame(windfor_records)
    df_forecasts["publishTime_dt"] = pd.to_datetime(
        df_forecasts["publishTime"], utc=True
    )
    df_forecasts["startTime_dt"] = pd.to_datetime(df_forecasts["startTime"], utc=True)

    # Deduplicate raw stream responses if any boundary overlaps
    initial_raw_count = len(df_forecasts)
    df_forecasts = df_forecasts.drop_duplicates(
        subset=["publishTime", "startTime"]
    ).reset_index(drop=True)

    # Calculate lead_hours = (startTime - publishTime) in hours
    df_forecasts["lead_hours"] = (
        (
            df_forecasts["startTime_dt"] - df_forecasts["publishTime_dt"]
        ).dt.total_seconds()
        / 3600.0
    ).round(4)

    # Drop hindcast rows (lead_hours <= 0)
    hindcast_mask = df_forecasts["lead_hours"] <= 0
    hindcast_dropped = int(hindcast_mask.sum())
    print(f"\nHindcast rows dropped (lead_hours <= 0): {hindcast_dropped}")

    df_forecasts = df_forecasts[~hindcast_mask].copy()

    # Keep only startTime in the delivery window: 2026-01-02T00:00Z to 2026-02-02T00:00Z
    window_start = pd.Timestamp("2026-01-02T00:00:00Z")
    window_end = pd.Timestamp("2026-02-02T00:00:00Z")
    window_mask = (df_forecasts["startTime_dt"] >= window_start) & (
        df_forecasts["startTime_dt"] <= window_end
    )
    df_forecasts = df_forecasts[window_mask].copy()

    # Validate forecasts
    assert not df_forecasts.duplicated(subset=["publishTime", "startTime"]).any(), (
        "Found duplicate (publishTime, startTime) pairs"
    )
    assert (df_forecasts["lead_hours"] > 0).all(), (
        "Found non-positive lead_hours in cleaned forecasts"
    )
    assert (df_forecasts["startTime_dt"].dt.minute == 0).all() and (
        df_forecasts["startTime_dt"].dt.second == 0
    ).all(), "Not all forecast startTimes are on the hour"

    df_forecasts = df_forecasts.rename(columns={"generation": "generation_mw"})
    df_forecasts = df_forecasts.sort_values(
        ["publishTime_dt", "startTime_dt"]
    ).reset_index(drop=True)
    df_forecasts_clean = df_forecasts[
        ["publishTime", "startTime", "generation_mw", "lead_hours"]
    ]

    # 5. Write CSV Files
    actuals_csv_path = SNAPSHOT_DIR / "actuals_halfhourly.csv"
    forecasts_csv_path = SNAPSHOT_DIR / "forecasts.csv"

    df_actuals_clean.to_csv(actuals_csv_path, index=False)
    df_forecasts_clean.to_csv(forecasts_csv_path, index=False)

    # 6. Compute Manifest Metadata
    actuals_sha256 = calculate_sha256(actuals_csv_path)
    forecasts_sha256 = calculate_sha256(forecasts_csv_path)

    distinct_clock_times = sorted(
        df_forecasts["publishTime_dt"].dt.strftime("%H:%M").unique().tolist()
    )

    manifest_data = {
        "source_endpoint_urls": {
            "actuals": FUELHH_STREAM_URL,
            "forecasts": WINDFOR_STREAM_URL,
        },
        "query_parameters": {
            "actuals": {
                "settlementDateFrom": "2026-01-02",
                "settlementDateTo": "2026-02-01",
                "fuelType": "WIND",
                "chunk_size_days": 7,
            },
            "forecasts": {
                "publishDateTimeFrom": "2025-12-29T00:00:00Z",
                "publishDateTimeTo": "2026-02-02T00:00:00Z",
                "chunk_size_days": 7,
            },
        },
        "fetched_at_utc": fetched_at,
        "row_counts": {
            "actuals_halfhourly": len(df_actuals_clean),
            "forecasts": len(df_forecasts_clean),
            "raw_forecasts_before_hindcast_drop": initial_raw_count,
            "hindcast_rows_dropped": hindcast_dropped,
        },
        "time_ranges": {
            "actuals": {
                "min_startTime": df_actuals_clean["startTime"].min(),
                "max_startTime": df_actuals_clean["startTime"].max(),
            },
            "forecasts": {
                "min_startTime": df_forecasts_clean["startTime"].min(),
                "max_startTime": df_forecasts_clean["startTime"].max(),
                "min_publishTime": df_forecasts_clean["publishTime"].min(),
                "max_publishTime": df_forecasts_clean["publishTime"].max(),
            },
        },
        "distinct_publish_clock_times_utc": distinct_clock_times,
        "sha256": {
            "actuals_halfhourly.csv": actuals_sha256,
            "forecasts.csv": forecasts_sha256,
        },
    }

    manifest_path = SNAPSHOT_DIR / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    # 7. Print Concise Summary
    print("\n" + "=" * 70)
    print("INGESTION SUMMARY")
    print("=" * 70)
    print(
        f"Actuals rows saved     : {len(df_actuals_clean):,} -> {actuals_csv_path.name}"
    )
    print(
        f"Forecast rows saved    : {len(df_forecasts_clean):,} -> {forecasts_csv_path.name}"
    )
    print(f"Hindcast rows dropped  : {hindcast_dropped:,}")
    print(f"Distinct publish clocks: {distinct_clock_times}")
    print(f"Actuals SHA-256        : {actuals_sha256}")
    print(f"Forecasts SHA-256      : {forecasts_sha256}")
    print(f"Manifest written to    : {manifest_path.name}")
    print("=" * 70)


if __name__ == "__main__":
    ingest_data()
