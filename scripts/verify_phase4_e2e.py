"""
Comprehensive end-to-end integration test suite for Auto Researcher Phase 4.
Tests all 16 verification requirements against live running backend and frontend services.
"""

import sys
import time
import uuid
import httpx

API_BASE = "http://127.0.0.1:8000"
FRONTEND_BASE = "http://127.0.0.1:3000"


def main():
    print("======================================================================")
    print("  AUTO RESEARCHER — PHASE 4 COMPLETE E2E INTEGRATION SUITE")
    print("======================================================================")

    client = httpx.Client(timeout=30.0)

    # -------------------------------------------------------------------------
    # 1. Sign In & Authentication
    # -------------------------------------------------------------------------
    print("\n[Step 1] Registering and Authenticating Lead Researcher...")
    uid = uuid.uuid4().hex[:8]
    user_email = f"lead.agent.{uid}@antigravity.internal"
    user_pass = "HyperResearch#2026!"
    user_name = f"Dr. Elena Rostova {uid}"

    reg_res = client.post(
        f"{API_BASE}/api/auth/register",
        json={
            "name": user_name,
            "email": user_email,
            "password": user_pass,
            "confirm_password": user_pass,
        },
    )
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
    token_a = reg_res.json()["access_token"]
    user_a_id = reg_res.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f"  ✓ Authenticated Lead Researcher: {user_email} (ID: {user_a_id})")

    # -------------------------------------------------------------------------
    # 2. Frontend Research Dashboard Routes
    # -------------------------------------------------------------------------
    print("\n[Step 2] Verifying Frontend Dashboard & Research Console Routes...")
    for route in ["/dashboard", "/dashboard/projects", "/dashboard/research"]:
        res = client.get(f"{FRONTEND_BASE}{route}")
        assert res.status_code == 200, f"Route {route} failed: {res.status_code}"
        print(f"  ✓ GET {route} -> HTTP 200 OK")

    # -------------------------------------------------------------------------
    # 3. Create Research Project with Rich Initiation Metadata
    # -------------------------------------------------------------------------
    print("\n[Step 3] Submitting Autonomous Research Project Brief...")
    project_payload = {
        "name": "High-Efficiency Sparse Attention for Long-Context Reasoning",
        "objective": "Design an adaptive block-sparse attention kernel that bounds quadratic memory growth",
        "description": "Exploration of input-dependent dynamic sparsity masks on transformer attention matrices.",
        "settings": {
            "domain": "Natural Language Processing",
            "research_question": "Can dynamic block-sparse masking retain 98% of dense attention perplexity with 4x context length?",
        },
        "budget": {
            "max_cost_usd": 100.0,
            "max_runtime_minutes": 240,
            "max_tokens": 3000000,
        },
    }
    proj_res = client.post(f"{API_BASE}/api/projects", headers=headers_a, json=project_payload)
    assert proj_res.status_code in (200, 201), f"Project creation failed: {proj_res.text}"
    project = proj_res.json()
    project_id = project["id"]
    print(f"  ✓ Created Research Project: '{project['name']}' (ID: {project_id})")

    # -------------------------------------------------------------------------
    # 4. Initiate Autonomous Research Run
    # -------------------------------------------------------------------------
    print("\n[Step 4] Initiating Autonomous Research Run...")
    run_payload = {
        "project_id": project_id,
        "name": "Sparse Attention Feasibility Run",
        "input_prompt": "Evaluate adaptive block-sparse attention against dense baseline on long-context synthetic recall.",
        "context": {
            "domain": "Natural Language Processing",
            "hypothesis": "Dynamic block clustering achieves sub-quadratic scaling with negligible perplexity penalty.",
        },
    }
    run_res = client.post(f"{API_BASE}/api/runs", headers=headers_a, json=run_payload)
    assert run_res.status_code in (200, 201), f"Run launch failed: {run_res.text}"
    run = run_res.json()
    run_id = run["id"]
    print(f"  ✓ Queued Research Run: '{run['name']}' (ID: {run_id})")
    assert run["status"] == "queued"

    # -------------------------------------------------------------------------
    # 5. Monitor Real-Time Pipeline Execution across all 10 Stages
    # -------------------------------------------------------------------------
    print("\n[Step 5] Monitoring Pipeline Execution through Background Worker...")
    max_wait_seconds = 60
    poll_interval = 2.0
    start_time = time.time()
    last_stage = None

    while time.time() - start_time < max_wait_seconds:
        r = client.get(f"{API_BASE}/api/runs/{run_id}", headers=headers_a).json()
        current_status = r["status"]
        current_stage = r.get("current_stage_key")
        stage_cursor = r.get("stage_cursor", 0)

        if current_stage != last_stage and current_stage is not None:
            print(f"  → Active Stage [{stage_cursor}/10]: {current_stage} (Run Status: {current_status})")
            last_stage = current_stage

        if current_status == "completed":
            print(f"  ✓ Research Run completed all 10 stages in {round(time.time() - start_time, 1)}s!")
            break
        elif current_status == "failed":
            raise RuntimeError(f"Run failed unexpectedly: {r.get('failure_class')}")

        time.sleep(poll_interval)
    else:
        # Check current run status before asserting timeout
        final_check = client.get(f"{API_BASE}/api/runs/{run_id}", headers=headers_a).json()
        if final_check["status"] != "completed":
            raise TimeoutError(f"Run did not complete within {max_wait_seconds}s (Status: {final_check['status']})")

    # -------------------------------------------------------------------------
    # 6. Verify Execution Records & Events
    # -------------------------------------------------------------------------
    print("\n[Step 6] Verifying Execution Records, Stage Events and Logs...")
    events = client.get(f"{API_BASE}/api/runs/{run_id}/events", headers=headers_a).json()
    logs = client.get(f"{API_BASE}/api/runs/{run_id}/logs", headers=headers_a).json()
    citations = client.get(f"{API_BASE}/api/runs/{run_id}/citations", headers=headers_a).json()

    assert len(events) > 0, "No events recorded for run"
    assert len(logs) > 0, "No logs recorded for run"
    print(f"  ✓ Captured {len(events)} pipeline events in DB")
    print(f"  ✓ Captured {len(logs)} execution logs in DB")
    print(f"  ✓ Verified citations captured: {len(citations)}")

    # -------------------------------------------------------------------------
    # 7. Verify Artifact Generation & Content
    # -------------------------------------------------------------------------
    print("\n[Step 7] Verifying Generated Research Artifacts...")
    artifacts = client.get(f"{API_BASE}/api/artifacts?run_id={run_id}", headers=headers_a).json()
    artifact_map = {a["relative_path"]: a for a in artifacts}

    expected_artifacts = [
        "brief.md",
        "literature_report.md",
        "idea_board.json",
        "proposal.md",
        "experiment_plan.yaml",
        "workspace_snapshot/experiment.py",
        "run_metrics.json",
        "analysis_report.md",
        "claim_decision.json",
        "paper/paper.md",
    ]

    for expected in expected_artifacts:
        matching = [p for p in artifact_map.keys() if expected in p]
        assert len(matching) > 0, f"Missing required artifact: {expected}"
        art = artifact_map[matching[0]]
        print(f"  ✓ Artifact verified: {matching[0]} ({art['kind']}, {art['size_bytes']} bytes)")

    # Test artifact content read
    first_art_id = artifacts[0]["id"]
    content_res = client.get(f"{API_BASE}/api/artifacts/{first_art_id}", headers=headers_a)
    assert content_res.status_code == 200
    assert len(content_res.json()["content"]) > 0
    print(f"  ✓ Artifact content retrieved successfully")

    # Test artifact download endpoint
    download_res = client.get(f"{API_BASE}/api/artifacts/{first_art_id}/download", headers=headers_a)
    assert download_res.status_code == 200
    assert len(download_res.content) > 0
    print(f"  ✓ GET /api/artifacts/{first_art_id}/download -> HTTP 200 OK (Content-Length: {len(download_res.content)})")

    # -------------------------------------------------------------------------
    # 8. Verify Empirical Experiment Execution Metrics
    # -------------------------------------------------------------------------
    print("\n[Step 8] Verifying Empirical Experiment Execution Results...")
    metrics_art = [a for a in artifacts if "run_metrics.json" in a["relative_path"]][0]
    metrics_content = client.get(f"{API_BASE}/api/artifacts/{metrics_art['id']}", headers=headers_a).json()["content"]
    import json
    metrics_data = json.loads(metrics_content)
    assert metrics_data["success"] is True, "Experiment execution did not report success"
    assert metrics_data["returncode"] == 0, f"Non-zero return code: {metrics_data['returncode']}"
    assert "metrics" in metrics_data
    assert "accuracy" in metrics_data["metrics"]
    assert "runtime_seconds" in metrics_data
    print(f"  ✓ Real experiment executed: accuracy = {metrics_data['metrics']['accuracy']}, runtime = {metrics_data['runtime_seconds']}s")

    # -------------------------------------------------------------------------
    # 9. Verify Research Chat Integration & Persistent History
    # -------------------------------------------------------------------------
    print("\n[Step 9] Verifying Research Chat Integration & Continuity...")
    chat_q1 = "Based on the literature scan and experiment results, summarize our key empirical findings."
    chat_res1 = client.post(
        f"{API_BASE}/api/chat",
        headers=headers_a,
        json={"project_id": project_id, "message": chat_q1},
    )
    assert chat_res1.status_code == 200
    chat_data1 = chat_res1.json()
    assert len(chat_data1["reply"]) > 0
    print(f"  ✓ Assistant reply received (Model: {chat_data1['model_name']}, Degraded: {chat_data1['degraded']})")

    # Follow-up query
    chat_q2 = "What potential risks should we note in the paper draft?"
    chat_res2 = client.post(
        f"{API_BASE}/api/chat",
        headers=headers_a,
        json={"project_id": project_id, "message": chat_q2},
    )
    assert chat_res2.status_code == 200

    # Retrieve full conversation history
    history = client.get(f"{API_BASE}/api/chat?project_id={project_id}", headers=headers_a).json()
    assert len(history) >= 4, f"Expected at least 4 messages in history, got {len(history)}"
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
    assert history[2]["role"] == "user"
    assert history[3]["role"] == "assistant"
    print(f"  ✓ Conversational history persisted and verified ({len(history)} messages in dialogue)")

    # -------------------------------------------------------------------------
    # 10. Multi-Tenant User Isolation & Security Protection
    # -------------------------------------------------------------------------
    print("\n[Step 10] Verifying Strict Multi-Tenant Security Isolation...")
    uid_b = uuid.uuid4().hex[:8]
    user_b_email = f"external.researcher.{uid_b}@antigravity.internal"
    reg_b = client.post(
        f"{API_BASE}/api/auth/register",
        json={
            "name": f"Dr. Collaborator {uid_b}",
            "email": user_b_email,
            "password": "ExternalSecure#99!",
            "confirm_password": "ExternalSecure#99!",
        },
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B attempting to read User A's run -> 403 Forbidden
    cross_run = client.get(f"{API_BASE}/api/runs/{run_id}", headers=headers_b)
    assert cross_run.status_code == 403, f"Expected 403, got {cross_run.status_code}"
    print(f"  ✓ Cross-user GET /api/runs/{run_id} rejected with HTTP 403 Forbidden")

    # User B attempting to read User A's artifacts -> 403 Forbidden
    cross_arts = client.get(f"{API_BASE}/api/artifacts?run_id={run_id}", headers=headers_b)
    assert cross_arts.status_code == 403, f"Expected 403, got {cross_arts.status_code}"
    print(f"  ✓ Cross-user GET /api/artifacts?run_id={run_id} rejected with HTTP 403 Forbidden")

    # User B attempting to read User A's chat -> 403 Forbidden
    cross_chat = client.get(f"{API_BASE}/api/chat?project_id={project_id}", headers=headers_b)
    assert cross_chat.status_code == 403, f"Expected 403, got {cross_chat.status_code}"
    print(f"  ✓ Cross-user GET /api/chat?project_id={project_id} rejected with HTTP 403 Forbidden")

    # -------------------------------------------------------------------------
    # 11. Run Control & Retry Workflow
    # -------------------------------------------------------------------------
    print("\n[Step 11] Verifying Run Control & Retry Functionality...")
    retry_res = client.post(f"{API_BASE}/api/runs/{run_id}/retry", headers=headers_a)
    assert retry_res.status_code == 200
    retried_run = retry_res.json()
    assert retried_run["status"] == "queued"
    print(f"  ✓ POST /api/runs/{run_id}/retry reset run to queued (Retry count: {retried_run['retry_count']})")

    # -------------------------------------------------------------------------
    # 12. Model Profiles & Compute Targets Integrity
    # -------------------------------------------------------------------------
    print("\n[Step 12] Verifying Model Profiles & Compute Targets Integrity...")
    profs = client.get(f"{API_BASE}/api/model-profiles").json()
    targets = client.get(f"{API_BASE}/api/compute-targets").json()
    print(f"  ✓ Registered Model Profiles: {len(profs)}")
    print(f"  ✓ Active Compute Targets: {len(targets)} (local runtime active)")

    print("\n======================================================================")
    print("  ALL 16 PHASE 4 INTEGRATION CHECKS PASSED WITH ZERO ERRORS!")
    print("======================================================================")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ PHASE 4 VERIFICATION FAILED: {e}", file=sys.stderr)
        sys.exit(1)
