import { useState, useMemo, useEffect } from 'react'
import { mockOrders, mockHistory } from './mockData'
import { AuthProvider, useAuth, DEFAULT_TAB } from './context/AuthContext'
import { ActivityProvider, useActivity } from './context/ActivityContext'
import { useDarkMode } from './hooks/useDarkMode'
import { LIVE, fetchOrders, updateOrder as apiUpdate, deleteOrder as apiDelete, markDispatched as apiMarkDispatched } from './api'
import Header from './components/Header'
import StatsBar from './components/StatsBar'
import FilterBar from './components/FilterBar'
import OrdersTable from './components/OrdersTable'
import OrderPanel from './components/OrderPanel'
import UploadTab from './components/UploadTab'
import DispatchTab from './components/DispatchTab'
import AdminPage from './components/AdminPage'
import LoginPage from './components/LoginPage'

function Dashboard() {
  const { user } = useAuth()
  const { addLog } = useActivity()
  const [dark, toggleDark] = useDarkMode()
  const [orders, setOrders] = useState(LIVE ? [] : mockOrders)
  const [history, setHistory] = useState(LIVE ? [] : mockHistory)
  const [dispatchedIds, setDispatchedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(LIVE)
  const [selectedId, setSelectedId] = useState(null)
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB[user?.role] ?? 'orders')
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Load live data from the sheet (when configured)
  const loadOrders = async () => {
    if (!LIVE) return
    try {
      const { orders, history } = await fetchOrders()
      setOrders(orders)
      setHistory(history)
      // Seed dispatched set from the server's `dispatched` flag
      const ds = new Set([...orders, ...history].filter(o => o.dispatched).map(o => o.id))
      setDispatchedIds(ds)
    } catch (err) {
      console.error('Failed to load orders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [])

  const source = activeTab === 'history' ? history : orders

  const filtered = useMemo(() => source.filter(o => {
    if (activeFilter !== 'all' && o.status !== activeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.psNo.toLowerCase().includes(q) &&
          !o.customer.company.toLowerCase().includes(q) &&
          !o.address.city.toLowerCase().includes(q)) return false
    }
    if (dateFrom && new Date(o.dateReceived) < new Date(dateFrom)) return false
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59)
      if (new Date(o.dateReceived) > end) return false
    }
    return true
  }), [source, activeFilter, search, dateFrom, dateTo])

  const selectedOrder = [...orders, ...history].find(o => o.id === selectedId) || null

  const updateOrder = (id, changes) => {
    const prev = [...orders, ...history].find(o => o.id === id)
    if (prev) {
      const psNo = `PS ${prev.psNo}`
      if (changes.approved !== undefined && changes.approved !== prev.approved)
        addLog(user, changes.approved ? 'Approved shipment' : 'Unapproved shipment', psNo)
      if (changes.buyLabel !== undefined && changes.buyLabel !== prev.buyLabel && changes.buyLabel)
        addLog(user, 'Triggered booking', psNo)
      if (changes.selectedCourier !== undefined && changes.selectedCourier !== prev.selectedCourier)
        addLog(user, `Selected courier ${changes.selectedCourier}`, psNo)
      if (changes.address || changes.items || changes.customer)
        addLog(user, 'Edited order details', psNo)
    }
    // Optimistic local update
    setOrders(prevList => prevList.map(o => o.id === id ? { ...o, ...changes } : o))
    // Persist to sheet
    if (LIVE && prev) apiUpdate(prev.psNo, changes).catch(err => {
      console.error('Update failed:', err)
      loadOrders() // re-sync on failure
    })
  }

  const deleteOrder = (id) => {
    const order = [...orders, ...history].find(o => o.id === id)
    if (order) addLog(user, 'Deleted order', `PS ${order.psNo}`)
    setOrders(prev => prev.filter(o => o.id !== id))
    setSelectedId(null)
    if (LIVE && order) apiDelete(order.psNo).catch(err => {
      console.error('Delete failed:', err)
      loadOrders()
    })
  }

  const toggleDispatch = (id) => {
    const order = [...orders, ...history].find(o => o.id === id)
    const willDispatch = !dispatchedIds.has(id)
    setDispatchedIds(prev => {
      const next = new Set(prev)
      willDispatch ? next.add(id) : next.delete(id)
      return next
    })
    if (order) addLog(user, willDispatch ? 'Marked dispatched' : 'Marked not dispatched', `PS ${order.psNo}`)
    if (LIVE && order) apiMarkDispatched(order.psNo, willDispatch).catch(err => console.error('Dispatch update failed:', err))
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadOrders()
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab); setSelectedId(null)
    setActiveFilter('all'); setSearch('')
    setDateFrom(''); setDateTo('')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header activeTab={activeTab} setActiveTab={handleTabChange}
        onRefresh={handleRefresh} refreshing={refreshing}
        dark={dark} toggleDark={toggleDark} />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400 dark:text-slate-500 gap-3">
            <span className="w-5 h-5 border-2 border-slate-300 border-t-brand rounded-full animate-spin" />
            Loading orders…
          </div>
        ) : (
          <>
            {activeTab === 'upload'   && <UploadTab onUploaded={loadOrders} />}
            {activeTab === 'dispatch' && (
              <DispatchTab orders={orders} history={history}
                dispatchedIds={dispatchedIds} onToggleDispatch={toggleDispatch} />
            )}
            {activeTab === 'admin'    && <AdminPage orders={orders} history={history} />}

            {(activeTab === 'orders' || activeTab === 'history') && (
              <>
                {activeTab === 'orders' && <StatsBar orders={orders} />}
                <FilterBar orders={source} activeFilter={activeFilter} setActiveFilter={setActiveFilter}
                  search={search} setSearch={setSearch}
                  dateFrom={dateFrom} setDateFrom={setDateFrom}
                  dateTo={dateTo} setDateTo={setDateTo} />
                <OrdersTable orders={filtered} selectedId={selectedId}
                  onSelect={(id) => setSelectedId(prev => prev === id ? null : id)}
                  onUpdate={updateOrder} />
              </>
            )}
          </>
        )}
      </main>

      <OrderPanel order={selectedOrder} onClose={() => setSelectedId(null)}
        onUpdate={(changes) => selectedOrder && updateOrder(selectedOrder.id, changes)}
        onDelete={() => selectedOrder && deleteOrder(selectedOrder.id)} />
    </div>
  )
}

function AppRouter() {
  const { user } = useAuth()
  return user ? <Dashboard /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <ActivityProvider>
        <AppRouter />
      </ActivityProvider>
    </AuthProvider>
  )
}
