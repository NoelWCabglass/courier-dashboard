import { useState, useEffect } from 'react'
import { X, ExternalLink, Phone, Mail, MapPin, Package, RefreshCw, AlertTriangle, Pencil, Plus, Trash2, Check } from 'lucide-react'
import StatusBadge from './StatusBadge'
import Toggle from './Toggle'
import { STATUS } from '../mockData'
import { useAuth } from '../context/AuthContext'

const fmt = (n) => n != null ? `R ${Number(n).toFixed(2)}` : null

const COURIER_COLORS = {
  TCG: 'border-cyan-300 bg-cyan-50 text-cyan-800',
  EPX: 'border-orange-300 bg-orange-50 text-orange-800',
  Triangle: 'border-yellow-300 bg-yellow-50 text-yellow-800',
}

const inputCls = "w-full text-sm px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"

function Field({ label, value, editing, onChange, placeholder, type = 'text' }) {
  return editing ? (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || label}
      className={inputCls}
    />
  ) : (
    <p className="text-sm text-slate-700 dark:text-slate-300">{value || <span className="text-slate-400">—</span>}</p>
  )
}

export default function OrderPanel({ order, onClose, onUpdate, onDelete }) {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'general'
  const open = !!order
  const terminal = order && [STATUS.BOOKED, STATUS.BOOKING, STATUS.BOOKING_FAILED].includes(order.status)

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [editAddress, setEditAddress] = useState(null)
  const [editItems, setEditItems] = useState(null)

  useEffect(() => { setEditing(false); setConfirmDelete(false) }, [order?.id])

  const startEdit = () => {
    setEditContact({ ...order.customer })
    setEditAddress({ ...order.address })
    setEditItems(order.items.map(i => ({ ...i })))
    setEditing(true)
  }

  const cancelEdit = () => { setEditing(false); setEditContact(null); setEditAddress(null); setEditItems(null) }

  const saveEdit = () => {
    onUpdate({ customer: editContact, address: editAddress, items: editItems })
    setEditing(false)
  }

  const updateContact = (field, val) => setEditContact(prev => ({ ...prev, [field]: val }))
  const updateAddr    = (field, val) => setEditAddress(prev => ({ ...prev, [field]: val }))
  const updateItem    = (i, field, val) => setEditItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  const addItem       = () => setEditItems(prev => [...prev, { sku: '', h: 0, w: 0, l: 0, kg: 0, qty: 1 }])
  const removeItem    = (i) => setEditItems(prev => prev.filter((_, idx) => idx !== i))

  const cheaper = order?.tcgQuote != null && order?.epxQuote != null
    ? (order.tcgQuote <= order.epxQuote ? 'TCG' : 'EPX') : null

  const items = editing ? editItems : order?.items ?? []

  return (
    <>
      <div className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => { if (!editing) onClose() }} />

      <div className={`fixed right-0 top-0 h-full w-full sm:w-[540px] bg-white dark:bg-slate-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {!order ? null : (<>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <a href={order.psUrl} target="_blank" rel="noopener noreferrer"
                className="text-lg font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5">
                {order.psNo} <ExternalLink size={14} />
              </a>
              <StatusBadge status={order.status} size="lg" />
            </div>
            <div className="flex items-center gap-1">
              {canEdit && !terminal && (
                editing ? (
                  <>
                    <button onClick={saveEdit} style={{ backgroundColor: '#FECD28' }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#111111]">
                      <Check size={13} /> Save
                    </button>
                    <button onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={startEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                )
              )}
              {!editing && (
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors ml-1">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="p-5 space-y-5">

              {/* Error */}
              {order.errorMessage && (
                <div className="flex gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3.5">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">{order.errorMessage}</p>
                </div>
              )}

              {/* Sales read-only notice */}
              {!canEdit && (
                <div className="bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium">View only</span> — contact an admin to make changes.
                </div>
              )}

              {/* Customer / Contact */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Customer</h3>
                <div className={`rounded-xl p-4 space-y-2.5 ${editing ? 'bg-white dark:bg-slate-900/60 border-2 border-brand/40' : 'bg-slate-50 dark:bg-slate-700/30'}`}>
                  {editing ? (
                    <div className="space-y-2">
                      <Field label="Company" value={editContact?.company} editing onChange={v => updateContact('company', v)} />
                      <Field label="Contact name" value={editContact?.contact} editing onChange={v => updateContact('contact', v)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Phone" value={editContact?.phone} editing onChange={v => updateContact('phone', v)} type="tel" />
                        <Field label="Email" value={editContact?.email} editing onChange={v => updateContact('email', v)} type="email" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-base">{order.customer.company}</p>
                      {order.customer.contact && <p className="text-sm text-slate-600 dark:text-slate-300">{order.customer.contact}</p>}
                      {order.customer.phone && (
                        <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600">
                          <Phone size={13} className="text-slate-400" /> {order.customer.phone}
                        </a>
                      )}
                      {order.customer.email && (
                        <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600">
                          <Mail size={13} className="text-slate-400" /> {order.customer.email}
                        </a>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Address */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Delivery Address</h3>
                <div className={`rounded-xl p-4 ${editing ? 'bg-white dark:bg-slate-900/60 border-2 border-brand/40' : 'bg-slate-50 dark:bg-slate-700/30'}`}>
                  {editing && editAddress ? (
                    <div className="space-y-2">
                      <Field label="Street" value={editAddress.street} editing onChange={v => updateAddr('street', v)} />
                      <Field label="Suburb" value={editAddress.suburb} editing onChange={v => updateAddr('suburb', v)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="City" value={editAddress.city} editing onChange={v => updateAddr('city', v)} />
                        <Field label="Province" value={editAddress.province} editing onChange={v => updateAddr('province', v)} />
                      </div>
                      <Field label="Postal Code" value={editAddress.postalCode} editing onChange={v => updateAddr('postalCode', v)} />
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2.5">
                        <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
                          <p>{order.address.street}</p>
                          {order.address.suburb && <p>{order.address.suburb}</p>}
                          <p>{order.address.city}, {order.address.province} {order.address.postalCode}</p>
                        </div>
                      </div>
                      <a href={`https://maps.google.com/?q=${encodeURIComponent([order.address.street, order.address.city, order.address.province].join(', '))}`}
                        target="_blank" rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        <ExternalLink size={11} /> Open in Google Maps
                      </a>
                    </>
                  )}
                </div>
              </section>

              {/* Items */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Items</h3>
                  {editing && (
                    <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800">
                      <Plus size={12} /> Add item
                    </button>
                  )}
                </div>
                <div className={`rounded-xl overflow-hidden ${editing ? 'border-2 border-brand/40' : 'bg-slate-50 dark:bg-slate-700/30'}`}>
                  {items.length === 0 ? (
                    <p className="text-sm text-slate-400 p-4 text-center">No items</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={`border-b ${editing ? 'border-brand/20 bg-brand/5' : 'border-slate-200 dark:border-slate-600'}`}>
                          {['SKU', 'H', 'W', 'L', 'KG', 'QTY', ...(editing ? [''] : [])].map(h => (
                            <th key={h} className="px-2 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {items.map((item, i) => (
                          <tr key={i} className={editing ? 'bg-white dark:bg-slate-900' : ''}>
                            {editing ? (
                              <>
                                {['sku','h','w','l','kg','qty'].map(field => (
                                  <td key={field} className="px-1 py-1.5">
                                    <input
                                      type={field === 'sku' ? 'text' : 'number'}
                                      value={item[field]}
                                      onChange={e => updateItem(i, field, field === 'sku' ? e.target.value : Number(e.target.value))}
                                      className="w-full min-w-0 px-1.5 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand text-xs"
                                      style={{ width: field === 'sku' ? '80px' : '50px' }}
                                    />
                                  </td>
                                ))}
                                <td className="px-1 py-1.5">
                                  <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-0.5">
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                                  <div className="flex items-center gap-1.5"><Package size={11} className="text-slate-400" /> {item.sku}</div>
                                </td>
                                {['h','w','l','kg','qty'].map(f => (
                                  <td key={f} className="px-3 py-2 text-slate-600 dark:text-slate-400">{item[f]}</td>
                                ))}
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* Quotes */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Quotes</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[{ key: 'TCG', value: order.tcgQuote, rf: 'tcgRefresh' }, { key: 'EPX', value: order.epxQuote, rf: 'epxRefresh' }].map(({ key, value, rf }) => (
                    <div key={key} className={`rounded-xl border p-3.5 ${cheaper === key ? 'border-brand' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40'}`}
                      style={cheaper === key ? { backgroundColor: 'rgba(254,205,40,0.1)' } : {}}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{key}</span>
                        {cheaper === key && <span className="text-xs font-bold text-[#111111] rounded-full px-2 py-0.5" style={{ backgroundColor: '#FECD28' }}>Cheapest</span>}
                      </div>
                      <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {fmt(value) ?? <span className="text-slate-300 dark:text-slate-600 text-base">No quote</span>}
                      </p>
                      {canEdit && !terminal && (
                        <button onClick={() => onUpdate({ [rf]: true })}
                          className="mt-2.5 flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400">
                          <RefreshCw size={11} /> Refresh
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Actions */}
              {canEdit && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Actions</h3>
                  <div className={`rounded-xl border p-4 space-y-4 ${terminal ? 'opacity-70' : ''} bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-600`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Selected Courier</p>
                        <p className="text-xs text-slate-400 mt-0.5">Which courier to book with</p>
                      </div>
                      <select value={order.selectedCourier} onChange={e => onUpdate({ selectedCourier: e.target.value })} disabled={terminal}
                        className={`text-sm font-semibold border rounded-lg px-3 py-1.5 focus:outline-none dark:bg-slate-800 dark:text-slate-100
                          ${order.selectedCourier ? COURIER_COLORS[order.selectedCourier] || 'border-slate-200' : 'border-slate-200 dark:border-slate-600 text-slate-400'}
                          ${terminal ? 'cursor-not-allowed' : ''}`}>
                        <option value="">Select courier…</option>
                        <option value="TCG">TCG</option>
                        <option value="EPX">EPX</option>
                        <option value="Triangle">Triangle</option>
                      </select>
                    </div>
                    <hr className="border-slate-100 dark:border-slate-700" />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Approved</p>
                        <p className="text-xs text-slate-400 mt-0.5">Authorise this shipment</p>
                      </div>
                      <Toggle checked={order.approved} onChange={v => onUpdate({ approved: v })} disabled={terminal} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${!order.approved ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>Buy Label</p>
                        <p className="text-xs text-slate-400 mt-0.5">{!order.approved ? 'Approve first' : 'Trigger waybill booking'}</p>
                      </div>
                      <Toggle checked={order.buyLabel} onChange={v => onUpdate({ buyLabel: v })} disabled={terminal || !order.approved} />
                    </div>
                  </div>
                </section>
              )}

              {/* Waybill */}
              {(order.waybillNo || order.waybillLink || order.epxLabels) && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Waybill</h3>
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 space-y-3">
                    {order.waybillNo && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Waybill No</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{order.waybillNo}</span>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {order.waybillLink && (
                        <a href={order.waybillLink} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5">
                          <ExternalLink size={12} /> Open Waybill
                        </a>
                      )}
                      {order.epxLabels && (
                        <a href={order.epxLabels} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm text-orange-600 dark:text-orange-400 font-medium hover:underline bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-1.5">
                          <ExternalLink size={12} /> EPX Labels
                        </a>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Delete */}
              {canEdit && onDelete && !editing && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Danger Zone</h3>
                  <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-4">
                    {confirmDelete ? (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm text-red-700 dark:text-red-400">Delete {order.psNo}? This can't be undone.</p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { onDelete(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700">
                            <Trash2 size={13} /> Delete
                          </button>
                          <button onClick={() => setConfirmDelete(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Delete picking slip</p>
                          <p className="text-xs text-slate-400 mt-0.5">Remove this order from the dashboard</p>
                        </div>
                        <button onClick={() => setConfirmDelete(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}

            </div>
          </div>
        </>)}
      </div>
    </>
  )
}
