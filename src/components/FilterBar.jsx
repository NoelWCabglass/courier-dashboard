import { useState, useRef, useEffect } from 'react'
import { Search, X, ChevronDown, Calendar, SlidersHorizontal } from 'lucide-react'
import { STATUS } from '../mockData'
import StatusBadge from './StatusBadge'

const STATUS_OPTIONS = [
  { key: 'all', label: 'All statuses' },
  { key: STATUS.READY_FOR_QUOTE, label: STATUS.READY_FOR_QUOTE },
  { key: STATUS.QUOTED, label: STATUS.QUOTED },
  { key: STATUS.BOOKING, label: STATUS.BOOKING },
  { key: STATUS.BOOKED, label: STATUS.BOOKED },
  { key: STATUS.BOOKING_FAILED, label: STATUS.BOOKING_FAILED },
  { key: STATUS.ERROR, label: STATUS.ERROR },
  { key: STATUS.TRIANGLE, label: STATUS.TRIANGLE },
]

function StatusDropdown({ value, onChange, orders }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const count = (key) => key === 'all' ? orders.length : orders.filter(o => o.status === key).length

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 pl-3 pr-2.5 py-2 text-sm rounded-xl border shadow-sm bg-white dark:bg-slate-800 transition-all min-w-[160px]
          ${open ? 'border-brand ring-2 ring-brand/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
        <SlidersHorizontal size={14} className="text-slate-400 shrink-0" />
        <span className="flex-1 text-left font-medium text-slate-700 dark:text-slate-200">
          {value === 'all' ? 'All statuses' : value}
        </span>
        {value !== 'all' && (
          <span className="text-xs font-semibold rounded-full px-1.5 py-0.5 shrink-0 text-[#111111]" style={{ backgroundColor: '#FECD28' }}>
            {count(value)}
          </span>
        )}
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-52 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-20 overflow-hidden py-1">
          {STATUS_OPTIONS.map(({ key, label }) => {
            const n = count(key)
            const active = value === key
            return (
              <button key={key} onClick={() => { onChange(key); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors
                  ${active ? 'bg-brand/10 dark:bg-brand/20 text-[#111111] dark:text-brand' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-brand' : 'bg-transparent'}`} />
                  {key === 'all' ? <span className="font-medium">{label}</span> : <StatusBadge status={key} />}
                </div>
                <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 ${active ? 'text-[#111111] bg-brand' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'}`}>{n}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FilterBar({ orders, activeFilter, setActiveFilter, courierFilter, setCourierFilter, search, setSearch, dateFrom, setDateFrom, dateTo, setDateTo }) {
  const hasFilters = activeFilter !== 'all' || courierFilter !== 'all' || search || dateFrom || dateTo

  const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  const isToday = dateFrom === todayStr && dateTo === todayStr
  const toggleToday = () => {
    if (isToday) { setDateFrom(''); setDateTo('') }
    else { setDateFrom(todayStr); setDateTo(todayStr) }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 mb-4">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search PS number or customer…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand placeholder:text-slate-400 transition-colors" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      </div>

      <StatusDropdown value={activeFilter} onChange={setActiveFilter} orders={orders} />

      <button onClick={toggleToday}
        className={`text-sm font-semibold rounded-xl px-3 py-2 shadow-sm border transition-colors
          ${isToday
            ? 'bg-brand border-brand-dark text-[#111111]'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand'}`}
        style={isToday ? { backgroundColor: '#FECD28' } : {}}>
        Today
      </button>

      <select value={courierFilter} onChange={e => setCourierFilter(e.target.value)}
        className="text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand cursor-pointer">
        <option value="all">All couriers</option>
        <option value="TCG">TCG</option>
        <option value="EPX">EPX</option>
        <option value="Triangle">Triangle</option>
      </select>

      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-3 py-1.5">
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="text-sm text-slate-700 dark:text-slate-300 bg-transparent focus:outline-none w-32" />
        <span className="text-slate-300 dark:text-slate-600 text-sm">→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="text-sm text-slate-700 dark:text-slate-300 bg-transparent focus:outline-none w-32" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo('') }} className="ml-1 text-slate-400 hover:text-slate-600"><X size={13} /></button>
        )}
      </div>

      {hasFilters && (
        <button onClick={() => { setActiveFilter('all'); setCourierFilter('all'); setSearch(''); setDateFrom(''); setDateTo('') }}
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm transition-colors">
          <X size={13} /> Clear
        </button>
      )}
    </div>
  )
}
