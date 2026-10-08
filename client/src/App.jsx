import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { Home, LogOut, MessageCircle, ShieldCheck, Building2, UserRound, Users } from 'lucide-react'
import { api, getToken, setToken } from './api'
import { ChatProvider, useChat } from './chat'
import { Avatar, Logo } from './components/ui'
import AuthPage from './pages/AuthPage'
import QuestionnairePage from './pages/QuestionnairePage'
import MatchesPage from './pages/MatchesPage'
import ChatPage from './pages/ChatPage'
import MessagesPage from './pages/MessagesPage'
import ListingsPage from './pages/ListingsPage'
import LandlordPage from './pages/LandlordPage'
import AdminPage from './pages/AdminPage'

const linkClass = ({ isActive }) =>
  `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
    isActive ? 'bg-nest text-white shadow-sm shadow-nest/30' : 'text-ink/80 hover:bg-nest-soft hover:text-nest-dark'
  }`

function MessagesLink() {
  const { unread } = useChat()
  return (
    <NavLink to="/messages" className={linkClass}>
      <MessageCircle size={16} /> Messages
      {unread > 0 && (
        <span className="ml-0.5 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-sun text-ink text-[11px] font-bold">
          {unread}
        </span>
      )}
    </NavLink>
  )
}

export default function App() {
  const [session, setSession] = useState(null) // { user, profile, isAdmin }
  const [loading, setLoading] = useState(!!getToken())
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      setSession(await api('/me'))
    } catch {
      setToken(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (getToken()) refresh()
  }, [refresh])

  const logout = () => {
    setToken(null)
    setSession(null)
    navigate('/')
  }

  if (loading) return <p className="p-8 text-center">Loading...</p>

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage onDone={refresh} />} />
      </Routes>
    )
  }

  const { user, profile, isAdmin } = session
  const isStudent = user.role === 'student'
  const isLandlord = user.role === 'landlord'

  return (
    <ChatProvider key={user.id}>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-black/5">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
            <Logo className="text-xl" />
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full bg-cream">
                <Avatar name={user.name} size="sm" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-[11px] text-ink/60 capitalize flex items-center gap-1">
                    {user.verified && <ShieldCheck size={11} className="text-nest" />}
                    {isAdmin ? 'Admin' : user.role}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="group flex items-center gap-2 px-3.5 py-2 rounded-xl border border-black/10 text-sm font-semibold text-ink/80 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition"
              >
                <LogOut size={16} className="transition group-hover:translate-x-0.5" />
                Log out
              </button>
            </div>
          </div>
          <nav className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
            {isStudent && <NavLink to="/matches" className={linkClass}><Users size={16} /> Roommates</NavLink>}
            {isStudent && <NavLink to="/listings" className={linkClass}><Home size={16} /> Housing</NavLink>}
            {isLandlord && <NavLink to="/landlord" className={linkClass}><Building2 size={16} /> My listings</NavLink>}
            <MessagesLink />
            {isStudent && <NavLink to="/questionnaire" className={linkClass}><UserRound size={16} /> My profile</NavLink>}
            {isAdmin && <NavLink to="/admin" className={linkClass}><ShieldCheck size={16} /> Verify listings</NavLink>}
          </nav>
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/messages" element={<MessagesPage me={user} />} />
            <Route path="/chat/:userId" element={<ChatPage me={user} />} />
            {isStudent ? (
              <>
                <Route path="/questionnaire" element={<QuestionnairePage profile={profile} onSaved={refresh} />} />
                <Route path="/matches" element={profile ? <MatchesPage /> : <Navigate to="/questionnaire" />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="*" element={<Navigate to={profile ? '/matches' : '/questionnaire'} />} />
              </>
            ) : isLandlord ? (
              <>
                <Route path="/landlord" element={<LandlordPage />} />
                {isAdmin && <Route path="/admin" element={<AdminPage />} />}
                <Route path="*" element={<Navigate to="/landlord" />} />
              </>
            ) : (
              <>
                {isAdmin && <Route path="/admin" element={<AdminPage />} />}
                <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/messages'} />} />
              </>
            )}
          </Routes>
        </main>

        <footer className="text-center text-xs text-ink/50 py-6">
          UniNest · Team Coaster · AST02.21 E-Business Development and Technology
        </footer>
      </div>
    </ChatProvider>
  )
}
