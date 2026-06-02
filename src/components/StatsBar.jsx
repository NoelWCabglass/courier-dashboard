import { FileText, Zap, CheckCircle, Truck, AlertCircle } from 'lucide-react'
import { STATUS } from '../mockData'
import { hasIssues } from '../validation'

const stats = [
  { label: 'Total Orders',     icon: FileText,    color: 'text-[#111111]', bg: 'bg-brand',       filter: () => true,   brand: true },
  { label: 'Awaiting Quote',   icon: Zap,         color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/30',   filter: o => o.status === STATUS.READY_FOR_QUOTE },
  { label: 'Pending Approval', icon: CheckCircle, color: 'text-violet-600',bg: 'bg-violet-50 dark:bg-violet-900/30', filter: o => o.status === STATUS.QUOTED && (!o.approved || !o.buyLabel) },
  { label: 'Booked',           icon: Truck,       color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30',  filter: o => o.status === STATUS.BOOKED },
  // Errors = sheet errors OR dashboard-detected issues
  { label: 'Errors / Issues',  icon: AlertCircle, color: 'text-red-600',   bg: 'bg-red-50 dark:bg-red-900/30',    filter: o => o.status === STATUS.ERROR || o.status === STATUS.BOOKING_FAILED || hasIssues(o) },
]

export default function StatsBar({ orders }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
      {stats.map(({ label, icon: Icon, color, bg, filter, brand }) => (
        <div key={label}
          className={`rounded-xl border p-4 shadow-sm ${brand
            ? 'border-brand-dark'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
          style={brand ? { backgroundColor: '#FECD28', borderColor: '#E5B800' } : {}}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium uppercase tracking-wide ${brand ? 'text-[#111111]/60' : 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
            <span className={`${bg} ${color} p-1.5 rounded-lg`}><Icon size={14} /></span>
          </div>
          <p className={`text-2xl font-bold ${brand ? 'text-[#111111]' : 'text-slate-900 dark:text-slate-100'}`}>
            {orders.filter(filter).length}
          </p>
        </div>
      ))}
    </div>
  )
}
