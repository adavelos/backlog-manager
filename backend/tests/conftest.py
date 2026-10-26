import os
import shutil
import uuid
from pathlib import Path

# The settings module reads BACKLOG_DATA_DIR when it is imported, so the test data
# folder is set before the app is imported. Tests never touch the real database.
TEST_DATA_DIR = Path(__file__).resolve().parent.parent / ".test-data"
shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)
TEST_DATA_DIR.mkdir(parents=True)
os.environ["BACKLOG_DATA_DIR"] = str(TEST_DATA_DIR)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def project(client):
    """A new project for each test, so tests do not share items."""
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "id": f"p-{suffix}",
        "name": f"Project {suffix}",
        "key": uuid.uuid4().hex[:3].upper(),
        "type": "work",
    }
    res = client.post("/api/projects", json=payload)
    assert res.status_code == 201, res.text
    return res.json()
