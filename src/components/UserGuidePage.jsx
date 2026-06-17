import { useState, useEffect } from 'react'
import { BookOpen, Pencil, Check, X, Printer, UserCog } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchUserGuide, saveUserGuide, LIVE } from '../api'

// Default content shown until an editor saves their own version. Markdown.
const DEFAULT_GUIDE = `# CabGlass Courier User Guide

_Last updated: 15 May 2026_

## Purpose
The CabGlass Courier web application is used to simplify the process of generating courier quotes and dispatching shipments through EPX and TCG. Please note that Triangle bookings are still processed manually.

## Sales Order (SO)
Quotes are generated from Sales Orders (SOs) posted to the TG Group. Once an SO is created, the system automatically retrieves quotes from EPX and TCG. These quotes should be used as a guideline when selecting the courier. Factors to consider include:

- Courier pricing
- Type and fragility of the glass
- Availability of stock
- Whether the glass is supplied by an agent and the associated cost

## Booking
Once the invoice has been processed and appears on the TG Group:

1. Verify that the delivery address is correct.
2. Confirm that the contents, part numbers, and quantities match the invoice.
3. Select the courier from the dropdown list.
4. Toggle Approved and click Buy Label.

The booking status should now change to Booked.

## Booked
Once the booking is completed:

1. A waybill will be generated.
2. A waybill number will appear in the system.
3. Copy the waybill number and paste it onto the SI, together with the courier details.

## Waybill / Label

### TCG Shipments
1. Open the waybill link.
2. Print two copies of the waybill.
3. Write the part numbers on the reverse side of the waybill to assist with attaching it to the correct glass item.
4. If there is more than one glass item in the shipment, write the waybill number on the additional items using a permanent marker.

### EPX Shipments
1. Open the label link.
2. Print one copy of the label.

Once the waybill or label has been attached to the glass, mark the shipment as Labelled on the iPad.

## Collection
Once the courier has collected the shipment:

1. Mark the shipment as Dispatched on the iPad.

**Important:** This must be completed on the same day as collection.

## Duplicate Bookings
Duplicate bookings occur when multiple invoices are being delivered to the same address. In this situation:

1. Select one SO and edit its contents to include all invoices for that address.
2. Add a note containing the waybill number to all corresponding SOs.
3. Refresh the quotes.
4. Complete the booking as normal.
5. Copy waybill number into Notes.
6. Move the unused SO(s) to History.

## Partial Orders
Partial orders may generate an error because back-ordered items are reflected with a quantity of zero.

To process a partial order:

1. Edit the booking contents so that they match the quantities shown on the invoice.
2. Refresh the quotes.
3. Complete the booking as normal.
4. Add a note specifying which items were dispatched.

When back-ordered stock arrives to complete the order:

1. Upload the Sales Order only after the GRN has been completed and stock availability has been updated.
2. Edit the quantities again to remove any zero-quantity lines or items that have already been dispatched.
3. Refresh the quotes and complete the booking.

**Important:** Always ensure that the booking contents match the invoice exactly.`

// ── Tiny markdown renderer ──
// Supports: # / ## / ### headings, - · * · ● bullet lists, 1. ordered lists,
// **bold**, _italic_, and blank-line-separated paragraphs. Enough for the guide.
function renderInline(text, keyBase) {
  // Split on **bold** and _italic_ while keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>
    if (p.startsWith('_') && p.endsWith('_'))
      return <em key={`${keyBase}-${i}`}>{p.slice(1, -1)}</em>
    return <span key={`${keyBase}-${i}`}>{p}</span>
  })
}

function renderMarkdown(md) {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  let key = 0
  const isBullet = (l) => /^\s*[-*●]\s+/.test(l)
  const isOrdered = (l) => /^\s*\d+\.\s+/.test(l)

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    if (line.startsWith('### ')) {
      blocks.push(<h3 key={key++} className="text-base font-bold text-slate-800 dark:text-slate-100 mt-5 mb-1.5">{renderInline(line.slice(4), key)}</h3>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      blocks.push(<h2 key={key++} className="text-xl font-bold text-slate-900 dark:text-white mt-7 mb-2 pb-1 border-b border-slate-200 dark:border-slate-700">{renderInline(line.slice(3), key)}</h2>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      blocks.push(<h1 key={key++} className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">{renderInline(line.slice(2), key)}</h1>)
      i++; continue
    }

    if (isBullet(line)) {
      const items = []
      while (i < lines.length && isBullet(lines[i])) {
        items.push(<li key={items.length} className="ml-1">{renderInline(lines[i].replace(/^\s*[-*●]\s+/, ''), `b${key}-${items.length}`)}</li>)
        i++
      }
      blocks.push(<ul key={key++} className="list-disc list-outside ml-6 my-2 space-y-1 text-slate-700 dark:text-slate-300">{items}</ul>)
      continue
    }

    if (isOrdered(line)) {
      const items = []
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(<li key={items.length} className="ml-1 pl-1">{renderInline(lines[i].replace(/^\s*\d+\.\s+/, ''), `o${key}-${items.length}`)}</li>)
        i++
      }
      blocks.push(<ol key={key++} className="list-decimal list-outside ml-6 my-2 space-y-1 text-slate-700 dark:text-slate-300">{items}</ol>)
      continue
    }

    // Paragraph: gather consecutive non-blank, non-structural lines.
    const para = []
    while (i < lines.length && lines[i].trim() && !isBullet(lines[i]) && !isOrdered(lines[i]) && !lines[i].startsWith('#')) {
      para.push(lines[i])
      i++
    }
    blocks.push(<p key={key++} className="my-2 leading-relaxed text-slate-700 dark:text-slate-300">{renderInline(para.join(' '), `p${key}`)}</p>)
  }

  return blocks
}

export default function UserGuidePage() {
  const { user, users, perm } = useAuth()
  const isAdmin = perm('admin', 'view')

  const [guide, setGuide] = useState({ content: '', editorUsername: '', updatedAt: '', updatedBy: '' })
  const [loading, setLoading] = useState(LIVE)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (!LIVE) { setLoading(false); return }
    fetchUserGuide()
      .then(g => setGuide(g || {}))
      .catch(err => console.error('Load user guide failed:', err))
      .finally(() => setLoading(false))
  }, [])

  const content = guide.content && guide.content.trim() ? guide.content : DEFAULT_GUIDE
  const isAssignedEditor = !!user?.username && user.username === guide.editorUsername
  const canEdit = isAdmin || isAssignedEditor

  const startEdit = () => { setDraft(content); setEditing(true) }
  const cancelEdit = () => { setEditing(false); setDraft('') }

  const saveContent = async () => {
    setSaving(true)
    const payload = { content: draft, updatedBy: user?.name || user?.username || '' }
    try {
      if (LIVE) {
        const res = await saveUserGuide(payload)
        setGuide(res.guide || { ...guide, content: draft })
      } else {
        setGuide({ ...guide, content: draft })
      }
      setEditing(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      console.error('Save user guide failed:', err)
      alert('Saving the guide failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const assignEditor = async (username) => {
    const prev = guide.editorUsername
    setGuide(g => ({ ...g, editorUsername: username }))
    try {
      if (LIVE) await saveUserGuide({ editorUsername: username, updatedBy: user?.name || '' })
    } catch (err) {
      console.error('Assign editor failed:', err)
      setGuide(g => ({ ...g, editorUsername: prev })) // revert
      alert('Could not save the assigned editor — please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400 dark:text-slate-500 gap-3">
        <span className="w-5 h-5 border-2 border-slate-300 border-t-brand rounded-full animate-spin" />
        Loading guide…
      </div>
    )
  }

  const assignedName = users?.find(u => u.username === guide.editorUsername)?.name

  return (
    <div className="max-w-3xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-5 print:hidden">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <BookOpen size={20} className="text-[#111111] dark:text-[#FECD28]" />
          <h1 className="text-lg font-bold">User Guide</h1>
          {guide.updatedAt && !editing && (
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
              updated {new Date(guide.updatedAt).toLocaleDateString('en-ZA')}
              {guide.updatedBy ? ` by ${guide.updatedBy}` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-xs font-medium text-green-600 dark:text-green-400">Saved ✓</span>}
          {!editing && (
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
              <Printer size={14} /> Print
            </button>
          )}
          {canEdit && !editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#111111] bg-[#FECD28] hover:brightness-95 transition-all">
              <Pencil size={14} /> Edit
            </button>
          )}
          {editing && (
            <>
              <button onClick={cancelEdit} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-colors disabled:opacity-50">
                <X size={14} /> Cancel
              </button>
              <button onClick={saveContent} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#111111] bg-[#FECD28] hover:brightness-95 transition-all disabled:opacity-50">
                <Check size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Admin: assign the editor */}
      {isAdmin && !editing && (
        <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 print:hidden">
          <UserCog size={16} className="text-slate-500 dark:text-slate-400 shrink-0" />
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Editor:</label>
          <select
            value={guide.editorUsername || ''}
            onChange={(e) => assignEditor(e.target.value)}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#FECD28]">
            <option value="">— None (admins only) —</option>
            {(users || []).filter(u => u.role !== 'admin').map(u => (
              <option key={u.id} value={u.username}>{u.name} ({u.username})</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 dark:text-slate-500">Admins can always edit. Assign one other person who may edit this guide.</span>
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 print:border-0 print:shadow-none print:p-0">
        {editing ? (
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
              Markdown supported: <code># Heading</code>, <code>## Subheading</code>, <code>- bullet</code>, <code>1. step</code>, <code>**bold**</code>, <code>_italic_</code>.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={28}
              className="w-full font-mono text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-3 focus:outline-none focus:ring-2 focus:ring-[#FECD28] leading-relaxed"
            />
          </div>
        ) : (
          <article>{renderMarkdown(content)}</article>
        )}
      </div>
    </div>
  )
}
