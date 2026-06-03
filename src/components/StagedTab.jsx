import { useState, useMemo } from 'react'
import {
  PackageCheck, ClipboardList, Search, X, CheckCircle2, Circle,
  ExternalLink, ArrowLeft, MapPin, Phone, Package, Printer
} from 'lucide-react'
import { STATUS } from '../mockData'
import { openManifest } from '../manifest'

const COURIER_COLORS = {
  TCG:      'bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700',
  EPX:      'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  Triangle: 'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
}

// ---- Full-page detail ----
function StagedDetail({ order, isPicked, onBack, onTogglePicked }) {
  const totalParcels = order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
  const totalWeight = order.items.reduce((s, it) => s + (Number(it.kg) || 0) * (Number(it.qty) || 0), 0)
  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack}
        className="flex items-center gap-2 text-base font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-4 py-2">
        <ArrowLeft size={20} /> Back to list
      </button>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <a href={order.psUrl} target="_blank" rel="noopener noreferrer"
              className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2">
              {order.psNo} <ExternalLink size={18} />
            </a>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">{order.customer.company}</p>
          </div>
          {isPicked && (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} /> Picked
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">{order.items.length} lines</span>
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">{totalParcels} items</span>
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5">{totalWeight.toFixed(1)} kg total</span>
        </div>
      </div>

      {/* What to pick */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4">
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Package size={18} className="text-slate-400" /> What to pick
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

      {/* Customer */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6 mb-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
          <MapPin size={18} className="text-slate-400" /> Customer
        </h3>
        <div className="text-lg text-slate-700 dark:text-slate-300 space-y-0.5">
          {order.customer.contact && <p className="font-semibold">{order.customer.contact}</p>}
          <p>{order.address.city}, {order.address.province}</p>
        </div>
        {order.customer.phone && (
          <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-lg text-blue-600 dark:text-blue-400 mt-3 font-medium">
            <Phone size={18} /> {order.customer.phone}
          </a>
        )}
      </div>

      {/* Single Picked button */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur sm:bg-transparent sm:py-0">
        <button onClick={() => onTogglePicked(order.id)}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold transition-all
            ${isPicked
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-2 border-green-400 dark:border-green-700'
              : 'text-[#111111] hover:brightness-95 shadow-lg'}`}
          style={isPicked ? {} : { backgroundColor: '#FECD28' }}>
          {isPicked ? <><CheckCircle2 size={22} /> Picked ✓ (tap to undo)</> : <><Package size={22} /> Mark Picked</>}
        </button>
      </div>
    </div>
  )
}

// ---- Card ----
function StagedCard({ order, isPicked, onOpen, onTogglePicked }) {
  const totalParcels = order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
  return (
    <div className={`rounded-2xl border shadow-sm p-5 transition-all
      ${isPicked ? 'border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
      <button onClick={() => onOpen(order.id)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{order.psNo}</p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{order.customer.company}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{order.address.city}, {order.address.province}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">{order.status}</span>
            {isPicked && <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400"><CheckCircle2 size={13} /> Picked</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1">{totalParcels} items</span>
        </div>
      </button>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <button onClick={() => onTogglePicked(order.id)}
          className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all
            ${isPicked
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
              : 'text-[#111111] hover:brightness-95'}`}
          style={isPicked ? {} : { backgroundColor: '#FECD28' }}>
          <Package size={15} /> {isPicked ? 'Picked ✓' : 'Mark Picked'}
        </button>
      </div>
    </div>
  )
}

// ---- Main ----
export default function StagedTab({ orders, stagedIds, onTogglePicked }) {
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState(null)

  // Staged = all Pending orders EXCEPT booked / mid-booking / failed
  const staged = useMemo(
    () => (orders ?? []).filter(o =>
      o.status !== STATUS.BOOKED && o.status !== STATUS.BOOKING && o.status !== STATUS.BOOKING_FAILED
    ),
    [orders]
  )

  const detailOrder = staged.find(o => o.id === detailId) || null

  const filtered = useMemo(() => staged.filter(o => {
    if (search) {
      const q = search.toLowerCase()
      if (!o.psNo.toLowerCase().includes(q) &&
          !o.customer.company.toLowerCase().includes(q) &&
          !o.items.some(it => it.sku.toLowerCase().includes(q))) return false
    }
    return true
  }), [staged, search])

  const sorted = [...filtered].sort((a, b) => (stagedIds.has(a.id) ? 1 : 0) - (stagedIds.has(b.id) ? 1 : 0))
  const toPick = staged.filter(o => !stagedIds.has(o.id)).length
  const picked = staged.filter(o => stagedIds.has(o.id)).length

  if (detailOrder) {
    return (
      <StagedDetail order={detailOrder} isPicked={stagedIds.has(detailOrder.id)}
        onBack={() => setDetailId(null)} onTogglePicked={onTogglePicked} />
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList size={22} className="text-slate-400" /> Staged
          </h2>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-0.5">Pick the physical items before invoicing. Booked orders move to Dispatch.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-full px-3 py-1.5">
            <Circle size={13} /> {toPick} to pick
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-3 py-1.5">
            <CheckCircle2 size={13} /> {picked} picked
          </span>
        </div>
      </div>

      {/* Picking-list manifest */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Printer size={15} /> Picking list:
        </span>
        <button onClick={() => openManifest(staged, [], 'ALL')}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand hover:bg-brand/5 transition-colors">
          Print all
        </button>
      </div>

      <div className="relative flex-1 min-w-[220px] max-w-md mb-5">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search PS, customer or part…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-10 py-3 text-base bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand placeholder:text-slate-400" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18} /></button>}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-16 text-center">
          <PackageCheck size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500 text-base">
            {staged.length === 0 ? 'Nothing to stage right now.' : 'Nothing matches your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map(o => (
            <StagedCard key={o.id} order={o} isPicked={stagedIds.has(o.id)}
              onOpen={setDetailId} onTogglePicked={onTogglePicked} />
          ))}
        </div>
      )}
    </div>
  )
}
