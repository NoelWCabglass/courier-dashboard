import { useState, useMemo } from 'react'
import {
  PackageCheck, Truck, Search, X, CheckCircle2, Circle,
  ExternalLink, ChevronRight, ArrowLeft, MapPin, Phone, Package
} from 'lucide-react'
import { STATUS } from '../mockData'

const COURIER_COLORS = {
  TCG:      'bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700',
  EPX:      'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  Triangle: 'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
}

// ============================================================
// FULL-PAGE DETAIL — shown when a dispatch order is tapped
// ============================================================
function DispatchDetail({ order, isDispatched, onBack, onToggleDispatch }) {
  const totalParcels = order.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)
  const totalWeight = order.items.reduce((sum, it) => sum + (Number(it.kg) || 0) * (Number(it.qty) || 0), 0)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back + heading */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-base font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-4 py-2">
        <ArrowLeft size={20} /> Back to list
      </button>

      {/* Header card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <a href={order.psUrl} target="_blank" rel="noopener noreferrer"
              className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2">
              {order.psNo} <ExternalLink size={18} />
            </a>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">{order.customer.company}</p>
          </div>
          <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-bold border ${COURIER_COLORS[order.selectedCourier] || 'bg-slate-50 border-slate-300 text-slate-600'}`}>
            {order.selectedCourier || 'No courier'}
          </span>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">
            {order.items.length} line{order.items.length !== 1 ? 's' : ''}
          </span>
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">
            {totalParcels} parcel{totalParcels !== 1 ? 's' : ''}
          </span>
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">
            {totalWeight.toFixed(1)} kg total
          </span>
        </div>
      </div>

      {/* Waybill — big and obvious */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6 mb-4">
        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Waybill Number</p>
        {order.waybillLink ? (
          <a href={order.waybillLink} target="_blank" rel="noopener noreferrer"
            className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2">
            {order.waybillNo} <ExternalLink size={18} />
          </a>
        ) : (
          <p className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">{order.waybillNo || '—'}</p>
        )}
      </div>

      {/* WHAT MUST GO — parts, big and clear */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4">
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Package size={18} className="text-slate-400" /> What must go
          </h3>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {order.items.map((it, i) => (
            <li key={i} className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{it.sku}</span>
                <span className="text-lg font-bold text-[#111111] rounded-lg px-3 py-1" style={{ backgroundColor: '#FECD28' }}>
                  ×{it.qty}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-base text-slate-600 dark:text-slate-300">
                <span><span className="text-slate-400 dark:text-slate-500">Size:</span> {it.h} × {it.w} × {it.l} cm</span>
                <span><span className="text-slate-400 dark:text-slate-500">Weight:</span> {it.kg} kg each</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Where it's going */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6 mb-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
          <MapPin size={18} className="text-slate-400" /> Deliver to
        </h3>
        <div className="text-lg text-slate-700 dark:text-slate-300 space-y-0.5">
          {order.customer.contact && <p className="font-semibold">{order.customer.contact}</p>}
          <p>{order.address.street}</p>
          {order.address.suburb && <p>{order.address.suburb}</p>}
          <p>{order.address.city}, {order.address.province} {order.address.postalCode}</p>
        </div>
        {order.customer.phone && (
          <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-lg text-blue-600 dark:text-blue-400 mt-3 font-medium">
            <Phone size={18} /> {order.customer.phone}
          </a>
        )}
      </div>

      {/* Big dispatch button — sticky at bottom on small screens */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur sm:bg-transparent sm:py-0">
        <button onClick={() => onToggleDispatch(order.id)}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold transition-all
            ${isDispatched
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-2 border-green-400 dark:border-green-700'
              : 'text-[#111111] hover:brightness-95 shadow-lg'}`}
          style={isDispatched ? {} : { backgroundColor: '#FECD28' }}>
          {isDispatched
            ? <><CheckCircle2 size={22} /> Dispatched — tap to undo</>
            : <><Truck size={22} /> Mark as dispatched</>}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// CARD (mobile / tablet list item)
// ============================================================
function DispatchCard({ order, isDispatched, onOpen }) {
  const totalParcels = order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
  return (
    <button onClick={() => onOpen(order.id)}
      className={`w-full text-left rounded-2xl border shadow-sm p-5 transition-all active:scale-[0.99]
        ${isDispatched
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{order.psNo}</p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{order.customer.company}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{order.address.city}, {order.address.province}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-bold border ${COURIER_COLORS[order.selectedCourier] || 'bg-slate-50 border-slate-300 text-slate-600'}`}>
            {order.selectedCourier || '—'}
          </span>
          {isDispatched && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
              <CheckCircle2 size={13} /> Done
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1">
            {totalParcels} parcel{totalParcels !== 1 ? 's' : ''}
          </span>
          <span className="text-sm font-mono font-semibold text-slate-500 dark:text-slate-400">{order.waybillNo || 'No waybill'}</span>
        </div>
        <span className="flex items-center gap-1 text-sm font-semibold text-slate-400 dark:text-slate-500">
          View <ChevronRight size={18} />
        </span>
      </div>
    </button>
  )
}

// ============================================================
// MAIN
// ============================================================
export default function DispatchTab({ orders, history, dispatchedIds, onToggleDispatch }) {
  const [search, setSearch] = useState('')
  const [showDispatched, setShowDispatched] = useState(false)
  const [detailId, setDetailId] = useState(null)

  const booked = useMemo(
    () => [...(orders ?? []), ...(history ?? [])].filter(o => o.status === STATUS.BOOKED),
    [orders, history]
  )

  const detailOrder = booked.find(o => o.id === detailId) || null

  const filtered = useMemo(() => booked.filter(o => {
    const isDispatched = dispatchedIds.has(o.id)
    if (!showDispatched && isDispatched) return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.psNo.toLowerCase().includes(q) &&
          !o.customer.company.toLowerCase().includes(q) &&
          !String(o.waybillNo).toLowerCase().includes(q) &&
          !o.items.some(it => it.sku.toLowerCase().includes(q))) return false
    }
    return true
  }), [booked, dispatchedIds, showDispatched, search])

  const pending = booked.filter(o => !dispatchedIds.has(o.id)).length
  const done = booked.filter(o => dispatchedIds.has(o.id)).length

  // ---- FULL-PAGE DETAIL ----
  if (detailOrder) {
    return (
      <DispatchDetail
        order={detailOrder}
        isDispatched={dispatchedIds.has(detailOrder.id)}
        onBack={() => setDetailId(null)}
        onToggleDispatch={onToggleDispatch}
      />
    )
  }

  // ---- LIST ----
  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Truck size={22} className="text-slate-400" /> Dispatch
          </h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-0.5">
            Booked shipments ready to label and send.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full px-3 py-1.5">
            <Circle size={13} /> {pending} to go
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-3 py-1.5">
            <CheckCircle2 size={13} /> {done} done
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search PS, waybill, customer or part…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-10 py-3 text-base bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand placeholder:text-slate-400" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18} /></button>}
        </div>
        <label className="flex items-center gap-2 text-base text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 shadow-sm cursor-pointer">
          <input type="checkbox" checked={showDispatched} onChange={e => setShowDispatched(e.target.checked)}
            className="accent-[#FECD28] w-5 h-5" />
          Show done
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-16 text-center">
          <PackageCheck size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500 text-base">
            {booked.length === 0 ? 'No booked shipments yet.' : 'Nothing left to dispatch.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(o => (
            <DispatchCard key={o.id} order={o}
              isDispatched={dispatchedIds.has(o.id)}
              onOpen={setDetailId} />
          ))}
        </div>
      )}
    </div>
  )
}
