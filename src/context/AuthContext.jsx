import { createContext, useContext, useState, useEffect } from 'react'
import { LIVE, fetchUsers, saveUsers } from '../api'

const AuthContext = createContext(null)

const INITIAL_USERS = [
  { id: 1, name: 'Claire',     username: 'admin',    password: 'admin123',    role: 'admin' },
  { id: 2, name: 'Ashton',     username: 'ashton',   password: 'ashton123',   role: 'general' },
  { id: 3, name: 'Sales Rep',  username: 'sales',    password: 'sales123',    role: 'sales' },
  { id: 4, name: 'Dispatch',   username: 'dispatch', password: 'dispatch123', role: 'dispatch' },
]

// Role capabilities
//   canView     — see Orders / History tabs
//   canUpload   — see Upload tab
//   canEdit     — edit order details, courier, approve/buy
//   canBook     — book shipments
//   canDispatch — see Dispatch tab and mark items dispatched
//   canAdmin    — see Admin tab (users, analytics, activity)
export const ROLES = {
  admin:    { label: 'Admin',    canView: true,  canUpload: true,  canEdit: true,  canBook: true,  canDispatch: true,  canAdmin: true  },
  general:  { label: 'General',  canView: true,  canUpload: true,  canEdit: true,  canBook: true,  canDispatch: true,  canAdmin: false },
  sales:    { label: 'Sales',    canView: true,  canUpload: true,  canEdit: false, canBook: false, canDispatch: true,  canAdmin: false },
  dispatch: { label: 'Dispatch', canView: false, canUpload: false, canEdit: false, canBook: false, canDispatch: true,  canAdmin: false },
}

// Where each role lands after logging in
export const DEFAULT_TAB = {
  admin: 'orders', general: 'orders', sales: 'orders', dispatch: 'dispatch',
}

const SESSION_KEY = 'courier_session'
const IDLE_MS = 12 * 60 * 60 * 1000 // 12 hours of inactivity

// Restore a saved session if it hasn't gone idle past the 12h window.
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s.user || !s.expiresAt || Date.now() > s.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return s.user
  } catch (e) { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession)   // restore session on load
  const [users, setUsers] = useState(INITIAL_USERS)

  // Load the shared user list from the server (so accounts persist & sync)
  useEffect(() => {
    if (!LIVE) return
    fetchUsers().then(list => { if (list.length) setUsers(list) }).catch(err => console.error('Load users failed:', err))
  }, [])

  // Save a session (without the password) and slide the 12h idle expiry forward.
  // Dispatch stays logged in indefinitely (warehouse tablet) — far-future expiry.
  const writeSession = (u) => {
    if (!u) { localStorage.removeItem(SESSION_KEY); return }
    const safe = { id: u.id, name: u.name, username: u.username, role: u.role }
    const expiresAt = u.role === 'dispatch'
      ? Date.now() + 100 * 365 * 24 * 60 * 60 * 1000 // ~never
      : Date.now() + IDLE_MS
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: safe, expiresAt }))
  }

  // Keep the session alive while the user is active; auto-logout after 12h idle.
  useEffect(() => {
    if (!user) return
    let last = 0
    const bump = () => {
      const now = Date.now()
      if (now - last > 30000) { last = now; writeSession(user) } // throttle writes
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, bump, { passive: true }))

    const check = setInterval(() => {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) { setUser(null); return }
      try {
        const s = JSON.parse(raw)
        if (Date.now() > s.expiresAt) { localStorage.removeItem(SESSION_KEY); setUser(null) }
      } catch (e) { /* ignore */ }
    }, 60000)

    return () => {
      events.forEach(e => window.removeEventListener(e, bump))
      clearInterval(check)
    }
  }, [user])

  // Persist the whole list to the server, keeping local state in sync
  const persist = (nextUsers) => {
    setUsers(nextUsers)
    if (LIVE) saveUsers(nextUsers).catch(err => console.error('Save users failed:', err))
  }

  const login = (username, password) => {
    const found = users.find(
      u => u.username === username.trim().toLowerCase() && u.password === password
    )
    if (found) { setUser(found); writeSession(found); return found }
    return null
  }

  const logout = () => { writeSession(null); setUser(null) }

  // User management — admin only
  const addUser = (data) => {
    const newUser = { ...data, id: Date.now(), username: data.username.trim().toLowerCase() }
    persist([...users, newUser])
  }

  const updateUser = (id, data) => {
    const next = users.map(u => u.id === id
      ? { ...u, ...data, username: data.username?.trim().toLowerCase() ?? u.username }
      : u)
    persist(next)
    if (user?.id === id) setUser(prev => ({ ...prev, ...data }))
  }

  const deleteUser = (id) => {
    if (id === user?.id) return // can't delete yourself
    persist(users.filter(u => u.id !== id))
  }

  const can = (ability) => ROLES[user?.role]?.[ability] ?? false

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, updateUser, deleteUser, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
