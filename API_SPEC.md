# Backlog Manager API Specification

**Version**: 1.0.0  
**Base URL**: `http://localhost:8000/api` (development) or `http://localhost:3000/api` (production)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Security](#authentication--security)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Error Handling](#error-handling)
6. [Usage Examples](#usage-examples)
7. [Auto-Creating Backlog from File](#auto-creating-backlog-from-file)

---

## Overview

Backlog Manager is a local-first backlog management system built with FastAPI and SQLite. The API provides RESTful endpoints to manage:

- **Projects**: Organize work into projects (types: "work", "argonath")
- **Releases**: Group items into release cycles within a project
- **Items**: Individual backlog items with state, priority, tags, and metadata
- **Notes**: Project/release-level documentation with Markdown support
- **Scratchpads**: Global persistent notepads per type ("work", "argonath")

All data is stored in SQLite at `~/.backlog/data/backlog.sqlite3` and is accessible through this REST API.

---

## Authentication & Security

**No authentication is required.** This is a single-user, local-first application intended for personal use on a single machine.

- **CORS**: Not applicable (single-user, local deployment)
- **HTTPS**: Not required (local use)
- **Session Management**: None (stateless REST API)

---

## Data Models

### Project Types (Scopes)

Projects are organized by **`type`**, which acts as a scope or category:
- `"work"` — Professional/work-related projects
- `"argonath"` — Secondary scope (e.g., personal, research, or alternative category)

The UI toggles between these two scopes via the header. A user can have projects in either scope, and they are kept organizationally separate in the UI while sharing the same backend database.

### Common Fields

All resources include timestamps (milliseconds since epoch):
- `createdAt`: Timestamp when created
- `updatedAt`: Timestamp when last updated

### Project

```json
{
  "id": "unique-string-id",
  "name": "My Project",
  "type": "work",
  "description": "Project description",
  "repoPath": "/path/to/repo",
  "sortOrder": 0,
  "createdAt": 1717713600000,
  "updatedAt": 1717713600000,
  "releases": []
}
```

**Fields:**
- `id`: Unique identifier (required on create)
- `name`: Project name (required)
- `type`: "work" or "argonath" (required)
- `description`: Markdown text
- `repoPath`: Path to associated repository
- `sortOrder`: Float for ordering projects

---

### Release

```json
{
  "id": "unique-string-id",
  "projectId": "project-id",
  "name": "v1.0.0",
  "state": "PLANNED",
  "description": "Release description",
  "startDate": 1717713600000,
  "endDate": 1720305600000,
  "note": "Markdown release notes",
  "sortOrder": 0,
  "createdAt": 1717713600000,
  "updatedAt": 1717713600000
}
```

**Fields:**
- `id`: Unique identifier (required on create)
- `projectId`: Parent project ID (required)
- `name`: Release name (required)
- `state`: "PLANNED", "ACTIVE", or "RELEASED"
- `description`: Release description
- `startDate`: Epoch timestamp (milliseconds)
- `endDate`: Epoch timestamp (milliseconds)
- `note`: Markdown release notes
- `sortOrder`: Float for ordering releases

---

### Item

```json
{
  "id": "unique-string-id",
  "projectId": "project-id",
  "releaseId": "release-id-or-null",
  "title": "Fix login bug",
  "state": "TODO",
  "priority": "high",
  "type": "bug",
  "analysis": "Root cause analysis",
  "prompt": "AI prompt for generation",
  "report": "Analysis or test report",
  "filesAffected": ["src/auth.js", "src/login.vue"],
  "tags": ["frontend", "security"],
  "subitems": [
    {
      "id": "subitem-1",
      "title": "Write unit tests",
      "done": false
    }
  ],
  "sortOrder": 0,
  "completedAt": null,
  "createdAt": 1717713600000,
  "updatedAt": 1717713600000
}
```

**Fields:**
- `id`: Unique identifier (required on create)
- `projectId`: Parent project ID (required)
- `releaseId`: Associated release (optional, can be set to null)
- `title`: Item title (required)
- `state`: "BACKLOG", "TODO", "ONGOING", or "DONE"
- `priority`: String (e.g., "low", "medium", "high")
- `type`: String (e.g., "feature", "bug", "chore")
- `analysis`: Markdown analysis text
- `prompt`: AI prompt context
- `report`: Analysis or testing results
- `filesAffected`: Array of file paths
- `tags`: Array of string tags
- `subitems`: Array of `{id, title, done}`
- `sortOrder`: Float for drag-and-drop ordering
- `completedAt`: Epoch timestamp when moved to DONE (auto-set)

---

### Note

```json
{
  "id": "unique-string-id",
  "projectId": "project-id-or-null",
  "releaseId": "release-id-or-null",
  "title": "Design Notes",
  "content": "# Markdown\n\nSupported here",
  "createdAt": 1717713600000,
  "updatedAt": 1717713600000
}
```

**Fields:**
- `id`: Unique identifier (required on create)
- `projectId`: Associated project (optional)
- `releaseId`: Associated release (optional)
- `title`: Note title
- `content`: Markdown text

---

### Scratchpad

```json
{
  "type": "work",
  "content": "# Markdown\n\nGlobal scratchpad content",
  "createdAt": 1717713600000,
  "updatedAt": 1717713600000
}
```

**Fields:**
- `type`: "work" or "argonath" (primary key)
- `content`: Markdown text
- Auto-created on app startup if missing

---

## API Endpoints

### Configuration

#### Get Configuration
```
GET /api/config
```

Returns current app configuration.

**Response:**
```json
{
  "dataDir": "/home/user/.backlog/data",
  "dataFile": "/home/user/.backlog/data/backlog.sqlite3",
  "dataTimestamp": 1720305600000
}
```

---

### Backlog (Aggregate)

#### Get Full Backlog Snapshot
```
GET /api/backlog
```

Returns complete backlog snapshot for initial page load (projects, items, notes, scratchpads all at once).

**Response:**
```json
{
  "projects": [
    { "id": "...", "name": "...", ... }
  ],
  "items": [
    { "id": "...", "projectId": "...", ... }
  ],
  "notes": [
    { "id": "...", "projectId": "...", ... }
  ],
  "scratchpads": {
    "work": { "type": "work", "content": "...", ... },
    "argonath": { "type": "argonath", "content": "...", ... }
  }
}
```

---

### Projects

#### List All Projects
```
GET /api/projects
```

Returns all projects with their releases.

**Response:**
```json
[
  {
    "id": "project-1",
    "name": "My Project",
    "type": "work",
    "description": "...",
    "repoPath": "...",
    "sortOrder": 0,
    "createdAt": 1717713600000,
    "updatedAt": 1717713600000,
    "releases": [...]
  }
]
```

---

#### Create Project
```
POST /api/projects
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "project-1",
  "name": "My Project",
  "type": "work",
  "description": "Project description",
  "repoPath": "/path/to/repo",
  "sortOrder": 0
}
```

**Response:** `201 Created` with full Project object

**Errors:**
- `400`: Conflict (id already exists)

---

#### Update Project
```
PATCH /api/projects/{projectId}
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "name": "Updated Name",
  "description": "New description",
  "sortOrder": 1
}
```

**Response:** Updated Project object

**Errors:**
- `404`: Project not found

---

#### Delete Project
```
DELETE /api/projects/{projectId}
```

Cascades to all items, releases, and notes.

**Response:**
```json
{
  "status": "ok"
}
```

**Errors:**
- `404`: Project not found

---

### Releases

#### Create Release (under Project)
```
POST /api/projects/{projectId}/releases
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "release-1",
  "name": "v1.0.0",
  "state": "PLANNED",
  "description": "Release description",
  "startDate": 1717713600000,
  "endDate": 1720305600000,
  "note": "Release notes",
  "sortOrder": 0
}
```

**Response:** `201 Created` with Release object

**Errors:**
- `400`: Conflict (id already exists)
- `404`: Project not found

---

#### Update Release
```
PATCH /api/releases/{releaseId}
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "name": "v1.1.0",
  "state": "ACTIVE",
  "sortOrder": 1
}
```

**Response:** Updated Release object

**Errors:**
- `404`: Release not found

---

#### Delete Release
```
DELETE /api/releases/{releaseId}
```

Items associated with this release have `releaseId` set to null.

**Response:**
```json
{
  "status": "ok"
}
```

**Errors:**
- `404`: Release not found

---

### Items

#### List Items (with Filtering)
```
GET /api/items
```

**Query Parameters:**
- `projectId` (optional): Filter by project
- `state` (optional): Filter by state (BACKLOG, TODO, ONGOING, DONE)
- `releaseId` (optional): Filter by release

**Example:**
```
GET /api/items?projectId=project-1&state=TODO
```

**Response:**
```json
[
  {
    "id": "item-1",
    "projectId": "project-1",
    "title": "Fix login",
    "state": "TODO",
    ...
  }
]
```

---

#### Create Item
```
POST /api/items
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "item-1",
  "projectId": "project-1",
  "title": "Fix login bug",
  "state": "BACKLOG",
  "priority": "high",
  "type": "bug",
  "releaseId": "release-1",
  "filesAffected": ["src/auth.js"],
  "tags": ["frontend"],
  "subitems": [],
  "sortOrder": 0
}
```

**Response:** `201 Created` with Item object

**Errors:**
- `400`: Conflict or validation error
- `404`: Project or Release not found

---

#### Update Item
```
PATCH /api/items/{itemId}
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "title": "Updated title",
  "state": "DONE",
  "priority": "low",
  "sortOrder": 5
}
```

**Response:** Updated Item object

**Errors:**
- `404`: Item not found

---

#### Delete Item
```
DELETE /api/items/{itemId}
```

**Response:**
```json
{
  "status": "ok"
}
```

**Errors:**
- `404`: Item not found

---

### Notes

#### Create Note
```
POST /api/notes
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "note-1",
  "projectId": "project-1",
  "releaseId": null,
  "title": "Design Notes",
  "content": "# Markdown\n\nContent here"
}
```

**Response:** `201 Created` with Note object

**Errors:**
- `400`: Conflict or validation error
- `404`: Project or Release not found

---

#### Update Note
```
PATCH /api/notes/{noteId}
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "content": "Updated markdown content"
}
```

**Response:** Updated Note object

**Errors:**
- `404`: Note not found

---

#### Delete Note
```
DELETE /api/notes/{noteId}
```

**Response:**
```json
{
  "status": "ok"
}
```

**Errors:**
- `404`: Note not found

---

### Scratchpads

#### Update Scratchpad
```
PATCH /api/scratchpads/{type}
Content-Type: application/json
```

**Path Parameters:**
- `type`: "work" or "argonath"

**Request Body:**
```json
{
  "content": "# Updated scratchpad\n\nContent here"
}
```

**Response:** Updated Scratchpad object

**Errors:**
- `404`: Scratchpad type not found

---

## Error Handling

### Error Response Format

All errors return JSON with status and message:

```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Created |
| `400` | Bad Request or Conflict (e.g., duplicate id) |
| `404` | Not Found |
| `500` | Server Error |

---

## Usage Examples

### Python Example (Using Requests)

```python
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

# Create a project
project_data = {
    "id": "my-project",
    "name": "My First Project",
    "type": "work",
    "description": "A test project"
}
response = requests.post(f"{BASE_URL}/projects", json=project_data)
print(response.status_code, response.json())

# Create a release
release_data = {
    "id": "v1.0",
    "name": "Version 1.0",
    "state": "PLANNED",
    "description": "First release"
}
response = requests.post(f"{BASE_URL}/projects/my-project/releases", json=release_data)
print(response.status_code, response.json())

# Create an item
item_data = {
    "id": "item-1",
    "projectId": "my-project",
    "title": "Implement login",
    "state": "TODO",
    "priority": "high",
    "type": "feature",
    "releaseId": "v1.0",
    "tags": ["frontend"]
}
response = requests.post(f"{BASE_URL}/items", json=item_data)
print(response.status_code, response.json())

# Update item state
update_data = {"state": "DONE"}
response = requests.patch(f"{BASE_URL}/items/item-1", json=update_data)
print(response.status_code, response.json())

# List all items in a project
response = requests.get(f"{BASE_URL}/items?projectId=my-project")
items = response.json()
print(f"Found {len(items)} items")
```

### JavaScript/Node.js Example

```javascript
const BASE_URL = "http://localhost:8000/api";

async function createProject() {
  const response = await fetch(`${BASE_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "my-project",
      name: "My Project",
      type: "work"
    })
  });
  return response.json();
}

async function createItem(projectId, title) {
  const response = await fetch(`${BASE_URL}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `item-${Date.now()}`,
      projectId: projectId,
      title: title,
      state: "BACKLOG"
    })
  });
  return response.json();
}

async function listItems(projectId) {
  const response = await fetch(
    `${BASE_URL}/items?projectId=${encodeURIComponent(projectId)}`
  );
  return response.json();
}

// Usage
(async () => {
  const project = await createProject();
  console.log("Created project:", project);

  const item = await createItem("my-project", "Task 1");
  console.log("Created item:", item);

  const items = await listItems("my-project");
  console.log("Items:", items);
})();
```

### cURL Examples

```bash
# Create a project
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-project",
    "name": "My Project",
    "type": "work"
  }'

# Create a release
curl -X POST http://localhost:8000/api/projects/my-project/releases \
  -H "Content-Type: application/json" \
  -d '{
    "id": "v1.0",
    "name": "Version 1.0",
    "state": "PLANNED"
  }'

# Create an item
curl -X POST http://localhost:8000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "id": "item-1",
    "projectId": "my-project",
    "title": "Implement feature",
    "state": "TODO"
  }'

# List items in a project
curl "http://localhost:8000/api/items?projectId=my-project"

# Update an item
curl -X PATCH http://localhost:8000/api/items/item-1 \
  -H "Content-Type: application/json" \
  -d '{"state": "DONE"}'
```

---

## Auto-Creating Backlog from File

To automatically create a backlog from an external file format, follow this pattern:

### Recommended Workflow

1. **Parse your source file** (JSON, YAML, CSV, etc.) into structured data
2. **Map to Backlog Manager data model** using the schemas above
3. **Generate unique IDs** for projects, releases, items, and notes
4. **Create in dependency order**:
   - Projects first
   - Releases (depend on Projects)
   - Items (depend on Projects and optionally Releases)
   - Notes (depend on Projects and Releases)

### Example: Import from JSON File

Create a file `import_backlog.py`:

```python
#!/usr/bin/env python3
import json
import requests
import uuid
from datetime import datetime

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
            "description": item.get("description", ""),
            "analysis": item.get("analysis"),
            "tags": item.get("tags", []),
            "filesAffected": item.get("filesAffected", []),
            "releaseId": release_id,
            "sortOrder": item.get("sortOrder", 0)
        }
        response = requests.post(f"{BASE_URL}/items", json=item_data)
        if response.status_code == 201:
            print(f"✓ Created item: {item['title']} ({project_id})")
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
            print(f"✓ Created note: {note.get('title', '(untitled)')}")
        else:
            print(f"✗ Failed to create note: {response.text}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python import_backlog.py <file.json>")
        sys.exit(1)
    
    import_backlog(sys.argv[1])
    print("\n✓ Import complete!")
```

### Input File Format (JSON)

```json
{
  "projects": [
    {
      "name": "Backend API",
      "type": "work",
      "description": "Core REST API",
      "sortOrder": 0
    }
  ],
  "releases": {
    "Backend API": [
      {
        "name": "v1.0",
        "state": "PLANNED",
        "description": "Initial release",
        "sortOrder": 0
      }
    ]
  },
  "items": [
    {
      "projectName": "Backend API",
      "releaseName": "v1.0",
      "title": "Setup authentication",
      "state": "TODO",
      "priority": "high",
      "type": "feature",
      "tags": ["auth", "security"],
      "sortOrder": 0
    }
  ],
  "notes": [
    {
      "projectName": "Backend API",
      "title": "Architecture Notes",
      "content": "# Architecture\n\nWe use FastAPI..."
    }
  ]
}
```

### Running the Import

```bash
python import_backlog.py backlog.json
```

---

## Tips for Integration

1. **ID Generation**: Use `uuid` or timestamp-based IDs to ensure uniqueness
2. **Timestamps**: Dates should be epoch milliseconds
3. **State Validation**: Items must have state in [BACKLOG, TODO, ONGOING, DONE]
4. **Type Validation**: Projects must be "work" or "argonath"
5. **Dependencies**: Always create projects/releases before items that reference them
6. **Error Handling**: Check HTTP status codes (201 for success, 400/404 for errors)
7. **Batch Operations**: Consider batching requests to reduce HTTP overhead

---

## Rate Limiting & Performance

- **No rate limiting** is enforced (single-user app)
- **SQLite transactions** handle ACID compliance
- For large imports (100+ items), consider:
  - Batching POST requests in groups
  - Adding 10-50ms delays between requests to avoid database locks
  - Using database connection pooling

---

## Support & Questions

For issues or questions about the API:
1. Check the backend logs at `/tmp/backlog-manager*.log`
2. Verify the database file exists at `~/.backlog/data/backlog.sqlite3`
3. Ensure the backend is running on the configured port
