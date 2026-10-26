"""System tests: the running API over HTTP, with a real database file.

Each test creates its own project, so tests do not depend on each other's items.
"""

import uuid


def new_item(project_id, **overrides):
    body = {
        "id": f"i-{uuid.uuid4().hex[:8]}",
        "projectId": project_id,
        "title": "A test item",
    }
    body.update(overrides)
    return body


def test_health_reports_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_config_reports_the_data_location(client):
    res = client.get("/api/config")
    assert res.status_code == 200
    assert "dataFile" in res.json()


def test_project_is_created_and_listed(client, project):
    res = client.get("/api/projects")
    assert res.status_code == 200
    assert project["id"] in [p["id"] for p in res.json()]


def test_project_key_must_match_the_pattern(client):
    res = client.post(
        "/api/projects",
        json={"id": f"bad-{uuid.uuid4().hex[:6]}", "name": "Bad", "key": "toolong1", "type": "work"},
    )
    assert res.status_code == 422


def test_item_is_created_read_and_listed(client, project):
    payload = new_item(project["id"], priority="high")
    created = client.post("/api/items", json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["priority"] == "HIGH"
    assert created.json()["state"] == "BACKLOG"

    fetched = client.get(f"/api/items/{payload['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "A test item"

    listed = client.get("/api/items", params={"projectId": project["id"]})
    assert payload["id"] in [i["id"] for i in listed.json()]


def test_item_state_can_be_changed(client, project):
    payload = new_item(project["id"])
    client.post("/api/items", json=payload)

    res = client.patch(f"/api/items/{payload['id']}", json={"state": "DONE"})
    assert res.status_code == 200
    assert res.json()["state"] == "DONE"


def test_listing_can_filter_by_state(client, project):
    done = new_item(project["id"], state="DONE")
    todo = new_item(project["id"], state="TODO")
    client.post("/api/items", json=done)
    client.post("/api/items", json=todo)

    res = client.get("/api/items", params={"projectId": project["id"], "state": "DONE"})
    ids = [i["id"] for i in res.json()]
    assert done["id"] in ids
    assert todo["id"] not in ids


def test_candidates_are_ordered_by_priority(client, project):
    low = new_item(project["id"], state="TODO", priority="LOW")
    blocker = new_item(project["id"], state="TODO", priority="BLOCKER")
    client.post("/api/items", json=low)
    client.post("/api/items", json=blocker)

    res = client.get("/api/items/candidates", params={"projectId": project["id"], "limit": 2})
    assert res.status_code == 200
    ids = [i["id"] for i in res.json()]
    assert ids.index(blocker["id"]) < ids.index(low["id"])


def test_unknown_item_is_a_404_with_an_error_body(client):
    res = client.get("/api/items/does-not-exist")
    assert res.status_code == 404
    assert res.json()["status"] == "error"


def test_invalid_item_state_is_rejected(client, project):
    res = client.post("/api/items", json=new_item(project["id"], state="DOING"))
    assert res.status_code == 422


def test_deleted_item_is_gone(client, project):
    payload = new_item(project["id"])
    client.post("/api/items", json=payload)

    assert client.delete(f"/api/items/{payload['id']}").status_code == 200
    assert client.get(f"/api/items/{payload['id']}").status_code == 404
