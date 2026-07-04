import client from './client'

export function getConfig() {
  return client.get('/config').then((r) => r.data)
}

export function getBacklog() {
  return client.get('/backlog').then((r) => r.data)
}
