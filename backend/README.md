# UK Wind Day-Ahead Purchasing API Backend

FastAPI decision-support and analysis engine for day-ahead wind purchasing decisions, operating against the committed Elexon BMRS snapshot (`data/snapshot/`).

## Prerequisites

- Python 3.12+
- A virtual environment (e.g., in `.venv`) with required dependencies installed (`fastapi`, `uvicorn`, `pandas`, `pytest`, `ruff`, etc.).

---

## Running the API Server

The API runs by default on `http://127.0.0.1:8000`.

### Windows PowerShell

From the repository root:

```powershell
# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Run the Uvicorn dev server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Or run directly without activating:

```powershell
.\.venv\Scripts\uvicorn.exe backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Linux / macOS Bash

From the repository root:

```bash
# Activate the virtual environment
source .venv/bin/activate

# Run the Uvicorn dev server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Or run directly without activating:

```bash
./.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Running Tests

### Windows PowerShell

From the repository root:

```powershell
# Run all test suites
.\.venv\Scripts\pytest

# Run with verbose test-case names and output
.\.venv\Scripts\pytest -v -s
```

### Linux / macOS Bash

From the repository root:

```bash
# Run all test suites
./.venv/bin/pytest

# Run with verbose test-case names and output
./.venv/bin/pytest -v -s
```

---

## Code Quality & Formatting (Ruff)

### Windows PowerShell

```powershell
# Lint check
.\.venv\Scripts\ruff.exe check backend

# Formatting check
.\.venv\Scripts\ruff.exe format --check backend

# Automatic reformatting
.\.venv\Scripts\ruff.exe format backend
```

### Linux / macOS Bash

```bash
# Lint check
./.venv/bin/ruff check backend

# Formatting check
./.venv/bin/ruff format --check backend

# Automatic reformatting
./.venv/bin/ruff format backend
```

---

## Key Endpoints

- `GET /api/health` — Service health check.
- `GET /api/meta` — Dataset manifest, window bounds, cutoff presets, and assumptions.
- `GET /api/brief?date=YYYY-MM-DD&cutoff=09:20` — 24-hour decision briefing, hourly schedule, calibrated ratio bands (expected, firm, upside), and summary aggregates.
- `GET /api/drift?date=YYYY-MM-DD&cutoff=09:20` — Intra-day forecast trajectory drift and publication timeline.
- `GET /api/accuracy?cutoff=09:20` — Overall metrics, diurnal error breakdowns, quantile breakdown, leave-one-day-out band backtest, and lookahead leakage benchmarks.
