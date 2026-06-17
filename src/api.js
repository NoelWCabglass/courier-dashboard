import { API_URL, API_SECRET, LIVE } from './config'

// POST uses text/plain to avoid a CORS preflight — Apps Script can't answer
// the OPTIONS request that an application/json body would trigger. The body is
// still JSON; Apps Script parses e.postData.contents either way.
async function post(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, secret: API_SECRET, ...payload }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Request failed')
  return data
}

// Read orders + history. GET is a "simple" request so no preflight.
export async function fetchOrders() {
  const url = `${API_URL}?action=getOrders&secret=${encodeURIComponent(API_SECRET)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load orders')
  return { orders: data.orders || [], history: data.history || [] }
}

export async function fetchUsers() {
  const url = `${API_URL}?action=getUsers&secret=${encodeURIComponent(API_SECRET)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load users')
  return data.users || []
}

// Server-side activity log (audit trail). Read the most recent entries.
export async function fetchActivity(limit = 200) {
  const url = `${API_URL}?action=getActivity&limit=${limit}&secret=${encodeURIComponent(API_SECRET)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load activity')
  return data.activity || []
}

// Append one entry. `entry` = { user, role, logAction, detail }.
export const logActivity = (entry) => post('logActivity', entry)

export const saveUsers        = (users)              => post('saveUsers', { users })
export const archiveBooked    = ()                   => post('archiveBooked')
export const archiveOrders    = (psNumbers)          => post('archiveOrders', { psNumbers })
export const restoreOrders    = (psNumbers)          => post('restoreOrders', { psNumbers })
export const saveNote         = (psNo, note)         => post('saveNote', { psNo, note })
export const setPacked        = (psNo, packed)       => post('setPacked', { psNo, packed })
export const setStaged        = (psNo, staged)       => post('setStaged', { psNo, staged })
export const setBackOrder     = (psNo, backOrder)    => post('setBackOrder', { psNo, backOrder })
export const updateOrder      = (psNo, changes)      => post('updateOrder', { psNo, changes })
export const deleteOrder      = (psNo)               => post('deleteOrder', { psNo })
export const markDispatched   = (psNo, dispatched)   => post('markDispatched', { psNo, dispatched })
export const uploadPickingSlip = (fileName, fileData) => post('uploadPickingSlip', { fileName, fileData })

// WH Uploads
export async function fetchWHData() {
  const url = `${API_URL}?action=getWHData&secret=${encodeURIComponent(API_SECRET)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load WH data')
  return { categories: data.categories || [], uploads: data.uploads || [] }
}
export const saveWHCategory   = (category)                         => post('saveWHCategory', { category })
export const deleteWHCategory = (categoryId)                       => post('deleteWHCategory', { categoryId })
export const whUpload         = (categoryId, files, uploadedBy, notes, weekKey) =>
  post('whUpload', { categoryId, files, uploadedBy, notes, weekKey })
export const deleteWHUpload   = (uploadId) => post('deleteWHUpload', { uploadId })

// Glass pricing
export async function fetchGlassPricing() {
  const url = `${API_URL}?action=getGlassPricing&secret=${encodeURIComponent(API_SECRET)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load glass pricing')
  return data.pricing
}
export const saveGlassPricing = (pricing) => post('saveGlassPricing', { pricing })

// User Guide (editable help page)
export async function fetchUserGuide() {
  const url = `${API_URL}?action=getUserGuide&secret=${encodeURIComponent(API_SECRET)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load user guide')
  return data.guide
}
// payload may contain { content } and/or { editorUsername }, plus updatedBy
export const saveUserGuide = (payload) => post('saveUserGuide', payload)

export { LIVE }
