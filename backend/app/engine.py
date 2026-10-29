"""Pure analysis engine for wind day-ahead forecast selection and accuracy evaluation."""

from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from backend.app.config import PRESET_LOOKUP, TIMEZONE

UTC = ZoneInfo("UTC")


def parse_cutoff_str(cutoff_str: str) -> str:
    """Normalize cutoff preset or HH:MM string to validated HH:MM string."""
    norm = cutoff_str.strip().lower()
    if norm in PRESET_LOOKUP:
        return PRESET_LOOKUP[norm]

    # Validate HH:MM
    parts = cutoff_str.strip().split(":")
    if len(parts) != 2:
        raise ValueError(
            f"Invalid cutoff format '{cutoff_str}'. Expected HH:MM or preset ID."
        )
    try:
        h, m = int(parts[0]), int(parts[1])
    except ValueError as exc:
        raise ValueError(
            f"Invalid cutoff time '{cutoff_str}': hours and minutes must be integers."
        ) from exc

    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError(
            f"Invalid cutoff time '{cutoff_str}': hour must be 0-23, minute 0-59."
        )

    return f"{h:02d}:{m:02d}"


def cutoff_utc(delivery_date: date, hhmm: str) -> datetime:
    """Calculate the decision cutoff in UTC: (delivery_date - 1 day) at hhmm London time."""
    norm_hhmm = parse_cutoff_str(hhmm)
    hour, minute = map(int, norm_hhmm.split(":"))
    decision_date = delivery_date - timedelta(days=1)
    local_dt = datetime.combine(decision_date, time(hour, minute), tzinfo=TIMEZONE)
    return local_dt.astimezone(UTC)


def hourly_actuals(actuals: pd.DataFrame) -> pd.DataFrame:
    """Aggregate half-hourly actuals to hourly means, requiring both :00 and :30 half-hours."""
    df = actuals.copy()
    if "startTime_dt" not in df.columns:
        df["startTime_dt"] = pd.to_datetime(df["startTime"], utc=True)
    if "generation_mw" not in df.columns:
        df["generation_mw"] = df["generation"].astype(float)

    df["hour_start"] = df["startTime_dt"].dt.floor("1h")

    # Group by hourly slot and enforce that both half-hours are present and valid
    grouped = df.groupby("hour_start")["generation_mw"]
    hourly_mean = grouped.mean()
    hourly_count = grouped.count()

    # If count is not 2, value is NaN
    valid_mask = hourly_count == 2
    result_series = hourly_mean.where(valid_mask, np.nan)

    res_df = result_series.reset_index().rename(
        columns={"hour_start": "start_time", "generation_mw": "actual_mw"}
    )
    return res_df


def select_forecasts(
    forecasts: pd.DataFrame, delivery_date: date, cutoff: datetime
) -> pd.DataFrame:
    """Select the latest forecast strictly before cutoff for each hour of delivery day."""
    df = forecasts
    if "startTime_dt" not in df.columns:
        df = df.copy()
        df["startTime_dt"] = pd.to_datetime(df["startTime"], utc=True)
    if "publishTime_dt" not in df.columns:
        if df is forecasts:
            df = df.copy()
        df["publishTime_dt"] = pd.to_datetime(df["publishTime"], utc=True)

    slot_dts = [
        datetime(
            delivery_date.year, delivery_date.month, delivery_date.day, h, 0, tzinfo=UTC
        )
        for h in range(24)
    ]
    grid_df = pd.DataFrame({"start_time": slot_dts})

    candidates = df[
        (df["startTime_dt"].isin(slot_dts)) & (df["publishTime_dt"] < cutoff)
    ]

    if not candidates.empty:
        best = (
            candidates.sort_values("publishTime_dt")
            .drop_duplicates(subset=["startTime_dt"], keep="last")
            .copy()
        )
        best = best.rename(
            columns={
                "startTime_dt": "start_time",
                "publishTime_dt": "publish_time",
                "generation_mw": "forecast_mw",
            }
        )
        best["forecast_mw"] = best["forecast_mw"].astype(float)
        best["lead_hours"] = best["lead_hours"].astype(float)
        best["missing"] = False
        res = pd.merge(
            grid_df,
            best[
                ["start_time", "publish_time", "forecast_mw", "lead_hours", "missing"]
            ],
            on="start_time",
            how="left",
        )
    else:
        res = grid_df.copy()
        res["publish_time"] = pd.NaT
        res["forecast_mw"] = np.nan
        res["lead_hours"] = np.nan
        res["missing"] = True

    res["missing"] = res["missing"].fillna(True).astype(bool)
    return res[["start_time", "publish_time", "forecast_mw", "lead_hours", "missing"]]


def naive_forecasts(forecasts: pd.DataFrame, delivery_date: date) -> pd.DataFrame:
    """Select the latest available forecast overall per hour (leaky baseline, ignoring cutoff)."""
    df = forecasts
    if "startTime_dt" not in df.columns:
        df = df.copy()
        df["startTime_dt"] = pd.to_datetime(df["startTime"], utc=True)
    if "publishTime_dt" not in df.columns:
        if df is forecasts:
            df = df.copy()
        df["publishTime_dt"] = pd.to_datetime(df["publishTime"], utc=True)

    slot_dts = [
        datetime(
            delivery_date.year, delivery_date.month, delivery_date.day, h, 0, tzinfo=UTC
        )
        for h in range(24)
    ]
    grid_df = pd.DataFrame({"start_time": slot_dts})

    candidates = df[df["startTime_dt"].isin(slot_dts)]

    if not candidates.empty:
        best = (
            candidates.sort_values("publishTime_dt")
            .drop_duplicates(subset=["startTime_dt"], keep="last")
            .copy()
        )
        best = best.rename(
            columns={
                "startTime_dt": "start_time",
                "publishTime_dt": "publish_time",
                "generation_mw": "forecast_mw",
            }
        )
        best["forecast_mw"] = best["forecast_mw"].astype(float)
        best["lead_hours"] = best["lead_hours"].astype(float)
        best["missing"] = False
        res = pd.merge(
            grid_df,
            best[
                ["start_time", "publish_time", "forecast_mw", "lead_hours", "missing"]
            ],
            on="start_time",
            how="left",
        )
    else:
        res = grid_df.copy()
        res["publish_time"] = pd.NaT
        res["forecast_mw"] = np.nan
        res["lead_hours"] = np.nan
        res["missing"] = True

    res["missing"] = res["missing"].fillna(True).astype(bool)
    return res[["start_time", "publish_time", "forecast_mw", "lead_hours", "missing"]]


def build_evaluation(
    delivery_dates: list[date],
    cutoff_hhmm: str,
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    mode: str = "decision",
) -> pd.DataFrame:
    """Evaluate forecasts vs actuals for multiple delivery dates under decision or naive mode."""
    if "start_time" in actuals.columns and "actual_mw" in actuals.columns:
        df_act_hourly = actuals
    else:
        df_act_hourly = hourly_actuals(actuals)

    all_slots = [
        datetime(d.year, d.month, d.day, h, 0, tzinfo=UTC)
        for d in delivery_dates
        for h in range(24)
    ]
    grid_df = pd.DataFrame(
        {
            "start_time": all_slots,
            "delivery_date": [s.date() for s in all_slots],
        }
    )

    df_fc = forecasts
    if "startTime_dt" not in df_fc.columns:
        df_fc = df_fc.copy()
        df_fc["startTime_dt"] = pd.to_datetime(df_fc["startTime"], utc=True)
    if "publishTime_dt" not in df_fc.columns:
        if df_fc is forecasts:
            df_fc = df_fc.copy()
        df_fc["publishTime_dt"] = pd.to_datetime(df_fc["publishTime"], utc=True)

    candidates = df_fc[df_fc["startTime_dt"].isin(all_slots)]

    if mode == "decision":
        cutoff_map = {d: cutoff_utc(d, cutoff_hhmm) for d in delivery_dates}
        slot_dates = candidates["startTime_dt"].dt.date
        cutoffs_series = slot_dates.map(cutoff_map)
        eligible = candidates[candidates["publishTime_dt"] < cutoffs_series]
    elif mode == "naive":
        eligible = candidates
    else:
        raise ValueError(f"Unknown mode '{mode}'. Expected 'decision' or 'naive'.")

    if not eligible.empty:
        best = (
            eligible.sort_values("publishTime_dt")
            .drop_duplicates(subset=["startTime_dt"], keep="last")
            .copy()
        )
        best = best.rename(
            columns={
                "startTime_dt": "start_time",
                "publishTime_dt": "publish_time",
                "generation_mw": "forecast_mw",
            }
        )
        best["forecast_mw"] = best["forecast_mw"].astype(float)
        best["lead_hours"] = best["lead_hours"].astype(float)
        best["missing"] = False
        cols_to_merge = [
            "start_time",
            "publish_time",
            "forecast_mw",
            "lead_hours",
            "missing",
        ]
        merged_fc = pd.merge(grid_df, best[cols_to_merge], on="start_time", how="left")
    else:
        merged_fc = grid_df.copy()
        merged_fc["publish_time"] = pd.NaT
        merged_fc["forecast_mw"] = np.nan
        merged_fc["lead_hours"] = np.nan
        merged_fc["missing"] = True

    merged_fc["missing"] = merged_fc["missing"].fillna(True).astype(bool)

    merged = pd.merge(merged_fc, df_act_hourly, on="start_time", how="left")

    merged["hour_utc"] = merged["start_time"].dt.hour
    merged["error_mw"] = merged["actual_mw"] - merged["forecast_mw"]
    merged["ratio"] = np.where(
        (merged["forecast_mw"].notnull()) & (merged["forecast_mw"] > 0),
        merged["actual_mw"] / merged["forecast_mw"],
        np.nan,
    )

    cols = [
        "delivery_date",
        "start_time",
        "hour_utc",
        "publish_time",
        "lead_hours",
        "forecast_mw",
        "actual_mw",
        "error_mw",
        "ratio",
        "missing",
    ]
    return merged[cols]


def metrics(eval_df: pd.DataFrame) -> dict[str, Any]:
    """Calculate accuracy metrics, bias, dispersion, and error percentiles."""
    valid_mask = (
        (~eval_df["missing"])
        & eval_df["actual_mw"].notnull()
        & eval_df["forecast_mw"].notnull()
    )
    valid_df = eval_df[valid_mask]

    n = len(valid_df)
    n_missing = int(len(eval_df) - n)

    if n == 0:
        return {
            "n": 0,
            "n_missing": n_missing,
            "mean_actual": None,
            "mean_forecast": None,
            "bias": None,
            "mae": None,
            "rmse": None,
            "error_std": None,
            "mae_pct_of_mean_actual": None,
            "error_percentiles": {},
            "ratio_percentiles": {},
            "bias_share_of_mse": None,
        }

    actuals = valid_df["actual_mw"]
    forecasts = valid_df["forecast_mw"]
    errors = valid_df["error_mw"]

    mean_act = float(actuals.mean())
    mean_fc = float(forecasts.mean())
    bias_val = float(errors.mean())
    mae_val = float(errors.abs().mean())
    mse_val = float((errors**2).mean())
    rmse_val = float(np.sqrt(mse_val))
    std_val = float(errors.std(ddof=1)) if n > 1 else 0.0
    mae_pct = (mae_val / mean_act * 100.0) if mean_act != 0 else 0.0

    # Percentiles using pandas default linear interpolation (matches diagnostics.py)
    err_p = {
        "p05": round(float(errors.quantile(0.05)), 2),
        "p10": round(float(errors.quantile(0.10)), 2),
        "p25": round(float(errors.quantile(0.25)), 2),
        "p50": round(float(errors.quantile(0.50)), 2),
        "p75": round(float(errors.quantile(0.75)), 2),
        "p90": round(float(errors.quantile(0.90)), 2),
        "p95": round(float(errors.quantile(0.95)), 2),
    }

    valid_ratios = valid_df["ratio"].dropna()
    ratio_p = {
        "p10": round(float(valid_ratios.quantile(0.10)), 4)
        if not valid_ratios.empty
        else None,
        "p50": round(float(valid_ratios.quantile(0.50)), 4)
        if not valid_ratios.empty
        else None,
        "p90": round(float(valid_ratios.quantile(0.90)), 4)
        if not valid_ratios.empty
        else None,
    }

    bias_share = float((bias_val**2) / mse_val) if mse_val > 0 else 0.0

    return {
        "n": n,
        "n_missing": n_missing,
        "mean_actual": round(mean_act, 2),
        "mean_forecast": round(mean_fc, 2),
        "bias": round(bias_val, 2),
        "mae": round(mae_val, 2),
        "rmse": round(rmse_val, 2),
        "error_std": round(std_val, 2),
        "mae_pct_of_mean_actual": round(mae_pct, 2),
        "error_percentiles": err_p,
        "ratio_percentiles": ratio_p,
        "bias_share_of_mse": round(bias_share, 4),
    }


def by_hour(eval_df: pd.DataFrame) -> list[dict[str, Any]]:
    """Aggregate forecast performance by hour of day (0-23 UTC)."""
    valid = eval_df[
        (~eval_df["missing"])
        & eval_df["actual_mw"].notnull()
        & eval_df["forecast_mw"].notnull()
    ]
    rows: list[dict[str, Any]] = []
    for h in range(24):
        sub = valid[valid["hour_utc"] == h]
        if not sub.empty:
            act = sub["actual_mw"]
            fc = sub["forecast_mw"]
            err = sub["error_mw"]
            rows.append(
                {
                    "hour_utc": h,
                    "mean_actual": round(float(act.mean()), 2),
                    "mean_forecast": round(float(fc.mean()), 2),
                    "bias": round(float(err.mean()), 2),
                    "mae": round(float(err.abs().mean()), 2),
                    "rmse": round(float(np.sqrt((err**2).mean())), 2),
                }
            )
        else:
            rows.append(
                {
                    "hour_utc": h,
                    "mean_actual": None,
                    "mean_forecast": None,
                    "bias": None,
                    "mae": None,
                    "rmse": None,
                }
            )
    return rows


def by_day(eval_df: pd.DataFrame) -> list[dict[str, Any]]:
    """Aggregate forecast performance per delivery date."""
    valid = eval_df[
        (~eval_df["missing"])
        & eval_df["actual_mw"].notnull()
        & eval_df["forecast_mw"].notnull()
    ]
    rows: list[dict[str, Any]] = []
    for d, sub in valid.groupby("delivery_date"):
        act = sub["actual_mw"]
        fc = sub["forecast_mw"]
        err = sub["error_mw"]
        rows.append(
            {
                "delivery_date": str(d),
                "mean_actual": round(float(act.mean()), 2),
                "mean_forecast": round(float(fc.mean()), 2),
                "bias": round(float(err.mean()), 2),
                "mae": round(float(err.abs().mean()), 2),
            }
        )
    return rows


def by_forecast_level(eval_df: pd.DataFrame, n_bins: int = 5) -> list[dict[str, Any]]:
    """Segment evaluation into quantile bins of forecasted generation."""
    valid = eval_df[
        (~eval_df["missing"])
        & eval_df["actual_mw"].notnull()
        & eval_df["forecast_mw"].notnull()
    ].copy()

    if valid.empty:
        return []

    valid["bin"] = pd.qcut(valid["forecast_mw"], q=n_bins, duplicates="drop")
    rows: list[dict[str, Any]] = []

    for idx, (b, sub) in enumerate(valid.groupby("bin", observed=False)):
        fc = sub["forecast_mw"]
        act = sub["actual_mw"]
        err = sub["error_mw"]
        mean_f = float(fc.mean())
        mean_a = float(act.mean())
        ratio_val = (mean_a / mean_f) if mean_f > 0 else 0.0

        rows.append(
            {
                "bin_index": idx + 1,
                "bin_range": f"{float(b.left):,.0f} - {float(b.right):,.0f} MW",
                "mean_forecast": round(mean_f, 2),
                "mean_actual": round(mean_a, 2),
                "mean_error": round(float(err.mean()), 2),
                "ratio": round(ratio_val, 4),
            }
        )
    return rows


def cutoff_comparison(
    delivery_dates: list[date],
    presets: list[dict[str, str]],
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    eval_dfs: dict[str, pd.DataFrame] | None = None,
) -> list[dict[str, Any]]:
    """Compare performance across decision cutoff presets."""
    results: list[dict[str, Any]] = []
    for p in presets:
        c_str = p["time_london"]
        if eval_dfs is not None and c_str in eval_dfs:
            eval_df = eval_dfs[c_str]
        else:
            eval_df = build_evaluation(
                delivery_dates, c_str, forecasts, actuals, mode="decision"
            )
        m = metrics(eval_df)

        pub_times = eval_df["publish_time"].dropna().dt.strftime("%H:%M")
        if not pub_times.empty:
            mode_clock = str(pub_times.mode().iloc[0])
            mode_count = int((pub_times == mode_clock).sum())
            typical = f"{mode_clock} UTC ({mode_count}/{len(eval_df)})"
        else:
            typical = "N/A"

        results.append(
            {
                "preset_id": p.get("id", c_str),
                "cutoff": c_str,
                "typical_publish_run": typical,
                "n": m["n"],
                "bias": m["bias"],
                "mae": m["mae"],
                "rmse": m["rmse"],
                "mae_pct": m["mae_pct_of_mean_actual"],
            }
        )
    return results


def calibration(
    delivery_date: date,
    cutoff_hhmm: str,
    all_delivery_dates: list[date],
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    eval_df: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """Calculate leave-one-day-out ratio percentiles on all other delivery days."""
    other_days = [d for d in all_delivery_dates if d != delivery_date]
    if eval_df is not None:
        eval_other = eval_df[eval_df["delivery_date"].isin(other_days)]
    else:
        eval_other = build_evaluation(
            other_days, cutoff_hhmm, forecasts, actuals, mode="decision"
        )

    valid = eval_other[
        (~eval_other["missing"])
        & eval_other["actual_mw"].notnull()
        & eval_other["forecast_mw"].notnull()
    ]
    ratios = valid["ratio"].dropna()

    p10 = float(ratios.quantile(0.10)) if not ratios.empty else 1.0
    p50 = float(ratios.quantile(0.50)) if not ratios.empty else 1.0
    p90 = float(ratios.quantile(0.90)) if not ratios.empty else 1.0

    return {
        "method": "leave_one_day_out_ratio",
        "days_used": len(other_days),
        "n_points": len(ratios),
        "ratio_p10": round(p10, 4),
        "ratio_p50": round(p50, 4),
        "ratio_p90": round(p90, 4),
        "note": "Ratio percentiles (p10, p50, p90) computed on all other days in the evaluation window.",
    }


def band_backtest(eval_df: pd.DataFrame) -> dict[str, Any]:
    """Perform leave-one-day-out ratio band calibration and backtest hourly points."""
    valid_mask = (
        (~eval_df["missing"])
        & eval_df["actual_mw"].notnull()
        & eval_df["forecast_mw"].notnull()
    )
    valid_df = eval_df[valid_mask]

    unique_days = sorted(valid_df["delivery_date"].unique())
    n_days = len(unique_days)

    if n_days < 2:
        return {
            "method": "leave_one_day_out",
            "n_hours": len(valid_df),
            "share_below_firm": 0.0,
            "share_within_band": 0.0,
            "share_above_upside": 0.0,
            "nominal": {"below": 0.10, "within": 0.80, "above": 0.10},
            "n_days": n_days,
            "days_avg_actual_below_avg_firm": 0,
            "note": (
                "Hourly shares near nominal mean the band is calibrated per hour. "
                "Errors are correlated within a day (one weather system), so whole days can still miss."
            ),
        }

    day_groups = {}
    for d, sub in valid_df.groupby("delivery_date"):
        day_groups[d] = {
            "act": sub["actual_mw"].to_numpy(dtype=float),
            "fc": sub["forecast_mw"].to_numpy(dtype=float),
            "ratios": sub["ratio"].dropna().to_numpy(dtype=float),
        }

    total_hours = 0
    total_below = 0
    total_within = 0
    total_above = 0
    days_below_firm = 0

    for d in unique_days:
        test_data = day_groups[d]
        train_ratios = np.concatenate(
            [day_groups[other]["ratios"] for other in unique_days if other != d]
        )
        if len(train_ratios) > 0:
            p10 = float(np.percentile(train_ratios, 10, method="linear"))
            p90 = float(np.percentile(train_ratios, 90, method="linear"))
        else:
            p10, p90 = 1.0, 1.0

        act_s = test_data["act"]
        fc_s = test_data["fc"]
        if len(act_s) == 0:
            continue

        firm = fc_s * p10
        upside = fc_s * p90

        b = int((act_s < firm).sum())
        a = int((act_s > upside).sum())
        w = int(((act_s >= firm) & (act_s <= upside)).sum())

        total_hours += len(act_s)
        total_below += b
        total_above += a
        total_within += w

        if float(act_s.mean()) < float(firm.mean()):
            days_below_firm += 1

    if total_hours > 0:
        share_below = round(total_below / total_hours, 4)
        share_above = round(total_above / total_hours, 4)
        share_within = round(1.0 - share_below - share_above, 4)
    else:
        share_below = 0.0
        share_within = 0.0
        share_above = 0.0

    return {
        "method": "leave_one_day_out",
        "n_hours": total_hours,
        "share_below_firm": share_below,
        "share_within_band": share_within,
        "share_above_upside": share_above,
        "nominal": {"below": 0.10, "within": 0.80, "above": 0.10},
        "n_days": n_days,
        "days_avg_actual_below_avg_firm": days_below_firm,
        "note": (
            "Hourly shares near nominal mean the band is calibrated per hour. "
            "Errors are correlated within a day (one weather system), so whole days can still miss."
        ),
    }


def drift(
    delivery_date: date,
    cutoff_hhmm: str,
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
) -> dict[str, Any]:
    """Extract forecast drift across publication runs covering the delivery day."""
    df_fc = forecasts
    if "startTime_dt" not in df_fc.columns:
        df_fc = df_fc.copy()
        df_fc["startTime_dt"] = pd.to_datetime(df_fc["startTime"], utc=True)
    if "publishTime_dt" not in df_fc.columns:
        if df_fc is forecasts:
            df_fc = df_fc.copy()
        df_fc["publishTime_dt"] = pd.to_datetime(df_fc["publishTime"], utc=True)

    if "start_time" in actuals.columns and "actual_mw" in actuals.columns:
        df_act_hourly = actuals
    else:
        df_act_hourly = hourly_actuals(actuals)

    c_utc = cutoff_utc(delivery_date, cutoff_hhmm)

    slot_dts = [
        datetime(
            delivery_date.year, delivery_date.month, delivery_date.day, h, 0, tzinfo=UTC
        )
        for h in range(24)
    ]

    # Find all publish runs having at least one slot on this day
    day_fc = df_fc[df_fc["startTime_dt"].isin(slot_dts)]
    unique_pubs = sorted(day_fc["publishTime_dt"].unique())

    # Find the selected run at cutoff
    before_cutoff_pubs = [p for p in unique_pubs if p < c_utc]
    selected_pub = max(before_cutoff_pubs) if before_cutoff_pubs else None

    runs_data: list[dict[str, Any]] = []
    for pub in unique_pubs:
        sub = day_fc[day_fc["publishTime_dt"] == pub]
        slot_map = dict(zip(sub["startTime_dt"], sub["generation_mw"], strict=False))
        vals = [
            round(float(slot_map[s]), 2)
            if s in slot_map and pd.notnull(slot_map[s])
            else None
            for s in slot_dts
        ]
        runs_data.append(
            {
                "publish_time": pub.isoformat().replace("+00:00", "Z"),
                "selected": bool(pub == selected_pub),
                "before_cutoff": bool(pub < c_utc),
                "values": vals,
            }
        )

    # Hourly actuals
    act_map = dict(
        zip(df_act_hourly["start_time"], df_act_hourly["actual_mw"], strict=False)
    )
    actual_vals = [
        round(float(act_map[s]), 2) if s in act_map and pd.notnull(act_map[s]) else None
        for s in slot_dts
    ]

    return {
        "delivery_date": str(delivery_date),
        "cutoff": cutoff_hhmm,
        "selected_publish_time": selected_pub.isoformat().replace("+00:00", "Z")
        if selected_pub
        else None,
        "runs": runs_data,
        "actual": actual_vals,
    }
