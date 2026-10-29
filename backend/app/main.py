"""FastAPI application for wind purchasing decision engine."""

import logging
import time
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from functools import lru_cache

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend.app import engine
from backend.app.config import (
    CORS_ORIGINS,
    CUTOFF_PRESETS,
    DEFAULT_CUTOFF,
    FIRST_DELIVERY_DATE,
    LAST_DELIVERY_DATE,
    N_DELIVERY_DAYS,
    TIMEZONE_STR,
)
from backend.app.data import store
from backend.app.schemas import (
    AccuracyResponse,
    ActualSummary,
    BandBacktestModel,
    BriefResponse,
    BriefSummary,
    CalibrationInfo,
    CutoffInfo,
    CutoffPreset,
    DriftResponse,
    HealthResponse,
    HourlyBriefItem,
    LeakageModel,
    MetaResponse,
    MetricsModel,
    SelectedRunInfo,
    WindowInfo,
)

logger = logging.getLogger("backend.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data snapshot, verify integrity checksums, and warm evaluation tables for presets."""
    t_start = time.perf_counter()
    store.load()
    t_load = (time.perf_counter() - t_start) * 1000

    t_warm_start = time.perf_counter()
    for preset in CUTOFF_PRESETS:
        get_cached_evaluation(preset["time_london"])
    get_cached_naive_evaluation()
    t_warm = (time.perf_counter() - t_warm_start) * 1000

    logger.info(
        "Lifespan startup complete: data loaded in %.1f ms; 3 presets + naive evaluations warmed in %.1f ms",
        t_load,
        t_warm,
    )
    yield


app = FastAPI(
    title="UK Wind Day-Ahead Purchasing API",
    description="Analysis engine and decision-support API for UK day-ahead wind purchasing",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_all_delivery_dates() -> list[date]:
    """Return all 31 delivery dates in the evaluation window."""
    return [FIRST_DELIVERY_DATE + timedelta(days=i) for i in range(N_DELIVERY_DAYS)]


@lru_cache(maxsize=32)
def get_cached_evaluation(cutoff_hhmm: str) -> pd.DataFrame:
    """Cached evaluation DataFrame across the full delivery window for a specific cutoff."""
    dates = get_all_delivery_dates()
    forecasts = store.get_forecasts()
    actuals = store.get_actuals()
    return engine.build_evaluation(
        dates, cutoff_hhmm, forecasts, actuals, mode="decision"
    )


@lru_cache(maxsize=1)
def get_cached_naive_evaluation() -> pd.DataFrame:
    """Cached naive (leaky) evaluation DataFrame across the full delivery window."""
    dates = get_all_delivery_dates()
    forecasts = store.get_forecasts()
    actuals = store.get_actuals()
    return engine.build_evaluation(dates, "00:00", forecasts, actuals, mode="naive")


def validate_date(date_str: str) -> date:
    """Parse and validate that delivery date is strictly within the committed snapshot window."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid date format '{date_str}'. Expected YYYY-MM-DD.",
        ) from exc

    if d < FIRST_DELIVERY_DATE or d > LAST_DELIVERY_DATE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                f"Delivery date {d} is outside evaluation window "
                f"[{FIRST_DELIVERY_DATE} to {LAST_DELIVERY_DATE}]."
            ),
        )
    return d


def validate_cutoff(cutoff_str: str) -> str:
    """Validate and normalize cutoff parameter."""
    try:
        return engine.parse_cutoff_str(cutoff_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="ok")


@app.get("/api/meta", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    """System metadata, window bounds, cutoff presets, and dataset manifest."""
    manifest = store.get_manifest()

    assumptions = [
        "Cutoff rule strictly uses less-than (publish_time < cutoff) in Europe/London time.",
        "Hourly delivery grid on the hour (00:00 to 23:00 UTC).",
        "Retrospective hindcast points (lead_hours <= 0) were dropped at ingestion.",
        "Error sign convention is actual - forecast; negative values mean wind fell short of forecast.",
        "Expected, firm (p10), and upside (p90) bands use leave-one-day-out ratio calibration on actual / forecast.",
        "Systematic over-forecast is consistent with transmission curtailment and unmetered embedded generation, not isolated.",
    ]

    return MetaResponse(
        window=WindowInfo(
            first_delivery_date=str(FIRST_DELIVERY_DATE),
            last_delivery_date=str(LAST_DELIVERY_DATE),
            n_days=N_DELIVERY_DAYS,
        ),
        cutoff_presets=[CutoffPreset(**p) for p in CUTOFF_PRESETS],
        default_cutoff=DEFAULT_CUTOFF,
        timezone=TIMEZONE_STR,
        manifest=manifest,
        assumptions=assumptions,
    )


@app.get("/api/brief", response_model=BriefResponse)
def get_brief(
    date: str = Query(..., description="Delivery date (YYYY-MM-DD)"),
    cutoff: str = Query(
        DEFAULT_CUTOFF, description="Decision cutoff (preset ID or HH:MM)"
    ),
) -> BriefResponse:
    """Day-ahead purchasing briefing for a specific delivery date and decision cutoff."""
    d = validate_date(date)
    norm_cutoff = validate_cutoff(cutoff)

    forecasts = store.get_forecasts()
    actuals = store.get_actuals()
    all_dates = get_all_delivery_dates()

    # Decision cutoff in UTC
    c_utc = engine.cutoff_utc(d, norm_cutoff)

    # Full-window evaluation from cache
    full_eval = get_cached_evaluation(norm_cutoff)

    # Calibration on all other delivery days
    calib = engine.calibration(
        d, norm_cutoff, all_dates, forecasts, actuals, eval_df=full_eval
    )
    r_p10 = calib["ratio_p10"]
    r_p50 = calib["ratio_p50"]
    r_p90 = calib["ratio_p90"]

    # Daily evaluation sliced directly from full_eval
    daily_eval = full_eval[full_eval["delivery_date"] == d].copy()

    hours_list: list[HourlyBriefItem] = []
    for _, row in daily_eval.iterrows():
        fc = float(row["forecast_mw"]) if pd.notnull(row["forecast_mw"]) else None
        act = float(row["actual_mw"]) if pd.notnull(row["actual_mw"]) else None
        lead = float(row["lead_hours"]) if pd.notnull(row["lead_hours"]) else None
        pub = (
            row["publish_time"].isoformat().replace("+00:00", "Z")
            if pd.notnull(row["publish_time"])
            else None
        )

        exp_mw = round(fc * r_p50, 2) if fc is not None else None
        firm_mw = round(fc * r_p10, 2) if fc is not None else None
        up_mw = round(fc * r_p90, 2) if fc is not None else None

        hours_list.append(
            HourlyBriefItem(
                start_time=row["start_time"].isoformat().replace("+00:00", "Z"),
                hour_utc=int(row["hour_utc"]),
                forecast_mw=fc,
                publish_time=pub,
                lead_hours=lead,
                expected_mw=exp_mw,
                firm_mw=firm_mw,
                upside_mw=up_mw,
                actual_mw=act,
                missing=bool(row["missing"]),
            )
        )

    # Selected run (mode of publish_time on this day)
    valid_pubs = daily_eval["publish_time"].dropna()
    selected_run_time = (
        valid_pubs.mode().iloc[0].isoformat().replace("+00:00", "Z")
        if not valid_pubs.empty
        else None
    )

    # Compute summary values directly from hours list to ensure mathematical identity
    valid_fcs = [h.forecast_mw for h in hours_list if h.forecast_mw is not None]
    valid_acts = [h.actual_mw for h in hours_list if h.actual_mw is not None]
    valid_exps = [h.expected_mw for h in hours_list if h.expected_mw is not None]
    valid_firms = [h.firm_mw for h in hours_list if h.firm_mw is not None]
    valid_ups = [h.upside_mw for h in hours_list if h.upside_mw is not None]

    avg_fc = round(float(np.mean(valid_fcs)), 2) if valid_fcs else None
    peak_fc = round(float(np.max(valid_fcs)), 2) if valid_fcs else None
    peak_hour = None
    if valid_fcs and peak_fc is not None:
        for h in hours_list:
            if h.forecast_mw == peak_fc:
                peak_hour = h.hour_utc
                break

    total_mwh = round(float(np.sum(valid_fcs)), 2) if valid_fcs else None
    avg_exp = round(float(np.mean(valid_exps)), 2) if valid_exps else None
    avg_firm = round(float(np.mean(valid_firms)), 2) if valid_firms else None
    avg_up = round(float(np.mean(valid_ups)), 2) if valid_ups else None
    firm_vs_fc = (
        round(avg_firm - avg_fc, 2)
        if (avg_firm is not None and avg_fc is not None)
        else None
    )

    avg_act = round(float(np.mean(valid_acts)), 2) if valid_acts else None
    bias_val = (
        round(avg_act - avg_fc, 2)
        if (avg_act is not None and avg_fc is not None)
        else None
    )
    errors = [
        abs(h.actual_mw - h.forecast_mw)
        for h in hours_list
        if h.actual_mw is not None and h.forecast_mw is not None
    ]
    mae_val = round(float(np.mean(errors)), 2) if errors else None

    n_miss = sum(1 for h in hours_list if h.missing)

    return BriefResponse(
        delivery_date=str(d),
        cutoff=CutoffInfo(
            time_london=norm_cutoff,
            cutoff_utc=c_utc.isoformat().replace("+00:00", "Z"),
        ),
        selected_run=SelectedRunInfo(publish_time=selected_run_time),
        hours=hours_list,
        summary=BriefSummary(
            avg_forecast_mw=avg_fc,
            peak_forecast_mw=peak_fc,
            peak_hour_utc=peak_hour,
            total_forecast_mwh=total_mwh,
            avg_expected_mw=avg_exp,
            avg_firm_mw=avg_firm,
            avg_upside_mw=avg_up,
            firm_vs_forecast_mw=firm_vs_fc,
            n_missing=n_miss,
        ),
        calibration=CalibrationInfo(**calib),
        actual_summary=ActualSummary(
            avg_actual_mw=avg_act,
            bias_mw=bias_val,
            mae_mw=mae_val,
        ),
    )


@app.get("/api/drift", response_model=DriftResponse)
def get_drift(
    date: str = Query(..., description="Delivery date (YYYY-MM-DD)"),
    cutoff: str = Query(
        DEFAULT_CUTOFF, description="Decision cutoff (preset ID or HH:MM)"
    ),
) -> DriftResponse:
    """Forecast evolution and publication trajectories across the 24 delivery hours."""
    d = validate_date(date)
    norm_cutoff = validate_cutoff(cutoff)

    forecasts = store.get_forecasts()
    actuals = store.get_actuals()

    drift_data = engine.drift(d, norm_cutoff, forecasts, actuals)
    return DriftResponse(**drift_data)


@app.get("/api/accuracy", response_model=AccuracyResponse)
def get_accuracy(
    cutoff: str = Query(
        DEFAULT_CUTOFF, description="Decision cutoff (preset ID or HH:MM)"
    ),
) -> AccuracyResponse:
    """Comprehensive accuracy metrics, diurnal patterns, leakage, and cutoff comparisons."""
    norm_cutoff = validate_cutoff(cutoff)
    all_dates = get_all_delivery_dates()

    eval_df = get_cached_evaluation(norm_cutoff)
    naive_eval_df = get_cached_naive_evaluation()

    m_dec = engine.metrics(eval_df)
    m_nv = engine.metrics(naive_eval_df)

    by_h = engine.by_hour(eval_df)
    by_d = engine.by_day(eval_df)
    by_fl = engine.by_forecast_level(eval_df)
    band_bt = engine.band_backtest(eval_df)

    forecasts = store.get_forecasts()
    actuals = store.get_actuals()
    preset_eval_dfs = {
        p["time_london"]: get_cached_evaluation(p["time_london"])
        for p in CUTOFF_PRESETS
    }
    preset_eval_dfs[norm_cutoff] = eval_df
    cutoff_comp = engine.cutoff_comparison(
        all_dates, CUTOFF_PRESETS, forecasts, actuals, eval_dfs=preset_eval_dfs
    )

    dec_mae = m_dec["mae"]
    nv_mae = m_nv["mae"]
    gap_mw = (
        round(dec_mae - nv_mae, 2)
        if (dec_mae is not None and nv_mae is not None)
        else None
    )
    gap_pct = (
        round((gap_mw / dec_mae) * 100.0, 2)
        if (gap_mw is not None and dec_mae is not None and dec_mae != 0)
        else None
    )

    leakage = LeakageModel(
        decision_time={
            "bias": m_dec["bias"],
            "mae": m_dec["mae"],
            "rmse": m_dec["rmse"],
        },
        naive={
            "bias": m_nv["bias"],
            "mae": m_nv["mae"],
            "rmse": m_nv["rmse"],
        },
        mae_gap_mw=gap_mw,
        mae_gap_pct=gap_pct,
        naive_definition=(
            "Evaluates the latest published forecast run overall per hourly slot, "
            "ignoring decision cutoff timing constraints (lookahead leakage)."
        ),
    )

    notes = [
        "Quintile selection effect: High-forecast quintiles experience greater negative bias (-3.45 GW) partially due to physical curtailment and distribution-level wind exclusion.",
        "Scope caveat: FUELHH WIND reflects transmission-metered outturn; WINDFOR models national gross wind potential. Discrepancies are consistent with embedded generation and curtailment, not isolated.",
        "Cutoff strict less-than: Only forecast runs published strictly before cutoff timestamp are eligible for decision-time selection.",
    ]

    return AccuracyResponse(
        cutoff=norm_cutoff,
        window=WindowInfo(
            first_delivery_date=str(FIRST_DELIVERY_DATE),
            last_delivery_date=str(LAST_DELIVERY_DATE),
            n_days=N_DELIVERY_DAYS,
        ),
        metrics=MetricsModel(**m_dec),
        by_hour=by_h,
        by_day=by_d,
        by_forecast_level=by_fl,
        band_backtest=BandBacktestModel(**band_bt),
        leakage=leakage,
        cutoff_comparison=cutoff_comp,
        notes=notes,
    )
