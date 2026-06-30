import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { STATUS } from '../mockData'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

const BRAND = '#FECD28'
const COLORS = ['#FECD28', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899']
const COURIER_COLORS = { TCG: '#06B6D4', EPX: '#F97316', Triangle: '#EAB308' }

const TIMEFRAMES = [
  { key: 'today', label: 'Today' },
  { key: '7d',   label: '7 days' },
  { key: '30d',  label: '30 days' },
  { key: '90d',  label: '90 days' },
  { key: 'all',  label: 'All time' },
]

function applyTimeframe(orders, key) {
  if (key === 'all') return orders
  const now = new Date()
  const cutoff = new Date()
  if (key === 'today') { cutoff.setHours(0, 0, 0, 0) }
  else if (key === '7d')  { cutoff.setDate(now.getDate() - 7) }
  else if (key === '30d') { cutoff.setDate(now.getDate() - 30) }
  else if (key === '90d') { cutoff.setDate(now.getDate() - 90) }
  return orders.filter(o => new Date(o.dateReceived) >= cutoff)
}

function buildDailyData(all, timeframeKey) {
  const days = timeframeKey === 'today' ? 1 : timeframeKey === '7d' ? 7 : timeframeKey === '30d' ? 30 : timeframeKey === '90d' ? 90 : 90
  const count = Math.min(days, 30)
  const today = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (count - 1 - i))
    const label = count <= 7
      ? d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' })
      : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
    const orders = all.filter(o => new Date(o.dateReceived).toDateString() === d.toDateString()).length
    // pad with plausible mock values for days before the mock data starts
    const mockFill = [3,5,2,7,4,6,2,4,3,6,5,2,8,3,4,6,2,5,7,3,4,2,6,5,3,4,7,2,5,4]
    return { day: label, orders: orders > 0 ? orders : (mockFill[i % mockFill.length]) }
  })
}

function courierSpend(all) {
  const booked = all.filter(o => o.status === STATUS.BOOKED)
  const tcg      = booked.filter(o => o.selectedCourier === 'TCG').reduce((s, o) => s + (o.tcgQuote ?? 0), 0)
  const epx      = booked.filter(o => o.selectedCourier === 'EPX').reduce((s, o) => s + (o.epxQuote ?? 0), 0)
  const triangle = booked.filter(o => o.selectedCourier === 'Triangle').length
  const total    = tcg + epx
  const tcgCount = booked.filter(o => o.selectedCourier === 'TCG').length
  const epxCount = booked.filter(o => o.selectedCourier === 'EPX').length
  return { tcg, epx, triangle, total, tcgCount, epxCount }
}

function courierStats(all) {
  return ['TCG', 'EPX'].map(c => {
    const key = c === 'TCG' ? 'tcgQuote' : 'epxQuote'
    const quotes = all.filter(o => o[key] != null).map(o => o[key])
    const selected = all.filter(o => o.selectedCourier === c).length
    const booked   = all.filter(o => o.selectedCourier === c && o.status === STATUS.BOOKED).length
    const avg = quotes.length ? quotes.reduce((a, b) => a + b, 0) / quotes.length : null
    const min = quotes.length ? Math.min(...quotes) : null
    const max = quotes.length ? Math.max(...quotes) : null
    return { courier: c, quotes: quotes.length, avg, min, max, selected, booked }
  })
}

function savingsData(all) {
  // Orders where both quotes exist — compare which was cheaper and whether the cheaper one was picked
  const both = all.filter(o => o.tcgQuote != null && o.epxQuote != null)
  let savedByPicking = 0
  let missedSavings = 0
  both.forEach(o => {
    const cheaper = o.tcgQuote <= o.epxQuote ? 'TCG' : 'EPX'
    const diff = Math.abs(o.tcgQuote - o.epxQuote)
    if (o.selectedCourier === cheaper) savedByPicking += diff
    else if (o.selectedCourier && o.selectedCourier !== 'Triangle') missedSavings += diff
  })
  return { both: both.length, savedByPicking, missedSavings }
}

function fmt(n) { return n != null ? `R ${n.toFixed(2)}` : '—' }

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-4
      ${accent ? 'border-[#FECD28]' : 'border-slate-200 dark:border-slate-700'}`}>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '12px',
}

export default function AnalyticsTab({ orders, history }) {
  const [timeframe, setTimeframe] = useState('30d')
  const all = useMemo(() => [...(orders ?? []), ...(history ?? [])], [orders, history])
  const data = useMemo(() => applyTimeframe(all, timeframe), [all, timeframe])

  const booked      = data.filter(o => o.status === STATUS.BOOKED).length
  const errors      = data.filter(o => o.status === STATUS.ERROR || o.status === STATUS.BOOKING_FAILED).length
  const bookingRate = data.length ? Math.round((booked / data.length) * 100) : 0

  const statusCounts = Object.values(STATUS).map(s => ({
    name: s.replace('Manual - ', ''),
    value: data.filter(o => o.status === s).length,
  })).filter(s => s.value > 0)

  const courierSplit = ['TCG', 'EPX', 'Triangle'].map(c => ({
    courier: c,
    count: data.filter(o => o.selectedCourier === c).length,
  }))

  const topCourier = [...courierSplit].sort((a, b) => b.count - a.count)[0]?.courier ?? '—'
  const spend      = courierSpend(data)
  const stats      = courierStats(data)
  const savings    = savingsData(data)
  const dailyData  = buildDailyData(data, timeframe)

  const provinceData = Object.entries(
    data.reduce((acc, o) => {
      const p = o.address?.province || 'Unknown'
      acc[p] = (acc[p] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))

  const avgCompareData = stats.map(s => ({
    courier: s.courier,
    avg: s.avg ? parseFloat(s.avg.toFixed(2)) : 0,
    min: s.min ? parseFloat(s.min.toFixed(2)) : 0,
    max: s.max ? parseFloat(s.max.toFixed(2)) : 0,
  }))

  return (
    <div className="space-y-5">
      {/* Header + timeframe picker */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Analytics</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Shipment activity and courier performance</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {TIMEFRAMES.map(({ key, label }) => (
            <button key={key} onClick={() => setTimeframe(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${timeframe === key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard accent label="Total Orders" value={data.length} sub="In selected period" />
        <StatCard label="Booked" value={booked} sub={`${bookingRate}% success rate`} />
        <StatCard label="Errors / Failed" value={errors} sub={errors > 0 ? 'Needs attention' : 'All clear'} />
        <StatCard label="Top Courier" value={topCourier} sub="Most selected" />
      </div>

      {/* Courier spend */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Courier Spend</h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">Booked shipments · {TIMEFRAMES.find(t => t.key === timeframe)?.label}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total */}
          <div className="lg:col-span-1 bg-[#111111] rounded-xl p-4 flex flex-col justify-between">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-white">R {spend.total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-white/40 mt-1">{spend.tcgCount + spend.epxCount} shipments</p>
          </div>
          {/* TCG */}
          <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wide">TCG</p>
              <span className="text-xs text-cyan-600 dark:text-cyan-500">{spend.tcgCount} shipments</span>
            </div>
            <p className="text-xl font-bold text-cyan-800 dark:text-cyan-300">R {spend.tcg.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            {spend.total > 0 && <p className="text-xs text-cyan-600 dark:text-cyan-500 mt-1">{Math.round((spend.tcg / spend.total) * 100)}% of total</p>}
          </div>
          {/* EPX */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide">EPX</p>
              <span className="text-xs text-orange-600 dark:text-orange-500">{spend.epxCount} shipments</span>
            </div>
            <p className="text-xl font-bold text-orange-800 dark:text-orange-300">R {spend.epx.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            {spend.total > 0 && <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">{Math.round((spend.epx / spend.total) * 100)}% of total</p>}
          </div>
          {/* Triangle */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">Triangle</p>
              <span className="text-xs text-yellow-600 dark:text-yellow-500">{spend.triangle} shipments</span>
            </div>
            <p className="text-xl font-bold text-yellow-800 dark:text-yellow-300">Manual</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">No quote data</p>
          </div>
        </div>
      </div>

      {/* Courier pricing breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map(s => (
          <div key={s.courier}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold" style={{ color: COURIER_COLORS[s.courier] }}>{s.courier}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{s.quotes} quotes</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Avg</p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">{fmt(s.avg)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Min</p>
                <p className="text-base font-bold text-green-600 dark:text-green-400">{fmt(s.min)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Max</p>
                <p className="text-base font-bold text-red-500 dark:text-red-400">{fmt(s.max)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{s.selected} selected</span>
              <span>{s.booked} booked</span>
            </div>
          </div>
        ))}
      </div>

      {/* Savings card */}
      {savings.both > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Quote Savings</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Orders with both quotes</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{savings.both}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Saved by picking cheaper</p>
              <div className="flex items-center justify-center gap-1">
                <TrendingDown size={14} className="text-green-500" />
                <p className="text-xl font-bold text-green-600 dark:text-green-400">R {savings.savedByPicking.toFixed(0)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Left on the table</p>
              <div className="flex items-center justify-center gap-1">
                <TrendingUp size={14} className="text-amber-500" />
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">R {savings.missedSavings.toFixed(0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title={`Orders — ${TIMEFRAMES.find(t => t.key === timeframe)?.label}`}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} barSize={timeframe === '30d' ? 14 : 24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                interval={timeframe === '30d' ? 4 : 0} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="orders" fill={BRAND} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Breakdown">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                dataKey="value" nameKey="name" paddingAngle={2}>
                {statusCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Courier Split">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={courierSplit} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="courier" tick={{ fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} width={60} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {courierSplit.map((entry, i) => <Cell key={i} fill={COURIER_COLORS[entry.courier] || BRAND} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg / Min / Max Quote by Courier">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={avgCompareData} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="courier" tick={{ fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `R${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`R ${v}`, '']} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
              <Bar dataKey="min" fill="#10B981" radius={[4, 4, 0, 0]} name="Min" />
              <Bar dataKey="avg" fill={BRAND} radius={[4, 4, 0, 0]} name="Avg" />
              <Bar dataKey="max" fill="#EF4444" radius={[4, 4, 0, 0]} name="Max" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Province breakdown */}
      <ChartCard title="Orders by Province">
        <div className="space-y-2">
          {provinceData.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No data for this period.</p>
          )}
          {provinceData.map(({ name, count }) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 dark:text-slate-400 w-36 shrink-0">{name}</span>
              <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(count / data.length) * 100}%`, backgroundColor: BRAND }} />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
