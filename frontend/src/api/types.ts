/**
 * Real API Response Types derived directly from live FastAPI backend endpoints.
 * All fields match server responses exactly without guesswork.
 */

export interface WindowInfo {
  first_delivery_date: string; // e.g., "2026-01-02"
  last_delivery_date: string; // e.g., "2026-02-01"
  n_days: number; // 31
}

export interface CutoffPreset {
  id: string; // "epex-0920" | "n2ex-0950" | "epex-hh-1530"
  label: string; // "EPEX Day-Ahead (09:20)"
  time_london: string; // "09:20"
}

export interface DatasetProvenanceInfo {
  source_endpoint_urls: {
    actuals: string;
    forecasts: string;
  };
  query_parameters: {
    actuals: {
      settlementDateFrom: string;
      settlementDateTo: string;
      fuelType: string;
      chunk_size_days: number;
    };
    forecasts: {
      publishDateTimeFrom: string;
      publishDateTimeTo: string;
      chunk_size_days: number;
    };
  };
  fetched_at_utc: string;
  row_counts: {
    actuals_halfhourly: number;
    forecasts: number;
    raw_forecasts_before_hindcast_drop: number;
    hindcast_rows_dropped: number;
  };
  time_ranges: {
    actuals: {
      min_startTime: string;
      max_startTime: string;
    };
    forecasts: {
      min_startTime: string;
      max_startTime: string;
      min_publishTime: string;
      max_publishTime: string;
    };
  };
  distinct_publish_clock_times_utc: string[];
  sha256: {
    'actuals_halfhourly.csv': string;
    'forecasts.csv': string;
  };
}

export interface MetaResponse {
  window: WindowInfo;
  cutoff_presets: CutoffPreset[];
  default_cutoff: string;
  timezone: string;
  manifest: DatasetProvenanceInfo;
  assumptions: string[];
}

export interface HourlyBriefItem {
  start_time: string;
  hour_utc: number;
  forecast_mw: number | null;
  publish_time: string | null;
  lead_hours: number | null;
  expected_mw: number | null;
  firm_mw: number | null;
  upside_mw: number | null;
  actual_mw: number | null;
  missing: boolean;
}

export interface BriefSummary {
  avg_forecast_mw: number | null;
  peak_forecast_mw: number | null;
  peak_hour_utc: number | null;
  total_forecast_mwh: number | null;
  avg_expected_mw: number | null;
  avg_firm_mw: number | null;
  avg_upside_mw: number | null;
  firm_vs_forecast_mw: number | null;
  n_missing: number;
}

export interface CalibrationInfo {
  method: string;
  days_used: number;
  n_points: number;
  ratio_p10: number;
  ratio_p50: number;
  ratio_p90: number;
  note: string;
}

export interface ActualSummary {
  avg_actual_mw: number | null;
  bias_mw: number | null;
  mae_mw: number | null;
}

export interface BriefResponse {
  delivery_date: string;
  cutoff: {
    time_london: string;
    cutoff_utc: string;
  };
  selected_run: {
    publish_time: string | null;
  };
  hours: HourlyBriefItem[];
  summary: BriefSummary;
  calibration: CalibrationInfo;
  actual_summary: ActualSummary;
}

export interface DriftRunItem {
  publish_time: string;
  selected: boolean;
  before_cutoff: boolean;
  values: (number | null)[];
}

export interface DriftResponse {
  delivery_date: string;
  cutoff: string;
  selected_publish_time: string | null;
  runs: DriftRunItem[];
  actual: (number | null)[];
}

export interface AccuracyMetrics {
  n: number;
  n_missing: number;
  mean_actual: number | null;
  mean_forecast: number | null;
  bias: number | null;
  mae: number | null;
  rmse: number | null;
  error_std: number | null;
  mae_pct_of_mean_actual: number | null;
  error_percentiles: Record<string, number | null>;
  ratio_percentiles: Record<string, number | null>;
  bias_share_of_mse: number | null;
}

export interface ByHourMetric {
  hour_utc: number;
  mean_actual: number | null;
  mean_forecast: number | null;
  bias: number | null;
  mae: number | null;
  rmse: number | null;
}

export interface ByDayMetric {
  delivery_date: string;
  mean_actual: number | null;
  mean_forecast: number | null;
  bias: number | null;
  mae: number | null;
}

export interface ByForecastLevelMetric {
  bin_index: number;
  bin_range: string;
  mean_forecast: number;
  mean_actual: number;
  mean_error: number;
  ratio: number;
}

export interface BandBacktest {
  method: string;
  n_hours: number;
  share_below_firm: number;
  share_within_band: number;
  share_above_upside: number;
  nominal: {
    below: number;
    within: number;
    above: number;
  };
  n_days: number;
  days_avg_actual_below_avg_firm: number;
  note: string;
}

export interface LeakageModel {
  decision_time: {
    bias: number | null;
    mae: number | null;
    rmse: number | null;
  };
  naive: {
    bias: number | null;
    mae: number | null;
    rmse: number | null;
  };
  mae_gap_mw: number | null;
  mae_gap_pct: number | null;
  naive_definition: string;
}

export interface CutoffComparisonItem {
  preset_id: string;
  cutoff: string;
  typical_publish_run: string;
  n: number;
  bias: number | null;
  mae: number | null;
  rmse: number | null;
  mae_pct: number | null;
}

export interface AccuracyResponse {
  cutoff: string;
  window: WindowInfo;
  metrics: AccuracyMetrics;
  by_hour: ByHourMetric[];
  by_day: ByDayMetric[];
  by_forecast_level: ByForecastLevelMetric[];
  band_backtest: BandBacktest;
  leakage: LeakageModel;
  cutoff_comparison: CutoffComparisonItem[];
  notes: string[];
}

export interface ApiErrorDetail {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

export interface ApiErrorPayload {
  detail: string | ApiErrorDetail[];
}
