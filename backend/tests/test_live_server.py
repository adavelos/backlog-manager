"""System test: the API as a separate process, reached over a real socket.

This is the closest the tests get to the deployed container: uvicorn runs on its own
port with its own data folder, and the test talks to it with plain HTTP.
"""

import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def live_server(tmp_path_factory):
    port = free_port()
    data_dir = tmp_path_factory.mktemp("live-data")
    env = {**os.environ, "BACKLOG_DATA_DIR": str(data_dir)}
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=BACKEND_DIR,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                urllib.request.urlopen(f"{base}/health", timeout=1)
                break
            except OSError:
                time.sleep(0.2)
        else:
            pytest.fail("the server did not start within 20 seconds")
        yield base
    finally:
        proc.terminate()
        proc.wait(timeout=10)


def get_json(url: str):
    with urllib.request.urlopen(url, timeout=5) as res:
        return res.status, json.loads(res.read())


def test_live_health(live_server):
    status, body = get_json(f"{live_server}/health")
    assert status == 200
    assert body == {"status": "ok"}


def test_live_project_round_trip(live_server):
    payload = json.dumps({"id": "live-1", "name": "Live", "key": "LIV", "type": "work"}).encode()
    req = urllib.request.Request(
        f"{live_server}/api/projects", data=payload, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=5) as res:
        assert res.status == 201
    _, projects = get_json(f"{live_server}/api/projects")
    assert "live-1" in [p["id"] for p in projects]
