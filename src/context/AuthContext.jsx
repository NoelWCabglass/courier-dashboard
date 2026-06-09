import { createContext, useContext, useState, useEffect } from 'react'
import { LIVE, fetchUsers, saveUsers, logActivity } from '../api'

const AuthContext = createContext(null)

const INITIAL_USERS = [
  { id: 1, name: 'Claire',     username: 'admin',    password: 'admin123',    role: 'admin' },
  { id: 2, name: 'Ashton',     username: 'ashton',   password: 'ashton123',   role: 'general' },
  { id: 3, name: 'Sales Rep',  username: 'sales',    password: 'sales123',    role: 'sales' },
  { id: 4, name: 'Dispatch',   username: 'dispatch', password: 'dispatch123', role: 'dispatch' },
]

// ── Per-page permission model ──
// Each user has a `permissions` object: { [pageKey]: { view, edit } }.
// PAGES drives both the Admin permission matrix and the nav gating.
export const PAGES = [
  { key: 'orders',   label: 'Orders & History', hasEdit: true,  editHint: 'Edit details, courier, approve & book' },
  { key: 'upload',   label: 'Upload',           hasEdit: false },
  { key: 'staged',   label: 'Staged',           hasEdit: true,  editHint: 'Mark items picked' },
  { key: 'dispatch', label: 'Dispatch',         hasEdit: true,  editHint: 'Label & mark dispatched' },
  { key: 'wh',       label: 'WH Uploads',       hasEdit: true,  editHint: 'Manage categories & settings' },
  { key: 'pricing',  label: 'Pricing',          hasEdit: true,  editHint: 'Edit markup tiers' },
  { key: 'admin',    label: 'Admin',            hasEdit: false },
]

// Roles remain as quick-fill PRESETS that populate the permission matrix.
// The per-user `permissions` object is the source of truth once set.
export const ROLES = {
  admin:    { label: 'Admin' },
  general:  { label: 'General' },
  sales:    { label: 'Sales' },
  dispatch: { label: 'Dispatch' },
}

const P = (view, edit) => ({ view, edit })

export function defaultPermsForRole(role) {
  switch (role) {
    case 'admin':
      return { orders: P(1,1), upload: P(1,1), staged: P(1,1), dispatch: P(1,1), wh: P(1,1), pricing: P(1,1), admin: P(1,1) }
    case 'general':
      return { orders: P(1,1), upload: P(1,1), staged: P(1,1), dispatch: P(1,1), wh: P(1,1), pricing: P(1,1), admin: P(0,0) }
    case 'sales':
      return { orders: P(1,0), upload: P(1,0), staged: P(1,0), dispatch: P(1,0), wh: P(1,0), pricing: P(1,0), admin: P(0,0) }
    case 'dispatch':
      return { orders: P(0,0), upload: P(0,0), staged: P(1,1), dispatch: P(1,1), wh: P(0,0), pricing: P(0,0), admin: P(0,0) }
    default:
      return { orders: P(1,0), upload: P(0,0), staged: P(1,0), dispatch: P(0,0), wh: P(0,0), pricing: P(0,0), admin: P(0,0) }
  }
}

// Resolve a user's effective permissions (explicit matrix, else derived from role).
export function permissionsFor(u) {
  if (u?.permissions && typeof u.permissions === 'object') return u.permissions
  return defaultPermsForRole(u?.role)
}

// First page (in PAGES order) the user can view — used as their landing tab.
export function landingTab(u) {
  const perms = permissionsFor(u)
  const first = PAGES.find(pg => perms?.[pg.key]?.view)
  return first ? first.key : 'orders'
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
    const safe = { id: u.id, name: u.name, username: u.username, role: u.role, permissions: u.permissions }
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
    if (found) {
      setUser(found); writeSession(found)
      // Record the sign-in to the server audit trail (only on a real login,
      // not on a session-restore reload).
      if (LIVE) {
        logActivity({ user: found.name, role: found.role, logAction: 'Signed in', detail: '' })
          .catch(err => console.error('Failed to log sign-in:', err))
      }
      return found
    }
    return null
  }

  const logout = () => { writeSession(null); setUser(null) }

  // User management — admin only
  const addUser = (data) => {
    const newUser = {
      ...data,
      id: Date.now(),
      username: data.username.trim().toLowerCase(),
      permissions: data.permissions || defaultPermsForRole(data.role),
    }
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

  // New per-page check: perm('orders','view') / perm('pricing','edit')
  const perm = (pageKey, action = 'view') => {
    const perms = permissionsFor(user)
    return !!perms?.[pageKey]?.[action]
  }

  // Backward-compat shim — maps the old ability names onto the page model.
  const ABILITY_MAP = {
    canView: ['orders', 'view'],
    canUpload: ['upload', 'view'],
    canEdit: ['orders', 'edit'],
    canDispatch: ['dispatch', 'view'],
    canAdmin: ['admin', 'view'],
  }
  const can = (ability) => {
    const m = ABILITY_MAP[ability]
    return m ? perm(m[0], m[1]) : false
  }

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, updateUser, deleteUser, can, perm }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
