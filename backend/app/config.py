"""Application configuration and constants."""

import os
from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = Path(os.environ.get("DATA_DIR", REPO_ROOT / "data" / "snapshot"))

ACTUALS_CSV = DATA_DIR / "actuals_halfhourly.csv"
FORECASTS_CSV = DATA_DIR / "forecasts.csv"
MANIFEST_JSON = DATA_DIR / "manifest.json"

TIMEZONE_STR = "Europe/London"
TIMEZONE = ZoneInfo(TIMEZONE_STR)

FIRST_DELIVERY_DATE = date(2026, 1, 2)
LAST_DELIVERY_DATE = date(2026, 2, 1)
N_DELIVERY_DAYS = (LAST_DELIVERY_DATE - FIRST_DELIVERY_DATE).days + 1  # 31 days

DEFAULT_CUTOFF = "09:20"

CUTOFF_PRESETS = [
    {
        "id": "epex-0920",
        "label": "EPEX Day-Ahead (09:20)",
        "time_london": "09:20",
    },
    {
        "id": "n2ex-0950",
        "label": "N2EX Day-Ahead (09:50)",
        "time_london": "09:50",
    },
    {
        "id": "epex-hh-1530",
        "label": "EPEX Half-Hourly (15:30)",
        "time_london": "15:30",
    },
]

PRESET_LOOKUP = {preset["id"]: preset["time_london"] for preset in CUTOFF_PRESETS}

CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
