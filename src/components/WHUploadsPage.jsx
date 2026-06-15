import { useState, useMemo } from 'react'
import { CheckCircle2, AlertCircle, Clock, Upload, Settings, Plus, ArrowLeft, Trash2, X, ExternalLink, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { saveWHCategory, deleteWHCategory, whUpload, deleteWHUpload } from '../api'

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

// ── ISO-week helpers (for weekly-mode categories, e.g. Bin Audits) ─────────────
function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7 // Mon=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((date - firstThursday) / (7 * 86400000))
  return { year: date.getUTCFullYear(), week }
}
function isoWeekMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const w1Mon = new Date(jan4); w1Mon.setUTCDate(jan4.getUTCDate() - jan4Day)
  const mon = new Date(w1Mon); mon.setUTCDate(w1Mon.getUTCDate() + (week - 1) * 7)
  return mon
}
// Deadline = end of Wednesday of that week (overdue from Thursday).
function isoWeekDeadline(year, week) {
  const m = isoWeekMonday(year, week)
  const wed = new Date(m); wed.setUTCDate(m.getUTCDate() + 2)
  return new Date(wed.getUTCFullYear(), wed.getUTCMonth(), wed.getUTCDate(), 23, 59, 59)
}
function weekRangeLabel(year, week) {
  const m = isoWeekMonday(year, week)
  const mon = new Date(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate())
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const f = (x) => x.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
  return `${f(mon)} – ${f(sun)}`
}
function weekKeyOf(year, week) { return `${year}-W${week}` }

function weekStatus(cat, uploads, year, week, now) {
  const key = weekKeyOf(year, week)
  const ups = uploads.filter(u => u.categoryId === cat.id && u.weekKey === key)
  if (ups.length) return { state: 'done', ups, key }
  if (now > isoWeekDeadline(year, week)) return { state: 'overdue', ups: [], key }
  return { state: 'due', ups: [], key }
}

// Aggregate weekly category → overall status for the card/header.
function aggregateWeekly(cat, uploads) {
  const now = new Date()
  const { year, week: currentWeek } = getISOWeek(now)
  let overdue = 0, done = 0
  for (let w = 1; w <= currentWeek; w++) {
    const s = weekStatus(cat, uploads, year, w, now).state
    if (s === 'overdue') overdue++
    if (s === 'done') done++
  }
  const currentDone = weekStatus(cat, uploads, year, currentWeek, now).state === 'done'
  const status = overdue > 0 ? 'overdue' : (!currentDone ? 'due-soon' : 'ok')
  const catUploads = uploads.filter(u => u.categoryId === cat.id)
  const last = catUploads.length ? catUploads.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0] : null
  return { status, overdue, done, total: currentWeek, currentWeek, year, last }
}

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
    mode: cat?.mode || 'standard',
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

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Tracking mode</label>
            <select className={inputCls} value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
              <option value="standard">Standard (single recurring upload)</option>
              <option value="weekly">Weekly slots (one per week, due Wednesday)</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">{form.mode === 'weekly' ? 'Lists every week of the year; each week needs its own upload (overdue from Thursday).' : 'One ongoing upload history with a recurring due date.'}</p>
          </div>

          {form.mode === 'standard' && (
            <>
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
            </>
          )}

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
  const [deletingId, setDeletingId] = useState(null)
  const [queue, setQueue] = useState([]) // { file, previewUrl }

  const addToQueue = (e) => {
    const picked = Array.from(e.target.files || [])
    if (!picked.length) return
    const newItems = picked.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }))
    setQueue(q => [...q, ...newItems])
    e.target.value = ''
  }

  const removeFromQueue = (idx) => {
    setQueue(q => {
      if (q[idx]?.previewUrl) URL.revokeObjectURL(q[idx].previewUrl)
      return q.filter((_, i) => i !== idx)
    })
  }

  const submitQueue = async () => {
    if (!queue.length) return
    setUploading(true)
    setUploadError('')
    try {
      const filesPayload = await Promise.all(queue.map(async ({ file }) => {
        const fileData = await new Promise((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res(reader.result.split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        return { fileName: file.name, fileData, mimeType: file.type }
      }))
      await whUpload(cat.id, filesPayload, currentUser?.name || currentUser?.username || 'Unknown', uploadNote)
      setUploadNote('')
      setQueue([])
      onUploadDone()
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{cat.name}</h2>
                {cat.driveFolderId && (
                  <a href={`https://drive.google.com/drive/folders/${cat.driveFolderId}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    <ExternalLink size={12} /> Drive Folder
                  </a>
                )}
              </div>
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
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">New Submission</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={uploadNote}
            onChange={e => setUploadNote(e.target.value)}
            placeholder="Optional note (e.g. June inspection, unit 3)"
            className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#FECD28] focus:ring-1 focus:ring-[#FECD28]/30"
          />

          {/* Queue preview */}
          {queue.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {queue.map((item, idx) => (
                <div key={idx} className="relative flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 max-w-[160px]">
                  {item.previewUrl
                    ? <img src={item.previewUrl} className="w-6 h-6 rounded object-cover shrink-0" alt="" />
                    : <FileText size={14} className="shrink-0 text-slate-400" />}
                  <span className="truncate">{item.file.name}</span>
                  <button onClick={() => removeFromQueue(idx)} className="shrink-0 ml-1 text-slate-400 hover:text-red-500"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Add files button */}
          <label className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors
            ${uploading ? 'opacity-50 cursor-not-allowed border-slate-200' : 'border-[#FECD28] hover:bg-[#FECD28]/5'}`}>
            <Upload size={16} className="text-[#FECD28]" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {queue.length > 0 ? `Add more files (${queue.length} queued)` : 'Add files or photos'}
            </span>
            <input type="file" className="hidden" disabled={uploading} multiple onChange={addToQueue} />
          </label>

          {/* Submit button — only shows when files are queued */}
          {queue.length > 0 && (
            <button onClick={submitQueue} disabled={uploading}
              style={{ backgroundColor: '#FECD28' }}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-[#111111] disabled:opacity-50">
              {uploading ? 'Uploading…' : `Submit ${queue.length} file${queue.length !== 1 ? 's' : ''} as one submission`}
            </button>
          )}

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
            {catUploads.map(u => {
              const fileList = u.files?.length > 0 ? u.files : (u.driveLink ? [{ fileName: u.fileName, driveLink: u.driveLink }] : [])
              return (
                <div key={u.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-400">{fmtDate(u.uploadedAt)} · {u.uploadedBy}</p>
                      {u.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">{u.notes}</p>}
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {fileList.map((f, i) => (
                          <a key={i} href={f.driveLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
                            <FileText size={11} /> {f.fileName || `File ${i + 1}`}
                          </a>
                        ))}
                        {fileList.length === 0 && <span className="text-xs text-slate-400">(no files)</span>}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center pt-1">
                      {deletingId === u.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={async () => { await deleteWHUpload(u.id); setDeletingId(null); onUploadDone() }}
                            className="text-xs text-red-600 font-semibold hover:underline">Confirm</button>
                          <button onClick={() => setDeletingId(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(u.id)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Weekly category (e.g. Bin Audits) ─────────────────────────────────────────

const WEEK_STYLES = {
  done:    { badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', label: 'Uploaded', icon: <CheckCircle2 size={16} className="text-green-500" /> },
  due:     { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', label: 'Due', icon: <Clock size={16} className="text-amber-500" /> },
  overdue: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', label: 'Overdue', icon: <AlertCircle size={16} className="text-red-500" /> },
}

function WeekRow({ cat, year, week, ws, isCurrent, currentUser, onUploadDone }) {
  const [busy, setBusy] = useState(false)
  const [delId, setDelId] = useState(null)
  const st = WEEK_STYLES[ws.state]

  const handlePick = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setBusy(true)
    try {
      const payload = await Promise.all(files.map(async file => {
        const fileData = await new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file)
        })
        return { fileName: file.name, fileData, mimeType: file.type }
      }))
      await whUpload(cat.id, payload, currentUser?.name || currentUser?.username || 'Unknown', `Week ${week}`, ws.key)
      onUploadDone()
    } catch (err) { alert('Upload failed: ' + err.message) }
    finally { setBusy(false); e.target.value = '' }
  }

  const allFiles = ws.ups.flatMap(u => (u.files?.length ? u.files.map(f => ({ ...f, uploadId: u.id, by: u.uploadedBy, at: u.uploadedAt })) : []))

  return (
    <div className={`rounded-xl border p-4 ${isCurrent ? 'border-[#FECD28] bg-[#FECD28]/5' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {st.icon}
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Week {week} {isCurrent && <span className="text-xs font-medium text-[#a06a00] dark:text-[#FECD28]">· this week</span>}</p>
            <p className="text-xs text-slate-400">{weekRangeLabel(year, week)} · due Wed {fmtShort(isoWeekDeadline(year, week))}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${busy ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ backgroundColor: '#FECD28', color: '#111111' }}>
            <Upload size={12} /> {busy ? 'Uploading…' : ws.ups.length ? 'Add more' : 'Upload'}
            <input type="file" className="hidden" multiple disabled={busy} onChange={handlePick} />
          </label>
        </div>
      </div>

      {allFiles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {allFiles.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg pl-2 pr-1 py-1">
              <a href={f.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <FileText size={11} /> {f.fileName || `File ${i + 1}`}
              </a>
              {delId === f.uploadId ? (
                <span className="flex items-center gap-1">
                  <button onClick={async () => { await deleteWHUpload(f.uploadId); setDelId(null); onUploadDone() }} className="text-[11px] text-red-600 font-semibold">Del</button>
                  <button onClick={() => setDelId(null)} className="text-[11px] text-slate-400">×</button>
                </span>
              ) : (
                <button onClick={() => setDelId(f.uploadId)} className="text-slate-300 hover:text-red-500"><Trash2 size={11} /></button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function WeeklyCategoryView({ cat, uploads, users, onBack, onUploadDone, onEditCat, canAdmin, currentUser }) {
  const now = new Date()
  const { year, week: currentWeek } = getISOWeek(now)
  const agg = aggregateWeekly(cat, uploads)
  const st = STATUS_STYLES[agg.status]
  const assignedUser = users.find(u => u.username === cat.assignedUser)

  const weeks = []
  for (let w = currentWeek; w >= 1; w--) weeks.push(w)

  return (
    <div className="space-y-5">
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{cat.name}</h2>
                {cat.driveFolderId && (
                  <a href={`https://drive.google.com/drive/folders/${cat.driveFolderId}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    <ExternalLink size={12} /> Drive Folder
                  </a>
                )}
              </div>
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
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Current week</p><p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">Week {currentWeek}, {year}</p></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Uploaded</p><p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">{agg.done} / {agg.total}</p></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Overdue weeks</p><p className={`font-medium mt-0.5 ${agg.overdue > 0 ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'}`}>{agg.overdue}</p></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Assigned To</p><p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">{assignedUser?.name || cat.assignedUser || '—'}</p></div>
        </div>
      </div>

      <div className="space-y-2">
        {weeks.map(w => (
          <WeekRow key={w} cat={cat} year={year} week={w}
            ws={weekStatus(cat, uploads, year, w, now)}
            isCurrent={w === currentWeek}
            currentUser={currentUser} onUploadDone={onUploadDone} />
        ))}
      </div>
    </div>
  )
}

// ── Main WH Uploads Page ──────────────────────────────────────────────────────

export default function WHUploadsPage({ whData, onRefresh }) {
  const { perm, user, users } = useAuth()
  const canAdmin = perm('wh', 'edit')

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
    const DetailView = live.mode === 'weekly' ? WeeklyCategoryView : CategoryPage
    return (
      <>
        <DetailView
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


      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeCategories.map(cat => {
          const isWeekly = cat.mode === 'weekly'
          const std = isWeekly ? null : getCategoryStatus(cat, uploads)
          const agg = isWeekly ? aggregateWeekly(cat, uploads) : null
          const status = isWeekly ? agg.status : std.status
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
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-3">{cat.name}{isWeekly && <span className="ml-1.5 text-[11px] font-medium text-slate-400">· weekly</span>}</h3>
              {isWeekly ? (
                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <p>This week: <span className="font-medium text-slate-700 dark:text-slate-300">Week {agg.currentWeek}, {agg.year}</span></p>
                  <p>Uploaded: <span className="font-medium text-slate-700 dark:text-slate-300">{agg.done} / {agg.total}</span></p>
                  <p>Overdue weeks: <span className={`font-medium ${agg.overdue > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{agg.overdue}</span></p>
                  <p>Assigned: <span className="font-medium text-slate-700 dark:text-slate-300">{assignedUser?.name || cat.assignedUser || '—'}</span></p>
                </div>
              ) : (
                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <p>Next due: <span className="font-medium text-slate-700 dark:text-slate-300">{std.nextDue ? fmtShort(std.nextDue) : '—'}
                    {std.daysUntilDue != null && (
                      <span className={`ml-1 ${std.daysUntilDue < 0 ? 'text-red-500 font-semibold' : ''}`}>
                        ({std.daysUntilDue < 0 ? `${Math.abs(std.daysUntilDue)}d overdue` : `in ${std.daysUntilDue}d`})
                      </span>
                    )}
                  </span></p>
                  <p>Last upload: <span className="font-medium text-slate-700 dark:text-slate-300">{std.last ? fmtShort(std.last.uploadedAt) : 'Never'}</span></p>
                  <p>Assigned: <span className="font-medium text-slate-700 dark:text-slate-300">{assignedUser?.name || cat.assignedUser || '—'}</span></p>
                  <p>Total uploads: <span className="font-medium text-slate-700 dark:text-slate-300">{catUploads.length}</span></p>
                </div>
              )}
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
