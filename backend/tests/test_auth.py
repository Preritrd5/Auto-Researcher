from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import get_db_session
from app.core.rate_limit import login_limiter
from app.db.models import Base
from app.main import app


@pytest.mark.asyncio
async def test_auth_workflow() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db_session():
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Password confirmation mismatch
        mismatch_resp = await client.post(
            "/api/auth/register",
            json={
                "name": "Dr. Marie Curie",
                "email": "curie@radium.org",
                "password": "SecurePassword123!",
                "confirm_password": "DifferentPassword456!",
            },
        )
        assert mismatch_resp.status_code == 400
        assert "Passwords do not match" in mismatch_resp.json()["detail"]

        # 2. Weak password validation
        weak_resp = await client.post(
            "/api/auth/register",
            json={
                "name": "Dr. Marie Curie",
                "email": "curie@radium.org",
                "password": "weak",
                "confirm_password": "weak",
            },
        )
        assert weak_resp.status_code == 422  # Pydantic validation error

        # 3. Successful Registration
        reg_resp = await client.post(
            "/api/auth/register",
            json={
                "name": "Dr. Marie Curie",
                "email": "curie@radium.org",
                "password": "SecurePassword123!",
                "confirm_password": "SecurePassword123!",
            },
        )
        assert reg_resp.status_code == 201
        data = reg_resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == "curie@radium.org"
        assert data["user"]["name"] == "Dr. Marie Curie"
        # Check HttpOnly cookie was set
        assert "access_token" in reg_resp.cookies

        # 4. Duplicate registration rejected
        dup_resp = await client.post(
            "/api/auth/register",
            json={
                "name": "Duplicate Person",
                "email": "curie@radium.org",
                "password": "AnotherPassword123!",
            },
        )
        assert dup_resp.status_code == 400
        assert "already exists" in dup_resp.json()["detail"]

        # 5. Login with invalid password
        fail_login = await client.post(
            "/api/auth/login",
            json={"email": "curie@radium.org", "password": "WrongPassword123!"},
        )
        assert fail_login.status_code == 401

        # 6. Valid login with Remember Me
        login_resp = await client.post(
            "/api/auth/login",
            json={
                "email": "curie@radium.org",
                "password": "SecurePassword123!",
                "remember_me": True,
            },
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        assert "access_token" in login_resp.cookies

        # 7. Get current user profile via Cookie
        me_cookie_resp = await client.get("/api/auth/me")
        assert me_cookie_resp.status_code == 200
        assert me_cookie_resp.json()["email"] == "curie@radium.org"

        # 8. Get current user profile via Bearer Header
        me_header_resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_header_resp.status_code == 200
        assert me_header_resp.json()["name"] == "Dr. Marie Curie"

        # 9. Logout clears cookie
        logout_resp = await client.post("/api/auth/logout")
        assert logout_resp.status_code == 200
        # Cookie deleted or empty
        val = logout_resp.cookies.get("access_token")
        assert val is None or val == '""'

        # 10. Direct access to /api/auth/me without login is rejected
        # Clear cookies on client
        client.cookies.clear()
        no_auth = await client.get("/api/auth/me")
        assert no_auth.status_code == 401

        # 11. Rate limiting on repeated failed logins
        login_limiter.clear("127.0.0.1:ratetest@lab.org")
        for _ in range(4):
            r = await client.post(
                "/api/auth/login",
                json={"email": "ratetest@lab.org", "password": "BadPassword1!"},
            )
            assert r.status_code == 401

        # 5th failure triggers lockout
        r5 = await client.post(
            "/api/auth/login",
            json={"email": "ratetest@lab.org", "password": "BadPassword1!"},
        )
        assert r5.status_code == 429
        assert "locked" in r5.json()["detail"].lower()

        # 12. Cross-user project access restriction
        # Register User 2
        reg_user2 = await client.post(
            "/api/auth/register",
            json={
                "name": "Dr. Albert Einstein",
                "email": "einstein@princeton.edu",
                "password": "Relativity1905!",
            },
        )
        user2_token = reg_user2.json()["access_token"]

        # User 1 creates a private project
        proj_resp = await client.post(
            "/api/projects",
            json={"name": "Radioactivity Study", "description": "Polonium isolation"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert proj_resp.status_code == 200
        proj_id = proj_resp.json()["id"]

        # User 1 can access it
        u1_access = await client.get(
            f"/api/projects/{proj_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert u1_access.status_code == 200

        # User 2 CANNOT access User 1's project -> 403 Forbidden
        u2_access = await client.get(
            f"/api/projects/{proj_id}",
            headers={"Authorization": f"Bearer {user2_token}"},
        )
        assert u2_access.status_code == 403
        assert "Access denied" in u2_access.json()["detail"]

        # Unauthenticated user CANNOT access User 1's project -> 401 Unauthorized
        client.cookies.clear()
        unauth_access = await client.get(f"/api/projects/{proj_id}")
        assert unauth_access.status_code == 401

    app.dependency_overrides.clear()
