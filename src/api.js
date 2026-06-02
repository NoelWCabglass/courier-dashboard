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

export const saveUsers        = (users)              => post('saveUsers', { users })
export const archiveBooked    = ()                   => post('archiveBooked')
export const archiveOrders    = (psNumbers)          => post('archiveOrders', { psNumbers })
export const restoreOrders    = (psNumbers)          => post('restoreOrders', { psNumbers })
export const saveNote         = (psNo, note)         => post('saveNote', { psNo, note })
export const setPacked        = (psNo, packed)       => post('setPacked', { psNo, packed })
export const updateOrder      = (psNo, changes)      => post('updateOrder', { psNo, changes })
export const deleteOrder      = (psNo)               => post('deleteOrder', { psNo })
export const markDispatched   = (psNo, dispatched)   => post('markDispatched', { psNo, dispatched })
export const uploadPickingSlip = (fileName, fileData) => post('uploadPickingSlip', { fileName, fileData })

export { LIVE }
