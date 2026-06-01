import { STATUS } from '../mockData'

const config = {
  [STATUS.READY_FOR_QUOTE]: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
  [STATUS.QUOTED]:          { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', border: 'border-violet-200' },
  [STATUS.BOOKING]:         { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  [STATUS.BOOKED]:          { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-200' },
  [STATUS.BOOKING_FAILED]:  { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
  [STATUS.ERROR]:           { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
  [STATUS.TRIANGLE]:        { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', border: 'border-yellow-200' },
}

const fallback = { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' }

export default function StatusBadge({ status, size = 'sm' }) {
  const c = config[status] || fallback
  const padding = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${c.bg} ${c.text} ${c.border} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {status}
    </span>
  )
}
