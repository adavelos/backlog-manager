#!/usr/bin/env python3
import json
import requests
import uuid
import sys

BASE_URL = "http://localhost:8000/api"

def generate_id(prefix):
    """Generate a unique ID."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"

def import_backlog(file_path):
    """Import backlog from JSON file."""

    with open(file_path, 'r') as f:
        data = json.load(f)

    # Step 1: Create projects
    project_mapping = {}  # maps input project name -> id
    for proj in data.get("projects", []):
        project_id = generate_id("proj")
        project_data = {
            "id": project_id,
            "name": proj["name"],
            "type": proj.get("type", "work"),
            "description": proj.get("description", ""),
            "sortOrder": proj.get("sortOrder", 0)
        }
        response = requests.post(f"{BASE_URL}/projects", json=project_data)
        if response.status_code == 201:
            project_mapping[proj["name"]] = project_id
            print(f"✓ Created project: {proj['name']} ({project_id})")
        elif response.status_code == 400:
            # Project might already exist, try to find it
            projects_resp = requests.get(f"{BASE_URL}/projects")
            if projects_resp.status_code == 200:
                for existing_proj in projects_resp.json():
                    if existing_proj["name"] == proj["name"]:
                        project_mapping[proj["name"]] = existing_proj["id"]
                        print(f"✓ Using existing project: {proj['name']} ({existing_proj['id']})")
                        break
        else:
            print(f"✗ Failed to create project {proj['name']}: {response.text}")

    # Step 2: Create releases
    release_mapping = {}  # maps (project, release_name) -> id
    for proj_name, releases in data.get("releases", {}).items():
        project_id = project_mapping.get(proj_name)
        if not project_id:
            continue

        for rel in releases:
            release_id = generate_id("rel")
            release_data = {
                "id": release_id,
                "name": rel["name"],
                "state": rel.get("state", "PLANNED"),
                "description": rel.get("description", ""),
                "note": rel.get("note", ""),
                "sortOrder": rel.get("sortOrder", 0)
            }
            response = requests.post(
                f"{BASE_URL}/projects/{project_id}/releases",
                json=release_data
            )
            if response.status_code == 201:
                release_mapping[(proj_name, rel["name"])] = release_id
                print(f"✓ Created release: {proj_name}/{rel['name']} ({release_id})")
            elif response.status_code == 400:
                # Release might already exist, try to find it
                get_resp = requests.get(f"{BASE_URL}/projects/{project_id}")
                if get_resp.status_code == 200:
                    proj_data = get_resp.json()
                    for existing_rel in proj_data.get("releases", []):
                        if existing_rel["name"] == rel["name"]:
                            release_mapping[(proj_name, rel["name"])] = existing_rel["id"]
                            print(f"✓ Using existing release: {proj_name}/{rel['name']} ({existing_rel['id']})")
                            break
            else:
                print(f"✗ Failed to create release {proj_name}/{rel['name']}: {response.text}")

    # Step 3: Create items
    for item in data.get("items", []):
        proj_name = item["projectName"]
        project_id = project_mapping.get(proj_name)
        if not project_id:
            print(f"✗ Project '{proj_name}' not found for item {item.get('title')}")
            continue

        release_name = item.get("releaseName")
        release_id = None
        if release_name:
            release_id = release_mapping.get((proj_name, release_name))

        item_data = {
            "id": generate_id("item"),
            "projectId": project_id,
            "title": item["title"],
            "state": item.get("state", "BACKLOG"),
            "priority": item.get("priority"),
            "type": item.get("type"),
            "analysis": item.get("analysis", ""),
            "tags": item.get("tags", []),
            "filesAffected": item.get("filesAffected", []),
            "releaseId": release_id,
            "sortOrder": item.get("sortOrder", 0)
        }
        response = requests.post(f"{BASE_URL}/items", json=item_data)
        if response.status_code == 201:
            print(f"✓ Created item: {item['title'][:50]}")
        else:
            print(f"✗ Failed to create item {item['title']}: {response.text}")

    # Step 4: Create notes
    for note in data.get("notes", []):
        proj_name = note.get("projectName")
        project_id = project_mapping.get(proj_name) if proj_name else None

        release_name = note.get("releaseName")
        release_id = None
        if release_name and proj_name:
            release_id = release_mapping.get((proj_name, release_name))

        note_data = {
            "id": generate_id("note"),
            "projectId": project_id,
            "releaseId": release_id,
            "title": note.get("title", ""),
            "content": note["content"]
        }
        response = requests.post(f"{BASE_URL}/notes", json=note_data)
        if response.status_code == 201:
            print(f"✓ Created note: {note.get('title', '(untitled)')[:50]}")
        else:
            print(f"✗ Failed to create note: {response.text}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python import_backlog.py <file.json>")
        sys.exit(1)

    import_backlog(sys.argv[1])
    print("\n✓ Import complete!")
