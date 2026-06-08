import { useState, useMemo } from 'react'
import { CheckCircle2, AlertCircle, Clock, Upload, Settings, Plus, ArrowLeft, Trash2, X, ExternalLink, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { saveWHCategory, deleteWHCategory, whUpload } from '../api'

// ── Due-date helpers ──────────────────────────────────────────────────────────

function getNextDueDate(cat, lastUploadDate) {
  const now = new Date()
  const last = lastUploadDate ? new Date(lastUploadDate) : null

  if (cat.frequencyType === 'monthly') {
    // Due on day N of each month
    const day = Math.max(1, Math.min(28, Number(cat.frequencyValue) || 1))
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), day)
    if (!last) return thisMonth
    // If already uploaded this month after the due day, next due is next month
    const lastMonthDue = new Date(last.getFullYear(), last.getMonth(), day)
    if (last >= lastMonthDue) {
      return new Date(now.getFullYear(), now.getMonth() + 1, day)
    }
    return thisMonth
  }

  if (cat.frequencyType === 'weekly') {
    // Due every N days (frequencyValue = interval in days, default 7)
    const interval = Math.max(1, Number(cat.frequencyValue) || 7)
    if (!last) return new Date(now.getTime() - 1) // overdue
    return new Date(last.getTime() + interval * 24 * 60 * 60 * 1000)
  }

  if (cat.frequencyType === 'days') {
    const interval = Math.max(1, Number(cat.frequencyValue) || 30)
    if (!last) return new Date(now.getTime() - 1) // overdue
    return new Date(last.getTime() + interval * 24 * 60 * 60 * 1000)
  }

  return null
}

function getCategoryStatus(cat, uploads) {
  const catUploads = uploads.filter(u => u.categoryId === cat.id)
  const last = catUploads.length
    ? catUploads.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
    : null

  const nextDue = getNextDueDate(cat, last?.uploadedAt)
  if (!nextDue) return { status: 'ok', nextDue: null, last }

  const now = new Date()
  const daysUntilDue = Math.ceil((nextDue - now) / (1000 * 60 * 60 * 24))
  const reminder = Number(cat.reminderDaysBefore) || 3

  if (daysUntilDue < 0) return { status: 'overdue', nextDue, daysUntilDue, last }
  if (daysUntilDue <= reminder) return { status: 'due-soon', nextDue, daysUntilDue, last }
  return { status: 'ok', nextDue, daysUntilDue, last }
}

const STATUS_STYLES = {
  overdue:  { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',   icon: <AlertCircle size={20} className="text-red-500" />,   badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', label: 'Overdue' },
  'due-soon': { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: <Clock size={20} className="text-amber-500" />, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', label: 'Due Soon' },
  ok:       { bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', icon: <CheckCircle2 size={20} className="text-green-500" />, badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', label: 'Up to Date' },
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtShort = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── Admin Settings Modal ──────────────────────────────────────────────────────

function CategorySettingsModal({ cat, users, onSave, onDelete, onClose, isNew }) {
  const [form, setForm] = useState({
    id: cat?.id || ('cat-' + Date.now()),
    name: cat?.name || '',
    driveFolderId: cat?.driveFolderId || '',
    assignedUser: cat?.assignedUser || '',
    frequencyType: cat?.frequencyType || 'monthly',
    frequencyValue: cat?.frequencyValue ?? 1,
    reminderDaysBefore: cat?.reminderDaysBefore ?? 3,
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const inputCls = "w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#FECD28] focus:ring-1 focus:ring-[#FECD28]/30"

  const freqLabel = { monthly: 'Day of month (1–28)', weekly: 'Every N days', days: 'Every N days' }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">{isNew ? 'New Category' : 'Edit Category'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Category Name</label>
            <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Vehicle Inspections" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Assigned To</label>
            <select className={inputCls} value={form.assignedUser} onChange={e => setForm(f => ({ ...f, assignedUser: e.target.value }))}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.username} value={u.username}>{u.name || u.username}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Frequency</label>
              <select className={inputCls} value={form.frequencyType} onChange={e => setForm(f => ({ ...f, frequencyType: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly (every N days)</option>
                <option value="days">Every N days</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">{freqLabel[form.frequencyType]}</label>
              <input type="number" className={inputCls} value={form.frequencyValue} min={1} max={form.frequencyType === 'monthly' ? 28 : 365}
                onChange={e => setForm(f => ({ ...f, frequencyValue: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Reminder (days before due)</label>
            <input type="number" className={inputCls} value={form.reminderDaysBefore} min={0} max={30}
              onChange={e => setForm(f => ({ ...f, reminderDaysBefore: Number(e.target.value) }))} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Google Drive Folder ID <span className="font-normal text-slate-400">(optional)</span></label>
            <input className={inputCls} value={form.driveFolderId} onChange={e => setForm(f => ({ ...f, driveFolderId: e.target.value }))}
              placeholder="Paste folder ID from Drive URL" />
            <p className="text-xs text-slate-400 mt-1">Found in the Drive folder URL: drive.google.com/drive/folders/<strong>THIS_PART</strong></p>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700">
          {!isNew && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Delete this category?</span>
                <button onClick={() => onDelete(cat.id)} className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700">Yes, delete</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700">
                <Trash2 size={13} /> Delete category
              </button>
            )
          )}
          {isNew && <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              style={{ backgroundColor: '#FECD28' }}
              className="px-4 py-2 text-sm font-bold text-[#111111] rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Category Detail Page ──────────────────────────────────────────────────────

function CategoryPage({ cat, uploads, users, onBack, onUploadDone, onEditCat, canAdmin, currentUser }) {
  const catUploads = useMemo(() =>
    uploads.filter(u => u.categoryId === cat.id)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)),
    [uploads, cat.id]
  )

  const { status, nextDue, daysUntilDue, last } = getCategoryStatus(cat, uploads)
  const st = STATUS_STYLES[status]
  const assignedUser = users.find(u => u.username === cat.assignedUser)

  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [uploadError, setUploadError] = useState('')

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      await whUpload(cat.id, file.name, base64, file.type, currentUser?.name || currentUser?.username || 'Unknown', uploadNote)
      setUploadNote('')
      onUploadDone()
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <ArrowLeft size={16} /> All Categories
        </button>
      </div>

      <div className={`rounded-2xl border p-5 ${st.bg}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {st.icon}
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{cat.name}</h2>
              <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>{st.label}</span>
            </div>
          </div>
          {canAdmin && (
            <button onClick={() => onEditCat(cat)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
              <Settings size={13} /> Settings
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Next Due</p>
            <p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
              {nextDue ? fmtShort(nextDue) : '—'}
              {daysUntilDue != null && (
                <span className={`ml-1 text-xs ${daysUntilDue < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `in ${daysUntilDue}d`})
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Last Upload</p>
            <p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">{last ? fmtShort(last.uploadedAt) : 'Never'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Assigned To</p>
            <p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">{assignedUser?.name || cat.assignedUser || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Total Uploads</p>
            <p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">{catUploads.length}</p>
          </div>
        </div>
      </div>

      {/* Upload section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Upload New File</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={uploadNote}
            onChange={e => setUploadNote(e.target.value)}
            placeholder="Optional note (e.g. March inspection, unit 3)"
            className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#FECD28] focus:ring-1 focus:ring-[#FECD28]/30"
          />
          <label className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors
            ${uploading ? 'opacity-50 cursor-not-allowed border-slate-200' : 'border-[#FECD28] hover:bg-[#FECD28]/5'}`}>
            <Upload size={16} className="text-[#FECD28]" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {uploading ? 'Uploading…' : 'Choose file to upload'}
            </span>
            <input type="file" className="hidden" disabled={uploading} onChange={handleFileUpload} />
          </label>
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>
      </div>

      {/* Upload history */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Upload History</h3>
        </div>
        {catUploads.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No uploads yet</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {catUploads.map(u => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={15} className="text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{u.fileName || '(no file)'}</p>
                    {u.notes && <p className="text-xs text-slate-400 mt-0.5">{u.notes}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(u.uploadedAt)} · {u.uploadedBy}</p>
                  </div>
                </div>
                {u.driveLink && (
                  <a href={u.driveLink} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 ml-3 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    <ExternalLink size={12} /> View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main WH Uploads Page ──────────────────────────────────────────────────────

export default function WHUploadsPage({ whData, onRefresh }) {
  const { can, user, users } = useAuth()
  const canAdmin = can('canAdmin')

  const { categories = [], uploads = [] } = whData || {}

  const [selectedCat, setSelectedCat] = useState(null)
  const [editingCat, setEditingCat] = useState(null)
  const [showNewCat, setShowNewCat] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSaveCategory = async (form) => {
    setSaving(true)
    try {
      await saveWHCategory(form)
      await onRefresh()
      setEditingCat(null)
      setShowNewCat(false)
    } finally {
      setSaving(false) }
  }

  const handleDeleteCategory = async (categoryId) => {
    await deleteWHCategory(categoryId)
    await onRefresh()
    setEditingCat(null)
    if (selectedCat?.id === categoryId) setSelectedCat(null)
  }

  const activeCategories = categories.filter(c => c.active !== false)

  // Notifications: collect overdue/due-soon for current user's assigned categories
  const myAlerts = useMemo(() =>
    activeCategories
      .filter(c => !canAdmin ? c.assignedUser === user?.username : true)
      .map(c => ({ cat: c, ...getCategoryStatus(c, uploads) }))
      .filter(x => x.status === 'overdue' || x.status === 'due-soon'),
    [activeCategories, uploads, user, canAdmin]
  )

  if (selectedCat) {
    const live = categories.find(c => c.id === selectedCat.id) || selectedCat
    return (
      <>
        <CategoryPage
          cat={live} uploads={uploads} users={users}
          onBack={() => setSelectedCat(null)}
          onUploadDone={onRefresh}
          onEditCat={setEditingCat}
          canAdmin={canAdmin}
          currentUser={user}
        />
        {editingCat && (
          <CategorySettingsModal
            cat={editingCat} users={users}
            onSave={handleSaveCategory}
            onDelete={handleDeleteCategory}
            onClose={() => setEditingCat(null)}
            isNew={false}
          />
        )}
      </>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">WH Uploads</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track warehouse document uploads and compliance</p>
        </div>
        {canAdmin && (
          <button onClick={() => setShowNewCat(true)}
            style={{ backgroundColor: '#FECD28' }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#111111]">
            <Plus size={15} /> Add Category
          </button>
        )}
      </div>

      {/* Alerts banner */}
      {myAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
            {myAlerts.filter(a => a.status === 'overdue').length > 0 ? '⚠️ Action required' : '⏰ Due soon'}
          </p>
          <ul className="text-sm text-red-600 dark:text-red-400 space-y-0.5">
            {myAlerts.map(a => (
              <li key={a.cat.id} className="flex items-center gap-2">
                <button onClick={() => setSelectedCat(a.cat)} className="hover:underline font-medium">{a.cat.name}</button>
                {a.status === 'overdue'
                  ? <span className="text-xs">— overdue by {Math.abs(a.daysUntilDue)} day{Math.abs(a.daysUntilDue) !== 1 ? 's' : ''}</span>
                  : <span className="text-xs">— due in {a.daysUntilDue} day{a.daysUntilDue !== 1 ? 's' : ''}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeCategories.map(cat => {
          const { status, nextDue, daysUntilDue, last } = getCategoryStatus(cat, uploads)
          const st = STATUS_STYLES[status]
          const assignedUser = users.find(u => u.username === cat.assignedUser)
          const catUploads = uploads.filter(u => u.categoryId === cat.id)

          return (
            <button key={cat.id} onClick={() => setSelectedCat(cat)} className={`text-left rounded-2xl border p-5 transition-all hover:shadow-md ${st.bg}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {st.icon}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                </div>
                {canAdmin && (
                  <button onClick={e => { e.stopPropagation(); setEditingCat(cat) }}
                    className="p-1 rounded-md hover:bg-black/10 text-slate-400">
                    <Settings size={14} />
                  </button>
                )}
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-3">{cat.name}</h3>
              <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p>Next due: <span className="font-medium text-slate-700 dark:text-slate-300">{nextDue ? fmtShort(nextDue) : '—'}
                  {daysUntilDue != null && (
                    <span className={`ml-1 ${daysUntilDue < 0 ? 'text-red-500 font-semibold' : ''}`}>
                      ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `in ${daysUntilDue}d`})
                    </span>
                  )}
                </span></p>
                <p>Last upload: <span className="font-medium text-slate-700 dark:text-slate-300">{last ? fmtShort(last.uploadedAt) : 'Never'}</span></p>
                <p>Assigned: <span className="font-medium text-slate-700 dark:text-slate-300">{assignedUser?.name || cat.assignedUser || '—'}</span></p>
                <p>Total uploads: <span className="font-medium text-slate-700 dark:text-slate-300">{catUploads.length}</span></p>
              </div>
            </button>
          )
        })}

        {activeCategories.length === 0 && (
          <div className="col-span-3 py-16 text-center text-slate-400 text-sm">
            No categories yet. {canAdmin && <button onClick={() => setShowNewCat(true)} className="text-[#FECD28] font-semibold hover:underline">Add one</button>}
          </div>
        )}
      </div>

      {/* Modals */}
      {editingCat && (
        <CategorySettingsModal
          cat={editingCat} users={users}
          onSave={handleSaveCategory}
          onDelete={handleDeleteCategory}
          onClose={() => setEditingCat(null)}
          isNew={false}
        />
      )}
      {showNewCat && (
        <CategorySettingsModal
          cat={null} users={users}
          onSave={handleSaveCategory}
          onDelete={() => {}}
          onClose={() => setShowNewCat(false)}
          isNew={true}
        />
      )}
    </div>
  )
}
