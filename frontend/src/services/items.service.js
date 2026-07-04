import client from './client'

export function createItem(item) {
  return client.post('/items', item).then((r) => r.data)
}

export function updateItem(id, patch) {
  return client.patch(`/items/${encodeURIComponent(id)}`, patch).then((r) => r.data)
}

export function deleteItem(id) {
  return client.delete(`/items/${encodeURIComponent(id)}`).then((r) => r.data)
}
