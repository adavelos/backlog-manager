import client from './client'

export function createNote(note) {
  return client.post('/notes', note).then((r) => r.data)
}

export function updateNote(id, patch) {
  return client.patch(`/notes/${encodeURIComponent(id)}`, patch).then((r) => r.data)
}

export function deleteNote(id) {
  return client.delete(`/notes/${encodeURIComponent(id)}`).then((r) => r.data)
}
