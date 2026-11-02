import pytest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.main import app


FRONTEND_ORIGIN = "https://pms.knowletive.in"


@pytest.fixture
def cors_client():
    cors = next(middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware)
    original_kwargs = cors.kwargs.copy()
    cors.kwargs.update(allow_origins=[FRONTEND_ORIGIN], allow_origin_regex=None)
    app.middleware_stack = None
    try:
        # Do not enter the TestClient context: CORS tests should not require a
        # live database connection or start the background reminder worker.
        yield TestClient(app)
    finally:
        cors.kwargs.clear()
        cors.kwargs.update(original_kwargs)
        app.middleware_stack = None


def test_production_frontend_origin_receives_cors_header(cors_client):
    response = cors_client.get("/health", headers={"Origin": FRONTEND_ORIGIN})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == FRONTEND_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_registration_options_preflight_allows_browser_headers_without_auth(cors_client):
    response = cors_client.options(
        "/api/v1/organizations/register",
        headers={
            "Origin": FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == FRONTEND_ORIGIN
    assert "POST" in response.headers["access-control-allow-methods"]
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers
    assert "content-type" in allowed_headers


def test_unlisted_origin_is_not_allowed(cors_client):
    response = cors_client.options(
        "/api/v1/organizations/register",
        headers={
            "Origin": "https://unauthorized-example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_does_not_bypass_authentication_for_protected_routes(cors_client):
    response = cors_client.get(
        "/api/v1/organizations/current",
        headers={"Origin": FRONTEND_ORIGIN},
    )

    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == FRONTEND_ORIGIN


def test_workspace_registration_route_and_schema_remain_available(cors_client):
    response = cors_client.post(
        "/api/v1/organizations/register",
        json={},
        headers={"Origin": FRONTEND_ORIGIN},
    )

    assert response.status_code == 422
    assert response.headers["access-control-allow-origin"] == FRONTEND_ORIGIN
