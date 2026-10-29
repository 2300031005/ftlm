"""Pydantic data models for API responses."""

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    """Health check status."""

    status: str = "ok"


class WindowInfo(BaseModel):
    """Delivery window metadata."""

    first_delivery_date: str
    last_delivery_date: str
    n_days: int


class CutoffPreset(BaseModel):
    """Preset decision cutoff definition."""

    id: str
    label: str
    time_london: str


class MetaResponse(BaseModel):
    """System metadata, window, presets, and dataset manifest."""

    window: WindowInfo
    cutoff_presets: list[CutoffPreset]
    default_cutoff: str
    timezone: str
    manifest: dict
    assumptions: list[str]


class CutoffInfo(BaseModel):
    """Cutoff representation in local time and UTC."""

    time_london: str
    cutoff_utc: str


class SelectedRunInfo(BaseModel):
    """Primary forecast publication run selected at decision time."""

    publish_time: str | None


class HourlyBriefItem(BaseModel):
    """Detailed forecast, band projections, and actual for a single delivery hour."""

    start_time: str
    hour_utc: int
    forecast_mw: float | None
    publish_time: str | None
    lead_hours: float | None
    expected_mw: float | None
    firm_mw: float | None
    upside_mw: float | None
    actual_mw: float | None
    missing: bool


class BriefSummary(BaseModel):
    """Summary metrics of day-ahead decision forecast and risk bands."""

    avg_forecast_mw: float | None
    peak_forecast_mw: float | None
    peak_hour_utc: int | None
    total_forecast_mwh: float | None
    avg_expected_mw: float | None
    avg_firm_mw: float | None
    avg_upside_mw: float | None
    firm_vs_forecast_mw: float | None
    n_missing: int


class CalibrationInfo(BaseModel):
    """Leave-one-day-out ratio calibration details."""

    method: str
    days_used: int
    n_points: int
    ratio_p10: float
    ratio_p50: float
    ratio_p90: float
    note: str


class ActualSummary(BaseModel):
    """Outturn summary and decision-time error."""

    avg_actual_mw: float | None
    bias_mw: float | None
    mae_mw: float | None


class BriefResponse(BaseModel):
    """Day-ahead purchasing briefing for a specific delivery day."""

    delivery_date: str
    cutoff: CutoffInfo
    selected_run: SelectedRunInfo
    hours: list[HourlyBriefItem]
    summary: BriefSummary
    calibration: CalibrationInfo
    actual_summary: ActualSummary


class DriftRunItem(BaseModel):
    """Trajectory of a single forecast publication run across the 24 delivery hours."""

    publish_time: str
    selected: bool
    before_cutoff: bool
    values: list[float | None]


class DriftResponse(BaseModel):
    """Forecast evolution and publication drift across delivery hours."""

    delivery_date: str
    cutoff: str
    selected_publish_time: str | None
    runs: list[DriftRunItem]
    actual: list[float | None]


class MetricsModel(BaseModel):
    """Forecast error and dispersion metrics."""

    n: int
    n_missing: int
    mean_actual: float | None
    mean_forecast: float | None
    bias: float | None
    mae: float | None
    rmse: float | None
    error_std: float | None
    mae_pct_of_mean_actual: float | None
    error_percentiles: dict[str, float | None]
    ratio_percentiles: dict[str, float | None]
    bias_share_of_mse: float | None


class LeakageModel(BaseModel):
    """Comparison of decision-time accuracy vs naive leaky baseline."""

    decision_time: dict[str, float | None]
    naive: dict[str, float | None]
    mae_gap_mw: float | None
    mae_gap_pct: float | None
    naive_definition: str


class BandBacktestModel(BaseModel):
    """Leave-one-day-out ratio calibration backtest results."""

    method: str
    n_hours: int
    share_below_firm: float
    share_within_band: float
    share_above_upside: float
    nominal: dict[str, float]
    n_days: int
    days_avg_actual_below_avg_firm: int
    note: str


class AccuracyResponse(BaseModel):
    """Comprehensive historical accuracy, diurnal errors, and cutoff comparisons."""

    cutoff: str
    window: WindowInfo
    metrics: MetricsModel
    by_hour: list[dict]
    by_day: list[dict]
    by_forecast_level: list[dict]
    band_backtest: BandBacktestModel
    leakage: LeakageModel
    cutoff_comparison: list[dict]
    notes: list[str]

    model_config = ConfigDict(arbitrary_types_allowed=True)
