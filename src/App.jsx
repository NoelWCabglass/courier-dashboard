import { useState, useMemo, useEffect, useRef } from 'react'
import { mockOrders, mockHistory, STATUS } from './mockData'
import { AuthProvider, useAuth, DEFAULT_TAB } from './context/AuthContext'
import { ActivityProvider, useActivity } from './context/ActivityContext'
import { useDarkMode } from './hooks/useDarkMode'
import { useNotifications } from './hooks/useNotifications'
import { LIVE, fetchOrders, updateOrder as apiUpdate, deleteOrder as apiDelete, archiveBooked, archiveOrders as apiArchiveOrders, restoreOrders, saveNote as apiSaveNote, setPacked as apiSetPacked, setStaged as apiSetStaged } from './api'
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
import StagedTab from './components/StagedTab'
import AdminPage from './components/AdminPage'
import LoginPage from './components/LoginPage'

function Dashboard() {
  const { user, can } = useAuth()
  const { addLog } = useActivity()
  const [dark, toggleDark] = useDarkMode()
  const [archiving, setArchiving] = useState(false)
  const [orders, setOrders] = useState(LIVE ? [] : mockOrders)
  const [history, setHistory] = useState(LIVE ? [] : mockHistory)
  const [packedIds, setPackedIds] = useState(() => new Set())
  const [stagedIds, setStagedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(LIVE)
  const [selectedId, setSelectedId] = useState(null)
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB[user?.role] ?? 'orders')
  const [activeFilter, setActiveFilter] = useState('all')
  const [courierFilter, setCourierFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [toasts, setToasts] = useState([])

  // Toast helper — optional action = { label, onClick }, optional duration
  const notify = (message, type = 'success', action = null, duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type, action, duration }])
  }
  const removeToast = (id) => setToasts(t => t.filter(x => x.id !== id))

  // Track known PS numbers so we can detect new arrivals and ping
  const knownPs = useRef(null)

  // De-duplicate by PS number (defends against duplicate sheet rows so the UI
  // doesn't flicker from duplicate React keys). Keeps the first occurrence.
  const dedupe = (list) => {
    const seen = new Set()
    return (list || []).filter(o => {
      if (seen.has(o.psNo)) return false
      seen.add(o.psNo)
      return true
    })
  }

  const applyLoaded = (rawOrders, rawHistory, { ping = false } = {}) => {
    const orders = dedupe(rawOrders)
    const history = dedupe(rawHistory)
    setOrders(orders)
    setHistory(history)
    const ps = new Set([...orders, ...history].filter(o => o.packed).map(o => o.id))
    setPackedIds(ps)
    setStagedIds(new Set([...orders, ...history].filter(o => o.staged).map(o => o.id)))
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

  const filtered = useMemo(() => {
    const rows = source.filter(o => {
      if (activeFilter !== 'all' && o.status !== activeFilter) return false
      if (courierFilter !== 'all' && o.selectedCourier !== courierFilter) return false
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
    })

    const newestFirst = (a, b) => new Date(b.dateReceived) - new Date(a.dateReceived)

    if (activeTab === 'history') {
      // History: most recent at the top
      return rows.sort(newestFirst)
    }
    // Orders: Invoiced float to top, booked sink to bottom; within each group, newest first
    const rank = (o) => o.status === STATUS.INVOICED ? 0 : o.status === STATUS.BOOKED ? 2 : 1
    return rows.sort((a, b) => rank(a) - rank(b) || newestFirst(a, b))
  }, [source, activeFilter, courierFilter, search, dateFrom, dateTo, activeTab])

  const selectedOrder = [...orders, ...history].find(o => o.id === selectedId) || null
  const selectedInHistory = !!history.find(o => o.id === selectedId)

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

  // Bulk delete many orders
  const bulkDelete = (ids) => {
    ids.forEach(id => deleteOrder(id))
    notify(`${ids.length} order${ids.length !== 1 ? 's' : ''} deleted`)
  }

  // Move specific booked orders to History (bulk or single)
  const moveToHistory = async (ids) => {
    if (!LIVE) { notify('Archiving works on the live site only.', 'warning'); return }
    // Manual move allows any status except mid-booking
    const targets = [...orders].filter(o => ids.includes(o.id) && o.status !== STATUS.BOOKING)
    if (targets.length === 0) { notify('No movable orders in selection.', 'warning'); return }
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

  // Stage 1: mark packed (toggle)
  const togglePacked = (id) => {
    const order = [...orders, ...history].find(o => o.id === id)
    const willPack = !packedIds.has(id)
    setPackedIds(prev => {
      const next = new Set(prev)
      willPack ? next.add(id) : next.delete(id)
      return next
    })
    if (order) addLog(user, willPack ? 'Marked labeled' : 'Marked not labeled', `PS ${order.psNo}`)
    if (LIVE && order) apiSetPacked(order.psNo, willPack).catch(err => console.error('Label update failed:', err))
  }

  // Staged page: mark item physically picked (toggle)
  const toggleStaged = (id) => {
    const order = [...orders, ...history].find(o => o.id === id)
    const willStage = !stagedIds.has(id)
    setStagedIds(prev => {
      const next = new Set(prev)
      willStage ? next.add(id) : next.delete(id)
      return next
    })
    if (order) addLog(user, willStage ? 'Marked picked (staged)' : 'Marked not picked (staged)', `PS ${order.psNo}`)
    if (LIVE && order) apiSetStaged(order.psNo, willStage).catch(err => console.error('Staged update failed:', err))
  }

  // Stage 2: dispatched → archive to History
  const dispatchOrder = (id) => {
    const order = [...orders, ...history].find(o => o.id === id)
    const psNo = order ? order.psNo : null
    moveToHistory([id])
    if (psNo) {
      notify(`PS ${psNo} dispatched → moved to History`, 'success',
        { label: 'Undo', onClick: () => undoDispatch(psNo) }, 8000)
    }
  }

  // Restore an order from History back to Orders (by id)
  const restoreFromHistory = async (id) => {
    const order = history.find(o => o.id === id)
    if (!order) return
    if (!LIVE) { notify('Restore works on the live site only.', 'warning'); return }
    setHistory(prev => prev.filter(o => o.id !== id))
    setSelectedId(null)
    addLog(user, 'Restored from History to Orders', `PS ${order.psNo}`)
    try {
      await restoreOrders([order.psNo])
      notify(`PS ${order.psNo} restored to Orders`)
      await loadOrders()
    } catch (err) {
      console.error('Restore failed:', err)
      notify('Restore failed', 'warning')
      loadOrders()
    }
  }

  // Undo a dispatch: bring the order back from History to Pending
  const undoDispatch = async (psNo) => {
    if (!LIVE) { notify('Undo works on the live site only.', 'warning'); return }
    try {
      await restoreOrders([psNo])
      addLog(user, 'Undid dispatch (restored to orders)', `PS ${psNo}`)
      notify(`PS ${psNo} restored to Orders`)
      await loadOrders()
    } catch (err) {
      console.error('Undo dispatch failed:', err)
      notify('Undo failed', 'warning')
    }
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
    setActiveFilter('all'); setCourierFilter('all'); setSearch('')
    setDateFrom(''); setDateTo('')
  }

  // Notifications derived from the orders already in memory (no extra fetch).
  // Clicking one jumps to that order and opens its detail panel.
  const openOrder = (notif) => {
    const inHistory = !!history.find(o => o.id === notif.orderId)
    setActiveTab(inHistory ? 'history' : 'orders')
    setSelectedId(notif.orderId)
  }
  const notif = useNotifications(orders)
  const notifications = { ...notif, onSelect: openOrder }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header activeTab={activeTab} setActiveTab={handleTabChange}
        onRefresh={handleRefresh} refreshing={refreshing}
        dark={dark} toggleDark={toggleDark} notifications={notifications} />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400 dark:text-slate-500 gap-3">
            <span className="w-5 h-5 border-2 border-slate-300 border-t-brand rounded-full animate-spin" />
            Loading orders…
          </div>
        ) : (
          <>
            {activeTab === 'upload'   && <UploadTab onUploaded={loadOrders} />}
            {activeTab === 'staged' && (
              <StagedTab orders={orders} stagedIds={stagedIds} onTogglePicked={toggleStaged} />
            )}
            {activeTab === 'dispatch' && (
              <DispatchTab orders={orders} history={history}
                packedIds={packedIds} onTogglePacked={togglePacked} onDispatch={dispatchOrder}
                onUndoDispatch={undoDispatch} />
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
                  courierFilter={courierFilter} setCourierFilter={setCourierFilter}
                  search={search} setSearch={setSearch}
                  dateFrom={dateFrom} setDateFrom={setDateFrom}
                  dateTo={dateTo} setDateTo={setDateTo} />
                <OrdersTable orders={filtered} selectedId={selectedId}
                  onSelect={(id) => setSelectedId(prev => prev === id ? null : id)}
                  onUpdate={updateOrder} inHistory={activeTab === 'history'}
                  onMoveToHistory={moveToHistory} onBulkDelete={bulkDelete} />
              </>
            )}
          </>
        )}
      </main>

      <OrderPanel order={selectedOrder} onClose={() => setSelectedId(null)}
        onUpdate={(changes) => selectedOrder && updateOrder(selectedOrder.id, changes)}
        onDelete={() => selectedOrder && deleteOrder(selectedOrder.id)}
        onSaveNote={(note) => selectedOrder && saveOrderNote(selectedOrder.id, note)}
        onMoveToHistory={() => selectedOrder && moveToHistory([selectedOrder.id])}
        onRestore={() => selectedOrder && restoreFromHistory(selectedOrder.id)}
        inHistory={selectedInHistory} />

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
