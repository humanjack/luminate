"""Basic API tests."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


def test_health(client):
    """Test health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_root(client):
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_init_database(client):
    """Test database initialization."""
    response = client.post("/api/init")
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_list_projects_empty(client):
    """Test listing projects when empty."""
    response = client.get("/api/projects")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_project(client):
    """Test creating a project."""
    response = client.post(
        "/api/projects",
        json={"name": "Test Project"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["currentStep"] == 1
    assert data["status"] == "draft"
    assert "id" in data


def test_get_project(client):
    """Test getting a project by ID."""
    # First create a project
    create_response = client.post(
        "/api/projects",
        json={"name": "Test Project 2"},
    )
    project_id = create_response.json()["id"]

    # Then get it
    response = client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project 2"
    assert data["id"] == project_id


def test_update_project(client):
    """Test updating a project."""
    # First create a project
    create_response = client.post(
        "/api/projects",
        json={"name": "Original Name"},
    )
    project_id = create_response.json()["id"]

    # Update it
    response = client.patch(
        f"/api/projects/{project_id}",
        json={"name": "Updated Name", "current_step": 2},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["currentStep"] == 2


def test_delete_project(client):
    """Test deleting a project."""
    # First create a project
    create_response = client.post(
        "/api/projects",
        json={"name": "To Delete"},
    )
    project_id = create_response.json()["id"]

    # Delete it
    response = client.delete(f"/api/projects/{project_id}")
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify it's gone
    get_response = client.get(f"/api/projects/{project_id}")
    assert get_response.status_code == 404


def test_get_settings(client):
    """Test getting settings."""
    response = client.get("/api/settings")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)


def test_save_settings(client):
    """Test saving settings."""
    response = client.post(
        "/api/settings",
        json={"testKey": "testValue"},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify it was saved
    get_response = client.get("/api/settings")
    assert get_response.json().get("testKey") == "testValue"
