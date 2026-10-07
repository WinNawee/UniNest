import { io } from 'socket.io-client'

// sessionStorage is per tab, so you can log in as two different people in two
// tabs of the same browser (handy for testing chat). localStorage was shared by
// every tab, so the second login replaced the first.
const TOKEN_KEY = 'uninest_token'
const store = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t) => {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t)
      else sessionStorage.removeItem(TOKEN_KEY)
    } catch { /* storage blocked */ }
  },
}
export const getToken = store.get
export const setToken = store.set

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || (data.errors && data.errors.join(', ')) || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}

export const connectChat = () => io({ auth: { token: getToken() }, reconnectionDelayMax: 5000 })
