import { ExternalLink, AlertTriangle, ChevronRight } from 'lucide-react'
import StatusBadge from './StatusBadge'
import Toggle from './Toggle'
import OrderCard from './OrderCard'
import { STATUS } from '../mockData'
import { useAuth } from '../context/AuthContext'

const fmt = (n) => n != null ? `R ${Number(n).toFixed(2)}` : '—'
const fmtDate = (d) => new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const COURIER_COLORS = {
  TCG:      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
  EPX:      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  Triangle: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
}

export default function OrdersTable({ orders, selectedId, onSelect, onUpdate }) {
  const { can } = useAuth()
  const canEdit = can('canEdit')
  const isTerminal = (o) => [STATUS.BOOKED, STATUS.BOOKING, STATUS.BOOKING_FAILED].includes(o.status)

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

      {/* Desktop table view */}
      <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
              {['PS No', 'Customer', 'Destination', 'TCG', 'EPX', 'Courier', 'Approved', 'Buy Label', 'Status', ''].map(h => (
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

              return (
                <tr key={order.id} onClick={() => onSelect(order.id)}
                  className={`cursor-pointer transition-colors border-l-2
                    ${selected
                      ? 'border-brand bg-brand/5 dark:bg-brand/10'
                      : 'border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-700/40'}`}>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <a href={order.psUrl} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                      {order.psNo} <ExternalLink size={11} />
                    </a>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{fmtDate(order.dateReceived)}</p>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200 leading-tight">{order.customer.company}</p>
                    {order.customer.contact && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{order.customer.contact}</p>}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-slate-700 dark:text-slate-300">{order.address.city}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{order.address.province}</p>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-medium ${cheaper === 'TCG' ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>{fmt(order.tcgQuote)}</span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-medium ${cheaper === 'EPX' ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>{fmt(order.epxQuote)}</span>
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
                      </select>
                    )}
                  </td>

                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Toggle checked={order.approved} onChange={v => canEdit && onUpdate(order.id, { approved: v })} disabled={!canEdit || terminal} />
                  </td>

                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Toggle checked={order.buyLabel} onChange={v => canEdit && onUpdate(order.id, { buyLabel: v })} disabled={!canEdit || terminal || !order.approved} />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.status} />
                      {order.errorMessage && <AlertTriangle size={14} className="text-red-500 shrink-0" title={order.errorMessage} />}
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
