// ============================================
// Backlog Manager — Granular REST API client
// ============================================
//
// Each function performs exactly one scoped write against the server.
// Unlike the old saveDataToServer() (which replaced the entire dataset
// on every save), these calls only ever touch the specific row(s) they
// name — so concurrent edits to different items/projects/notes no
// longer clobber each other.

async function apiRequest(method, url, body) {
  const resp = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const message = err.message || `${method} ${url} failed (${resp.status})`;
    throw new Error(message);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// --- Projects ---

function apiCreateProject(project) {
  return apiRequest("POST", "/api/projects", project);
}

function apiUpdateProject(id, patch) {
  return apiRequest("PATCH", `/api/projects/${encodeURIComponent(id)}`, patch);
}

function apiDeleteProject(id) {
  return apiRequest("DELETE", `/api/projects/${encodeURIComponent(id)}`);
}

// --- Releases ---

function apiCreateRelease(projectId, release) {
  return apiRequest("POST", `/api/projects/${encodeURIComponent(projectId)}/releases`, release);
}

function apiUpdateRelease(id, patch) {
  return apiRequest("PATCH", `/api/releases/${encodeURIComponent(id)}`, patch);
}

function apiDeleteRelease(id) {
  return apiRequest("DELETE", `/api/releases/${encodeURIComponent(id)}`);
}

// --- Items ---

function apiCreateItem(item) {
  return apiRequest("POST", "/api/items", item);
}

function apiUpdateItem(id, patch) {
  return apiRequest("PATCH", `/api/items/${encodeURIComponent(id)}`, patch);
}

function apiDeleteItem(id) {
  return apiRequest("DELETE", `/api/items/${encodeURIComponent(id)}`);
}

// --- Notes ---

function apiCreateNote(note) {
  return apiRequest("POST", "/api/notes", note);
}

function apiUpdateNote(id, patch) {
  return apiRequest("PATCH", `/api/notes/${encodeURIComponent(id)}`, patch);
}

function apiDeleteNote(id) {
  return apiRequest("DELETE", `/api/notes/${encodeURIComponent(id)}`);
}
