import { Search, X } from 'lucide-react'
import { STATUS } from '../mockData'

const TABS = [
  { key: 'all', label: 'All' },
  { key: STATUS.READY_FOR_QUOTE, label: 'Ready' },
  { key: STATUS.QUOTED, label: 'Quoted' },
  { key: STATUS.BOOKING, label: 'Booking' },
  { key: STATUS.BOOKING_FAILED, label: 'Failed' },
  { key: STATUS.ERROR, label: 'Error' },
  { key: STATUS.TRIANGLE, label: 'Triangle' },
]

export default function FilterTabs({ orders, activeFilter, setActiveFilter, search, setSearch }) {
  const count = (key) => key === 'all' ? orders.length : orders.filter(o => o.status === key).length

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto scrollbar-thin shrink-0">
        {TABS.map(({ key, label }) => {
          const n = count(key)
          const active = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150
                ${active
                  ? 'bg-brand text-[#111111] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              {label}
              {n > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold
                  ${active ? 'bg-black/10 text-[#111111]' : 'bg-slate-100 text-slate-600'}`}>
                  {n}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="relative flex-1 max-w-xs ml-auto">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search PS number or customer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand placeholder:text-slate-400 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
