import { ExternalLink, AlertTriangle, ChevronRight } from 'lucide-react'
import StatusBadge from './StatusBadge'
import Toggle from './Toggle'
import { STATUS } from '../mockData'
import { useAuth } from '../context/AuthContext'
import { getOrderIssues } from '../validation'

const fmt = (n) => n != null ? `R ${Number(n).toFixed(2)}` : '—'

const COURIER_COLORS = {
  TCG:      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
  EPX:      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  Triangle: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
}

export default function OrderCard({ order, selected, onSelect, onUpdate }) {
  const { can } = useAuth()
  const canEdit = can('canEdit')
  const terminal = [STATUS.BOOKED, STATUS.BOOKING, STATUS.BOOKING_FAILED].includes(order.status)
  const cheaper = order.tcgQuote != null && order.epxQuote != null
    ? (order.tcgQuote <= order.epxQuote ? 'TCG' : 'EPX') : null

  return (
    <div
      onClick={() => onSelect(order.id)}
      className={`rounded-xl border shadow-sm p-4 cursor-pointer transition-all
        ${selected
          ? 'border-brand bg-brand/5 dark:bg-brand/10'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <a href={order.psUrl} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-sm">
            {order.psNo} <ExternalLink size={11} />
          </a>
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{order.customer.company}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{order.address.city}, {order.address.province}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={order.status} />
          {order.errorMessage
            ? <AlertTriangle size={14} className="text-red-500" />
            : (getOrderIssues(order).length > 0 && <AlertTriangle size={14} className="text-amber-500" />)}
        </div>
      </div>

      {/* Quotes */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[['TCG', order.tcgQuote], ['EPX', order.epxQuote]].map(([label, val]) => (
          <div key={label} className={`rounded-lg px-2.5 py-2 border text-center
            ${cheaper === label
              ? 'border-brand bg-brand/10 dark:bg-brand/20'
              : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40'}`}>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">{label}</p>
            <p className={`text-sm font-bold ${cheaper === label ? 'text-[#111111] dark:text-brand' : 'text-slate-700 dark:text-slate-300'}`}>
              {fmt(val)}
            </p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
        {/* Courier */}
        {!canEdit || order.status === STATUS.TRIANGLE ? (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${COURIER_COLORS[order.selectedCourier] || 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500'}`}>
            {order.selectedCourier || '—'}
          </span>
        ) : (
          <select value={order.selectedCourier}
            onChange={e => onUpdate(order.id, { selectedCourier: e.target.value })}
            disabled={terminal}
            className={`text-xs font-medium border rounded-lg px-2 py-1 focus:outline-none
              ${order.selectedCourier ? COURIER_COLORS[order.selectedCourier] || 'bg-white border-slate-200 text-slate-700' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400'}
              ${terminal ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <option value="">Courier…</option>
            <option value="TCG">TCG</option>
            <option value="EPX">EPX</option>
            <option value="Triangle">Triangle</option>
          </select>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Approved</span>
            <Toggle checked={order.approved} onChange={v => canEdit && onUpdate(order.id, { approved: v })} disabled={!canEdit || terminal} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Buy</span>
            <Toggle checked={order.buyLabel} onChange={v => canEdit && onUpdate(order.id, { buyLabel: v })} disabled={!canEdit || terminal || !order.approved} />
          </div>
        </div>

        <ChevronRight size={16} className={selected ? 'text-brand' : 'text-slate-300 dark:text-slate-600'} />
      </div>

      {order.waybillNo && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <a href={order.waybillLink} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Waybill: {order.waybillNo}
          </a>
        </div>
      )}
    </div>
  )
}
