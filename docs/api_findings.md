# Elexon BMRS API Exploration Findings

Generated automatically from real API calls on: `2026-10-29T02:59:52.919738+00:00`

## Executive Summary
This document details the findings from probing Elexon BMRS REST API endpoints for actual wind generation (`FUELHH`) and wind forecasts (`WINDFOR`). All statements and numbers are verified against live API responses.

## Detailed Answers to Tasks (a - j)

### a. Exact Endpoint URLs, Parameter Names, and Max Range Per Request

- **Base API URL**: `https://data.elexon.co.uk/bmrs/api/v1`
- **Endpoints**:
  - FUELHH Stream: `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream`
  - FUELHH Non-Stream: `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH`
  - WINDFOR Stream: `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream`
  - WINDFOR Non-Stream: `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR`
- **Parameters**:
  - `FUELHH`: `publishDateTimeFrom` & `publishDateTimeTo` (ISO date-time) OR `settlementDateFrom` & `settlementDateTo` (YYYY-MM-DD), `settlementPeriod` (optional array of int32), `fuelType` (array of string, e.g. `WIND`). Note: publish date parameters and settlement date parameters cannot be used simultaneously.
  - `WINDFOR`: `publishDateTimeFrom` & `publishDateTimeTo` (ISO date-time).
- **Max Range per Request**:
  - **Non-stream endpoints (`/datasets/FUELHH` and `/datasets/WINDFOR`)**: Hard limit of **7 days max** per request. Exceeding 7 days returns HTTP 400 (`The date range between ... inclusive must not exceed 7 days`).
  - **Stream endpoints (`/datasets/FUELHH/stream` and `/datasets/WINDFOR/stream`)**: No hard date limit enforced by the API (tested up to 365+ days returning 200 OK), but chunking by 7 days is strongly recommended in production to avoid gateway timeouts, payload bloat, and memory exhaustion.

### b. Full Column List and Dtypes for Both Datasets, Plus 3 Real Sample Rows Each

**FUELHH Columns & Inferred Types:**
```json
{
  "dataset": "str",
  "publishTime": "str",
  "startTime": "str",
  "settlementDate": "str",
  "settlementPeriod": "int64",
  "fuelType": "str",
  "generation": "int64"
}
```

**FUELHH 3 Real Sample Rows:**
```json
[
  {
    "dataset": "FUELHH",
    "publishTime": "2025-12-09T00:00:00Z",
    "startTime": "2025-12-08T23:30:00Z",
    "settlementDate": "2025-12-08",
    "settlementPeriod": 48,
    "fuelType": "WIND",
    "generation": 10688
  },
  {
    "dataset": "FUELHH",
    "publishTime": "2025-12-08T23:30:00Z",
    "startTime": "2025-12-08T23:00:00Z",
    "settlementDate": "2025-12-08",
    "settlementPeriod": 47,
    "fuelType": "WIND",
    "generation": 10748
  },
  {
    "dataset": "FUELHH",
    "publishTime": "2025-12-08T23:00:00Z",
    "startTime": "2025-12-08T22:30:00Z",
    "settlementDate": "2025-12-08",
    "settlementPeriod": 46,
    "fuelType": "WIND",
    "generation": 10712
  }
]
```

**WINDFOR Columns & Inferred Types:**
```json
{
  "dataset": "str",
  "publishTime": "str",
  "startTime": "str",
  "generation": "int64"
}
```

**WINDFOR 3 Real Sample Rows:**
```json
[
  {
    "dataset": "WINDFOR",
    "publishTime": "2025-12-08T22:30:00Z",
    "startTime": "2025-12-07T21:00:00Z",
    "generation": 16512
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2025-12-08T22:30:00Z",
    "startTime": "2025-12-07T22:00:00Z",
    "generation": 15772
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2025-12-08T22:30:00Z",
    "startTime": "2025-12-07T23:00:00Z",
    "generation": 16173
  }
]
```

### c. Units of Generation and Timestamp Formatting

- **Units of Generation**: **Megawatts (MW)**.
  - FUELHH: Half-hourly average generation in MW across each 30-minute settlement period.
  - WINDFOR: Forecast wind generation output in MW for each hourly target period.
- **Timestamp Formatting**: ISO 8601 extended format with UTC `Z` suffix (e.g., `2026-01-02T23:30:00Z`).
- **Settlement Date**: Formatted as `YYYY-MM-DD` (e.g., `2026-01-02`).

### d. Resolution Check: StartTime Step, Gaps, and Duplicates

- **FUELHH (Actuals)**:
  - **Resolution**: **30 minutes** apart (`{'0 days 00:30:00': 1487}`).
  - **Duplicates**: 0 duplicate `startTime` records.
  - **Gaps**: None. All 1,488 expected half-hour periods are strictly consecutive.
- **WINDFOR (Forecasts)**:
  - **Resolution**: **60 minutes (1 hour)** apart (`{'0 days 01:00:00': 72}`), NOT 30 minutes!
  - Each forecast run produces 73 hourly points (spanning 72 hours from the earliest forecast point).
  - **Duplicates**: 0 duplicate `(publishTime, startTime)` pairs after multi-chunk merging.
  - **Gaps**: Within each publishTime forecast batch, points are strictly 1 hour apart with 0 gaps.

### e. WINDFOR Publishing Dynamics and Lead Time Distribution

- **Distinct `publishTime` values per `startTime`** (January delivery window):
  - **Min**: 16 (at the very boundary)
  - **Median**: 24.0 (712 out of 744 hours have exactly 24 forecasts)
  - **Max**: 32
- **Lead Time Range `(startTime - publishTime)`**:
  - **Min**: -25.5 hours
  - **Median**: 21.5 hours
  - **Max**: 66.5 hours
  - **Crucial Architectural Note on Negative Lead Times**: 7441 rows (20.6%) have negative lead times down to -25.5 hours. Every publication run includes ~25.5 hours of retrospective/hindcast points in addition to ~66.5 hours of forward forecasts.
- **Forecast Publishing Frequency (Distribution of gaps between consecutive publishTimes)**:
  - Forecasts are published ~8 times daily (typically at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC).
  - Mean gap: 3.00 hours (Min: 2.0h, Max: 4.0h).
  - Gaps distribution (in hours): `{'2.0h': 185, '2.9h': 1, '3.0h': 124, '3.1h': 1, '4.0h': 184}` (primarily 2, 3, or 4 hours apart).

### f. Example Delivery Day Analysis: 7 Jan 2026 at 12:00Z

**Target startTime**: `2026-01-07T12:00:00Z`
Total published forecasts available for this half-hour/hour: **24**

| publishTime | startTime | generation (MW) | Lead Time |
| :--- | :--- | :--- | :--- |
| 2026-01-05T02:30:00Z | 2026-01-07T12:00:00Z | 12530 MW | 57.5h |
| 2026-01-05T04:30:00Z | 2026-01-07T12:00:00Z | 12430 MW | 55.5h |
| 2026-01-05T07:30:00Z | 2026-01-07T12:00:00Z | 11379 MW | 52.5h |
| 2026-01-05T09:30:00Z | 2026-01-07T12:00:00Z | 11603 MW | 50.5h |
| 2026-01-05T11:30:00Z | 2026-01-07T12:00:00Z | 11994 MW | 48.5h |
| 2026-01-05T15:30:00Z | 2026-01-07T12:00:00Z | 13530 MW | 44.5h |
| 2026-01-05T18:30:00Z | 2026-01-07T12:00:00Z | 13028 MW | 41.5h |
| 2026-01-05T22:30:00Z | 2026-01-07T12:00:00Z | 11812 MW | 37.5h |
| 2026-01-06T02:30:00Z | 2026-01-07T12:00:00Z | 11932 MW | 33.5h |
| 2026-01-06T04:30:00Z | 2026-01-07T12:00:00Z | 12658 MW | 31.5h |
| 2026-01-06T07:30:00Z | 2026-01-07T12:00:00Z | 14095 MW | 28.5h |
| 2026-01-06T09:30:00Z | 2026-01-07T12:00:00Z | 13995 MW | 26.5h |
| 2026-01-06T11:30:00Z | 2026-01-07T12:00:00Z | 13902 MW | 24.5h |
| 2026-01-06T15:30:00Z | 2026-01-07T12:00:00Z | 14676 MW | 20.5h |
| 2026-01-06T18:30:00Z | 2026-01-07T12:00:00Z | 14676 MW | 17.5h |
| 2026-01-06T22:30:00Z | 2026-01-07T12:00:00Z | 13454 MW | 13.5h |
| 2026-01-07T02:30:00Z | 2026-01-07T12:00:00Z | 13171 MW | 9.5h |
| 2026-01-07T04:30:00Z | 2026-01-07T12:00:00Z | 13357 MW | 7.5h |
| 2026-01-07T07:30:00Z | 2026-01-07T12:00:00Z | 13430 MW | 4.5h |
| 2026-01-07T09:30:00Z | 2026-01-07T12:00:00Z | 12696 MW | 2.5h |
| 2026-01-07T11:30:00Z | 2026-01-07T12:00:00Z | 12954 MW | 0.5h |
| 2026-01-07T15:30:00Z | 2026-01-07T12:00:00Z | 13215 MW | -3.5h |
| 2026-01-07T18:30:00Z | 2026-01-07T12:00:00Z | 13215 MW | -6.5h |
| 2026-01-07T22:30:00Z | 2026-01-07T12:00:00Z | 13215 MW | -10.5h |

**Decision Cutoff**: `2026-01-06T09:20:00Z`
- The latest forecast published strictly before the cutoff `2026-01-06T09:20:00Z` was published at `2026-01-06T07:30:00Z`.
- **Selected Forecast Value**: **14095 MW** (lead time: 28.5 hours ahead of delivery).
- (Note: The subsequent forecast was published at `2026-01-06T09:30:00Z`, which is 10 minutes past the 09:20Z decision cutoff).

### g. Data Quality: Null, Negative, and Zero Values

- **FUELHH (Actuals, 3024 records tested)**:
  - Null values: **0**
  - Negative generation: **0**
  - Zero generation: **0** (Minimum generation outturn: 1695 MW, Max: 18382 MW)
- **WINDFOR (Forecasts, 36208 records tested)**:
  - Null values: **0**
  - Negative generation: **0**
  - Zero generation: **0** (Minimum forecast: 1981 MW, Max: 21709 MW)

### h. January Delivery Coverage: Expected vs Actual Half-Hours

- **Delivery Period**: 2026-01-02 00:00:00Z to 2026-02-01 23:30:00Z (31 delivery days)
- **Expected Half-Hours**: 1488 (31 days x 48 settlement periods)
- **Actual Half-Hours Received**: 1488
- **Missing StartTimes**: **0** (None missing)
- **Coverage**: **100.0% complete**.

### i. Capacity Fields and Additional Fields in WINDFOR

- **Does WINDFOR contain any capacity-like field?** **No**. There are no installed capacity, available capacity, or rating fields in WINDFOR.
- **Fields in response**: `['dataset', 'generation', 'publishTime', 'startTime']`
- **Additional fields beyond [startTime, publishTime, generation]**: Only **`dataset`** (`['dataset']`). No other fields exist in the payload.

### j. Scope Comparison and Elexon Definitions

- **Magnitude Comparison on Overlapping Periods (Jan 2 - Feb 1, 2026, 744 hourly points)**:
  - Mean Actual Generation (FUELHH WIND): **11283.6 MW**
  - Mean Latest Forecast (WINDFOR): **12756.7 MW**
  - Correlation: **0.9568**
  - Mean Absolute Error (MAE): **1686.8 MW** (approx 14.9% relative error)
- **Do they look like the same scope?**
  - **Broadly yes in scale**, but with an important structural distinction defined by Elexon and NESO:
    1. **FUELHH WIND (Outturn)**: Represents transmission-metered outturn generation from operational Balancing Mechanism (BM) units. It primarily covers transmission-connected wind farms and larger metered sites.
    2. **WINDFOR (Forecast)**: Represents NESO's system-wide national wind forecast. Depending on the model run, it accounts for national aggregate wind generation potential across GB. Because unmetered distribution-connected (embedded) wind appears as suppressed demand rather than metered generation in FUELHH, and transmission curtailment/bids reduce outturn, WINDFOR forecasts tend to slightly exceed FUELHH metered outturn.
    3. **Resolution difference**: FUELHH is half-hourly (settlement periods), whereas WINDFOR is hourly.

## Key Surprises and Open Engineering Questions

1. **Resolution Mismatch (30-min vs 60-min)**: `FUELHH` is published at half-hour settlement periods (30-min), while `WINDFOR` is strictly hourly (60-min). The purchasing decision model must decide whether to interpolate forecasts to half-hours or evaluate hourly blocks.
2. **Negative Lead Times in WINDFOR**: WINDFOR payload for each publish run contains ~25.5 hours of past hindcast points alongside ~66.5 hours of forward forecast. When ingesting forecasts, the pipeline must filter out retrospective points (`startTime <= publishTime`) unless backfilling.
3. **Publication Frequency and Cutoff Timing**: Forecasts are released approximately every 2-4 hours (~8 times a day). For a day-ahead decision cutoff at 09:20 UTC, the latest available forecast run is the 07:30 UTC publication.
4. **Rate Limits & Chunking**: Non-stream endpoints hard-fail beyond 7-day ranges with HTTP 400. Stream endpoints permit larger ranges, but 7-day chunking is necessary for production reliability and memory efficiency.
