import { useState } from 'react'
import { ExternalLink, AlertTriangle, ChevronRight, StickyNote, X, Archive, Trash2, CheckCircle2, Circle, PackageSearch, Clock } from 'lucide-react'
import StatusBadge from './StatusBadge'
import Toggle from './Toggle'
import OrderCard from './OrderCard'
import { STATUS } from '../mockData'
import { useAuth } from '../context/AuthContext'
import { getOrderIssues } from '../validation'

const fmt = (n) => n != null ? `R ${Number(n).toFixed(2)}` : '—'
const fmtDate = (d) => new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const QUOTE_STALE_DAYS = 7
const isQuoteStale = (order) => {
  if (!order.dateReceived) return false
  if (order.tcgQuote == null && order.epxQuote == null) return false
  // Don't warn on terminal statuses — quote age is irrelevant once booked
  if ([STATUS.BOOKED, STATUS.BOOKING, STATUS.BOOKING_FAILED, STATUS.TRIANGLE].includes(order.status)) return false
  const ageDays = (Date.now() - new Date(order.dateReceived).getTime()) / (1000 * 60 * 60 * 24)
  return ageDays > QUOTE_STALE_DAYS
}

const COURIER_COLORS = {
  TCG:      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
  EPX:      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  Triangle: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  Other:    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
}

export default function OrdersTable({ orders, selectedId, onSelect, onUpdate, onMoveToHistory, onBulkDelete, inHistory = false }) {
  const { perm } = useAuth()
  const canEdit = perm('orders', 'edit')
  // terminal = can't edit fields (booked / mid-booking / failed)
  const isTerminal = (o) => [STATUS.BOOKED, STATUS.BOOKING, STATUS.BOOKING_FAILED].includes(o.status)
  // Archivable = completed orders that can go to History (booked or Triangle)
  const isBooked = (o) => o.status === STATUS.BOOKED || o.status === STATUS.TRIANGLE
  // selectable = anything except mid-booking / failed (so booked CAN be picked for History)
  const canSelect = (o) => o.status !== STATUS.BOOKING && o.status !== STATUS.BOOKING_FAILED

  const [picked, setPicked] = useState(() => new Set())
  const selectable = orders.filter(canSelect)
  const togglePick = (id) => setPicked(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const allPicked = selectable.length > 0 && selectable.every(o => picked.has(o.id))
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(selectable.map(o => o.id)))
  const clearPicked = () => setPicked(new Set())
  const moveSelected = () => {
    onMoveToHistory(Array.from(picked))
    clearPicked()
  }
  const deleteSelected = () => {
    onBulkDelete(Array.from(picked))
    clearPicked()
  }
  const pickedCount = picked.size
  const pickedBookedCount = orders.filter(o => picked.has(o.id) && isBooked(o)).length
  const pickedActiveCount = pickedCount - pickedBookedCount

  if (orders.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-16 text-center">
        <p className="text-slate-400 dark:text-slate-500 text-sm">No orders match this filter.</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile / tablet card view */}
      <div className="lg:hidden space-y-3">
        {orders.map(order => (
          <OrderCard key={order.id} order={order}
            selected={selectedId === order.id}
            onSelect={(id) => onSelect(id)}
            onUpdate={onUpdate} />
        ))}
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-1">
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Bulk action bar (desktop, admin/general) */}
      {canEdit && pickedCount > 0 && (
        <div className="hidden lg:flex items-center gap-3 mb-3 bg-[#111111] text-white rounded-xl px-4 py-2.5 shadow-lg flex-wrap">
          <span className="text-sm font-semibold">{pickedCount} selected</span>

          <div className="h-4 w-px bg-white/20" />
          <button onClick={moveSelected}
            className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:brightness-110 transition-colors">
            <Archive size={14} /> Move {pickedCount} to History
          </button>

          <div className="h-4 w-px bg-white/20" />
          <button onClick={() => { if (confirm(`Delete ${pickedCount} order${pickedCount !== 1 ? 's' : ''}? This can't be undone.`)) deleteSelected() }}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-400 hover:text-red-300 transition-colors">
            <Trash2 size={14} /> Delete {pickedCount}
          </button>

          <button onClick={clearPicked} className="ml-auto text-white/60 hover:text-white"><X size={16} /></button>
        </div>
      )}

      {/* Desktop table view */}
      <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
              {canEdit && (
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={allPicked} onChange={toggleAll}
                    className="accent-[#FECD28] w-4 h-4 cursor-pointer" title="Select all" />
                </th>
              )}
              {['PS No', 'Customer', 'Destination', 'TCG', 'EPX', 'Courier', 'Approved', 'Buy Label', ...(!inHistory ? ['Picked', 'Labelled'] : []), 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {orders.map(order => {
              const terminal = isTerminal(order)
              const selected = selectedId === order.id
              const cheaper = order.tcgQuote != null && order.epxQuote != null
                ? (order.tcgQuote <= order.epxQuote ? 'TCG' : 'EPX') : null
              const stale = isQuoteStale(order)

              return (
                <tr key={order.id} onClick={() => onSelect(order.id)}
                  className={`cursor-pointer transition-colors border-l-2
                    ${selected
                      ? 'border-brand bg-brand/5 dark:bg-brand/10'
                      : 'border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-700/40'}`}>

                  {canEdit && (
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      {canSelect(order) && (
                        <input type="checkbox" checked={picked.has(order.id)} onChange={() => togglePick(order.id)}
                          className="accent-[#FECD28] w-4 h-4 cursor-pointer" />
                      )}
                    </td>
                  )}

                  <td className="px-4 py-3 whitespace-nowrap">
                    <a href={order.psUrl} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                      {order.psNo} <ExternalLink size={11} />
                    </a>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{fmtDate(order.dateReceived)}</p>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200 leading-tight flex items-center gap-1.5">
                      {order.customer.company}
                      {order.note && <StickyNote size={12} className="text-amber-500 shrink-0" title={order.note} />}
                      {order.backOrder && <PackageSearch size={12} className="text-orange-500 shrink-0" title="Back Order" />}
                    </p>
                    {order.customer.contact && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{order.customer.contact}</p>}
                    {order.backOrder && <p className="text-[10px] font-semibold text-orange-500 mt-0.5 uppercase tracking-wide">Back Order</p>}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-slate-700 dark:text-slate-300">{order.address.city}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{order.address.province}</p>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-medium ${stale ? 'text-amber-500 dark:text-amber-400' : cheaper === 'TCG' ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>{fmt(order.tcgQuote)}</span>
                    {stale && order.tcgQuote != null && <Clock size={10} className="inline ml-1 text-amber-400 relative -top-px" />}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-medium ${stale ? 'text-amber-500 dark:text-amber-400' : cheaper === 'EPX' ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>{fmt(order.epxQuote)}</span>
                    {stale && order.epxQuote != null && <Clock size={10} className="inline ml-1 text-amber-400 relative -top-px" />}
                  </td>

                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {!canEdit || order.status === STATUS.TRIANGLE ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${COURIER_COLORS[order.selectedCourier] || 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}>
                        {order.selectedCourier || '—'}
                      </span>
                    ) : (
                      <select value={order.selectedCourier}
                        onChange={e => onUpdate(order.id, { selectedCourier: e.target.value })}
                        disabled={terminal}
                        className={`text-xs font-medium border rounded-lg px-2 py-1 focus:outline-none transition-colors dark:bg-slate-700
                          ${order.selectedCourier ? COURIER_COLORS[order.selectedCourier] || 'bg-white border-slate-200 text-slate-700' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400'}
                          ${terminal ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <option value="">Select…</option>
                        <option value="TCG">TCG</option>
                        <option value="EPX">EPX</option>
                        <option value="Triangle">Triangle</option>
                        <option value="Other">Other</option>
                      </select>
                    )}
                  </td>

                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div title={!order.staged && !terminal ? 'Mark as picked first' : undefined}>
                      <Toggle checked={order.approved} onChange={v => canEdit && onUpdate(order.id, { approved: v })} disabled={!canEdit || terminal || !order.staged} />
                    </div>
                  </td>

                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div title={!order.staged && !terminal ? 'Mark as picked first' : undefined}>
                      <Toggle checked={order.buyLabel} onChange={v => canEdit && onUpdate(order.id, { buyLabel: v })} disabled={!canEdit || terminal || !order.approved || !order.staged} />
                    </div>
                  </td>

                  {!inHistory && (
                    <td className="px-4 py-3 text-center">
                      {order.staged
                        ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                        : <Circle size={16} className="text-slate-300 dark:text-slate-600 mx-auto" />}
                    </td>
                  )}

                  {!inHistory && (
                    <td className="px-4 py-3 text-center">
                      {order.packed
                        ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                        : <Circle size={16} className="text-slate-300 dark:text-slate-600 mx-auto" />}
                    </td>
                  )}

                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.status} />
                      {order.errorMessage
                        ? <AlertTriangle size={14} className="text-red-500 shrink-0" title={order.errorMessage} />
                        : (() => {
                            const issues = getOrderIssues(order)
                            return issues.length > 0
                              ? <AlertTriangle size={14} className="text-amber-500 shrink-0" title={'Possible issue:\n' + issues.join('\n')} />
                              : null
                          })()}
                    </div>
                    {order.waybillNo && (
                      <a href={order.waybillLink} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5 block">
                        {order.waybillNo}
                      </a>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <ChevronRight size={16} className={`transition-colors ${selected ? 'text-brand' : 'text-slate-300 dark:text-slate-600'}`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/20">
        <p className="text-xs text-slate-400 dark:text-slate-500">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
      </div>
      </div>
    </>
  )
}
