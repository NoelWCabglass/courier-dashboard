import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { LIVE, fetchActivity, logActivity } from '../api'

const ActivityContext = createContext(null)

// Mock data is only used when running locally on mock data (LIVE === false).
// On the live site the log is loaded from, and written to, the server.
const SEED = [
  { id: 1,  user: 'Claire', role: 'admin',   action: 'Signed in',            detail: '',           timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
  { id: 2,  user: 'Claire', role: 'admin',   action: 'Approved shipment',    detail: 'PS 2-24519', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { id: 3,  user: 'Ashton', role: 'general', action: 'Selected courier TCG', detail: 'PS 2-24537', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  { id: 4,  user: 'Ashton', role: 'general', action: 'Triggered booking',    detail: 'PS 2-24537', timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000) },
  { id: 5,  user: 'Claire', role: 'admin',   action: 'Edited order details', detail: 'PS 2-24538', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) },
  { id: 6,  user: 'Sales',  role: 'sales',   action: 'Uploaded picking slip',detail: 'PS_24541.pdf', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000) },
  { id: 7,  user: 'Claire', role: 'admin',   action: 'Approved shipment',    detail: 'PS 2-24520', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  { id: 8,  user: 'Claire', role: 'admin',   action: 'Selected courier EPX', detail: 'PS 2-24520', timestamp: new Date(Date.now() - 24.5 * 60 * 60 * 1000) },
  { id: 9,  user: 'Ashton', role: 'general', action: 'Signed in',            detail: '',           timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000) },
  { id: 10, user: 'Sales',  role: 'sales',   action: 'Uploaded picking slip',detail: 'PS_24528.pdf', timestamp: new Date(Date.now() - 28 * 60 * 60 * 1000) },
]

export function ActivityProvider({ children }) {
  const [log, setLog] = useState(LIVE ? [] : SEED)

  // Load the real, server-side log on the live site.
  const refresh = useCallback(async () => {
    if (!LIVE) return
    try {
      const rows = await fetchActivity(200)
      setLog(rows.map((r, i) => ({ ...r, id: `${r.timestamp}-${i}` })))
    } catch (err) {
      console.error('Failed to load activity log:', err)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Record an action: shows immediately (optimistic) and persists to the server.
  const addLog = (user, action, detail = '') => {
    setLog(prev => [{
      id: Date.now(),
      user: user.name,
      role: user.role,
      action,
      detail,
      timestamp: new Date(),
    }, ...prev].slice(0, 500))

    if (LIVE) {
      logActivity({ user: user.name, role: user.role, logAction: action, detail })
        .catch(err => console.error('Failed to record activity:', err))
    }
  }

  return (
    <ActivityContext.Provider value={{ log, addLog, refresh }}>
      {children}
    </ActivityContext.Provider>
  )
}

export function useActivity() {
  return useContext(ActivityContext)
}
