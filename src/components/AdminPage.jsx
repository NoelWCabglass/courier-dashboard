import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, Eye, EyeOff, Pencil as PencilIcon, Shield, ShieldCheck, User, Clock, BarChart2, Users, Truck } from 'lucide-react'
import { useAuth, ROLES, PAGES, defaultPermsForRole } from '../context/AuthContext'
import { useActivity } from '../context/ActivityContext'
import AnalyticsTab from './AnalyticsTab'

const ROLE_COLORS = { admin: 'text-red-600', general: 'text-blue-600', sales: 'text-green-600', dispatch: 'text-purple-600' }

function fmtTime(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
}

const ROLE_BADGES = {
  admin:    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  general:  'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  sales:    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  dispatch: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
}

const ROLE_ICONS = { admin: ShieldCheck, general: Shield, sales: User, dispatch: Truck }

function UserForm({ initial, onSave, onCancel, isNew }) {
  const [form, setForm] = useState(() => {
    const base = initial || { name: '', username: '', password: '', role: 'sales' }
    return { ...base, permissions: base.permissions || defaultPermsForRole(base.role) }
  })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (field, val) => { setForm(p => ({ ...p, [field]: val })); setErrors(p => ({ ...p, [field]: '' })) }

  // Apply a role preset → fills the whole permission matrix
  const applyPreset = (role) => {
    setForm(p => ({ ...p, role, permissions: defaultPermsForRole(role) }))
  }

  // Toggle one page's view/edit cell. Turning off View also turns off Edit.
  const togglePerm = (pageKey, action) => {
    setForm(p => {
      const cur = p.permissions[pageKey] || { view: false, edit: false }
      let next = { ...cur, [action]: !cur[action] }
      if (action === 'view' && !next.view) next.edit = false
      if (action === 'edit' && next.edit) next.view = true
      return { ...p, permissions: { ...p.permissions, [pageKey]: next } }
    })
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.username.trim()) e.username = 'Required'
    if (isNew && !form.password) e.password = 'Required'
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave(form)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
        {isNew ? 'Add new user' : `Edit ${initial?.name}`}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Display name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none transition-colors
              ${errors.name ? 'border-red-400' : 'border-slate-200 dark:border-slate-600 focus:border-brand'}`}
            placeholder="Full name" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Username</label>
          <input value={form.username} onChange={e => set('username', e.target.value)}
            className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none transition-colors
              ${errors.username ? 'border-red-400' : 'border-slate-200 dark:border-slate-600 focus:border-brand'}`}
            placeholder="login username" />
          {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Password {!isNew && <span className="font-normal normal-case">(leave blank to keep)</span>}
          </label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
              className={`w-full px-3 py-2 pr-9 text-sm rounded-xl border bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none transition-colors
                ${errors.password ? 'border-red-400' : 'border-slate-200 dark:border-slate-600 focus:border-brand'}`}
              placeholder={isNew ? 'Set password' : 'New password'} />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Quick preset</label>
          <select value={form.role} onChange={e => applyPreset(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand">
            <option value="admin">Admin (full access)</option>
            <option value="general">General (no user mgmt)</option>
            <option value="sales">Sales (view only)</option>
            <option value="dispatch">Dispatch (warehouse)</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1">Fills the grid below — fine-tune after.</p>
        </div>
      </div>

      {/* Permission matrix */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Page permissions</label>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="text-left font-semibold px-3 py-2">Page</th>
                <th className="text-center font-semibold px-3 py-2 w-20">View</th>
                <th className="text-center font-semibold px-3 py-2 w-20">Edit</th>
              </tr>
            </thead>
            <tbody>
              {PAGES.map(pg => {
                const cell = form.permissions[pg.key] || { view: false, edit: false }
                return (
                  <tr key={pg.key} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{pg.label}</span>
                      {pg.hasEdit && pg.editHint && <span className="block text-[11px] text-slate-400">{pg.editHint}</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => togglePerm(pg.key, 'view')}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors
                          ${cell.view ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700'}`}>
                        {cell.view ? <Check size={15} /> : <Eye size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {pg.hasEdit ? (
                        <button type="button" onClick={() => togglePerm(pg.key, 'edit')}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors
                            ${cell.edit ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700'}`}>
                          {cell.edit ? <Check size={15} /> : <PencilIcon size={13} />}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} style={{ backgroundColor: '#FECD28' }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#111111] hover:brightness-95">
          <Check size={14} /> {isNew ? 'Add user' : 'Save changes'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
          Cancel
        </button>
      </div>
    </div>
  )
}

function UsersTab() {
  const { user, users, addUser, updateUser, deleteUser } = useAuth()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleAdd = (form) => { addUser(form); setAdding(false) }
  const handleEdit = (id, form) => {
    const data = { ...form }
    if (!data.password) delete data.password
    updateUser(id, data)
    setEditingId(null)
  }
  const handleDelete = (id) => { deleteUser(id); setConfirmDelete(null) }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">User Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Add, edit or remove user accounts and assign roles.</p>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setEditingId(null) }}
            style={{ backgroundColor: '#FECD28' }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#111111] hover:brightness-95">
            <Plus size={14} /> Add user
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4">
          <UserForm isNew onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
              {['Name', 'Username', 'Role', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map(u => {
              const Icon = ROLE_ICONS[u.role] || User
              const isYou = u.id === user?.id
              return (
                <tr key={u.id}>
                  {editingId === u.id ? (
                    <td colSpan={4} className="px-4 py-3">
                      <UserForm initial={u} onSave={(form) => handleEdit(u.id, form)} onCancel={() => setEditingId(null)} />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] shrink-0"
                            style={{ backgroundColor: '#FECD28' }}>
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{u.name}</span>
                          {isYou && <span className="text-xs text-slate-400 dark:text-slate-500">(you)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{u.username}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGES[u.role]}`}>
                          <Icon size={11} /> {ROLES[u.role]?.label ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingId(u.id); setAdding(false) }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <Pencil size={13} />
                          </button>
                          {!isYou && (
                            confirmDelete === u.id ? (
                              <div className="flex items-center gap-1.5 ml-1">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Delete?</span>
                                <button onClick={() => handleDelete(u.id)}
                                  className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">Yes</button>
                                <button onClick={() => setConfirmDelete(null)}
                                  className="text-xs font-medium text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(u.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActivityLog() {
  const { log } = useActivity()
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Activity Log</h2>
        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-2 py-0.5 font-medium">{log.length}</span>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {log.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[560px] overflow-y-auto scrollbar-thin">
            {log.map(entry => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] shrink-0 mt-0.5"
                  style={{ backgroundColor: '#FECD28' }}>
                  {entry.user.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{entry.user}</span>
                    <span className={`text-xs font-medium capitalize ${ROLE_COLORS[entry.role] || 'text-slate-500'}`}>({entry.role})</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {entry.action}
                    {entry.detail && <span className="text-slate-400 dark:text-slate-500"> · {entry.detail}</span>}
                  </p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">{fmtTime(entry.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const SUB_TABS = [
  { key: 'users',     label: 'Users',     icon: Users },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
  { key: 'activity',  label: 'Activity',  icon: Clock },
]

export default function AdminPage({ orders, history }) {
  const [sub, setSub] = useState('users')

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-700 pb-0">
        {SUB_TABS.map(({ key, label, icon: Icon }) => {
          const active = sub === key
          return (
            <button
              key={key}
              onClick={() => setSub(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors
                ${active
                  ? 'border-[#FECD28] text-slate-900 dark:text-slate-100'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      </div>

      {sub === 'users'     && <UsersTab />}
      {sub === 'analytics' && <AnalyticsTab orders={orders} history={history} />}
      {sub === 'activity'  && <ActivityLog />}
    </div>
  )
}
