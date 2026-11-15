"""
Auto Researcher Phase 2 Live End-to-End Verification Script
Tests all 12 Phase 2 requirements against the live running FastAPI backend on http://127.0.0.1:8000
"""

import sys
import uuid
import httpx

BASE_URL = "http://127.0.0.1:8000/api"
FE_URL = "http://127.0.0.1:3000"

unique_id = uuid.uuid4().hex[:8]
user_a_email = f"shannon_{unique_id}@bell-labs.org"
user_b_email = f"lovelace_{unique_id}@analytical.org"
password_a = "InformationTheory1948!"
password_b = "AnalyticalEngine1843!"

print("=" * 60)
print("PHASE 2 LIVE END-TO-END VERIFICATION")
print("=" * 60)

passed = 0
failed = 0

def check(test_num: int, name: str, condition: bool, extra: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"[PASS] Test {test_num:02d}: {name} {extra}")
    else:
        failed += 1
        print(f"[FAIL] Test {test_num:02d}: {name} {extra}")

with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
    # 1. Password validation: Weak password rejected
    res = client.post("/auth/register", json={
        "name": "Claude Shannon",
        "email": user_a_email,
        "password": "weak",
        "confirm_password": "weak"
    })
    check(1, "Weak password validation", res.status_code == 422, f"status={res.status_code}")

    # 2. Password validation: Confirmation mismatch rejected
    res = client.post("/auth/register", json={
        "name": "Claude Shannon",
        "email": user_a_email,
        "password": password_a,
        "confirm_password": "MismatchPassword999!"
    })
    check(2, "Password mismatch validation", res.status_code == 400 and "Passwords do not match" in res.json().get("detail", ""), f"status={res.status_code}")

    # 3. New user registration
    res = client.post("/auth/register", json={
        "name": "Dr. Claude Shannon",
        "email": user_a_email,
        "password": password_a,
        "confirm_password": password_a
    })
    set_cookie = res.headers.get("set-cookie", "")
    has_cookie = "access_token" in set_cookie and "HttpOnly" in set_cookie
    check(3, "New user registration + HttpOnly cookie", res.status_code == 201 and has_cookie, f"status={res.status_code}")
    token_a = res.json().get("access_token", "")

    # 4. Duplicate email registration rejected
    res = client.post("/auth/register", json={
        "name": "Claude Shannon Imposter",
        "email": user_a_email,
        "password": password_a,
        "confirm_password": password_a
    })
    check(4, "Duplicate email registration rejected", res.status_code == 400 and "already exists" in res.json().get("detail", ""), f"status={res.status_code}")

    # 5. Invalid login rejected
    res = client.post("/auth/login", json={
        "email": user_a_email,
        "password": "IncorrectPassword999!"
    })
    check(5, "Invalid credentials rejected", res.status_code == 401, f"status={res.status_code}")

    # 6. Valid login with Remember Me (30-day session)
    client.cookies.clear()
    res = client.post("/auth/login", json={
        "email": user_a_email,
        "password": password_a,
        "remember_me": True
    })
    set_cookie = res.headers.get("set-cookie", "")
    has_login_cookie = "access_token" in set_cookie and "HttpOnly" in set_cookie
    check(6, "Valid login sets HttpOnly cookie", res.status_code == 200 and has_login_cookie, f"status={res.status_code}")

    # 7. Session persistence via HttpOnly Cookie (GET /auth/me)
    # The client now has the cookie stored automatically
    res = client.get("/auth/me")
    check(7, "Session persistence via HttpOnly cookie", res.status_code == 200 and res.json().get("email") == user_a_email, f"user={res.json().get('email', '')}")

    # 8. Direct access without login rejected
    no_cookie_client = httpx.Client(base_url=BASE_URL, timeout=10.0)
    res = no_cookie_client.get("/auth/me")
    check(8, "Direct protected route access without login rejected", res.status_code == 401, f"status={res.status_code}")

    # 9. Logout functionality and session invalidation
    res = client.post("/auth/logout")
    del_cookie = res.headers.get("set-cookie", "")
    check(9, "Logout invalidates session cookie", res.status_code == 200 and "access_token" in del_cookie, f"status={res.status_code}")
    # After logout, /auth/me must fail
    res = client.get("/auth/me")
    check(10, "Protected route access fails after logout", res.status_code == 401, f"status={res.status_code}")

    # 10. Login Rate Limiting: 5 failed attempts trigger lockout (429)
    rate_email = f"brute_{unique_id}@test.org"
    rate_res = None
    for _ in range(5):
        rate_res = client.post("/auth/login", json={"email": rate_email, "password": "BadPassword1!"})
    check(11, "Rate limiting lockout after 5 failed attempts", rate_res.status_code == 429 and "locked" in rate_res.json().get("detail", "").lower(), f"status={rate_res.status_code}")

    # 11. Cross-User Data Isolation: User B cannot access User A's private project
    # User A creates a private project
    res_login_a = client.post("/auth/login", json={"email": user_a_email, "password": password_a})
    user_a_token = res_login_a.json()["access_token"]
    res_proj = client.post("/projects", json={
        "name": "Entropy & Coding Limits",
        "description": "Discrete noiseless channel capacities"
    }, headers={"Authorization": f"Bearer {user_a_token}"})
    proj_a_id = res_proj.json()["id"]

    # Register User B
    client_b = httpx.Client(base_url=BASE_URL, timeout=10.0)
    res_reg_b = client_b.post("/auth/register", json={
        "name": "Ada Lovelace",
        "email": user_b_email,
        "password": password_b,
        "confirm_password": password_b
    })
    user_b_token = res_reg_b.json()["access_token"]

    # User B tries to access User A's project -> MUST return 403 Forbidden
    res_cross = client_b.get(f"/projects/{proj_a_id}", headers={"Authorization": f"Bearer {user_b_token}"})
    check(12, "Cross-user data isolation (User B blocked from User A project)", res_cross.status_code == 403, f"status={res_cross.status_code}")

    # 12. Unauthenticated user blocked from User A's project -> MUST return 401 Unauthorized
    res_unauth = no_cookie_client.get(f"/projects/{proj_a_id}")
    check(13, "Unauthenticated user blocked from private project", res_unauth.status_code == 401, f"status={res_unauth.status_code}")

    # 13. Existing research functionality integrity (Health, Compute Targets, Models)
    res_health = client.get("/health")
    res_targets = client.get("/compute-targets")
    check(14, "Existing research API routes operational", res_health.status_code == 200 and res_targets.status_code == 200, f"health={res_health.json().get('status')}")

# 14. Check Frontend Web Routes
with httpx.Client(base_url=FE_URL, timeout=10.0) as fe_client:
    routes = ["/", "/signin", "/signup", "/dashboard", "/dashboard/research", "/dashboard/settings"]
    all_200 = True
    for r in routes:
        fe_res = fe_client.get(r)
        if fe_res.status_code != 200:
            all_200 = False
            break
    check(15, "Frontend Web Routes (/signin, /signup, /dashboard, etc.) return 200", all_200)

print("=" * 60)
print(f"RESULTS: {passed} PASSED, {failed} FAILED")
print("=" * 60)

if failed > 0:
    sys.exit(1)
