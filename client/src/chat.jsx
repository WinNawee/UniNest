import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, connectChat } from './api'

// One chat connection for the whole app while logged in.
// - "version" goes up whenever something new may have arrived, so pages refetch.
// - If the live socket is down, the app checks the server every few seconds
//   and sends messages over plain HTTP instead, so chat still works.
const ChatContext = createContext(null)
export const useChat = () => useContext(ChatContext)

const POLL_MS = 3000

export function ChatProvider({ children }) {
  const [status, setStatus] = useState('connecting')
  const [version, setVersion] = useState(0)
  const [unread, setUnread] = useState(0)
  const socketRef = useRef(null)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    const socket = connectChat()
    socketRef.current = socket
    socket.on('connect', () => setStatus('live'))
    socket.on('disconnect', () => setStatus('fallback'))
    socket.on('connect_error', () => setStatus('fallback'))
    socket.on('chat:message', bump)
    return () => socket.disconnect()
  }, [bump])

  // Polling only runs while the live connection is down.
  useEffect(() => {
    if (status === 'live') return
    const t = setInterval(bump, POLL_MS)
    return () => clearInterval(t)
  }, [status, bump])

  const refreshUnread = useCallback(() => {
    api('/chats').then((d) => setUnread(d.unread)).catch(() => {})
  }, [])
  useEffect(() => {
    refreshUnread()
  }, [version, refreshUnread])

  const send = useCallback(async (to, text) => {
    const socket = socketRef.current
    if (socket?.connected) {
      const res = await socket.timeout(4000).emitWithAck('chat:send', { to, text }).catch(() => null)
      if (res?.ok) return res.message
    }
    const { message } = await api(`/chats/${to}`, { method: 'POST', body: { text } })
    bump()
    return message
  }, [bump])

  return (
    <ChatContext.Provider value={{ status, version, unread, send, refreshUnread }}>
      {children}
    </ChatContext.Provider>
  )
}
