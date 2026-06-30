import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

const PROCESSES_ID = 'page_processes'
const PROCESSES_CONTENT = `# CabGlass Courier User Guide

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

async function seedIfNeeded(index) {
  if (index.some(p => p.id === PROCESSES_ID)) return index
  const processesMeta = {
    id: PROCESSES_ID, title: 'Processes', parentId: null, locked: true,
    viewRoles: [], editRoles: ['admin'], updatedAt: new Date().toISOString(),
    updatedBy: 'system', order: 0,
  }
  const newIndex = [processesMeta, ...index]
  await redis.set('wiki:index', newIndex)
  await redis.set(`wiki:page:${PROCESSES_ID}`, PROCESSES_CONTENT)
  return newIndex
}

function json(res, data, status = 200) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(data)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const { action, id } = req.query

      if (action === 'getPages') {
        let index = await redis.get('wiki:index') || []
        index = await seedIfNeeded(index)
        return json(res, { ok: true, pages: index })
      }

      if (action === 'getPage' && id) {
        const content = await redis.get(`wiki:page:${id}`) || ''
        return json(res, { ok: true, content })
      }

      return json(res, { ok: false, error: 'Unknown action' }, 400)
    }

    if (req.method === 'POST') {
      const body = req.body
      const { action } = body

      if (action === 'savePage') {
        const { id, title, content, parentId, isFolder, locked, viewRoles, editRoles, viewUsers, editUsers, updatedBy } = body
        const pageId = id || `page_${Date.now()}`
        let index = await redis.get('wiki:index') || []

        const existing = index.find(p => p.id === pageId)
        const meta = {
          ...(existing || {}),
          id: pageId,
          title: title !== undefined ? (title || 'Untitled') : (existing?.title || 'Untitled'),
          parentId: parentId !== undefined ? (parentId || null) : (existing?.parentId || null),
          isFolder: isFolder !== undefined ? (isFolder || false) : (existing?.isFolder || false),
          locked: locked !== undefined ? (locked || false) : (existing?.locked || false),
          viewRoles: viewRoles !== undefined ? viewRoles : (existing?.viewRoles || []),
          editRoles: editRoles !== undefined ? editRoles : (existing?.editRoles || ['admin']),
          viewUsers: viewUsers !== undefined ? viewUsers : (existing?.viewUsers || []),
          editUsers: editUsers !== undefined ? editUsers : (existing?.editUsers || []),
          updatedAt: updatedBy !== undefined ? new Date().toISOString() : (existing?.updatedAt || new Date().toISOString()),
          updatedBy: updatedBy !== undefined ? updatedBy : (existing?.updatedBy || ''),
          order: body.order !== undefined ? body.order : (existing?.order ?? index.length),
        }

        if (existing) {
          index = index.map(p => p.id === pageId ? meta : p)
        } else {
          index.push(meta)
        }

        await redis.set('wiki:index', index)
        if (content !== undefined) {
          await redis.set(`wiki:page:${pageId}`, content)
        }
        return json(res, { ok: true, page: meta })
      }

      if (action === 'deletePage') {
        const { id } = body
        let index = await redis.get('wiki:index') || []
        const page = index.find(p => p.id === id)
        if (page?.locked) return json(res, { ok: false, error: 'Page is locked' }, 403)
        index = index.filter(p => p.id !== id && p.parentId !== id)
        await redis.set('wiki:index', index)
        await redis.del(`wiki:page:${id}`)
        return json(res, { ok: true })
      }

      if (action === 'uploadImage') {
        const { fileName, fileData, mimeType } = body
        if (!fileName || !fileData) return json(res, { ok: false, error: 'Missing file data' }, 400)
        // Store image as base64 in Redis with a unique key
        const imageId = `img_${Date.now()}`
        await redis.set(`wiki:img:${imageId}`, { fileName, mimeType, data: fileData })
        const url = `/api/wiki-image?id=${imageId}`
        return json(res, { ok: true, url })
      }

      return json(res, { ok: false, error: 'Unknown action' }, 400)
    }

    return json(res, { ok: false, error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Wiki API error:', err)
    return json(res, { ok: false, error: String(err) }, 500)
  }
}
