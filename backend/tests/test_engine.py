"""Unit and integration tests for analysis engine functions and golden diagnostics benchmarks."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import pytest

from backend.app import engine
from backend.app.config import CUTOFF_PRESETS, FIRST_DELIVERY_DATE, N_DELIVERY_DAYS
from backend.app.data import store

UTC = ZoneInfo("UTC")


# =====================================================================
# Synthetic Fixture Tests (a - e)
# =====================================================================


def test_forecast_exact_cutoff_not_selected():
    """a. Assert a forecast with publish_time exactly equal to cutoff is NOT selected."""
    delivery_date = date(2026, 1, 7)
    cutoff = datetime(2026, 1, 6, 9, 20, tzinfo=UTC)
    slot = datetime(2026, 1, 7, 12, 0, tzinfo=UTC)

    # Candidate 1: 07:30 (strictly before)
    # Candidate 2: 09:20 (exactly equal to cutoff)
    # Candidate 3: 09:30 (after cutoff)
    synthetic_fc = pd.DataFrame(
        [
            {
                "startTime_dt": slot,
                "publishTime_dt": datetime(2026, 1, 6, 7, 30, tzinfo=UTC),
                "generation_mw": 1000.0,
                "lead_hours": 28.5,
            },
            {
                "startTime_dt": slot,
                "publishTime_dt": cutoff,  # Exactly equal
                "generation_mw": 9999.0,
                "lead_hours": 26.67,
            },
            {
                "startTime_dt": slot,
                "publishTime_dt": datetime(2026, 1, 6, 9, 30, tzinfo=UTC),
                "generation_mw": 2000.0,
                "lead_hours": 26.5,
            },
        ]
    )

    res = engine.select_forecasts(synthetic_fc, delivery_date, cutoff)
    slot_res = res[res["start_time"] == slot].iloc[0]

    assert not slot_res["missing"]
    assert slot_res["publish_time"] == datetime(2026, 1, 6, 7, 30, tzinfo=UTC)
    assert slot_res["forecast_mw"] == 1000.0


def test_no_fallback_to_later_run_and_missing_flag():
    """b. Assert no fallback to a later run; missing hours are flagged."""
    delivery_date = date(2026, 1, 7)
    cutoff = datetime(2026, 1, 6, 9, 20, tzinfo=UTC)
    slot = datetime(2026, 1, 7, 15, 0, tzinfo=UTC)

    # Only a post-cutoff run exists for this slot
    synthetic_fc = pd.DataFrame(
        [
            {
                "startTime_dt": slot,
                "publishTime_dt": datetime(2026, 1, 6, 11, 30, tzinfo=UTC),
                "generation_mw": 1500.0,
                "lead_hours": 27.5,
            }
        ]
    )

    res = engine.select_forecasts(synthetic_fc, delivery_date, cutoff)
    slot_res = res[res["start_time"] == slot].iloc[0]

    assert bool(slot_res["missing"]) is True
    assert pd.isna(slot_res["forecast_mw"])
    assert pd.isna(slot_res["publish_time"])


def test_cutoff_utc_winter_and_summer_dst():
    """c. Assert cutoff_utc handles winter GMT and summer BST correctly."""
    # Winter date: 2026-01-07 -> decision day 2026-01-06 @09:20 London (GMT = UTC+0)
    c_winter = engine.cutoff_utc(date(2026, 1, 7), "09:20")
    assert c_winter == datetime(2026, 1, 6, 9, 20, tzinfo=UTC)

    # Summer date: 2026-07-01 -> decision day 2026-06-30 @09:20 London (BST = UTC+1, so 08:20 UTC)
    c_summer = engine.cutoff_utc(date(2026, 7, 1), "09:20")
    assert c_summer == datetime(2026, 6, 30, 8, 20, tzinfo=UTC)


def test_hourly_actuals_averaging_and_missing():
    """d. Assert hourly_actuals averages correctly and returns NaN if either half-hour is missing."""
    h1 = datetime(2026, 1, 5, 10, 0, tzinfo=UTC)
    h1_half = datetime(2026, 1, 5, 10, 30, tzinfo=UTC)
    h2 = datetime(2026, 1, 5, 11, 0, tzinfo=UTC)
    # Note: 11:30 is missing!

    df_actuals = pd.DataFrame(
        [
            {"startTime_dt": h1, "generation_mw": 100.0},
            {"startTime_dt": h1_half, "generation_mw": 200.0},
            {"startTime_dt": h2, "generation_mw": 300.0},
        ]
    )

    res = engine.hourly_actuals(df_actuals).set_index("start_time")

    # Hour 10:00 has both 10:00 and 10:30 -> mean is 150.0
    assert res.loc[h1, "actual_mw"] == 150.0

    # Hour 11:00 has only 11:00 -> NaN
    assert pd.isna(res.loc[h2, "actual_mw"])


def test_metrics_hand_computed_example():
    """e. Assert metrics on a tiny hand-computed example."""
    # errors: actual - forecast
    # row 1: actual=100, forecast=120 -> error = -20, ratio = 100/120 = 0.8333
    # row 2: actual=200, forecast=180 -> error = +20, ratio = 200/180 = 1.1111
    # row 3: actual=150, forecast=150 -> error =   0, ratio = 150/150 = 1.0000
    # row 4: missing
    eval_df = pd.DataFrame(
        [
            {
                "missing": False,
                "actual_mw": 100.0,
                "forecast_mw": 120.0,
                "error_mw": -20.0,
                "ratio": 100 / 120,
            },
            {
                "missing": False,
                "actual_mw": 200.0,
                "forecast_mw": 180.0,
                "error_mw": 20.0,
                "ratio": 200 / 180,
            },
            {
                "missing": False,
                "actual_mw": 150.0,
                "forecast_mw": 150.0,
                "error_mw": 0.0,
                "ratio": 150 / 150,
            },
            {
                "missing": True,
                "actual_mw": None,
                "forecast_mw": None,
                "error_mw": None,
                "ratio": None,
            },
        ]
    )

    m = engine.metrics(eval_df)
    assert m["n"] == 3
    assert m["n_missing"] == 1
    assert m["mean_actual"] == 150.0
    assert m["mean_forecast"] == 150.0
    assert m["bias"] == 0.0
    assert m["mae"] == round((20 + 20 + 0) / 3, 2)  # 13.33
    assert m["rmse"] == round(np.sqrt((400 + 400 + 0) / 3), 2)  # 16.33
    assert m["error_percentiles"]["p50"] == 0.0
    assert m["ratio_percentiles"]["p50"] == 1.0


# =====================================================================
# Real Snapshot Tests (f - i)
# =====================================================================


@pytest.fixture(scope="module")
def snapshot_data():
    """Load real verified snapshot data."""
    store.load()
    return store.get_actuals(), store.get_forecasts()


def test_property_all_selected_before_cutoff_and_lead_positive(snapshot_data):
    """f. PROPERTY: for all 31 days and all 3 presets, every selected row has publish_time < cutoff and lead_hours > 0."""
    actuals, forecasts = snapshot_data
    delivery_dates = [
        FIRST_DELIVERY_DATE + timedelta(days=i) for i in range(N_DELIVERY_DAYS)
    ]

    for preset in CUTOFF_PRESETS:
        c_hhmm = preset["time_london"]
        eval_df = engine.build_evaluation(
            delivery_dates, c_hhmm, forecasts, actuals, mode="decision"
        )

        assert len(eval_df) == 744, (
            f"Preset {c_hhmm}: expected 744 rows, got {len(eval_df)}"
        )
        assert not eval_df["missing"].any(), (
            f"Preset {c_hhmm}: unexpected missing hours"
        )

        for _, row in eval_df.iterrows():
            c_utc = engine.cutoff_utc(row["delivery_date"], c_hhmm)
            assert row["publish_time"] < c_utc, (
                f"Selected publish_time {row['publish_time']} >= cutoff {c_utc} on {row['delivery_date']}"
            )
            assert row["lead_hours"] > 0, (
                f"Non-positive lead hours {row['lead_hours']} on {row['delivery_date']}"
            )


def test_golden_accuracy_benchmarks(snapshot_data):
    """g. GOLDEN benchmark assertion matching docs/data_diagnostics.md within 0.01 MW."""
    actuals, forecasts = snapshot_data
    delivery_dates = [
        FIRST_DELIVERY_DATE + timedelta(days=i) for i in range(N_DELIVERY_DAYS)
    ]

    # 1. Primary cutoff 09:20
    eval_0920 = engine.build_evaluation(
        delivery_dates, "09:20", forecasts, actuals, mode="decision"
    )
    m_0920 = engine.metrics(eval_0920)

    assert m_0920["n"] == 744
    assert m_0920["n_missing"] == 0
    assert pytest.approx(11283.56, abs=0.01) == m_0920["mean_actual"]
    assert pytest.approx(13031.44, abs=0.01) == m_0920["mean_forecast"]
    assert pytest.approx(-1747.89, abs=0.01) == m_0920["bias"]
    assert pytest.approx(2038.91, abs=0.01) == m_0920["mae"]
    assert pytest.approx(2504.76, abs=0.01) == m_0920["rmse"]

    # 2. Cutoff comparison table
    comp = engine.cutoff_comparison(delivery_dates, CUTOFF_PRESETS, forecasts, actuals)
    comp_map = {r["cutoff"]: r for r in comp}

    # 09:50
    assert pytest.approx(2013.01, abs=0.01) == comp_map["09:50"]["mae"]
    assert pytest.approx(2505.94, abs=0.01) == comp_map["09:50"]["rmse"]
    assert "09:30 UTC (744/744)" == comp_map["09:50"]["typical_publish_run"]

    # 15:30
    assert pytest.approx(1904.01, abs=0.01) == comp_map["15:30"]["mae"]
    assert pytest.approx(2361.10, abs=0.01) == comp_map["15:30"]["rmse"]
    assert "11:30 UTC (720/744)" == comp_map["15:30"]["typical_publish_run"]


def test_extra_run_1225_selected_date(snapshot_data):
    """h. Confirm the 12:25 run is selected for some day at 15:30 cutoff and identify the date."""
    actuals, forecasts = snapshot_data
    delivery_dates = [
        FIRST_DELIVERY_DATE + timedelta(days=i) for i in range(N_DELIVERY_DAYS)
    ]

    eval_1530 = engine.build_evaluation(
        delivery_dates, "15:30", forecasts, actuals, mode="decision"
    )
    eval_1530["pub_clock"] = eval_1530["publish_time"].dt.strftime("%H:%M")

    rows_1225 = eval_1530[eval_1530["pub_clock"] == "12:25"]
    assert not rows_1225.empty, "Expected 12:25 run to be selected on at least one day"

    dates_with_1225 = sorted(rows_1225["delivery_date"].unique().tolist())
    # Confirm it is 2026-01-16
    assert dates_with_1225 == [date(2026, 1, 16)]
    assert len(rows_1225) == 24


def test_leakage_gap_reporting(snapshot_data):
    """i. Leakage: report decision-time vs naive MAE and the gap."""
    actuals, forecasts = snapshot_data
    delivery_dates = [
        FIRST_DELIVERY_DATE + timedelta(days=i) for i in range(N_DELIVERY_DAYS)
    ]

    eval_decision = engine.build_evaluation(
        delivery_dates, "09:20", forecasts, actuals, mode="decision"
    )
    eval_naive = engine.build_evaluation(
        delivery_dates, "00:00", forecasts, actuals, mode="naive"
    )

    m_dec = engine.metrics(eval_decision)
    m_nv = engine.metrics(eval_naive)

    gap = m_dec["mae"] - m_nv["mae"]
    assert gap is not None
    # We verify gap is approximately 352.14 MW without asserting direction
    assert pytest.approx(352.14, abs=0.02) == gap


def test_band_backtest_synthetic():
    """Test band_backtest on a tiny synthetic hand-computed 3-day dataset."""
    # 3 delivery days with 1 hour each:
    # Day 1: actual=10, forecast=100 (ratio 0.1)
    # Day 2: actual=100, forecast=100 (ratio 1.0)
    # Day 3: actual=200, forecast=100 (ratio 2.0)
    #
    # Leave-one-day-out calibration:
    # - Day 1: Train ratios [1.0, 2.0] -> p10=1.1, p90=1.9. Firm=110, Upside=190.
    #   actual (10) < firm (110) => below_firm. Day mean actual (10) < mean firm (110) => below.
    # - Day 2: Train ratios [0.1, 2.0] -> p10=0.29, p90=1.81. Firm=29, Upside=181.
    #   actual (100) is within [29, 181] => within_band.
    # - Day 3: Train ratios [0.1, 1.0] -> p10=0.19, p90=0.91. Firm=19, Upside=91.
    #   actual (200) > upside (91) => above_upside.
    df = pd.DataFrame(
        [
            {
                "delivery_date": date(2026, 1, 2),
                "forecast_mw": 100.0,
                "actual_mw": 10.0,
                "ratio": 0.1,
                "missing": False,
            },
            {
                "delivery_date": date(2026, 1, 3),
                "forecast_mw": 100.0,
                "actual_mw": 100.0,
                "ratio": 1.0,
                "missing": False,
            },
            {
                "delivery_date": date(2026, 1, 4),
                "forecast_mw": 100.0,
                "actual_mw": 200.0,
                "ratio": 2.0,
                "missing": False,
            },
        ]
    )

    res = engine.band_backtest(df)

    assert res["method"] == "leave_one_day_out"
    assert res["n_hours"] == 3
    assert res["n_days"] == 3
    assert res["days_avg_actual_below_avg_firm"] == 1
    assert res["share_below_firm"] == 0.3333
    assert res["share_within_band"] == 0.3334
    assert res["share_above_upside"] == 0.3333
    # Verify shares sum to 1.0
    total_share = (
        res["share_below_firm"] + res["share_within_band"] + res["share_above_upside"]
    )
    assert round(total_share, 4) == 1.0
    assert res["nominal"] == {"below": 0.10, "within": 0.80, "above": 0.10}
    assert (
        res["note"]
        == "Hourly shares near nominal mean the band is calibrated per hour. Errors are correlated within a day (one weather system), so whole days can still miss."
    )


def test_band_backtest_real_snapshot(snapshot_data, capsys):
    """Test band_backtest on real snapshot data at cutoff 09:20 and report values."""
    actuals, forecasts = snapshot_data
    delivery_dates = [
        FIRST_DELIVERY_DATE + timedelta(days=i) for i in range(N_DELIVERY_DAYS)
    ]

    eval_0920 = engine.build_evaluation(
        delivery_dates, "09:20", forecasts, actuals, mode="decision"
    )
    res = engine.band_backtest(eval_0920)

    # Structural assertions
    assert res["method"] == "leave_one_day_out"
    assert res["n_hours"] == 744
    assert res["n_days"] == 31
    assert res["nominal"] == {"below": 0.10, "within": 0.80, "above": 0.10}

    # Verify shares sum to 1.0
    total_share = (
        res["share_below_firm"] + res["share_within_band"] + res["share_above_upside"]
    )
    assert round(total_share, 4) == 1.0

    # Explicit requirement: On the real snapshot at 09:20, REPORT the values, do not assert them.
    print(f"\n[REPORT] Real snapshot band_backtest at 09:20: {res}")
