"""Integration tests for FastAPI endpoints."""

import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Assert /api/health returns 200 and status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_meta_endpoint():
    """Assert /api/meta returns 200 with required keys and window info."""
    response = client.get("/api/meta")
    assert response.status_code == 200
    data = response.json()

    assert "window" in data
    assert data["window"]["first_delivery_date"] == "2026-01-02"
    assert data["window"]["last_delivery_date"] == "2026-02-01"
    assert data["window"]["n_days"] == 31

    assert "cutoff_presets" in data
    assert len(data["cutoff_presets"]) == 3
    preset_ids = [p["id"] for p in data["cutoff_presets"]]
    assert "epex-0920" in preset_ids
    assert "n2ex-0950" in preset_ids
    assert "epex-hh-1530" in preset_ids

    assert data["default_cutoff"] == "09:20"
    assert data["timezone"] == "Europe/London"
    assert "manifest" in data
    assert "assumptions" in data
    assert len(data["assumptions"]) >= 5


def test_brief_endpoint_success_and_summary_identity():
    """Assert /api/brief returns 200 and summary matches mathematical mean of hours."""
    response = client.get("/api/brief?date=2026-01-07&cutoff=09:20")
    assert response.status_code == 200
    data = response.json()

    assert data["delivery_date"] == "2026-01-07"
    assert data["cutoff"]["time_london"] == "09:20"
    assert data["cutoff"]["cutoff_utc"] == "2026-01-06T09:20:00Z"
    assert data["selected_run"]["publish_time"] == "2026-01-06T07:30:00Z"

    hours = data["hours"]
    assert len(hours) == 24

    # Assert hours structure
    first_hour = hours[0]
    assert "start_time" in first_hour
    assert "forecast_mw" in first_hour
    assert "expected_mw" in first_hour
    assert "firm_mw" in first_hour
    assert "upside_mw" in first_hour
    assert "actual_mw" in first_hour
    assert "lead_hours" in first_hour

    summary = data["summary"]
    calib = data["calibration"]
    act_summary = data["actual_summary"]

    # Verify summary numbers in /api/brief equal the mean of the hours list
    fcs = [h["forecast_mw"] for h in hours if h["forecast_mw"] is not None]
    exps = [h["expected_mw"] for h in hours if h["expected_mw"] is not None]
    firms = [h["firm_mw"] for h in hours if h["firm_mw"] is not None]
    ups = [h["upside_mw"] for h in hours if h["upside_mw"] is not None]
    acts = [h["actual_mw"] for h in hours if h["actual_mw"] is not None]

    assert summary["avg_forecast_mw"] == round(float(np.mean(fcs)), 2)
    assert summary["avg_expected_mw"] == round(float(np.mean(exps)), 2)
    assert summary["avg_firm_mw"] == round(float(np.mean(firms)), 2)
    assert summary["avg_upside_mw"] == round(float(np.mean(ups)), 2)
    assert act_summary["avg_actual_mw"] == round(float(np.mean(acts)), 2)

    assert calib["days_used"] == 30
    assert calib["n_points"] == 720
    assert calib["ratio_p10"] > 0
    assert calib["ratio_p50"] > 0
    assert calib["ratio_p90"] > calib["ratio_p50"]


def test_drift_endpoint():
    """Assert /api/drift returns 200 with runs and actuals array."""
    response = client.get("/api/drift?date=2026-01-07&cutoff=09:20")
    assert response.status_code == 200
    data = response.json()

    assert data["delivery_date"] == "2026-01-07"
    assert data["cutoff"] == "09:20"
    assert data["selected_publish_time"] == "2026-01-06T07:30:00Z"

    assert len(data["actual"]) == 24
    runs = data["runs"]
    assert len(runs) > 0

    selected_runs = [r for r in runs if r["selected"]]
    assert len(selected_runs) == 1
    assert selected_runs[0]["publish_time"] == "2026-01-06T07:30:00Z"
    assert selected_runs[0]["before_cutoff"] is True

    for r in runs:
        assert len(r["values"]) == 24


def test_accuracy_endpoint():
    """Assert /api/accuracy returns 200 with metrics, breakdown, leakage, and comparison."""
    response = client.get("/api/accuracy?cutoff=09:20")
    assert response.status_code == 200
    data = response.json()

    assert data["cutoff"] == "09:20"
    assert "metrics" in data
    m = data["metrics"]
    assert m["n"] == 744
    assert m["n_missing"] == 0
    assert m["mean_actual"] == 11283.56
    assert m["mean_forecast"] == 13031.44
    assert m["bias"] == -1747.89
    assert m["mae"] == 2038.91
    assert m["rmse"] == 2504.76

    assert len(data["by_hour"]) == 24
    assert len(data["by_day"]) == 31
    assert len(data["by_forecast_level"]) == 5

    assert "leakage" in data
    leakage = data["leakage"]
    assert leakage["decision_time"]["mae"] == 2038.91
    assert leakage["naive"]["mae"] == 1686.77
    assert leakage["mae_gap_mw"] == 352.14

    assert len(data["cutoff_comparison"]) == 3
    assert len(data["notes"]) >= 2

    assert "band_backtest" in data
    bt = data["band_backtest"]
    assert bt["method"] == "leave_one_day_out"
    assert bt["n_hours"] == 744
    assert bt["n_days"] == 31
    assert (
        round(
            bt["share_below_firm"] + bt["share_within_band"] + bt["share_above_upside"],
            4,
        )
        == 1.0
    )
    assert bt["nominal"] == {"below": 0.10, "within": 0.80, "above": 0.10}
    assert "Errors are correlated within a day" in bt["note"]


def test_cors_meta_endpoint():
    """Assert /api/meta returns Access-Control-Allow-Origin header for origin http://localhost:5173."""
    response = client.get("/api/meta", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert (
        response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    )


def test_validation_errors_422():
    """Assert 422 for out-of-window date and bad cutoff."""
    # Date before window start
    res1 = client.get("/api/brief?date=2026-01-01&cutoff=09:20")
    assert res1.status_code == 422
    assert "outside evaluation window" in res1.json()["detail"]

    # Date after window end
    res2 = client.get("/api/brief?date=2026-02-02&cutoff=09:20")
    assert res2.status_code == 422
    assert "outside evaluation window" in res2.json()["detail"]

    # Malformed date
    res3 = client.get("/api/brief?date=invalid-date&cutoff=09:20")
    assert res3.status_code == 422

    # Malformed cutoff
    res4 = client.get("/api/brief?date=2026-01-07&cutoff=99:99")
    assert res4.status_code == 422

    res5 = client.get("/api/accuracy?cutoff=bad-cutoff")
    assert res5.status_code == 422
