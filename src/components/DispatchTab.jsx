import { useState, useMemo } from 'react'
import {
  PackageCheck, Truck, Search, X, CheckCircle2, Circle,
  ExternalLink, ChevronRight, ArrowLeft, MapPin, Phone, Package, Printer, Box
} from 'lucide-react'
import { STATUS } from '../mockData'
import { openManifest } from '../manifest'

const COURIER_COLORS = {
  TCG:      'bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700',
  EPX:      'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  Triangle: 'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
}


// ============================================================
// FULL-PAGE DETAIL
// ============================================================
function DispatchDetail({ order, isPacked, onBack, onTogglePacked, onDispatch, dispatchedMode, onUndoDispatch }) {
  const totalParcels = order.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)
  const totalWeight = order.items.reduce((sum, it) => sum + (Number(it.kg) || 0) * (Number(it.qty) || 0), 0)

  return (
    <div className="max-w-3xl mx-auto">
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
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-bold border ${COURIER_COLORS[order.selectedCourier] || 'bg-slate-50 border-slate-300 text-slate-600'}`}>
              {order.selectedCourier || 'No courier'}
            </span>
            {isPacked && (
              <span className="inline-flex items-center gap-1 text-sm font-bold text-green-600 dark:text-green-400">
                <Box size={14} /> Picked
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">{order.items.length} lines</span>
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">{totalParcels} parcels</span>
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">{totalWeight.toFixed(1)} kg total</span>
        </div>
      </div>

      {/* Waybill */}
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

      {/* What must go */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4">
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Package size={18} className="text-slate-400" /> What must go
          </h3>
          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">{order.items.length} parts</span>
        </div>
        <div className="grid grid-cols-[1.4fr_1.6fr_auto] gap-3 px-5 sm:px-6 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/20">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Part Number</span>
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Dimensions &amp; Weight</span>
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide text-right">Qty</span>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {order.items.map((it, i) => (
            <li key={i} className="grid grid-cols-[1.4fr_1.6fr_auto] gap-3 items-center px-5 sm:px-6 py-4">
              <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 break-words">{it.sku}</span>
              <div className="text-base text-slate-600 dark:text-slate-300 leading-snug">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{it.h} × {it.w} × {it.l} <span className="font-normal text-slate-400 dark:text-slate-500">cm</span></p>
                <p>{it.kg} <span className="text-slate-400 dark:text-slate-500">kg each</span></p>
              </div>
              <span className="justify-self-end text-lg font-bold text-[#111111] rounded-lg px-3 py-1.5 min-w-[3rem] text-center" style={{ backgroundColor: '#FECD28' }}>×{it.qty}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Deliver to */}
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

      {/* Action buttons */}
      {dispatchedMode ? (
        <div className="space-y-3">
          {order.dispatchedAt && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3.5 text-center">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                Dispatched {new Date(order.dispatchedAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          )}
          <button onClick={() => { if (confirm(`Undo dispatch for ${order.psNo}? It will return to Orders.`)) onUndoDispatch(order.psNo) }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-base font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:border-brand transition-all">
            <ArrowLeft size={18} /> Undo dispatch (return to Orders)
          </button>
        </div>
      ) : (
        <>
          <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur sm:bg-transparent sm:py-0 flex flex-col sm:flex-row gap-3">
            <button onClick={() => onTogglePacked(order.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold transition-all
                ${isPacked
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-2 border-green-400 dark:border-green-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-600 hover:border-brand'}`}>
              <Box size={20} /> {isPacked ? 'Picked ✓ (tap to undo)' : 'Mark Picked'}
            </button>
            <button onClick={() => { if (confirm(`Dispatch ${order.psNo}? It will move to History.`)) onDispatch(order.id) }}
              disabled={!isPacked}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold transition-all
                ${isPacked ? 'text-[#111111] hover:brightness-95 shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
              style={isPacked ? { backgroundColor: '#FECD28' } : {}}>
              <Truck size={20} /> Dispatch
            </button>
          </div>
          {!isPacked && <p className="text-center text-sm text-slate-400 mt-2">Mark as picked before dispatching</p>}
        </>
      )}
    </div>
  )
}

// ============================================================
// CARD
// ============================================================
function DispatchCard({ order, isPacked, onOpen, onTogglePacked, onDispatch }) {
  const totalParcels = order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
  return (
    <div className={`rounded-2xl border shadow-sm p-5 transition-all
      ${isPacked ? 'border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
      <button onClick={() => onOpen(order.id)} className="w-full text-left">
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
            {isPacked && <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400"><Box size={13} /> Picked</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1">{totalParcels} parcels</span>
          <span className="text-sm font-mono font-semibold text-slate-500 dark:text-slate-400">{order.waybillNo || 'No waybill'}</span>
        </div>
      </button>

      {/* Stage buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <button onClick={() => onTogglePacked(order.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all
            ${isPacked
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:border-brand'}`}>
          <Box size={15} /> {isPacked ? 'Picked ✓' : 'Pick'}
        </button>
        <button onClick={() => { if (confirm(`Dispatch ${order.psNo}? It will move to History.`)) onDispatch(order.id) }}
          disabled={!isPacked}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all
            ${isPacked ? 'text-[#111111] hover:brightness-95' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
          style={isPacked ? { backgroundColor: '#FECD28' } : {}}>
          <Truck size={15} /> Dispatch
        </button>
      </div>
    </div>
  )
}

// ============================================================
// MAIN
// ============================================================
export default function DispatchTab({ orders, history, packedIds, onTogglePacked, onDispatch, onUndoDispatch }) {
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState(null)

  // Booked orders still in Pending are awaiting dispatch (dispatched ones already left)
  const booked = useMemo(
    () => (orders ?? []).filter(o => o.status === STATUS.BOOKED),
    [orders]
  )

  const filtered = useMemo(() => booked.filter(o => {
    if (search) {
      const q = search.toLowerCase()
      if (!o.psNo.toLowerCase().includes(q) &&
          !o.customer.company.toLowerCase().includes(q) &&
          !String(o.waybillNo).toLowerCase().includes(q) &&
          !o.items.some(it => it.sku.toLowerCase().includes(q))) return false
    }
    return true
  }), [booked, search])

  // sort: to-pack first, packed after (packed are ready to dispatch)
  const sorted = [...filtered].sort((a, b) => (packedIds.has(a.id) ? 1 : 0) - (packedIds.has(b.id) ? 1 : 0))

  const toPack = booked.filter(o => !packedIds.has(o.id)).length
  const packedReady = booked.filter(o => packedIds.has(o.id)).length

  // Manifest = packed but not yet dispatched (i.e. packed booked orders still here)
  const packedOrders = booked.filter(o => packedIds.has(o.id))

  // Dispatched today = history orders whose dispatchedAt is today
  const isToday = (iso) => {
    if (!iso) return false
    const d = new Date(iso)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }
  const dispatchedToday = (history ?? [])
    .filter(o => isToday(o.dispatchedAt))
    .sort((a, b) => new Date(b.dispatchedAt) - new Date(a.dispatchedAt))

  // Detail can be an awaiting-dispatch order OR a dispatched-today one
  const bookedDetail = booked.find(o => o.id === detailId)
  const dispatchedDetail = dispatchedToday.find(o => o.id === detailId)
  const detailOrder = bookedDetail || dispatchedDetail || null

  if (detailOrder) {
    return (
      <DispatchDetail
        order={detailOrder}
        isPacked={packedIds.has(detailOrder.id)}
        dispatchedMode={!!dispatchedDetail}
        onUndoDispatch={(ps) => { onUndoDispatch(ps); setDetailId(null) }}
        onBack={() => setDetailId(null)}
        onTogglePacked={onTogglePacked}
        onDispatch={(id) => { onDispatch(id); setDetailId(null) }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Truck size={22} className="text-slate-400" /> Dispatch
          </h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-0.5">Pick, then dispatch. Dispatched orders move to History.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-full px-3 py-1.5">
            <Circle size={13} /> {toPack} to pick
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-3 py-1.5">
            <Box size={13} /> {packedReady} picked
          </span>
        </div>
      </div>

      {/* Manifest buttons — packed (ready to send) only */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Printer size={15} /> Manifest (all to dispatch):
        </span>
        {[['TCG', 'TCG'], ['EPX', 'EPX'], ['All couriers', 'ALL']].map(([label, key]) => (
          <button key={key} onClick={() => openManifest(booked, [], key)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand hover:bg-brand/5 transition-colors">
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-[220px] max-w-md mb-5">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search PS, waybill, customer or part…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-10 py-3 text-base bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand placeholder:text-slate-400" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18} /></button>}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-16 text-center">
          <PackageCheck size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500 text-base">
            {booked.length === 0 ? 'No booked shipments to dispatch.' : 'Nothing matches your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map(o => (
            <DispatchCard key={o.id} order={o}
              isPacked={packedIds.has(o.id)}
              onOpen={setDetailId}
              onTogglePacked={onTogglePacked}
              onDispatch={onDispatch} />
          ))}
        </div>
      )}

      {/* Dispatched today */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={18} className="text-green-500" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Dispatched today</h3>
          <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold">{dispatchedToday.length}</span>
        </div>
        {dispatchedToday.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">Nothing dispatched yet today.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
            {dispatchedToday.map(o => (
              <button key={o.id} onClick={() => setDetailId(o.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{o.psNo}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400 flex-1 truncate">{o.customer.company}</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${COURIER_COLORS[o.selectedCourier] || 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  {o.selectedCourier || '—'}
                </span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">{o.waybillNo}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 w-16 text-right">
                  {new Date(o.dispatchedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
