import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BookOpen, Plus, Lock, Unlock, Trash2, Pencil, Check, X,
  Image as ImageIcon, Link2, Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Minus, Quote,
  Code, FileCode2,
  ChevronRight, ChevronDown, AlertCircle, Loader2,
  Search, Shield, Users, Eye, EyeOff, Printer, Folder, FolderOpen, FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  LIVE,
  fetchWikiPages, fetchWikiPage,
  saveWikiPage, deleteWikiPage, uploadWikiImage,
} from '../api'

// ─── Seed content ─────────────────────────────────────────────────────────────
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

const SEED_PAGE = { id: '__seed__', title: 'User Guide', locked: true, parentId: null, viewRoles: [], editRoles: ['admin'], updatedAt: '', updatedBy: 'system', order: 0 }

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderInline(text, keyBase) {
  const parts = text
    .split(/(\*\*[^*]+\*\*|_[^_]+_|~~[^~]+~~|`[^`]+`|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\))/g)
    .filter(Boolean)
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={k}>{p.slice(2,-2)}</strong>
    if (p.startsWith('_') && p.endsWith('_'))   return <em key={k}>{p.slice(1,-1)}</em>
    if (p.startsWith('~~') && p.endsWith('~~')) return <s key={k}>{p.slice(2,-2)}</s>
    if (p.startsWith('`') && p.endsWith('`'))   return <code key={k} className="bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5 text-[0.8em] font-mono text-slate-800 dark:text-slate-200">{p.slice(1,-1)}</code>
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
  const isQuote   = l => /^>\s?/.test(l)
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    if (line.startsWith('```')) {
      const codeLines = []; i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++
      blocks.push(<pre key={key++} className="bg-slate-900 dark:bg-slate-950 text-green-300 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono leading-relaxed"><code>{codeLines.join('\n')}</code></pre>)
      continue
    }
    if (line.trim() === '---') { blocks.push(<hr key={key++} className="my-6 border-slate-200 dark:border-slate-700" />); i++; continue }
    if (line.startsWith('### ')) { blocks.push(<h3 key={key++} className="text-base font-bold text-slate-800 dark:text-slate-100 mt-5 mb-1.5">{renderInline(line.slice(4), key)}</h3>); i++; continue }
    if (line.startsWith('## '))  { blocks.push(<h2 key={key++} className="text-xl font-bold text-slate-900 dark:text-white mt-7 mb-2 pb-1 border-b border-slate-200 dark:border-slate-700">{renderInline(line.slice(3), key)}</h2>); i++; continue }
    if (line.startsWith('# '))   { blocks.push(<h1 key={key++} className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">{renderInline(line.slice(2), key)}</h1>); i++; continue }
    if (isQuote(line)) {
      const qlines = []
      while (i < lines.length && isQuote(lines[i])) { qlines.push(lines[i].replace(/^>\s?/, '')); i++ }
      blocks.push(<blockquote key={key++} className="border-l-4 border-[#FECD28] pl-4 my-3 italic text-slate-500 dark:text-slate-400">{qlines.map((ql,qi)=><p key={qi} className="my-0.5">{renderInline(ql,`bq${key}-${qi}`)}</p>)}</blockquote>)
      continue
    }
    if (isBullet(line)) {
      const items = []
      while (i < lines.length && isBullet(lines[i])) { items.push(<li key={items.length} className="ml-1">{renderInline(lines[i].replace(/^\s*[-*●]\s+/,''),`b${key}-${items.length}`)}</li>); i++ }
      blocks.push(<ul key={key++} className="list-disc list-outside ml-6 my-2 space-y-1 text-slate-700 dark:text-slate-300">{items}</ul>)
      continue
    }
    if (isOrdered(line)) {
      const items = []
      while (i < lines.length && isOrdered(lines[i])) { items.push(<li key={items.length} className="ml-1 pl-1">{renderInline(lines[i].replace(/^\s*\d+\.\s+/,''),`o${key}-${items.length}`)}</li>); i++ }
      blocks.push(<ol key={key++} className="list-decimal list-outside ml-6 my-2 space-y-1 text-slate-700 dark:text-slate-300">{items}</ol>)
      continue
    }
    const imgLineM = line.trim().match(/^!\[([^\]]*)\]\(([^)]*)\)$/)
    if (imgLineM) {
      const rawSrc = imgLineM[2]
      // Only rewrite actual Google Drive URLs — leave /api/wiki-image and other URLs alone
      const isDrive = rawSrc.includes('drive.google.com')
      const driveId = isDrive ? (rawSrc.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || rawSrc.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]) : null
      const src = driveId ? `https://lh3.googleusercontent.com/d/${driveId}` : rawSrc
      blocks.push(<img key={key++} src={src} alt={imgLineM[1]} className="max-w-full rounded-xl my-4 border border-slate-200 dark:border-slate-700 shadow-sm" />); i++; continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !isBullet(lines[i]) && !isOrdered(lines[i]) && !isQuote(lines[i]) && !lines[i].startsWith('#') && lines[i].trim() !== '---' && !lines[i].startsWith('```')) { para.push(lines[i]); i++ }
    blocks.push(<p key={key++} className="my-2 leading-relaxed text-slate-700 dark:text-slate-300">{para.flatMap((l,pi) => pi === 0 ? [renderInline(l,`p${key}-${pi}`)] : [<br key={`br${key}-${pi}`}/>, renderInline(l,`p${key}-${pi}`)])}</p>)
  }
  return blocks
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────
function Sep() { return <span className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-0.5 shrink-0" /> }
function ToolBtn({ icon: Icon, label, onClick, disabled, spin }) {
  return (
    <button type="button" title={label} onClick={onClick} disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-slate-100 transition-colors disabled:opacity-40 shrink-0">
      <Icon size={15} className={spin ? 'animate-spin' : ''} />
    </button>
  )
}

// ─── Highlight search match ───────────────────────────────────────────────────
function Highlight({ text, query }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return <>{text.slice(0, idx)}<mark className="bg-[#FECD28]/50 rounded-sm">{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>
}

// ─── Permissions modal ────────────────────────────────────────────────────────
function PermissionsModal({ page, allPages, allRoles, allUsers, onSave, onClose }) {
  const [viewRoles, setViewRoles] = useState(() => page.viewRoles?.length ? page.viewRoles : allRoles)
  const [editRoles, setEditRoles] = useState(() => page.editRoles?.length ? page.editRoles : ['admin'])
  const [viewUsers, setViewUsers] = useState(() => page.viewUsers || [])
  const [editUsers, setEditUsers] = useState(() => page.editUsers || [])
  const [applyAll,  setApplyAll]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [tab,       setTab]       = useState('roles')

  const toggle = (val, list, setList) =>
    setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ viewRoles, editRoles, viewUsers, editUsers, applyAll })
    setSaving(false)
    onClose()
  }

  const Row = ({ label, inView, onView, inEdit, onEdit, disabled }) => (
    <tr className="border-b border-slate-100 dark:border-slate-700">
      <td className="py-2 pr-4 text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{label}</td>
      <td className="py-2 px-4 text-center">
        <input type="checkbox" checked={inView} onChange={onView} disabled={disabled}
          className="w-4 h-4 accent-[#FECD28] cursor-pointer disabled:opacity-40" />
      </td>
      <td className="py-2 px-4 text-center">
        <input type="checkbox" checked={inEdit} onChange={onEdit} disabled={disabled}
          className="w-4 h-4 accent-[#FECD28] cursor-pointer disabled:opacity-40" />
      </td>
    </tr>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <Shield size={16} className="text-[#FECD28]" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex-1 truncate">Permissions · {page.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 px-5">
          {['roles', 'users'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2 px-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-[#FECD28] text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              {t === 'roles' ? 'By Role' : 'By User'}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 max-h-72 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-600">
                <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">{tab === 'roles' ? 'Role' : 'User'}</th>
                <th className="pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center"><span className="flex items-center justify-center gap-1"><Eye size={12}/> View</span></th>
                <th className="pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center"><span className="flex items-center justify-center gap-1"><Pencil size={12}/> Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {tab === 'roles' ? allRoles.map(role => (
                <Row key={role} label={role}
                  inView={viewRoles.includes(role) || role === 'admin'}
                  inEdit={editRoles.includes(role) || role === 'admin'}
                  onView={() => toggle(role, viewRoles, setViewRoles)}
                  onEdit={() => toggle(role, editRoles, setEditRoles)}
                  disabled={role === 'admin'} />
              )) : allUsers.map(u => (
                <Row key={u.username} label={`${u.name || u.username} (${u.role})`}
                  inView={viewUsers.includes(u.username)}
                  inEdit={editUsers.includes(u.username)}
                  onView={() => toggle(u.username, viewUsers, setViewUsers)}
                  onEdit={() => toggle(u.username, editUsers, setEditUsers)}
                  disabled={u.role === 'admin'} />
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Admins always have full access. Empty view list = visible to all.</p>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input type="checkbox" checked={applyAll} onChange={e => setApplyAll(e.target.checked)} className="w-4 h-4 accent-[#FECD28]" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Apply to <strong>all {allPages.length} pages</strong></span>
          </label>
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-[#111111] bg-[#FECD28] hover:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Move to folder modal ─────────────────────────────────────────────────────
function MoveToFolderModal({ page, folders, onMove, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <Folder size={15} className="text-[#FECD28]" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex-1">Move "{page.title}" to…</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
        </div>
        <div className="py-2 max-h-64 overflow-y-auto">
          <button onClick={() => onMove(null)}
            className="w-full text-left px-5 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
            <FileText size={13} className="text-slate-400" /> No folder (root)
          </button>
          {folders.map(f => (
            <button key={f.id} onClick={() => onMove(f.id)}
              className="w-full text-left px-5 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-[#FECD28]/10 flex items-center gap-2">
              <Folder size={13} className="text-[#FECD28]" /> {f.title}
            </button>
          ))}
          {!folders.length && <p className="px-5 py-3 text-xs text-slate-400">No folders yet — create one first.</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar tree item ────────────────────────────────────────────────────────
function PageItem({ page, depth, allPages, activeId, searchQuery, expandedIds, toggleExpanded, onSelect, onCreateSubpage, onCreatePageInFolder, onMoveToFolder, onDeleteFolder, isAdmin, canView }) {
  if (!canView(page)) return null
  const children = allPages.filter(p => p.parentId === page.id && canView(p))
  const hasChildren = children.length > 0
  const isActive = page.id === activeId
  const isExpanded = expandedIds.has(page.id)
  const isFolder = page.isFolder
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div>
      <div className={`group flex items-center gap-0.5 rounded-xl transition-colors ${isActive && !isFolder ? 'bg-[#FECD28]/20 dark:bg-[#FECD28]/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        style={{ paddingLeft: depth * 12 + 4 }}>
        {/* Expand toggle */}
        <button onClick={() => (hasChildren || isFolder) && toggleExpanded(page.id)}
          className={`p-0.5 shrink-0 text-slate-400 dark:text-slate-500 transition-colors ${(hasChildren || isFolder) ? 'hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer' : 'cursor-default opacity-0 pointer-events-none'}`}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Folder / page icon */}
        <span className="shrink-0 mr-1">
          {isFolder
            ? (isExpanded ? <FolderOpen size={13} className="text-[#FECD28]" /> : <Folder size={13} className="text-[#FECD28]" />)
            : <FileText size={11} className="text-slate-400 dark:text-slate-500" />}
        </span>

        {/* Title */}
        <button onClick={() => !isFolder && onSelect(page)}
          className={`flex-1 min-w-0 text-left py-1.5 text-sm truncate ${isFolder ? 'font-semibold text-slate-700 dark:text-slate-200 cursor-default' : isActive ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
          <Highlight text={page.title} query={searchQuery} />
        </button>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 pr-1 shrink-0">
          {page.locked && <Lock size={9} className="text-slate-400 dark:text-slate-500" />}
          {page.viewRoles?.length > 0 && !page.viewRoles.includes('general') && (
            <EyeOff size={9} className="text-amber-400" title="Restricted visibility" />
          )}
          {isAdmin && isFolder && !confirmDel && (
            <>
              <button onClick={e => { e.stopPropagation(); onCreatePageInFolder(page.id) }}
                title="New page in folder"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                <Plus size={11} />
              </button>
              <button onClick={e => { e.stopPropagation(); setConfirmDel(true) }}
                title="Delete folder"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                <Trash2 size={11} />
              </button>
            </>
          )}
          {isAdmin && isFolder && confirmDel && (
            <span className="flex items-center gap-1">
              <span className="text-xs text-red-600 font-medium">Delete?</span>
              <button onClick={e => { e.stopPropagation(); onDeleteFolder(page.id); setConfirmDel(false) }} className="text-xs text-red-600 font-bold px-1 hover:text-red-800">Yes</button>
              <button onClick={e => { e.stopPropagation(); setConfirmDel(false) }} className="text-xs text-slate-500 px-1 hover:text-slate-700">No</button>
            </span>
          )}
          {isAdmin && !isFolder && (
            <>
              <button onClick={e => { e.stopPropagation(); onMoveToFolder(page) }}
                title="Move to folder"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                <Folder size={11} />
              </button>
              <button onClick={e => { e.stopPropagation(); onCreateSubpage(page.id) }}
                title="New subpage"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                <Plus size={11} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Children */}
      {(hasChildren || isFolder) && isExpanded && children
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(child => (
          <PageItem key={child.id} page={child} depth={depth + 1}
            allPages={allPages} activeId={activeId} searchQuery={searchQuery}
            expandedIds={expandedIds} toggleExpanded={toggleExpanded}
            onSelect={onSelect} onCreateSubpage={onCreateSubpage}
            onCreatePageInFolder={onCreatePageInFolder}
            onMoveToFolder={onMoveToFolder}
            onDeleteFolder={onDeleteFolder}
            isAdmin={isAdmin} canView={canView} />
        ))
      }
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UserGuidePage() {
  const { user, users, perm } = useAuth()
  const isAdmin = perm('admin', 'view')

  // Derive all unique roles from user list
  const allRoles = [...new Set(['admin', ...((users || []).map(u => u.role).filter(Boolean))])]

  const canView = useCallback((page) => {
    if (isAdmin) return true
    if (page.viewUsers?.includes(user?.username)) return true
    if (!page.viewRoles?.length && !page.viewUsers?.length) return true
    return page.viewRoles?.includes(user?.role)
  }, [isAdmin, user?.role, user?.username])

  const canEditPage = useCallback((page) => {
    if (isAdmin) return true
    if (page.editUsers?.includes(user?.username)) return true
    if (!page.editRoles?.length && !page.editUsers?.length) return false
    return page.editRoles?.includes(user?.role)
  }, [isAdmin, user?.role, user?.username])

  const [pages, setPages]           = useState(() => {
    try { const c = sessionStorage.getItem('wiki_pages'); return c ? JSON.parse(c) : [SEED_PAGE] } catch { return [SEED_PAGE] }
  })
  const [activePage, setActivePage] = useState(SEED_PAGE)
  const [content, setContent]       = useState(SEED_CONTENT)
  const [loadingPages, setLoadingPages]     = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())

  const [editing, setEditing]       = useState(false)
  const [draft, setDraft]           = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [saving, setSaving]         = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const [permsPage, setPermsPage]   = useState(null)
  const [movingPage, setMovingPage] = useState(null) // page being moved to a folder

  const [imgUploading, setImgUploading] = useState(false)
  const [dragOver, setDragOver]         = useState(false)
  const textareaRef   = useRef(null)
  const imageInputRef = useRef(null)

  // ── Load pages ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!LIVE) return
    // Always fetch fresh from Vercel KV (fast — no Apps Script cold start)
    fetchWikiPages()
      .then(ps => {
        if (!ps.length) return
        const sorted = [...ps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        setPages(sorted)
        setActivePage(prev => {
          // Keep current selection if it still exists, otherwise go to first
          const still = sorted.find(p => p.id === prev?.id)
          if (!still || prev?.id === '__seed__') {
            setContent('')
            return sorted.find(p => !p.parentId) || sorted[0]
          }
          return still
        })
        setExpandedIds(new Set(sorted.filter(p => sorted.some(c => c.parentId === p.id)).map(p => p.id)))
      })
      .catch(() => {/* keep whatever is showing */})
  }, [])

  // ── Load page content ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activePage || activePage.id === '__seed__' || !LIVE) return
    setLoadingContent(true)
    setContent('')
    fetchWikiPage(activePage.id)
      .then(c => setContent(c || ''))
      .catch(() => setContent(''))
      .finally(() => setLoadingContent(false))
  }, [activePage?.id])

  const toggleExpanded = (id) => setExpandedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const selectPage = (page) => {
    if (editing) return
    setActivePage(page)
    setDeleteConfirm(false)
  }

  // ── Create page ─────────────────────────────────────────────────────────────
  const createFolder = async () => {
    const title = 'New Folder'
    const payload = { title, content: '', parentId: null, isFolder: true, viewRoles: [], editRoles: ['admin'], updatedBy: user?.name || user?.username || '' }
    try {
      if (LIVE) {
        const { page: p } = await saveWikiPage(payload)
        const newPage = { ...p, isFolder: true }
        setPages(ps => [...ps, newPage])
        setExpandedIds(s => new Set([...s, newPage.id]))
      } else {
        const p = { id: 'mock' + Date.now(), title, parentId: null, isFolder: true, locked: false, viewRoles: [], editRoles: ['admin'], updatedAt: new Date().toISOString(), updatedBy: '', order: pages.length }
        setPages(ps => [...ps, p])
        setExpandedIds(s => new Set([...s, p.id]))
      }
    } catch (err) { alert('Could not create folder: ' + err.message) }
  }

  const createPageInFolder = async (folderId) => {
    setExpandedIds(s => new Set([...s, folderId]))
    await createPage(folderId)
  }

  const createPage = async (parentId = null) => {
    const title = parentId ? 'New Page' : 'New Page'
    const payload = { title, content: '', parentId, viewRoles: [], editRoles: ['admin'], updatedBy: user?.name || user?.username || '' }
    if (LIVE) {
      try {
        const res = await saveWikiPage(payload)
        const p = res.page
        setPages(ps => [...ps, p])
        if (parentId) setExpandedIds(s => new Set([...s, parentId]))
        setActivePage(p)
        setContent('')
        setDraft('')
        setDraftTitle(p.title)
        setEditing(true)
      } catch (err) { alert('Could not create page: ' + err.message) }
    } else {
      const p = { id: 'mock' + Date.now(), title, parentId, locked: false, viewRoles: [], editRoles: ['admin'], updatedAt: new Date().toISOString(), updatedBy: '', order: pages.length }
      setPages(ps => [...ps, p])
      if (parentId) setExpandedIds(s => new Set([...s, parentId]))
      setActivePage(p)
      setContent('')
      setDraft('')
      setDraftTitle(p.title)
      setEditing(true)
    }
  }

  // ── Lock ────────────────────────────────────────────────────────────────────
  const toggleLock = async () => {
    if (!activePage) return
    const updated = { ...activePage, locked: !activePage.locked }
    setActivePage(updated)
    setPages(ps => ps.map(p => p.id === updated.id ? updated : p))
    if (LIVE) {
      try { await saveWikiPage({ id: activePage.id, locked: updated.locked, updatedBy: user?.name || '' }) }
      catch (err) {
        setActivePage(activePage)
        setPages(ps => ps.map(p => p.id === activePage.id ? activePage : p))
        alert('Could not update lock: ' + err.message)
      }
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!activePage || activePage.locked) return
    setDeleting(true)
    try {
      if (LIVE) await deleteWikiPage({ id: activePage.id })
      const remaining = pages.filter(p => p.id !== activePage.id)
      setPages(remaining)
      const next = remaining.find(p => !p.parentId) || remaining[0] || null
      setActivePage(next || SEED_PAGE)
      if (!next) setContent(SEED_CONTENT)
      setDeleteConfirm(false)
    } catch (err) { alert('Delete failed: ' + err.message) }
    finally { setDeleting(false) }
  }

  // ── Delete folder ───────────────────────────────────────────────────────────
  const deleteFolder = async (folderId) => {
    try {
      if (LIVE) await deleteWikiPage({ id: folderId })
      // Move children to root before removing folder
      const children = pages.filter(p => p.parentId === folderId)
      if (LIVE) await Promise.all(children.map(c => saveWikiPage({ id: c.id, parentId: null })))
      setPages(ps => ps.filter(p => p.id !== folderId).map(p => p.parentId === folderId ? { ...p, parentId: null } : p))
    } catch (err) { alert('Delete failed: ' + err.message) }
  }

  // ── Move page to folder ─────────────────────────────────────────────────────
  const movePage = async (page, folderId) => {
    setMovingPage(null)
    try {
      if (LIVE) await saveWikiPage({ id: page.id, parentId: folderId || null })
      setPages(ps => ps.map(p => p.id === page.id ? { ...p, parentId: folderId || null } : p))
      if (folderId) setExpandedIds(s => new Set([...s, folderId]))
    } catch (err) { alert('Move failed: ' + err.message) }
  }

  // ── Permissions save ────────────────────────────────────────────────────────
  const savePermissions = async ({ viewRoles, editRoles, viewUsers, editUsers, applyAll }) => {
    const targets = applyAll ? pages.filter(p => p.id !== '__seed__') : [activePage]
    const updates = targets.map(p => ({ ...p, viewRoles, editRoles, viewUsers, editUsers }))
    setPages(ps => ps.map(p => updates.find(u => u.id === p.id) || p))
    if (activePage && updates.find(u => u.id === activePage.id)) {
      setActivePage(a => ({ ...a, viewRoles, editRoles, viewUsers, editUsers }))
    }
    if (LIVE) {
      try {
        await Promise.all(targets.map(p => saveWikiPage({ id: p.id, viewRoles, editRoles, viewUsers, editUsers, updatedBy: user?.name || '' })))
      } catch (err) { alert('Could not save permissions: ' + err.message) }
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const startEdit = () => { setDraft(content); setDraftTitle(activePage?.title || ''); setEditing(true); setDeleteConfirm(false) }
  const cancelEdit = () => { setEditing(false); setDraft(''); setDraftTitle('') }
  const saveEdit = async () => {
    if (!activePage) return
    setSaving(true)
    const payload = { id: activePage.id, title: draftTitle.trim() || activePage.title, content: draft, updatedBy: user?.name || user?.username || '' }
    try {
      let updated = { ...activePage, title: payload.title, updatedAt: new Date().toISOString(), updatedBy: payload.updatedBy }
      if (LIVE) { const res = await saveWikiPage(payload); updated = res.page || updated }
      setContent(draft)
      setActivePage(updated)
      setPages(ps => ps.map(p => p.id === updated.id ? updated : p))
      setEditing(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) { alert('Save failed: ' + err.message) }
    finally { setSaving(false) }
  }

  // ── Format ──────────────────────────────────────────────────────────────────
  const applyFormat = useCallback((type) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const val = ta.value, sel = val.slice(start, end)
    let result, cs, ce

    const wrapInline = (open, close, ph) => {
      const t = sel || ph
      result = val.slice(0, start) + open + t + close + val.slice(end)
      cs = start + open.length; ce = cs + t.length
    }
    const prefixLine = (prefix) => {
      const ls = val.lastIndexOf('\n', start - 1) + 1
      const stripped = val.slice(ls).replace(/^(#{1,3} |> |- |\d+\. )/, '')
      result = val.slice(0, ls) + prefix + stripped
      cs = ce = ls + prefix.length
    }

    switch (type) {
      case 'bold':      wrapInline('**','**','bold text'); break
      case 'italic':    wrapInline('_','_','italic text'); break
      case 'strike':    wrapInline('~~','~~','strikethrough'); break
      case 'code':      wrapInline('`','`','code'); break
      case 'codeblock': {
        const ins = '\n```\n' + (sel || 'code here') + '\n```\n'
        result = val.slice(0,start) + ins + val.slice(end)
        cs = start + 5; ce = cs + (sel||'code here').length; break
      }
      case 'h1': prefixLine('# '); break
      case 'h2': prefixLine('## '); break
      case 'h3': prefixLine('### '); break
      case 'hr': result = val.slice(0,start)+'\n---\n'+val.slice(end); cs=ce=start+5; break
      case 'bullet':  prefixLine('- '); break
      case 'ordered': prefixLine('1. '); break
      case 'quote':   prefixLine('> '); break
      case 'link': {
        const url = prompt('Enter URL:')
        if (!url) return
        const t = sel || 'link text'
        result = val.slice(0,start)+`[${t}](${url})`+val.slice(end)
        cs = start; ce = start + `[${t}](${url})`.length; break
      }
      default: return
    }
    setDraft(result)
    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.selectionStart = cs
      textareaRef.current.selectionEnd   = ce
      textareaRef.current.focus()
    })
  }, [])

  // ── Image upload ────────────────────────────────────────────────────────────
  const uploadImageFile = async (file, pos) => {
    let url
    if (LIVE) {
      const fileData = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file) })
      const result = await uploadWikiImage({ fileName: file.name, fileData, mimeType: file.type })
      url = result.url
    } else { url = URL.createObjectURL(file) }
    const ins = `\n![${file.name}](${url})\n`
    setDraft(v => { const p = pos ?? v.length; return v.slice(0, p) + ins + v.slice(p) })
  }

  const handleImagePick = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''
    setImgUploading(true)
    try { const pos = textareaRef.current?.selectionStart; for (const f of files) await uploadImageFile(f, pos) }
    catch (err) { alert('Image upload failed: ' + err.message) }
    finally { setImgUploading(false) }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (!files.length) return
    setImgUploading(true)
    try { const pos = textareaRef.current?.selectionStart; for (const f of files) await uploadImageFile(f, pos) }
    catch (err) { alert('Image upload failed: ' + err.message) }
    finally { setImgUploading(false) }
  }

  // ── Filtered search results ─────────────────────────────────────────────────
  const searchResults = searchQuery.trim()
    ? pages.filter(p => canView(p) && p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null

  // Root pages for tree (no parentId)
  const rootPages = pages.filter(p => !p.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  if (loadingPages) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400 gap-3">
        <span className="w-5 h-5 border-2 border-slate-300 border-t-brand rounded-full animate-spin" />
        Loading wiki…
      </div>
    )
  }

  const currentCanEdit = activePage ? canEditPage(activePage) : false

  return (
    <div className="flex gap-5 min-h-[calc(100vh-112px)]">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between px-1 mb-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <BookOpen size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">Pages</span>
          </div>
          {isAdmin && !editing && (
            <div className="flex items-center gap-0.5">
              <button onClick={createFolder} title="New folder"
                className="p-1 rounded-lg text-slate-400 hover:text-[#FECD28] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <Folder size={14} />
              </button>
              <button onClick={() => createPage(null)} title="New page"
                className="p-1 rounded-lg text-slate-400 hover:text-[#111111] dark:hover:text-[#FECD28] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <Plus size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search pages…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#FECD28] transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Page tree / search results */}
        <nav className="flex flex-col gap-0.5 overflow-y-auto flex-1">
          {searchResults ? (
            searchResults.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400 italic">No pages match</p>
            ) : searchResults.map(page => (
              <button key={page.id} onClick={() => { selectPage(page); setSearchQuery('') }}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${activePage?.id === page.id ? 'bg-[#FECD28]/20 font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <Highlight text={page.title} query={searchQuery} />
              </button>
            ))
          ) : (
            rootPages.length === 0
              ? <p className="px-3 py-4 text-xs text-slate-400 italic">No pages yet</p>
              : rootPages.map(page => (
                  <PageItem key={page.id} page={page} depth={0}
                    allPages={pages} activeId={activePage?.id} searchQuery={searchQuery}
                    expandedIds={expandedIds} toggleExpanded={toggleExpanded}
                    onSelect={selectPage} onCreateSubpage={createPage}
                    onCreatePageInFolder={createPageInFolder}
                    onMoveToFolder={setMovingPage}
                    onDeleteFolder={deleteFolder}
                    isAdmin={isAdmin} canView={canView} />
                ))
          )}
        </nav>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {!activePage ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <BookOpen size={32} />
            <p className="text-sm">No page selected</p>
            {isAdmin && <button onClick={() => createPage(null)} className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#111111] bg-[#FECD28] hover:brightness-95">Create first page</button>}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

            {/* Page header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 print:hidden flex-wrap">
              {editing ? (
                <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="Page title"
                  className="flex-1 min-w-0 text-lg font-bold bg-transparent border-b-2 border-[#FECD28] outline-none text-slate-900 dark:text-slate-100 py-0.5" />
              ) : (
                <h1 className="flex-1 min-w-0 text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{activePage.title}</h1>
              )}

              {!editing && activePage.updatedAt && (
                <span className="hidden sm:block text-xs text-slate-400 shrink-0">
                  {new Date(activePage.updatedAt).toLocaleDateString('en-ZA')}
                  {activePage.updatedBy ? ` · ${activePage.updatedBy}` : ''}
                </span>
              )}
              {savedFlash && <span className="text-xs font-medium text-green-600 shrink-0">Saved ✓</span>}

              {/* Admin controls — view mode */}
              {isAdmin && !editing && (
                <div className="flex items-center gap-1 shrink-0">
                  {/* Print */}
                  <button onClick={() => {
                    const w = window.open('', '_blank')
                    w.document.write(`<!DOCTYPE html><html><head><title>${activePage.title}</title><style>
                      body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6}
                      h1{font-size:2em;font-weight:800;margin-bottom:4px}h2{font-size:1.3em;font-weight:700;margin-top:2em;padding-bottom:4px;border-bottom:1px solid #ddd}
                      h3{font-size:1.1em;font-weight:600;margin-top:1.4em}p{margin:.5em 0}
                      ul,ol{margin:.5em 0;padding-left:1.6em}li{margin:.25em 0}
                      pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto;font-size:.85em}
                      code{background:#f4f4f4;padding:1px 4px;border-radius:3px;font-size:.9em}
                      blockquote{border-left:3px solid #FECD28;margin:0;padding-left:16px;color:#555;font-style:italic}
                      hr{border:none;border-top:1px solid #ddd;margin:1.5em 0}
                      img{max-width:100%}strong{font-weight:700}em{font-style:italic}
                      @media print{body{margin:20px}}
                    </style></head><body>
                    <h1>${activePage.title}</h1>
                    <div id="content"></div>
                    <script>
                      const md = ${JSON.stringify(content)};
                      document.getElementById('content').innerHTML = md
                        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                        .replace(/^### (.+)$/gm,'<h3>$1</h3>')
                        .replace(/^## (.+)$/gm,'<h2>$1</h2>')
                        .replace(/^# (.+)$/gm,'<h1>$1</h1>')
                        .replace(/^---$/gm,'<hr>')
                        .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
                        .replace(/^\d+\. (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g,'<ol>$&</ol>')
                        .replace(/^[-*] (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g,'<ul>$&</ul>')
                        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
                        .replace(/_(.+?)_/g,'<em>$1</em>')
                        .replace(/!\[([^\]]*)\]\(([^)]*)\)/g,'<img src="$2" alt="$1">')
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>')
                        .replace(/\n\n/g,'</p><p>').replace(/^(?!<)/gm,'').replace(/^/,'<p>').replace(/$/,'</p>');
                      window.print();
                    </script></body></html>`)
                    w.document.close()
                  }} title="Print page"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Printer size={14} />
                  </button>
                  {/* Permissions */}
                  <button onClick={() => setPermsPage(activePage)} title="Permissions"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Shield size={14} />
                  </button>
                  {/* Lock */}
                  <button onClick={toggleLock} title={activePage.locked ? 'Unlock page' : 'Lock page'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    {activePage.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  {/* Delete */}
                  {!activePage.locked && (
                    deleteConfirm ? (
                      <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1">
                        <span className="text-xs text-red-700 dark:text-red-400 font-medium">Delete?</span>
                        <button onClick={confirmDelete} disabled={deleting} className="text-xs text-red-600 font-semibold hover:text-red-800 px-1 disabled:opacity-50">{deleting ? '…' : 'Yes'}</button>
                        <button onClick={() => setDeleteConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 px-1">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(true)} title="Delete page"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )
                  )}
                  {/* Edit */}
                  {currentCanEdit && (
                    <button onClick={startEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#111111] bg-[#FECD28] hover:brightness-95 transition-all ml-1">
                      <Pencil size={13} /> Edit
                    </button>
                  )}
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

            {/* Obsidian-style toolbar */}
            {editing && (
              <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-900/60 overflow-x-auto print:hidden">
                <ToolBtn icon={Bold}          label="Bold (**text**)"          onClick={() => applyFormat('bold')} />
                <ToolBtn icon={Italic}        label="Italic (_text_)"          onClick={() => applyFormat('italic')} />
                <ToolBtn icon={Strikethrough} label="Strikethrough (~~text~~)" onClick={() => applyFormat('strike')} />
                <Sep />
                <ToolBtn icon={Heading1} label="Heading 1" onClick={() => applyFormat('h1')} />
                <ToolBtn icon={Heading2} label="Heading 2" onClick={() => applyFormat('h2')} />
                <ToolBtn icon={Heading3} label="Heading 3" onClick={() => applyFormat('h3')} />
                <Sep />
                <ToolBtn icon={List}        label="Bullet list"    onClick={() => applyFormat('bullet')} />
                <ToolBtn icon={ListOrdered} label="Numbered list"  onClick={() => applyFormat('ordered')} />
                <ToolBtn icon={Quote}       label="Blockquote"     onClick={() => applyFormat('quote')} />
                <ToolBtn icon={Minus}       label="Horizontal rule (---)" onClick={() => applyFormat('hr')} />
                <Sep />
                <ToolBtn icon={Code}      label="Inline code (`code`)"  onClick={() => applyFormat('code')} />
                <ToolBtn icon={FileCode2} label="Code block (```)"       onClick={() => applyFormat('codeblock')} />
                <Sep />
                <ToolBtn icon={Link2}     label="Insert link"   onClick={() => applyFormat('link')} />
                <ToolBtn icon={imgUploading ? Loader2 : ImageIcon} label="Insert image" disabled={imgUploading} spin={imgUploading} onClick={() => imageInputRef.current?.click()} />
                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} />
              </div>
            )}

            {/* Content */}
            <div className={editing ? '' : 'p-6 sm:p-8'}>
              {editing ? (
                <div className="flex divide-x divide-slate-200 dark:divide-slate-700" style={{ minHeight: 520 }}>
                  {/* Editor pane */}
                  <div className="relative w-1/2 self-stretch">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onKeyDown={e => {
                        // Prevent # (and other special chars) from triggering browser URL navigation
                        e.stopPropagation()
                      }}
                      autoFocus
                      spellCheck
                      className={`w-full h-full font-mono text-sm text-slate-800 dark:text-slate-100 p-5 focus:outline-none leading-relaxed resize-none border-0 transition-colors ${dragOver ? 'bg-[#FECD28]/10' : 'bg-white dark:bg-slate-800'}`}
                      placeholder="Start writing in Markdown…"
                      style={{ minHeight: 520 }}
                    />
                    {dragOver && (
                      <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-[#FECD28] flex items-center justify-center">
                        <span className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#111111] dark:text-[#FECD28] shadow">Drop image to insert</span>
                      </div>
                    )}
                    {imgUploading && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-800/60">
                        <Loader2 size={24} className="animate-spin text-[#FECD28]" />
                      </div>
                    )}
                  </div>
                  {/* Preview pane */}
                  <article className="w-1/2 p-5 overflow-y-auto text-sm leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 self-stretch" style={{ minHeight: 520 }}>
                    {draft.trim() ? renderMarkdown(draft) : <span className="text-slate-300 dark:text-slate-600 italic select-none">Preview will appear here…</span>}
                  </article>
                </div>
              ) : loadingContent ? (
                <div className="flex items-center gap-3 py-20 justify-center text-slate-400">
                  <span className="w-5 h-5 border-2 border-slate-300 border-t-brand rounded-full animate-spin" />
                  Loading…
                </div>
              ) : content.trim() ? (
                <article>{renderMarkdown(content)}</article>
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
                  <AlertCircle size={24} />
                  <p className="text-sm">This page is empty.</p>
                  {currentCanEdit && <button onClick={startEdit} className="text-sm text-[#FECD28] font-semibold hover:underline">Start editing</button>}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Permissions modal ────────────────────────────────────────────────── */}
      {permsPage && (
        <PermissionsModal
          page={permsPage}
          allPages={pages.filter(p => p.id !== '__seed__')}
          allRoles={allRoles}
          allUsers={(users || []).filter(u => u.role !== 'admin')}
          onSave={savePermissions}
          onClose={() => setPermsPage(null)}
        />
      )}

      {movingPage && (
        <MoveToFolderModal
          page={movingPage}
          folders={pages.filter(p => p.isFolder)}
          onMove={(folderId) => movePage(movingPage, folderId)}
          onClose={() => setMovingPage(null)}
        />
      )}
    </div>
  )
}
