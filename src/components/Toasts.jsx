import { useEffect } from 'react'
import { CheckCircle, AlertTriangle, Bell, X } from 'lucide-react'

const ICONS = {
  success: { Icon: CheckCircle, cls: 'text-green-500' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-500' },
  info:    { Icon: Bell, cls: 'text-blue-500' },
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, toast.duration || 4000)
    return () => clearTimeout(t)
  }, [])
  const { Icon, cls } = ICONS[toast.type] || ICONS.info
  return (
    <div className="flex items-start gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3 w-80 animate-[slideIn_0.2s_ease-out]">
      <Icon size={18} className={`${cls} shrink-0 mt-0.5`} />
      <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{toast.message}</p>
      <button onClick={onClose} className="text-slate-300 hover:text-slate-500 shrink-0"><X size={14} /></button>
    </div>
  )
}

export default function Toasts({ toasts, remove }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map(t => <Toast key={t.id} toast={t} onClose={() => remove(t.id)} />)}
    </div>
  )
}
