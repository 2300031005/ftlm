"""Data loading and integrity verification."""

import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd

from backend.app.config import ACTUALS_CSV, FORECASTS_CSV, MANIFEST_JSON


def calculate_sha256(file_path: Path) -> str:
    """Calculate the SHA-256 hash of a file on disk."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class DataStore:
    """Singleton-style cache for verified snapshot data."""

    def __init__(self) -> None:
        self.actuals: pd.DataFrame | None = None
        self.forecasts: pd.DataFrame | None = None
        self.manifest: dict[str, Any] | None = None

    def load(
        self,
        actuals_path: Path = ACTUALS_CSV,
        forecasts_path: Path = FORECASTS_CSV,
        manifest_path: Path = MANIFEST_JSON,
    ) -> None:
        """Verify snapshot checksums against manifest and load CSVs into memory."""
        if not manifest_path.exists():
            raise FileNotFoundError(f"Manifest file not found: {manifest_path}")
        if not actuals_path.exists():
            raise FileNotFoundError(f"Actuals CSV not found: {actuals_path}")
        if not forecasts_path.exists():
            raise FileNotFoundError(f"Forecasts CSV not found: {forecasts_path}")

        with open(manifest_path, encoding="utf-8") as f:
            manifest_data = json.load(f)

        expected_actuals_hash = manifest_data.get("sha256", {}).get(
            "actuals_halfhourly.csv"
        )
        expected_forecasts_hash = manifest_data.get("sha256", {}).get("forecasts.csv")

        actual_actuals_hash = calculate_sha256(actuals_path)
        actual_forecasts_hash = calculate_sha256(forecasts_path)

        if expected_actuals_hash != actual_actuals_hash:
            raise RuntimeError(
                f"Actuals CSV hash mismatch! Expected {expected_actuals_hash}, got {actual_actuals_hash}"
            )
        if expected_forecasts_hash != actual_forecasts_hash:
            raise RuntimeError(
                f"Forecasts CSV hash mismatch! Expected {expected_forecasts_hash}, got {actual_forecasts_hash}"
            )

        df_act = pd.read_csv(actuals_path)
        df_act["startTime_dt"] = pd.to_datetime(df_act["startTime"], utc=True)
        df_act["generation_mw"] = df_act["generation_mw"].astype(float)

        df_fc = pd.read_csv(forecasts_path)
        df_fc["publishTime_dt"] = pd.to_datetime(df_fc["publishTime"], utc=True)
        df_fc["startTime_dt"] = pd.to_datetime(df_fc["startTime"], utc=True)
        df_fc["generation_mw"] = df_fc["generation_mw"].astype(float)
        df_fc["lead_hours"] = df_fc["lead_hours"].astype(float)
        df_fc = df_fc.sort_values("publishTime_dt").reset_index(drop=True)

        self.actuals = df_act
        self.forecasts = df_fc
        self.manifest = manifest_data

    def get_actuals(self) -> pd.DataFrame:
        """Return verified actuals DataFrame."""
        if self.actuals is None:
            self.load()
        assert self.actuals is not None
        return self.actuals

    def get_forecasts(self) -> pd.DataFrame:
        """Return verified forecasts DataFrame."""
        if self.forecasts is None:
            self.load()
        assert self.forecasts is not None
        return self.forecasts

    def get_manifest(self) -> dict[str, Any]:
        """Return manifest metadata dictionary."""
        if self.manifest is None:
            self.load()
        assert self.manifest is not None
        return self.manifest


store = DataStore()
