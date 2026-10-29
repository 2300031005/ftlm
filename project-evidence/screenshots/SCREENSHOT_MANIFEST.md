# Screenshot Manifest

This manifest records all evidence screenshots captured from the live, running **Wind Forecast Desk** application for the technical handoff audit.

---

## 1. Primary User Journey

1. **Access Decision Brief**: The power purchaser accesses the application at `http://localhost:5173/#brief`. The landing page defaults to delivery date `2026-01-07` and decision cutoff `09:20` London time (the EPEX day-ahead auction cutoff).
2. **Review Available Forecast & Calibrated Risk Bands**:
   - The headline immediately displays the reconstructed forecast available *prior* to decision time (published at `07:30 UTC`), its average generation (`13.6 GW`), and the empirical firm floor (`9.5 GW`).
   - The purchaser inspects the 6 stat tiles: forecast run used, average forecast, expected (P50), firm floor (P10 — "plan on at least"), total energy, and intra-day revision.
   - The interactive 24-hour profile chart displays the hourly delivery schedule alongside the leave-one-day-out calibrated P10–P90 risk band.
3. **Analyze Forecast Trajectory Drift**:
   - The purchaser inspects the "How the forecast changed after you decided" chart, which visualizes publication runs published before vs. after the auction cutoff.
4. **Reveal Outturn (Hedge Quality Check)**:
   - The user toggles "Reveal actuals". The metered actual generation line appears on both charts, and the **Outcome & Outturn** card renders outturn bias, MAE, hours landing inside the calibrated band, and a benchmark context line from historical backtesting.
5. **Inspect Hourly Schedule**:
   - The user expands "Hourly detail" to inspect tabular generation numbers, lead times (ranging 16.5h to 39.5h), and missing status.
6. **Investigate Accuracy & Structural Patterns (Accuracy Lab)**:
   - The purchaser switches to the **Accuracy Lab** (`#accuracy`) to understand systematic over-forecasting:
     - Biurnal error patterns show peak over-estimation at 05:00 UTC and lowest at 15:00 UTC.
     - Quantile breakdowns demonstrate that high wind forecasts experience the largest negative bias (-3.45 GW in quintile 5).
     - Day-by-day timeline visualizes daily bias across all 31 days.
     - Gate comparison evaluates the value of waiting for later auction cutoffs (09:50 N2EX, 15:30 Half-Hourly).
     - The "Look-Ahead Trap" showpiece illustrates the danger of using a naive retrospective join (which falsely appears 17.27% more accurate than decision-time data).
7. **Verify Methodology & Governance (Method Page)**:
   - The user views the **Method** page (`#method`) to inspect dataset provenance, API endpoints, SHA-256 checksums, and mathematical assumptions.

---

## 2. Screenshot Inventory

| Filename | Page or feature | Application state | Real or mock data | What it demonstrates |
|---|---|---|---|---|
| `01-home-dashboard.png` | Decision Brief (Default View) | Initial load (`2026-01-07`, `09:20`) | **Real Elexon Snapshot** | Header navigation, decision tags, insight headline card, 6 KPI stat tiles, and 24-hour profile chart with actuals hidden. Viewport: 1440 × 1000. |
| `02-full-dashboard.png` | Decision Brief (Full Dashboard) | Loaded state | **Real Elexon Snapshot** | Complete page flow showing the 24-hour delivery profile chart and the intra-day forecast drift chart side-by-side. Viewport: 1440 × 1000. |
| `03-navigation.png` | Global Header & Presets | Active on Decision Brief | **Real Metadata** | Application branding (`Wind Forecast Desk`), `PILOT / GB / JAN 2026` badge, navigation tabs (`Decision Brief`, `Accuracy Lab`, `Method`), and cutoff preset selector (`09:20 EPEX`, `09:50 N2EX`, `15:30 30-min`). Viewport: 1440 × 1000. |
| `04-generation-forecast.png` | 24-Hour Delivery Profile Chart | Normal operating state | **Real Elexon Snapshot** | Interactive ECharts visualization showing the decision-time forecast line (`07:30 UTC` run), expected P50 dashed line, and calibrated P10–P90 green uncertainty band. Viewport: 1440 × 1000. |
| `05-forecast-vs-actual.png` | Outcome & Outturn Card (Reveal On) | `revealActuals = true` | **Real Elexon Snapshot** | Outcome card rendering average actual (`12.1 GW`), bias (`−1.5 GW`), MAE (`1.5 GW`), band compliance (`24 / 24 hours inside band`), takeaway text, and leave-one-day-out context line. Viewport: 1440 × 1000. |
| `06-forecast-accuracy.png` | Accuracy Lab (Header & KPIs) | Active tab `#accuracy` (`09:20`) | **Real Elexon Snapshot** | Micro-tag `ACCURACY LAB`, H1 headline, sample size subtitle (744 hours across 31 days), systemic bias insight card, and 6 StatTiles (Bias `−1.7 GW` in negative red, MAE, RMSE, P50, P10–P90 range, MSE bias share `49%`). Viewport: 1440 × 1000. |
| `07-forecast-error-analysis.png` | Accuracy Lab (Diurnal & Quintiles) | Active tab `#accuracy` | **Real Elexon Snapshot** | Diurnal hourly bias bar chart + MAE line (`00–23 UTC`), diurnal summary sentence, 5-quintile wind generation level grouped bars with ratio labels, and "Read with care" statistical disclaimer box. Viewport: 1440 × 1000. |
| `08-data-table.png` | Hourly Detail Breakdown Table | Expanded state | **Real Elexon Snapshot** | Table containing all 24 delivery hours, UTC timestamps, forecast MW, expected MW, firm floor MW, upside MW, actual MW, lead hours, and missing flags. Viewport: 1440 × 1000. |
| `09-date-filters.png` | Decision Controls Bar | Active operating state | **Real Elexon Snapshot** | DayPicker date chips (covering all 31 days in January 2026), Custom cutoff input (`HH:MM` format), and Reveal actuals toggle switch. Viewport: 1440 × 1000. |
| `13-day-by-day-timeline.png` | January 2026 Timeline | Active tab `#accuracy` | **Real Elexon Snapshot** | Daily bias bars (negative red for under-generation, green for over-generation) and MAE trendline across all 31 delivery days. Clicking any bar links directly to that day's Decision Brief. Viewport: 1440 × 1000. |
| `14-look-ahead-trap.png` | The Look-Ahead Trap Card | Active tab `#accuracy` | **Real Elexon Snapshot** | Amber-bordered showpiece comparing Decision-time forecast (`2,039 MW` MAE) against the retrospective Naive latest forecast (`1,687 MW` MAE), quantifying the 17.27% lookahead leakage gap. Viewport: 1440 × 1000. |
| `15-gate-comparison-table.png` | Auction Timing Benchmarks | Active tab `#accuracy` | **Real Elexon Snapshot** | Benchmark table comparing `09:20`, `09:50`, and `15:30` cutoffs with typical publish runs, bias, MAE, RMSE, MAE %, and relative improvement percentages with current cutoff row highlighted. Viewport: 1440 × 1000. |
| `16-percentiles-table.png` | All Error Percentiles Table | Expanded state | **Real Elexon Snapshot** | Collapsible table rendering P05, P10, P25, P50, P75, P90, and P95 percentiles for both hourly error (MW) and actual/forecast ratios. Viewport: 1440 × 1000. |
| `17-method-governance.png` | Methodology & Governance Page | Active tab `#method` | **Real Elexon Snapshot** | System architecture explanations, decision cutoff rules, provenance table with dataset endpoints, row counts, copyable SHA-256 hashes, and reproduction commands. Viewport: 1440 × 1000. |
| `18-responsive-mobile-360px-top.png` | Accuracy Lab (Mobile View - Top) | Viewport: 360 × 840 | **Real Elexon Snapshot** | Clean mobile layout showing static header, micro-tag, H1 headline, responsive insight card, and 2-column StatTiles with zero horizontal window scroll. |
| `19-responsive-mobile-360px-middle.png` | Accuracy Lab (Mobile View - Middle) | Viewport: 360 × 840 | **Real Elexon Snapshot** | Mobile rendering of the Quintiles grouped bar chart and the "Read with care" box, formatted for narrow screens. |
| `20-responsive-mobile-360px-bottom.png` | Accuracy Lab (Mobile View - Bottom) | Viewport: 360 × 840 | **Real Elexon Snapshot** | Mobile percentiles table with contained horizontal scroll (`overflow-x-auto`), notes, and footer disclosures. |
| `21-responsive-mobile-method.png` | Method Page (Mobile View) | Viewport: 360 × 840 | **Real Elexon Snapshot** | Mobile method page displaying right-edge inset fade shadows on tables and code blocks with `scroll →` indicators. |

---

## 3. Capture Conditions & Limitations

- **Source Application**: Captured directly from the running Vite frontend (`http://127.0.0.1:5173`) backed by the live FastAPI backend (`http://127.0.0.1:8000`).
- **Data Authenticity**: All metrics, charts, and table rows are driven exclusively by the committed Elexon BMRS snapshot (`data/snapshot/actuals_halfhourly.csv` and `data/snapshot/forecasts.csv`). Zero synthetic or mock data is used.
- **Loading State (`10-loading-state.png`)**: Because the backend evaluation tables for presets are pre-warmed at lifespan startup (`~120 ms`) and the frontend implements a module-level `sessionCache` Map, subsequent page loads and tab switches resolve in `< 1 ms`. Skeleton placeholders exist in the codebase (`src/components/ui/Skeleton.tsx`) and display during cold uncached requests.
- **Empty State (`11-empty-state.png`)**: The application operates against a fixed historical delivery window (`2026-01-02` to `2026-02-01`, 31 days). The `DayPicker` UI strictly confines navigation to valid snapshot dates, meaning a completely blank or empty state is prevented by design.
- **Error State (`12-error-state.png`)**: Backend returns HTTP 422 with structured JSON error messages if an out-of-range date or invalid cutoff time (e.g. `99:99`) is passed, triggering the frontend `ErrorState` component with a red warning alert and retry action.

