import { createContext, useContext, useState } from 'react'

const ActivityContext = createContext(null)

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
  const [log, setLog] = useState(SEED)

  const addLog = (user, action, detail = '') => {
    setLog(prev => [{
      id: Date.now(),
      user: user.name,
      role: user.role,
      action,
      detail,
      timestamp: new Date(),
    }, ...prev].slice(0, 500))
  }

  return (
    <ActivityContext.Provider value={{ log, addLog }}>
      {children}
    </ActivityContext.Provider>
  )
}

export function useActivity() {
  return useContext(ActivityContext)
}
