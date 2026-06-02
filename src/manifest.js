import { STATUS } from './mockData'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function itemsText(items) {
  if (!items?.length) return '—'
  return items.map(it => `${esc(it.sku)} ×${it.qty}`).join('<br>')
}
function dimsText(items) {
  if (!items?.length) return '—'
  return items.map(it => `${it.h}×${it.w}×${it.l}cm, ${it.kg}kg`).join('<br>')
}
const parcels = (o) => o.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
const weight  = (o) => o.items.reduce((s, it) => s + (Number(it.kg) || 0) * (Number(it.qty) || 0), 0)

// courier: 'TCG' | 'EPX' | 'ALL'
export function openManifest(orders, history, courier) {
  const booked = [...(orders || []), ...(history || [])].filter(o => o.status === STATUS.BOOKED)
  const rows = courier === 'ALL' ? booked : booked.filter(o => o.selectedCourier === courier)

  const dateStr = new Date().toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'short' })
  const title = courier === 'ALL' ? 'Combined Dispatch Manifest' : `${courier} Dispatch Manifest`

  // Group by courier when ALL
  const groups = courier === 'ALL'
    ? ['TCG', 'EPX', 'Triangle'].map(c => ({ name: c, items: rows.filter(o => o.selectedCourier === c) })).filter(g => g.items.length)
    : [{ name: courier, items: rows }]

  const sectionHtml = (g) => {
    const secParcels = g.items.reduce((s, o) => s + parcels(o), 0)
    const secWeight = g.items.reduce((s, o) => s + weight(o), 0)
    return `
    <h2>${esc(g.name)} — ${g.items.length} shipment${g.items.length !== 1 ? 's' : ''}</h2>
    <table>
      <thead>
        <tr>
          <th>PS No</th><th>Customer</th><th>Destination</th>
          <th>Parts (SKU × qty)</th><th>Dimensions / Weight</th>
          <th>Parcels</th><th>Total kg</th><th>Waybill</th><th>Dispatched</th>
        </tr>
      </thead>
      <tbody>
        ${g.items.map(o => `
          <tr>
            <td><strong>${esc(o.psNo)}</strong></td>
            <td>${esc(o.customer.company)}${o.customer.contact ? '<br><span class="sub">' + esc(o.customer.contact) + '</span>' : ''}${o.customer.phone ? '<br><span class="sub">' + esc(o.customer.phone) + '</span>' : ''}</td>
            <td>${esc(o.address.street)}<br>${esc(o.address.city)}, ${esc(o.address.province)} ${esc(o.address.postalCode)}</td>
            <td>${itemsText(o.items)}</td>
            <td class="sub">${dimsText(o.items)}</td>
            <td class="center">${parcels(o)}</td>
            <td class="center">${weight(o).toFixed(1)}</td>
            <td>${esc(o.waybillNo) || '—'}</td>
            <td class="center">☐</td>
          </tr>
        `).join('')}
        <tr class="subtotal">
          <td colspan="5" style="text-align:right">${esc(g.name)} total:</td>
          <td class="center">${secParcels}</td>
          <td class="center">${secWeight.toFixed(1)}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
  `
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Arial, sans-serif; color: #111; margin: 24px; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #FECD28; padding-bottom:12px; margin-bottom:16px; }
    .brand { font-size:22px; font-weight:800; }
    .brand span { color:#E5B800; }
    h1 { font-size:18px; margin:4px 0 0; }
    .meta { text-align:right; font-size:12px; color:#555; }
    h2 { font-size:14px; background:#FECD28; padding:6px 10px; border-radius:4px; margin:20px 0 8px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th { background:#f4f4f4; text-align:left; padding:6px; border:1px solid #ddd; font-size:10px; text-transform:uppercase; letter-spacing:.03em; }
    td { padding:6px; border:1px solid #ddd; vertical-align:top; }
    .sub { color:#666; font-size:10px; }
    .center { text-align:center; }
    .note { background:#fff8e1; font-style:italic; color:#8a6d00; }
    .subtotal td { background:#f9f9f9; font-weight:700; }
    .total { margin-top:10px; font-size:12px; font-weight:600; }
    .empty { color:#999; padding:20px; text-align:center; }
    @media print { body { margin:10px; } .noprint { display:none; } }
    .btn { background:#FECD28; border:none; padding:8px 16px; border-radius:6px; font-weight:700; cursor:pointer; }
  </style></head><body>
    <div class="head">
      <div><div class="brand">cab<span>glass</span>.co.za</div><h1>${esc(title)}</h1></div>
      <div class="meta">${esc(dateStr)}<br>${rows.length} shipment${rows.length !== 1 ? 's' : ''} total</div>
    </div>
    <div class="noprint" style="margin-bottom:16px"><button class="btn" onclick="window.print()">Print this manifest</button></div>
    ${rows.length === 0 ? '<p class="empty">No booked shipments to manifest.</p>' : groups.map(sectionHtml).join('')}
    <p class="total" style="font-size:14px;border-top:2px solid #FECD28;padding-top:8px">
      Grand total — ${rows.length} shipment${rows.length !== 1 ? 's' : ''}, ${rows.reduce((s, o) => s + parcels(o), 0)} parcels, ${rows.reduce((s, o) => s + weight(o), 0).toFixed(1)} kg
    </p>
  </body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('Please allow pop-ups to open the manifest.'); return }
  w.document.write(html)
  w.document.close()
}
