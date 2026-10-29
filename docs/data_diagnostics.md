# Wind Day-Ahead Forecast Diagnostics Report

*Generated automatically on: `2026-10-29 05:24:05 UTC`*
*Dataset Snapshot: 2026-01-02 to 2026-02-01 (31 delivery days, 744 hourly delivery periods)*

---

## a. Alignment & Lag Test (-3h to +3h)

To determine whether forecasts systematically lag or lead physical wind outturn, we evaluate shifted forecast series against hourly actuals:

| Lag (Hours) | Pearson Correlation | MAE (MW) | Mean Bias (MW) |
| :--- | :--- | :--- | :--- |
| -3h | 0.9197 | 1,995.28 | -1,698.60 |
| -2h **(Best MAE)** | 0.9290 | 1,954.85 | -1,715.52 |
| -1h **(Best Corr)** | 0.9326 | 1,972.85 | -1,731.98 |
| +0h | 0.9309 | 2,038.91 | -1,747.89 |
| +1h | 0.9235 | 2,121.09 | -1,764.31 |
| +2h | 0.9110 | 2,211.14 | -1,780.77 |
| +3h | 0.8936 | 2,310.76 | -1,797.29 |

- **Best Correlation**: Lag `-1h` (correlation = `0.9326`).
- **Best MAE**: Lag `-2h` (MAE = `1,954.85 MW`).
- **Is Lag 0 Best?**: **No, not strictly**. While Lag 0 exhibits strong correlation (`0.9309`), a slight negative lag of `-1h` improves correlation (`0.9326`) and `-2h` minimizes MAE (`1,954.85 MW` vs `2,038.91 MW`). This indicates that National Grid's wind forecast model slightly lags real-time ramp events by 1 to 2 hours, or that weather front arrivals were systematically predicted 1–2 hours later than physical dispatch outturns.

## b. Overall Forecast Error & Dispersion (09:20 London Cutoff)

- **Evaluation Scope**: 744 hourly delivery periods (31 delivery days × 24 hours).
- **Missing Hourly Points**: **0** (100% complete coverage).
- **Mean Actual Generation (`FUELHH WIND`)**: **11,283.56 MW**
- **Mean Selected Forecast (`WINDFOR`)**: **13,031.44 MW**
- **Mean Bias (`actual - forecast`)**: **-1,747.89 MW** (Forecast systematically over-predicts actuals by ~1.75 GW).
- **Mean Absolute Error (MAE)**: **2,038.91 MW**
- **MAE as % of Mean Actual**: **18.07%**
- **Root Mean Square Error (RMSE)**: **2,504.76 MW**
- **Standard Deviation of Error**: **1,795.28 MW**
- **Error Percentiles**:
  - **P10**: `-4,097.90 MW` (large over-forecast: forecast exceeded actuals by >4 GW)
  - **P50 (Median)**: `-1,592.00 MW`
  - **P90**: `549.30 MW` (under-forecast: actuals exceeded forecast by >549 MW)

## c. Error and Bias by Hour of Day (00:00 - 23:00)

| Hour (UTC) | Mean Actual (MW) | Mean Forecast (MW) | Bias (MW) | MAE (MW) | RMSE (MW) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 00:00 | 11,616.0 | 13,568.7 | -1,952.7 | 2,027.8 | 2,526.1 |
| 01:00 | 11,353.8 | 13,487.1 | -2,133.3 | 2,169.0 | 2,671.5 |
| 02:00 | 11,156.5 | 13,410.0 | -2,253.5 | 2,299.4 | 2,799.8 |
| 03:00 | 11,024.8 | 13,346.5 | -2,321.7 | 2,413.1 | 2,908.7 |
| 04:00 | 10,932.6 | 13,267.2 | -2,334.6 | 2,405.2 | 2,904.4 |
| 05:00 | 10,793.3 | 13,151.4 | -2,358.1 | 2,429.9 | 2,919.2 |
| 06:00 | 10,721.1 | 13,033.3 | -2,312.2 | 2,379.9 | 2,876.6 |
| 07:00 | 10,817.1 | 12,956.4 | -2,139.4 | 2,227.3 | 2,735.9 |
| 08:00 | 10,983.1 | 12,886.4 | -1,903.2 | 2,032.4 | 2,494.7 |
| 09:00 | 11,000.6 | 12,855.1 | -1,854.5 | 1,996.3 | 2,449.6 |
| 10:00 | 11,082.0 | 12,813.4 | -1,731.4 | 1,930.7 | 2,390.6 |
| 11:00 | 11,142.0 | 12,712.4 | -1,570.5 | 1,962.9 | 2,337.2 |
| 12:00 | 11,186.5 | 12,574.2 | -1,387.7 | 1,929.3 | 2,295.5 |
| 13:00 | 11,139.5 | 12,470.2 | -1,330.7 | 1,942.5 | 2,265.0 |
| 14:00 | 11,114.5 | 12,442.9 | -1,328.4 | 1,913.6 | 2,234.2 |
| 15:00 | 11,273.4 | 12,520.4 | -1,247.0 | 1,817.5 | 2,199.8 |
| 16:00 | 11,385.5 | 12,688.8 | -1,303.3 | 1,847.1 | 2,228.5 |
| 17:00 | 11,578.0 | 12,898.2 | -1,320.2 | 1,918.2 | 2,292.1 |
| 18:00 | 11,784.6 | 13,132.2 | -1,347.5 | 1,954.6 | 2,368.0 |
| 19:00 | 11,887.1 | 13,275.8 | -1,388.7 | 1,952.9 | 2,383.0 |
| 20:00 | 11,880.5 | 13,316.2 | -1,435.7 | 1,856.3 | 2,339.8 |
| 21:00 | 11,783.2 | 13,327.5 | -1,544.2 | 1,785.6 | 2,324.1 |
| 22:00 | 11,691.9 | 13,327.7 | -1,635.8 | 1,792.5 | 2,368.6 |
| 23:00 | 11,477.9 | 13,292.8 | -1,814.9 | 1,949.7 | 2,532.3 |

- **Diurnal Pattern Observation**: Over-forecasting is most pronounced during overnight and early morning hours (**02:00 to 06:00 UTC**), where negative bias exceeds `-2,300 MW` and MAE peaks at `~2,430 MW`. In contrast, afternoon and early evening hours (**14:00 to 17:00 UTC**) exhibit lower bias (`-1,247 MW` to `-1,328 MW`) and lower MAE (`~1,817 MW` to `1,918 MW`).

## d. Over-Forecast Pattern by Wind Quintile

Forecast values are split into 5 equal-frequency quantile bins:

| Forecast Bin (MW) | Mean Forecast (MW) | Mean Actual (MW) | Mean Error (MW) | Actual / Forecast Ratio |
| :--- | :--- | :--- | :--- | :--- |
| Q1: 3,161 - 8,224 | 6,236.5 | 5,857.0 | -379.5 | 0.939 |
| Q2: 8,224 - 11,286 | 9,721.6 | 8,296.7 | -1,424.9 | 0.853 |
| Q3: 11,286 - 15,002 | 12,954.2 | 11,387.2 | -1,567.0 | 0.879 |
| Q4: 15,002 - 18,097 | 16,925.8 | 15,012.5 | -1,913.3 | 0.887 |
| Q5: 18,097 - 21,064 | 19,318.6 | 15,865.1 | -3,453.5 | 0.821 |

- **Does the over-forecast grow at high wind?**: **YES, substantially**.
  - In **Bin 1 (low wind, <8.2 GW)**: Mean error is only **`-379.5 MW`** with an actual-to-forecast ratio of **`0.939`**.
  - In **Bin 5 (high wind, >18.1 GW)**: Mean error expands nearly tenfold to **`-3,453.5 MW`**, and the ratio deteriorates to **`0.821`**.
  - **Commercial Rationale**: At high wind velocities, transmission constraints across the Scottish-English boundaries (B6 boundary) frequently trigger Balancing Mechanism bid acceptances (curtailment) by the system operator. While `WINDFOR` forecasts unconstrained weather potential, `FUELHH` records post-curtailment metered generation.

## e. Cutoff Comparison (09:20 vs 09:50 vs 15:30 London Time)

| Decision Cutoff | Typically Selected Publish Run | Bias (MW) | MAE (MW) | RMSE (MW) |
| :--- | :--- | :--- | :--- | :--- |
| 09:20 | 07:30 UTC (744/744) | -1,747.89 | 2,038.91 | 2,504.76 |
| 09:50 | 09:30 UTC (744/744) | -1,729.93 | 2,013.01 | 2,505.94 |
| 15:30 | 11:30 UTC (720/744) | -1,692.47 | 1,904.01 | 2,361.10 |

- **Cutoff Comparison Findings**:
  - At **09:20 London time**, the latest available forecast run is strictly the **07:30 UTC** publication (selected 100% of the time, 744/744 hours).
  - Extending the cutoff by just 30 minutes to **09:50 London time** captures the **09:30 UTC** publication run (selected 100% of the time), slightly reducing MAE from `2,038.91 MW` to `2,013.01 MW` and bias from `-1,747.89 MW` to `-1,729.93 MW`.
  - Extending to **15:30 London time** captures the **11:30 UTC** publication (mode 96.8%), reducing MAE further to `1,904.01 MW` and RMSE to `2,361.10 MW`.

## f. Scope & Definition Sources

The following documentation sources were reviewed to verify dataset boundaries and metering architectures:

1. **Elexon OpenAPI Specification**
   - URL: `https://data.elexon.co.uk/swagger/v1/swagger.json`
   - *[VERIFIED]*: `FUELHH` provides half-hourly generation outturn aggregated by fuel type category in average MW over 30 minutes.
   - *[VERIFIED]*: `WINDFOR` provides wind generation forecasts by publish time.

2. **Elexon Insights Solution (BMRS) Stream Documentation**
   - URL: `https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream`
   - URL: `https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream`
   - *[VERIFIED]*: Non-stream endpoints strictly limit date ranges to 7 days maximum.

3. **Elexon BMRS Guidance on Generation by Fuel Type (Operational Data)**
   - URL: `https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/`
   - *[VERIFIED]*: `FUELHH` is derived from operational telemetry of transmission-connected Balancing Mechanism (BM) Units directly metered by the system operator.
   - *[VERIFIED]*: Embedded generation (small-scale wind and solar connected to distribution network operators / DNOs without transmission meters) is excluded from `FUELHH` outturn and instead manifests as negative demand.
   - *[HYPOTHESIS]*: The widening of negative bias from -380 MW in low wind to -3,450 MW in high wind is driven by a combination of (a) transmission constraints requiring wind curtailment (bids accepted in the Balancing Mechanism), and (b) difference in embedded wind treatment between the NESO physical forecast model and transmission outturn meters.
