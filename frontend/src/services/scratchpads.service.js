import client from './client'

export function updateScratchpad(type, patch) {
  return client.patch(`/scratchpads/${encodeURIComponent(type)}`, patch).then((r) => r.data)
}
