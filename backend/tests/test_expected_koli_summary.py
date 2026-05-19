"""
Iteration 38 — Expected Koli Summary tests
Backend endpoints:
  - GET /api/jobs/expected-summary (optional ?machine_id=)
  - GET /api/dashboard/live (summary.expected_summary)

Verifies:
  1. Auth required (401 without token)
  2. Response shape correctness
  3. Calculation correctness (remaining = max(0, koli_count - completed_koli) for pending/in_progress/paused)
  4. Completed jobs are excluded
  5. machine_id filter works
  6. dashboard/live exposes summary.expected_summary with same shape
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


# ---- Fixtures ----

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def plan_token(session):
    r = session.post(
        f"{BASE_URL}/api/users/login",
        json={"username": "emrecan", "password": "testtest12"},
    )
    if r.status_code != 200:
        pytest.skip(f"Plan login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture(scope="session")
def mgmt_token(session):
    r = session.post(
        f"{BASE_URL}/api/management/login",
        json={"password": "buse11993"},
    )
    if r.status_code != 200:
        pytest.skip(f"Management login failed: {r.status_code}")
    return r.json().get("token")


@pytest.fixture(scope="session")
def dash_token(session):
    r = session.post(
        f"{BASE_URL}/api/dashboard/login",
        json={"password": "buse4"},
    )
    if r.status_code != 200:
        pytest.skip(f"Dashboard login failed: {r.status_code}")
    return r.json().get("token")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---- Auth tests ----

class TestExpectedSummaryAuth:
    def test_requires_auth(self, session):
        r = session.get(f"{BASE_URL}/api/jobs/expected-summary")
        assert r.status_code in (401, 403), f"Expected 401/403 got {r.status_code}"


# ---- Shape tests ----

class TestExpectedSummaryShape:
    def test_response_shape(self, session, plan_token):
        r = session.get(
            f"{BASE_URL}/api/jobs/expected-summary",
            headers=_auth(plan_token),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for key in (
            "total_remaining_koli",
            "total_target_koli",
            "total_completed_koli",
            "total_jobs",
            "completion_pct",
            "by_machine",
        ):
            assert key in data, f"Missing key: {key}"

        assert isinstance(data["total_remaining_koli"], int)
        assert isinstance(data["total_target_koli"], int)
        assert isinstance(data["total_completed_koli"], int)
        assert isinstance(data["total_jobs"], int)
        assert isinstance(data["completion_pct"], (int, float))
        assert isinstance(data["by_machine"], list)

        if data["by_machine"]:
            m = data["by_machine"][0]
            for k in (
                "machine_id",
                "machine_name",
                "remaining_koli",
                "target_koli",
                "completed_koli",
                "jobs_count",
                "completion_pct",
            ):
                assert k in m, f"by_machine missing {k}"


# ---- Calculation correctness ----

class TestExpectedSummaryCalculation:
    def test_calculation_matches_active_jobs(self, session, plan_token):
        """Cross-verify summary against /api/jobs (active jobs only)."""
        jobs_resp = session.get(f"{BASE_URL}/api/jobs", headers=_auth(plan_token))
        assert jobs_resp.status_code == 200
        jobs = jobs_resp.json()

        expected_remaining = 0
        expected_target = 0
        expected_completed = 0
        expected_count = 0
        for j in jobs:
            if j.get("status") in ("pending", "in_progress", "paused"):
                target = int(j.get("koli_count") or 0)
                completed = int(j.get("completed_koli") or 0)
                remaining = max(0, target - completed)
                expected_target += target
                expected_completed += min(completed, target)
                expected_remaining += remaining
                expected_count += 1

        sum_resp = session.get(
            f"{BASE_URL}/api/jobs/expected-summary",
            headers=_auth(plan_token),
        )
        assert sum_resp.status_code == 200
        data = sum_resp.json()

        assert data["total_remaining_koli"] == expected_remaining
        assert data["total_target_koli"] == expected_target
        assert data["total_completed_koli"] == expected_completed
        assert data["total_jobs"] == expected_count

        if expected_target > 0:
            expected_pct = round((expected_completed / expected_target) * 100, 1)
            assert abs(data["completion_pct"] - expected_pct) < 0.2

    def test_completed_jobs_excluded(self, session, plan_token):
        """Completed status jobs must not be counted."""
        sum_resp = session.get(
            f"{BASE_URL}/api/jobs/expected-summary",
            headers=_auth(plan_token),
        )
        assert sum_resp.status_code == 200
        data = sum_resp.json()
        total_jobs = data["total_jobs"]

        jobs_resp = session.get(f"{BASE_URL}/api/jobs", headers=_auth(plan_token))
        all_jobs = jobs_resp.json()
        active_count = sum(
            1 for j in all_jobs if j.get("status") in ("pending", "in_progress", "paused")
        )
        assert total_jobs == active_count, (
            f"Summary jobs={total_jobs} != active jobs={active_count}"
        )


# ---- Machine filter ----

class TestExpectedSummaryMachineFilter:
    def test_machine_id_filter(self, session, plan_token):
        """?machine_id= filters by machine. Sum of single-machine == by_machine entry."""
        full = session.get(
            f"{BASE_URL}/api/jobs/expected-summary",
            headers=_auth(plan_token),
        ).json()
        if not full.get("by_machine"):
            pytest.skip("No active jobs to test machine filter")
        m = full["by_machine"][0]
        mid = m["machine_id"]
        if not mid:
            pytest.skip("First machine has empty id")

        filtered = session.get(
            f"{BASE_URL}/api/jobs/expected-summary",
            headers=_auth(plan_token),
            params={"machine_id": mid},
        )
        assert filtered.status_code == 200
        fd = filtered.json()
        assert fd["total_remaining_koli"] == m["remaining_koli"]
        assert fd["total_target_koli"] == m["target_koli"]
        assert fd["total_completed_koli"] == m["completed_koli"]
        assert fd["total_jobs"] == m["jobs_count"]

    def test_machine_filter_unknown_returns_zero(self, session, plan_token):
        r = session.get(
            f"{BASE_URL}/api/jobs/expected-summary",
            headers=_auth(plan_token),
            params={"machine_id": "NONEXISTENT_MACHINE_XYZ"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total_remaining_koli"] == 0
        assert data["total_target_koli"] == 0
        assert data["total_jobs"] == 0
        assert data["by_machine"] == []


# ---- Dashboard integration ----

class TestDashboardLiveExpectedSummary:
    def test_dashboard_live_has_expected_summary(self, session, dash_token):
        r = session.get(f"{BASE_URL}/api/dashboard/live", headers=_auth(dash_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "summary" in data
        es = data["summary"].get("expected_summary")
        assert es is not None, "summary.expected_summary missing"
        for key in (
            "total_remaining_koli",
            "total_target_koli",
            "total_completed_koli",
            "total_jobs",
            "completion_pct",
            "by_machine",
        ):
            assert key in es, f"expected_summary missing {key}"

    def test_dashboard_summary_matches_jobs_endpoint(self, session, dash_token, plan_token):
        """Both endpoints should yield identical summary."""
        d = session.get(f"{BASE_URL}/api/dashboard/live", headers=_auth(dash_token)).json()
        j = session.get(f"{BASE_URL}/api/jobs/expected-summary", headers=_auth(plan_token)).json()
        es = d["summary"]["expected_summary"]
        assert es["total_remaining_koli"] == j["total_remaining_koli"]
        assert es["total_target_koli"] == j["total_target_koli"]
        assert es["total_completed_koli"] == j["total_completed_koli"]
        assert es["total_jobs"] == j["total_jobs"]
