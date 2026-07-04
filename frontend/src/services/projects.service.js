import client from './client'

export function createProject(project) {
  return client.post('/projects', project).then((r) => r.data)
}

export function updateProject(id, patch) {
  return client.patch(`/projects/${encodeURIComponent(id)}`, patch).then((r) => r.data)
}

export function deleteProject(id) {
  return client.delete(`/projects/${encodeURIComponent(id)}`).then((r) => r.data)
}

export function createRelease(projectId, release) {
  return client
    .post(`/projects/${encodeURIComponent(projectId)}/releases`, release)
    .then((r) => r.data)
}

export function updateRelease(id, patch) {
  return client.patch(`/releases/${encodeURIComponent(id)}`, patch).then((r) => r.data)
}

export function deleteRelease(id) {
  return client.delete(`/releases/${encodeURIComponent(id)}`).then((r) => r.data)
}
