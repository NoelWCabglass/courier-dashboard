import { useState, useMemo, useEffect, useRef } from 'react'
import { mockOrders, mockHistory, STATUS } from './mockData'
import { AuthProvider, useAuth, DEFAULT_TAB } from './context/AuthContext'
import { ActivityProvider, useActivity } from './context/ActivityContext'
import { useDarkMode } from './hooks/useDarkMode'
import { LIVE, fetchOrders, updateOrder as apiUpdate, deleteOrder as apiDelete, markDispatched as apiMarkDispatched, archiveBooked, archiveOrders as apiArchiveOrders, saveNote as apiSaveNote } from './api'
import { Archive } from 'lucide-react'
import { playPing } from './ping'
import Toasts from './components/Toasts'
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
  const { user, can } = useAuth()
  const { addLog } = useActivity()
  const [dark, toggleDark] = useDarkMode()
  const [archiving, setArchiving] = useState(false)
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
  const [toasts, setToasts] = useState([])

  // Toast helper
  const notify = (message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
  }
  const removeToast = (id) => setToasts(t => t.filter(x => x.id !== id))

  // Track known PS numbers so we can detect new arrivals and ping
  const knownPs = useRef(null)

  const applyLoaded = (orders, history, { ping = false } = {}) => {
    setOrders(orders)
    setHistory(history)
    const ds = new Set([...orders, ...history].filter(o => o.dispatched).map(o => o.id))
    setDispatchedIds(ds)
    // New-order detection
    const currentPs = new Set(orders.map(o => o.psNo))
    if (ping && knownPs.current) {
      const fresh = [...currentPs].filter(ps => !knownPs.current.has(ps))
      if (fresh.length > 0) {
        playPing()
        notify(`${fresh.length} new order${fresh.length !== 1 ? 's' : ''} arrived: ${fresh.join(', ')}`, 'info')
      }
    }
    knownPs.current = currentPs
  }

  // Load live data from the sheet (when configured)
  const loadOrders = async (opts = {}) => {
    if (!LIVE) return
    try {
      const { orders, history } = await fetchOrders()
      applyLoaded(orders, history, opts)
    } catch (err) {
      console.error('Failed to load orders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [])

  // Auto-poll every 60s to catch new orders and ping
  useEffect(() => {
    if (!LIVE) return
    const t = setInterval(() => loadOrders({ ping: true }), 60000)
    return () => clearInterval(t)
  }, [])

  const source = activeTab === 'history' ? history : orders

  const filtered = useMemo(() => source.filter(o => {
    if (activeFilter !== 'all' && o.status !== activeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.psNo.toLowerCase().includes(q) &&
          !o.customer.company.toLowerCase().includes(q) &&
          !o.address.city.toLowerCase().includes(q) &&
          !String(o.waybillNo || '').toLowerCase().includes(q)) return false
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
    if (LIVE && prev) {
      // Changes that trigger a server-side re-quote → reload to show new prices
      const triggersRequote = changes.address || changes.items || changes.tcgRefresh || changes.epxRefresh
      apiUpdate(prev.psNo, changes)
        .then(() => { if (triggersRequote) loadOrders() })
        .catch(err => { console.error('Update failed:', err); loadOrders() })
    }
  }

  // Bulk apply the same change to many orders
  const bulkUpdate = (ids, changes) => {
    ids.forEach(id => updateOrder(id, changes))
    const what = changes.buyLabel ? 'approved + buy label'
      : changes.approved ? 'approved'
      : changes.selectedCourier ? `courier set to ${changes.selectedCourier}`
      : 'updated'
    notify(`${ids.length} order${ids.length !== 1 ? 's' : ''} ${what}`)
  }

  // Move specific booked orders to History (bulk or single)
  const moveToHistory = async (ids) => {
    if (!LIVE) { notify('Archiving works on the live site only.', 'warning'); return }
    const archivable = [STATUS.BOOKED, STATUS.TRIANGLE]
    const targets = [...orders].filter(o => ids.includes(o.id) && archivable.includes(o.status))
    if (targets.length === 0) { notify('No completed orders in selection.', 'warning'); return }
    // optimistic remove
    const psNos = targets.map(o => o.psNo)
    setOrders(prev => prev.filter(o => !targets.find(t => t.id === o.id)))
    setSelectedId(null)
    addLog(user, 'Moved booked to History', `${targets.length} order(s)`)
    try {
      const res = await apiArchiveOrders(psNos)
      notify(`Moved ${res.moved} order${res.moved !== 1 ? 's' : ''} to History`)
      await loadOrders()
    } catch (err) {
      console.error('Move to history failed:', err)
      notify('Move to history failed', 'warning')
      loadOrders()
    }
  }

  // Save a note (everyone can do this)
  const saveOrderNote = (id, note) => {
    const order = [...orders, ...history].find(o => o.id === id)
    if (!order) return
    setOrders(prev => prev.map(o => o.id === id ? { ...o, note } : o))
    setHistory(prev => prev.map(o => o.id === id ? { ...o, note } : o))
    addLog(user, 'Updated note', `PS ${order.psNo}`)
    notify('Note saved')
    if (LIVE) apiSaveNote(order.psNo, note).catch(err => console.error('Save note failed:', err))
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

  const handleArchive = async () => {
    if (!LIVE) { alert('Archiving works on the live site only.'); return }
    const archivable = [STATUS.BOOKED, STATUS.TRIANGLE]
    const bookedCount = orders.filter(o => archivable.includes(o.status)).length
    if (bookedCount === 0) { alert('No completed orders to move to history.'); return }
    if (!confirm(`Move ${bookedCount} completed order${bookedCount !== 1 ? 's' : ''} (booked + Triangle) to History?`)) return
    setArchiving(true)
    try {
      const res = await archiveBooked()
      addLog(user, 'Archived booked orders to history', `${res.moved} moved`)
      await loadOrders()
      alert(`Moved ${res.moved} order${res.moved !== 1 ? 's' : ''} to History.`)
    } catch (err) {
      console.error('Archive failed:', err)
      alert('Archive failed — please try again.')
    } finally {
      setArchiving(false)
    }
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
                {activeTab === 'orders' && can('canEdit') && (
                  <div className="flex justify-end mb-3">
                    <button onClick={handleArchive} disabled={archiving}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors disabled:opacity-50">
                      <Archive size={14} className={archiving ? 'animate-pulse' : ''} />
                      {archiving ? 'Moving…' : 'Move booked to History'}
                    </button>
                  </div>
                )}
                <FilterBar orders={source} activeFilter={activeFilter} setActiveFilter={setActiveFilter}
                  search={search} setSearch={setSearch}
                  dateFrom={dateFrom} setDateFrom={setDateFrom}
                  dateTo={dateTo} setDateTo={setDateTo} />
                <OrdersTable orders={filtered} selectedId={selectedId}
                  onSelect={(id) => setSelectedId(prev => prev === id ? null : id)}
                  onUpdate={updateOrder} onBulkUpdate={bulkUpdate}
                  onMoveToHistory={moveToHistory} />
              </>
            )}
          </>
        )}
      </main>

      <OrderPanel order={selectedOrder} onClose={() => setSelectedId(null)}
        onUpdate={(changes) => selectedOrder && updateOrder(selectedOrder.id, changes)}
        onDelete={() => selectedOrder && deleteOrder(selectedOrder.id)}
        onSaveNote={(note) => selectedOrder && saveOrderNote(selectedOrder.id, note)}
        onMoveToHistory={() => selectedOrder && moveToHistory([selectedOrder.id])} />

      <Toasts toasts={toasts} remove={removeToast} />
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
