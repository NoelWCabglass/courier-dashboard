import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BookOpen, Plus, Lock, Unlock, Trash2, Pencil, Check, X,
  ImageIcon, Link2, Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Minus, ChevronRight, AlertCircle, Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  LIVE,
  fetchWikiPages, fetchWikiPage,
  saveWikiPage, deleteWikiPage, uploadWikiImage,
} from '../api'

// ─── Default seed content ────────────────────────────────────────────────────
const SEED_CONTENT = `# CabGlass Courier User Guide

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

// ─── Markdown renderer ───────────────────────────────────────────────────────
// Supports: headings, bullets, ordered lists, **bold**, _italic_, `code`,
//           [link](url), ![img](url), ---, code fences.

function renderInline(text, keyBase) {
  const parts = text
    .split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\))/g)
    .filter(Boolean)

  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={k}>{p.slice(2, -2)}</strong>
    if (p.startsWith('_') && p.endsWith('_'))
      return <em key={k}>{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`'))
      return <code key={k} className="bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5 text-[0.8em] font-mono text-slate-800 dark:text-slate-200">{p.slice(1, -1)}</code>
    const imgM = p.match(/^!\[([^\]]*)\]\(([^)]*)\)$/)
    if (imgM) return <img key={k} src={imgM[2]} alt={imgM[1]} className="max-w-full rounded-lg my-2 border border-slate-200 dark:border-slate-700 block" />
    const linkM = p.match(/^\[([^\]]*)\]\(([^)]*)\)$/)
    if (linkM) return <a key={k} href={linkM[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700">{linkM[1]}</a>
    return <span key={k}>{p}</span>
  })
}

function renderMarkdown(md) {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0, key = 0
  const isBullet  = l => /^\s*[-*●]\s+/.test(l)
  const isOrdered = l => /^\s*\d+\.\s+/.test(l)

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // Code fence
    if (line.startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++
      blocks.push(
        <pre key={key++} className="bg-slate-900 dark:bg-slate-950 text-green-300 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono leading-relaxed">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    // HR
    if (line.trim() === '---') {
      blocks.push(<hr key={key++} className="my-6 border-slate-200 dark:border-slate-700" />)
      i++; continue
    }

    if (line.startsWith('### '))
      { blocks.push(<h3 key={key++} className="text-base font-bold text-slate-800 dark:text-slate-100 mt-5 mb-1.5">{renderInline(line.slice(4), key)}</h3>); i++; continue }
    if (line.startsWith('## '))
      { blocks.push(<h2 key={key++} className="text-xl font-bold text-slate-900 dark:text-white mt-7 mb-2 pb-1 border-b border-slate-200 dark:border-slate-700">{renderInline(line.slice(3), key)}</h2>); i++; continue }
    if (line.startsWith('# '))
      { blocks.push(<h1 key={key++} className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">{renderInline(line.slice(2), key)}</h1>); i++; continue }

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

    // Standalone image line
    const imgLineM = line.trim().match(/^!\[([^\]]*)\]\(([^)]*)\)$/)
    if (imgLineM) {
      blocks.push(<img key={key++} src={imgLineM[2]} alt={imgLineM[1]} className="max-w-full rounded-xl my-4 border border-slate-200 dark:border-slate-700 shadow-sm" />)
      i++; continue
    }

    // Paragraph
    const para = []
    while (i < lines.length && lines[i].trim() && !isBullet(lines[i]) && !isOrdered(lines[i]) && !lines[i].startsWith('#') && lines[i].trim() !== '---' && !lines[i].startsWith('```')) {
      para.push(lines[i])
      i++
    }
    blocks.push(<p key={key++} className="my-2 leading-relaxed text-slate-700 dark:text-slate-300">{renderInline(para.join(' '), `p${key}`)}</p>)
  }

  return blocks
}

// ─── Toolbar button ───────────────────────────────────────────────────────────
function ToolBtn({ icon: Icon, label, onClick, disabled, active }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-40 ${active ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : ''}`}
    >
      <Icon size={14} />
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UserGuidePage() {
  const { user, perm } = useAuth()
  const isAdmin = perm('admin', 'view')

  // Page list
  const [pages, setPages]         = useState([])
  const [activePage, setActivePage] = useState(null)
  const [content, setContent]     = useState('')
  const [loadingPages, setLoadingPages]   = useState(LIVE)
  const [loadingContent, setLoadingContent] = useState(false)

  // Edit state
  const [editing, setEditing]     = useState(false)
  const [draft, setDraft]         = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [saving, setSaving]       = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]   = useState(false)

  // Image upload
  const [imgUploading, setImgUploading] = useState(false)
  const textareaRef = useRef(null)
  const imageInputRef = useRef(null)

  // ── Load page list ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!LIVE) {
      const mock = [{ id: 'mock1', title: 'User Guide', locked: true, updatedAt: new Date().toISOString(), updatedBy: 'system', order: 0 }]
      setPages(mock)
      setActivePage(mock[0])
      setContent(SEED_CONTENT)
      setLoadingPages(false)
      return
    }
    fetchWikiPages()
      .then(ps => {
        const sorted = [...ps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        setPages(sorted)
        if (sorted.length) setActivePage(sorted[0])
      })
      .catch(err => console.error('Wiki pages load failed:', err))
      .finally(() => setLoadingPages(false))
  }, [])

  // ── Load page content when active page changes ───────────────────────────────
  useEffect(() => {
    if (!activePage) return
    if (!LIVE) return
    setLoadingContent(true)
    setContent('')
    fetchWikiPage(activePage.id)
      .then(c => setContent(c))
      .catch(err => console.error('Wiki page load failed:', err))
      .finally(() => setLoadingContent(false))
  }, [activePage?.id])

  // ── Select a page ───────────────────────────────────────────────────────────
  const selectPage = (page) => {
    if (editing) return // guard: warn or ignore while editing
    setActivePage(page)
    setDeleteConfirm(false)
  }

  // ── Create new page ─────────────────────────────────────────────────────────
  const createPage = async () => {
    const title = 'New Page'
    const payload = { title, content: '', updatedBy: user?.name || user?.username || '' }
    if (LIVE) {
      try {
        const res = await saveWikiPage(payload)
        const newPage = res.page
        setPages(ps => [...ps, newPage])
        setActivePage(newPage)
        setContent('')
        setDraft('')
        setDraftTitle(newPage.title)
        setEditing(true)
      } catch (err) { alert('Could not create page: ' + err.message) }
    } else {
      const newPage = { id: 'mock' + Date.now(), title, locked: false, updatedAt: new Date().toISOString(), updatedBy: '', order: pages.length }
      setPages(ps => [...ps, newPage])
      setActivePage(newPage)
      setContent('')
      setDraft('')
      setDraftTitle(title)
      setEditing(true)
    }
  }

  // ── Toggle lock ─────────────────────────────────────────────────────────────
  const toggleLock = async () => {
    if (!activePage) return
    const newLocked = !activePage.locked
    const updated = { ...activePage, locked: newLocked }
    setActivePage(updated)
    setPages(ps => ps.map(p => p.id === updated.id ? updated : p))
    if (LIVE) {
      try {
        await saveWikiPage({ id: activePage.id, locked: newLocked, updatedBy: user?.name || '' })
      } catch (err) {
        // revert
        setActivePage(activePage)
        setPages(ps => ps.map(p => p.id === activePage.id ? activePage : p))
        alert('Could not update lock: ' + err.message)
      }
    }
  }

  // ── Delete page ─────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!activePage || activePage.locked) return
    setDeleting(true)
    try {
      if (LIVE) await deleteWikiPage({ id: activePage.id })
      const remaining = pages.filter(p => p.id !== activePage.id)
      setPages(remaining)
      setActivePage(remaining[0] || null)
      setContent(remaining[0] ? '' : '')
      setDeleteConfirm(false)
    } catch (err) {
      alert('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  // ── Start / cancel edit ─────────────────────────────────────────────────────
  const startEdit = () => {
    setDraft(content)
    setDraftTitle(activePage?.title || '')
    setEditing(true)
    setDeleteConfirm(false)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft('')
    setDraftTitle('')
  }

  // ── Save edit ───────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!activePage) return
    setSaving(true)
    const payload = {
      id: activePage.id,
      title: draftTitle.trim() || activePage.title,
      content: draft,
      updatedBy: user?.name || user?.username || '',
    }
    try {
      let updatedPage = { ...activePage, title: payload.title, updatedAt: new Date().toISOString(), updatedBy: payload.updatedBy }
      if (LIVE) {
        const res = await saveWikiPage(payload)
        updatedPage = res.page || updatedPage
      }
      setContent(draft)
      setActivePage(updatedPage)
      setPages(ps => ps.map(p => p.id === updatedPage.id ? updatedPage : p))
      setEditing(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      alert('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Markdown toolbar ────────────────────────────────────────────────────────
  const applyFormat = useCallback((type) => {
    const ta = textareaRef.current
    if (!ta) return
    const start  = ta.selectionStart
    const end    = ta.selectionEnd
    const value  = ta.value
    const sel    = value.slice(start, end)
    let result, cs, ce

    if (type === 'bold') {
      const t = sel || 'bold text'
      result = value.slice(0, start) + `**${t}**` + value.slice(end)
      cs = start + 2; ce = cs + t.length
    } else if (type === 'italic') {
      const t = sel || 'italic text'
      result = value.slice(0, start) + `_${t}_` + value.slice(end)
      cs = start + 1; ce = cs + t.length
    } else if (type === 'h1' || type === 'h2' || type === 'h3') {
      const prefix = type === 'h1' ? '# ' : type === 'h2' ? '## ' : '### '
      const ls = value.lastIndexOf('\n', start - 1) + 1
      const stripped = value.slice(ls).replace(/^#{1,3} /, '')
      result = value.slice(0, ls) + prefix + stripped
      cs = ce = ls + prefix.length
    } else if (type === 'hr') {
      result = value.slice(0, start) + '\n---\n' + value.slice(end)
      cs = ce = start + 5
    } else if (type === 'bullet') {
      const ls = value.lastIndexOf('\n', start - 1) + 1
      result = value.slice(0, ls) + '- ' + value.slice(ls)
      cs = ce = start + 2
    } else if (type === 'ordered') {
      const ls = value.lastIndexOf('\n', start - 1) + 1
      result = value.slice(0, ls) + '1. ' + value.slice(ls)
      cs = ce = start + 3
    } else if (type === 'link') {
      const url = prompt('Enter URL:')
      if (!url) return
      const t = sel || 'link text'
      result = value.slice(0, start) + `[${t}](${url})` + value.slice(end)
      cs = start; ce = start + `[${t}](${url})`.length
    } else { return }

    setDraft(result)
    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.selectionStart = cs
      textareaRef.current.selectionEnd = ce
      textareaRef.current.focus()
    })
  }, [])

  // ── Image upload ────────────────────────────────────────────────────────────
  const handleImagePick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImgUploading(true)
    try {
      let url
      if (LIVE) {
        const fileData = await new Promise((res, rej) => {
          const r = new FileReader()
          r.onload  = () => res(r.result.split(',')[1])
          r.onerror = rej
          r.readAsDataURL(file)
        })
        const result = await uploadWikiImage({ fileName: file.name, fileData, mimeType: file.type })
        url = result.url
      } else {
        url = URL.createObjectURL(file)
      }

      const ta = textareaRef.current
      if (ta) {
        const pos = ta.selectionStart
        const v   = ta.value
        const ins = `\n![${file.name}](${url})\n`
        setDraft(v.slice(0, pos) + ins + v.slice(pos))
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pos + ins.length
            textareaRef.current.focus()
          }
        })
      }
    } catch (err) {
      alert('Image upload failed: ' + err.message)
    } finally {
      setImgUploading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loadingPages) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400 dark:text-slate-500 gap-3">
        <span className="w-5 h-5 border-2 border-slate-300 border-t-brand rounded-full animate-spin" />
        Loading wiki…
      </div>
    )
  }

  const canEdit = isAdmin

  return (
    <div className="flex gap-5 min-h-[calc(100vh-112px)]">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <BookOpen size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">Pages</span>
          </div>
          {isAdmin && !editing && (
            <button
              onClick={createPage}
              title="New page"
              className="p-1 rounded-lg text-slate-400 hover:text-[#111111] dark:hover:text-[#FECD28] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <Plus size={15} />
            </button>
          )}
        </div>

        <nav className="flex flex-col gap-0.5">
          {pages.map(page => (
            <button
              key={page.id}
              onClick={() => selectPage(page)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 group
                ${activePage?.id === page.id
                  ? 'bg-[#FECD28]/20 dark:bg-[#FECD28]/10 text-slate-900 dark:text-slate-100 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`}>
              <ChevronRight size={12} className={`shrink-0 transition-transform ${activePage?.id === page.id ? 'text-[#FECD28] translate-x-0' : 'text-transparent group-hover:text-slate-300'}`} />
              <span className="truncate flex-1">{page.title}</span>
              {page.locked && <Lock size={10} className="shrink-0 text-slate-400 dark:text-slate-500" />}
            </button>
          ))}
          {pages.length === 0 && (
            <p className="px-3 py-4 text-xs text-slate-400 dark:text-slate-600 italic">No pages yet</p>
          )}
        </nav>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {!activePage ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600 gap-3">
            <BookOpen size={32} />
            <p className="text-sm">No page selected</p>
            {isAdmin && <button onClick={createPage} className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#111111] bg-[#FECD28] hover:brightness-95">Create first page</button>}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

            {/* Page header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-700 print:hidden">
              {editing ? (
                <input
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  placeholder="Page title"
                  className="flex-1 text-lg font-bold bg-transparent border-b-2 border-[#FECD28] outline-none text-slate-900 dark:text-slate-100 py-0.5"
                />
              ) : (
                <h1 className="flex-1 text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{activePage.title}</h1>
              )}

              {/* Meta */}
              {!editing && activePage.updatedAt && (
                <span className="hidden sm:block text-xs text-slate-400 dark:text-slate-500 shrink-0">
                  {new Date(activePage.updatedAt).toLocaleDateString('en-ZA')}
                  {activePage.updatedBy ? ` · ${activePage.updatedBy}` : ''}
                </span>
              )}

              {/* Saved flash */}
              {savedFlash && <span className="text-xs font-medium text-green-600 dark:text-green-400 shrink-0">Saved ✓</span>}

              {/* Admin actions */}
              {canEdit && !editing && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Lock/unlock */}
                  <button
                    onClick={toggleLock}
                    title={activePage.locked ? 'Unlock page' : 'Lock page (prevents deletion)'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    {activePage.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>

                  {/* Delete */}
                  {!activePage.locked && (
                    deleteConfirm ? (
                      <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1">
                        <span className="text-xs text-red-700 dark:text-red-400 font-medium">Delete?</span>
                        <button onClick={confirmDelete} disabled={deleting}
                          className="text-xs text-red-600 dark:text-red-400 font-semibold hover:text-red-800 px-1 disabled:opacity-50">
                          {deleting ? '…' : 'Yes'}
                        </button>
                        <button onClick={() => setDeleteConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-1">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(true)}
                        title="Delete page"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )
                  )}

                  {/* Edit */}
                  <button onClick={startEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#111111] bg-[#FECD28] hover:brightness-95 transition-all">
                    <Pencil size={13} /> Edit
                  </button>
                </div>
              )}

              {editing && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={cancelEdit} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                    <X size={13} /> Cancel
                  </button>
                  <button onClick={saveEdit} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#111111] bg-[#FECD28] hover:brightness-95 transition-all disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {/* Editor toolbar */}
            {editing && (
              <div className="flex items-center gap-0.5 px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex-wrap print:hidden">
                <ToolBtn icon={Bold}         label="Bold (Ctrl+B)"       onClick={() => applyFormat('bold')} />
                <ToolBtn icon={Italic}       label="Italic (Ctrl+I)"     onClick={() => applyFormat('italic')} />
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                <ToolBtn icon={Heading1}     label="Heading 1"           onClick={() => applyFormat('h1')} />
                <ToolBtn icon={Heading2}     label="Heading 2"           onClick={() => applyFormat('h2')} />
                <ToolBtn icon={Heading3}     label="Heading 3"           onClick={() => applyFormat('h3')} />
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                <ToolBtn icon={List}         label="Bullet list"         onClick={() => applyFormat('bullet')} />
                <ToolBtn icon={ListOrdered}  label="Numbered list"       onClick={() => applyFormat('ordered')} />
                <ToolBtn icon={Minus}        label="Horizontal rule"     onClick={() => applyFormat('hr')} />
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                <ToolBtn icon={Link2}        label="Insert link"         onClick={() => applyFormat('link')} />
                <ToolBtn
                  icon={imgUploading ? Loader2 : ImageIcon}
                  label="Insert image"
                  disabled={imgUploading}
                  onClick={() => imageInputRef.current?.click()} />
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
                <div className="ml-auto text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
                  Markdown · **bold** · _italic_ · # Heading · ![alt](url)
                </div>
              </div>
            )}

            {/* Content */}
            <div className={editing ? '' : 'p-6 sm:p-8'}>
              {editing ? (
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={32}
                  spellCheck
                  className="w-full font-mono text-sm rounded-none border-0 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-6 focus:outline-none leading-relaxed resize-none"
                  placeholder="Start writing in Markdown…"
                />
              ) : loadingContent ? (
                <div className="flex items-center gap-3 py-20 justify-center text-slate-400 dark:text-slate-500">
                  <span className="w-5 h-5 border-2 border-slate-300 border-t-brand rounded-full animate-spin" />
                  Loading…
                </div>
              ) : content.trim() ? (
                <article>{renderMarkdown(content)}</article>
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-slate-400 dark:text-slate-500">
                  <AlertCircle size={24} />
                  <p className="text-sm">This page is empty.</p>
                  {canEdit && <button onClick={startEdit} className="text-sm text-[#FECD28] font-semibold hover:underline">Start editing</button>}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

    </div>
  )
}
