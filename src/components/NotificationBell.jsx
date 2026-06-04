import { useState, useRef, useEffect } from 'react'
import { Bell, AlertCircle, AlertTriangle, Info, CheckCheck } from 'lucide-react'

const SEV = {
  error:   { Icon: AlertCircle,   color: 'text-red-500',   dot: 'bg-red-500' },
  warning: { Icon: AlertTriangle, color: 'text-amber-500', dot: 'bg-amber-500' },
  info:    { Icon: Info,          color: 'text-blue-500',  dot: 'bg-blue-500' },
}

// Date + time, e.g. "29 May, 09:15"
function formatTimestamp(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function NotificationBell({ notifications, unreadCount, isRead, onMarkRead, onMarkAllRead, onSelect, onSendTest, canTest }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = (n) => {
    onMarkRead(n.id)
    onSelect(n)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        className="relative p-2 rounded-md text-black/50 hover:text-black hover:bg-black/10 transition-colors"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium text-red-600">{unreadCount} new</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canTest && onSendTest && (
                <button
                  onClick={onSendTest}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors"
                >
                  Send test
                </button>
              )}
              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                You're all caught up — no warnings.
              </div>
            ) : (
              notifications.map((n) => {
                const { Icon, color, dot } = SEV[n.severity] || SEV.info
                const read = isRead(n.id)
                return (
                  <button
                    key={n.id}
                    onClick={() => handleSelect(n)}
                    className={`w-full text-left flex gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40 ${read ? '' : 'bg-amber-50/40 dark:bg-slate-700/20'}`}
                  >
                    <Icon size={16} className={`${color} mt-0.5 shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{n.title}</span>
                        {!read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.detail}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">PS {n.psNo}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatTimestamp(n.timestamp)}</span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
