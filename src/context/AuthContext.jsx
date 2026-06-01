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
  sales:    { label: 'Sales',    canView: true,  canUpload: true,  canEdit: false, canBook: false, canDispatch: false, canAdmin: false },
  dispatch: { label: 'Dispatch', canView: false, canUpload: false, canEdit: false, canBook: false, canDispatch: true,  canAdmin: false },
}

// Where each role lands after logging in
export const DEFAULT_TAB = {
  admin: 'orders', general: 'orders', sales: 'orders', dispatch: 'dispatch',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState(INITIAL_USERS)

  // Load the shared user list from the server (so accounts persist & sync)
  useEffect(() => {
    if (!LIVE) return
    fetchUsers().then(list => { if (list.length) setUsers(list) }).catch(err => console.error('Load users failed:', err))
  }, [])

  // Persist the whole list to the server, keeping local state in sync
  const persist = (nextUsers) => {
    setUsers(nextUsers)
    if (LIVE) saveUsers(nextUsers).catch(err => console.error('Save users failed:', err))
  }

  const login = (username, password) => {
    const found = users.find(
      u => u.username === username.trim().toLowerCase() && u.password === password
    )
    if (found) { setUser(found); return found }
    return null
  }

  const logout = () => setUser(null)

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
