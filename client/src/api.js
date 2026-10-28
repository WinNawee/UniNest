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
  let res
  try {
    res = await fetch('/api' + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(SERVER_DOWN)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // No JSON answer usually means the API server is not running.
    const message = data?.error || data?.errors?.join(', ') || (data ? 'Request failed' : SERVER_DOWN)
    const err = new Error(message)
    err.status = res.status
    err.data = data || {}
    throw err
  }
  return data || {}
}

const SERVER_DOWN = 'Cannot reach the UniNest server. Make sure it is running (npm start in the server folder).'

export const connectChat = () => io({ auth: { token: getToken() }, reconnectionDelayMax: 5000 })
