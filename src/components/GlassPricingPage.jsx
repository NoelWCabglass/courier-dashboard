import { useState, useEffect, useMemo } from 'react'
import { Calculator, Pencil, Check, RotateCcw, Printer, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchGlassPricing, saveGlassPricing, LIVE } from '../api'

const DEFAULT_PRICING = {
  flat_tough: [
    { from: 0, to: 1000, pct: 80 }, { from: 1000, to: 3000, pct: 65 },
    { from: 3000, to: 7000, pct: 50 }, { from: 7000, to: 15000, pct: 40 },
    { from: 15000, to: 30000, pct: 32 }, { from: 30000, to: 1e9, pct: 25 },
  ],
  curved_tough: [
    { from: 0, to: 1000, pct: 90 }, { from: 1000, to: 3000, pct: 75 },
    { from: 3000, to: 7000, pct: 60 }, { from: 7000, to: 15000, pct: 48 },
    { from: 15000, to: 30000, pct: 38 }, { from: 30000, to: 1e9, pct: 28 },
  ],
  laminated: [
    { from: 0, to: 1000, pct: 100 }, { from: 1000, to: 3000, pct: 85 },
    { from: 3000, to: 7000, pct: 70 }, { from: 7000, to: 15000, pct: 55 },
    { from: 15000, to: 30000, pct: 42 }, { from: 30000, to: 1e9, pct: 32 },
  ],
}

const TYPE_LABELS = { flat_tough: 'Flat toughened', curved_tough: 'Curved toughened', laminated: 'Laminated' }
const TYPE_COLORS = {
  flat_tough:   'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  curved_tough: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  laminated:    'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
}
const GLASS_DENSITY = { flat_tough: 2500, curved_tough: 2500, laminated: 2600 } // kg/m³

const fmtR = (n) => 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (n) => Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 })
const r = (n, d = 2) => +Number(n).toFixed(d)

// ── Core calculation (dimensions in cm; converts to mm internally) ──
function computeAll({ glassType, shipType, lenCm, widCm, thkCm, glassWt, cost, rkg, rvol, tiers }) {
  const Lc = +lenCm || 0, Wc = +widCm || 0, Tc = +thkCm || 0, c = +cost || 0
  const Lmm = Lc * 10, Wmm = Wc * 10, Tmm = Tc * 10
  const isLam = glassType === 'laminated'
  const isZero = shipType === 'zero'
  const legs = shipType === 'double' ? 2 : 1
  const gw = +glassWt || 0

  let pkgL, pkgW, pkgH, pkgWt, crate = null

  if (isLam) {
    const plyDensity_mm3 = 5.0926e-7, plyThk = 18, breadth = 150, slatW = 150, numSlats = 2, J1 = 40
    const longL = Lmm + J1
    const longKg = longL * breadth * plyThk * plyDensity_mm3 * 2
    const shortKg = Wmm * breadth * plyThk * plyDensity_mm3 * 2
    const slatKg = slatW * Wmm * plyThk * plyDensity_mm3 * numSlats
    const crateWt = r(longKg + shortKg + slatKg, 3)
    pkgWt = r(gw + crateWt, 2)
    pkgL = r((Lmm + J1) / 10, 1)
    pkgW = r(breadth / 10, 1)
    pkgH = r((Wmm + J1) / 10, 1)
    crate = {
      crateWt,
      cuts: [
        { label: 'Long side boards', dim: `${longL} × ${breadth} mm`, qty: 2 },
        { label: 'Short side boards', dim: `${Wmm} × ${breadth} mm`, qty: 2 },
        { label: 'Base / cross slats', dim: `${slatW} × ${Wmm} mm`, qty: numSlats },
      ],
    }
  } else {
    const pad = 30
    pkgL = r((Lmm + pad) / 10, 1)
    pkgW = r((Wmm + pad) / 10, 1)
    pkgH = r(30 / 10, 1)
    pkgWt = gw
  }

  const volCm3 = r(pkgL * pkgW * pkgH, 0)
  const volWtKg = r(volCm3 / 5000, 1)
  const billableWt = Math.max(pkgWt, volWtKg)
  const isByVol = volWtKg > pkgWt

  const shipPerLeg = isByVol ? (volCm3 / 1000) * rvol : billableWt * rkg
  const indicativeShip = r(Math.max(shipPerLeg * legs, 200), 2)
  const totalShip = isZero ? 0 : indicativeShip

  let activeTier = tiers[tiers.length - 1] || { from: 0, to: 1e9, pct: 0 }
  for (const t of tiers) { if (c >= t.from && c < t.to) { activeTier = t; break } }
  const markupAmt = r(c * (activeTier.pct / 100), 2)
  const sellPrice = r(c + markupAmt, 2)
  const totalSell = r(sellPrice + totalShip, 2)
  const gpPct = totalSell > 0 ? r(markupAmt / totalSell * 100, 1) : 0
  const multiplier = c > 0 ? r(totalSell / c, 2) : 0

  return {
    isLam, isZero, legs, pkgL, pkgW, pkgH, pkgWt, volCm3, volWtKg, billableWt, isByVol,
    indicativeShip, totalShip, activeTier, markupAmt, sellPrice, totalSell, gpPct, multiplier, gw,
    crate, Lc, Wc, Tc,
  }
}

// ── Print sheets (open in a clean new window) ──
const PRINT_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color:#000; padding:20mm; font-size:11pt; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2.5px solid #000; padding-bottom:8pt; margin-bottom:16pt; }
  .title { font-size:16pt; font-weight:700; } .sub { font-size:9pt; color:#555; margin-top:3pt; }
  .meta { font-size:9pt; text-align:right; color:#333; line-height:1.8; }
  .brand { font-size:20pt; font-weight:800; letter-spacing:-.02em; color:#111; }
  .stitle { font-size:8pt; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#555; margin:14pt 0 6pt; border-bottom:1px solid #ccc; padding-bottom:3pt; }
  table { width:100%; border-collapse:collapse; font-size:11pt; margin-bottom:4pt; }
  th { text-align:left; padding:5pt 8pt; background:#f0f0f0; border:1px solid #ccc; font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
  td { padding:8pt; border:1px solid #ddd; vertical-align:middle; }
  tr:nth-child(even) td { background:#fafafa; }
  .right { text-align:right; }
  .total td { background:#1A1814 !important; color:#fff !important; font-weight:700; font-size:12pt; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .subtotal td { background:#f5f3ee !important; font-weight:600; }
  .cbox { width:11pt; height:11pt; border:1.5px solid #333; display:inline-block; }
  .totals { margin-top:10pt; display:flex; gap:24pt; flex-wrap:wrap; font-size:10pt; }
  .validity { margin-top:14pt; padding:10pt 12pt; border:1pt solid #ccc; border-radius:4pt; font-size:10pt; background:#fafafa; }
  .validity strong { display:block; margin-bottom:4pt; font-size:11pt; }
  .sign { margin-top:24pt; display:grid; grid-template-columns:1fr 1fr; gap:30pt; }
  .signline { border-top:1pt solid #000; padding-top:4pt; font-size:9pt; color:#555; margin-top:30pt; }
  .foot { margin-top:20pt; padding-top:8pt; border-top:1px solid #ccc; font-size:8pt; color:#888; display:flex; justify-content:space-between; }
`
function brandHeader(rightMeta) {
  const logo = `${window.location.origin}/Cabglass_logo_PNG.avif`
  return `
    <div class="hdr">
      <div style="display:flex;align-items:center;gap:12pt">
        <img src="${logo}" alt="CabGlass" style="height:34pt;width:auto" onerror="this.style.display='none'">
        <div><div class="brand">CabGlass</div><div class="sub">Agricultural &amp; Construction Machine Glazing</div></div>
      </div>
      <div class="meta">${rightMeta}</div>
    </div>`
}

function openPrint(title, bodyHtml) {
  const w = window.open('', '_blank')
  if (!w) { alert('Pop-up blocked — allow pop-ups to print.'); return }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => w.print(), 350)
}

export default function GlassPricingPage() {
  const { perm } = useAuth()
  const canEdit = perm('pricing', 'edit')

  const [pricing, setPricing] = useState(DEFAULT_PRICING)
  const [glassType, setGlassType] = useState('flat_tough')
  const [shipType, setShipType] = useState('single')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [len, setLen] = useState(120)
  const [wid, setWid] = useState(60)
  const [thk, setThk] = useState(0.6)
  const [cost, setCost] = useState(3500)
  const [rkg, setRkg] = useState(18)
  const [rvol, setRvol] = useState(12)

  const [weightOverride, setWeightOverride] = useState(false)
  const [manualWt, setManualWt] = useState('')

  useEffect(() => {
    if (!LIVE) return
    fetchGlassPricing().then(p => { if (p) setPricing(p) }).catch(err => console.error('Load glass pricing failed:', err))
  }, [])

  const tiers = pricing[glassType] || []
  const isLam = glassType === 'laminated'

  // Auto weight from dims + density (cm → m³)
  const autoWt = useMemo(() => {
    const vol = (len / 100) * (wid / 100) * (thk / 100)
    return r(vol * GLASS_DENSITY[glassType], 2)
  }, [len, wid, thk, glassType])

  const glassWt = weightOverride ? (+manualWt || 0) : autoWt

  const calc = useMemo(
    () => computeAll({ glassType, shipType, lenCm: len, widCm: wid, thkCm: thk, glassWt, cost, rkg, rvol, tiers }),
    [glassType, shipType, len, wid, thk, glassWt, cost, rkg, rvol, tiers]
  )

  const updateTierPct = (idx, value) =>
    setPricing(prev => ({ ...prev, [glassType]: prev[glassType].map((t, i) => i === idx ? { ...t, pct: +value } : t) }))

  const saveTiers = async () => {
    setSaving(true)
    try { if (LIVE) await saveGlassPricing(pricing); setEditing(false) }
    catch (err) { alert('Save failed: ' + err.message) }
    finally { setSaving(false) }
  }
  const resetTiers = () => setPricing(prev => ({ ...prev, [glassType]: DEFAULT_PRICING[glassType].map(t => ({ ...t })) }))

  // ── Print builders ──
  const printDate = () => new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })

  const printCuttingList = () => {
    if (!calc.crate) return
    const d = printDate()
    const rows = calc.crate.cuts.map(cut => {
      const [a, b] = cut.dim.replace(' mm', '').split('×').map(s => s.trim())
      return `<tr><td style="text-align:center"><span class="cbox"></span></td><td>${cut.label}</td><td><strong>${a}</strong></td><td><strong>${b}</strong></td><td>18 mm</td><td style="text-align:center"><strong>${cut.qty}</strong></td></tr>`
    }).join('')
    openPrint('Crate Cutting List', `
      ${brandHeader(`Crate Cutting List<br>Date: ${d}<br>Glass: Laminated · ${calc.Lc} × ${calc.Wc} × ${calc.Tc} cm · ${calc.gw.toFixed(2)} kg`)}
      <div class="stitle">Crate external dimensions</div>
      <table><tbody>
        <tr><td>Length</td><td><strong>${calc.pkgL} cm</strong></td><td>Depth (breadth)</td><td><strong>${calc.pkgW} cm</strong></td><td>Height</td><td><strong>${calc.pkgH} cm</strong></td></tr>
      </tbody></table>
      <div class="stitle">Cutting list — 18mm shutterply</div>
      <table>
        <thead><tr><th>✓</th><th>Piece</th><th>Length (mm)</th><th>Width (mm)</th><th>Thickness</th><th>Qty</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div>Crate timber: <strong>${calc.crate.crateWt.toFixed(2)} kg</strong></div>
        <div>Glass: <strong>${calc.gw.toFixed(2)} kg</strong></div>
        <div>Total packed: <strong>${calc.pkgWt.toFixed(2)} kg</strong></div>
        <div>Billed freight: <strong>${calc.billableWt.toFixed(1)} kg</strong></div>
      </div>
      <div class="foot"><span>Glass Pricing Calculator — Internal use only</span><span>Printed ${d}</span></div>
    `)
  }

  const printQuote = () => {
    const d = printDate()
    const typeLabel = TYPE_LABELS[glassType]
    const shipLabel = calc.isZero ? 'Supplier delivers direct' : calc.legs === 2 ? 'Double shipment (agent → depot → customer)' : 'Single shipment'
    const packLabel = isLam ? `Timber crate — ${calc.pkgL}×${calc.pkgW}×${calc.pkgH} cm` : `Aerothene edge wrap (flat) — ${calc.pkgL}×${calc.pkgW}×${calc.pkgH} cm`
    const shipRow = calc.isZero
      ? `<tr><td>Shipping &amp; freight</td><td>Supplier delivers direct</td><td class="right"><strong style="color:#2D7A4F">No charge</strong></td></tr>`
      : `<tr><td>Shipping &amp; freight</td><td>${shipLabel} · billed on ${calc.isByVol ? 'volumetric' : 'actual'} weight (${calc.billableWt.toFixed(1)} kg)</td><td class="right">${fmtR(calc.totalShip)}</td></tr>`
    const vat = r(calc.totalSell * 0.15, 2)
    const incl = r(calc.totalSell * 1.15, 2)
    openPrint('Internal Pricing Sheet', `
      ${brandHeader(`Internal Pricing Sheet<br>Date: ${d}`)}
      <div class="stitle">Glass specification</div>
      <table><tbody>
        <tr><td>Glass type</td><td><strong>${typeLabel}</strong></td></tr>
        <tr><td>Dimensions (L × W × T)</td><td><strong>${calc.Lc} × ${calc.Wc} × ${calc.Tc} cm</strong></td></tr>
        <tr><td>Glass weight</td><td>${calc.gw.toFixed(2)} kg</td></tr>
      </tbody></table>
      <div class="stitle">Packaging</div>
      <table><tbody>
        <tr><td>Pack method</td><td>${isLam ? '18mm shutterply timber crate, 150mm breadth' : 'Aerothene (bubble-wrap) edge protection, laid flat'}</td></tr>
        <tr><td>Packed dimensions</td><td>${packLabel}</td></tr>
        <tr><td>Total packed weight</td><td>${calc.pkgWt.toFixed(2)} kg</td></tr>
      </tbody></table>
      <div class="stitle">Pricing</div>
      <table>
        <thead><tr><th>Item</th><th>Notes</th><th class="right">Amount (ZAR)</th></tr></thead>
        <tbody>
          <tr><td>Buy-in cost</td><td>Goods excl. freight</td><td class="right">${fmtR(cost)}</td></tr>
          <tr><td>Markup</td><td>${calc.activeTier.pct}% on cost</td><td class="right">${fmtR(calc.markupAmt)}</td></tr>
          <tr><td>Glass — ${typeLabel}</td><td>Selling price (goods)</td><td class="right">${fmtR(calc.sellPrice)}</td></tr>
          ${shipRow}
          <tr class="subtotal"><td colspan="2"><strong>Total (excl. VAT)</strong></td><td class="right"><strong>${fmtR(calc.totalSell)}</strong></td></tr>
          <tr><td colspan="2">VAT @ 15%</td><td class="right">${fmtR(vat)}</td></tr>
          <tr class="total"><td colspan="2">TOTAL (incl. VAT)</td><td class="right">${fmtR(incl)}</td></tr>
        </tbody>
      </table>
      <div class="foot"><span>CabGlass — Internal use only</span><span>Printed ${d}</span></div>
    `)
  }

  const inputCls = "w-full h-10 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#FECD28] focus:ring-1 focus:ring-[#FECD28]/30"
  const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
  const shipBtn = (key, label, active) => (
    <button key={key} onClick={() => setShipType(key)}
      className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg border transition-colors
        ${active ? (key === 'zero' ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700')
          : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calculator size={22} className="text-slate-400" /> Glass Pricing Calculator
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Stepped markup, auto packaging weight & shipping. Markup % steps down as item value rises.</p>
        </div>
        <button onClick={printQuote} style={{ backgroundColor: '#FECD28' }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#111111]">
          <Printer size={15} /> Print pricing sheet
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">

        {/* ── LEFT: inputs ── */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            {/* Glass type */}
            <div>
              <label className={labelCls}>Glass type</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(TYPE_LABELS).map(t => (
                  <button key={t} onClick={() => setGlassType(t)}
                    className={`px-2 py-2 text-xs font-semibold rounded-lg border transition-colors leading-tight
                      ${glassType === t ? TYPE_COLORS[t] : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              {isLam && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  Laminated — an 18mm shutterply crate is included in the packaging.
                </p>
              )}
            </div>

            {/* Dimensions */}
            <div>
              <label className={labelCls}>Glass dimensions (cm)</label>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-[11px] text-slate-400">Length</span><input type="number" step="0.1" className={inputCls} value={len} onChange={e => setLen(e.target.value)} /></div>
                <div><span className="text-[11px] text-slate-400">Width</span><input type="number" step="0.1" className={inputCls} value={wid} onChange={e => setWid(e.target.value)} /></div>
                <div><span className="text-[11px] text-slate-400">Thick</span><input type="number" step="0.1" className={inputCls} value={thk} onChange={e => setThk(e.target.value)} /></div>
              </div>
            </div>

            {/* Weight + cost */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>
                  Glass weight (kg)
                  <button onClick={() => { setWeightOverride(o => !o); if (!weightOverride) setManualWt(String(autoWt)) }}
                    className="ml-2 text-[11px] text-blue-600 dark:text-blue-400 underline font-normal">
                    {weightOverride ? 'use auto' : 'override'}
                  </button>
                </label>
                {weightOverride ? (
                  <input type="number" step="0.1" className={inputCls} value={manualWt} onChange={e => setManualWt(e.target.value)} autoFocus />
                ) : (
                  <div className="relative">
                    <input readOnly value={autoWt}
                      className="w-full h-10 px-3 text-sm rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-semibold" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-green-600 dark:text-green-400">AUTO</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-1">{weightOverride ? 'Manual entry' : 'From dims & density'}</p>
              </div>
              <div>
                <label className={labelCls}>Buy-in cost (ZAR)</label>
                <input type="number" className={inputCls} value={cost} onChange={e => setCost(e.target.value)} />
                <p className="text-[11px] text-slate-400 mt-1">Excluding shipping</p>
              </div>
            </div>
          </div>

          {/* Shipment */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-2">
            <label className={labelCls}>Shipment</label>
            {shipBtn('single', 'Single — agent to us, we deliver', shipType === 'single')}
            {shipBtn('double', 'Double — agent → depot → customer', shipType === 'double')}
            {shipBtn('zero', 'Supplier delivers direct — no cost', shipType === 'zero')}
            <div className={`grid grid-cols-2 gap-2 pt-2 ${shipType === 'zero' ? 'opacity-40 pointer-events-none' : ''}`}>
              <div><span className="text-[11px] text-slate-400">Rate per kg</span><input type="number" step="0.5" className={inputCls} value={rkg} onChange={e => setRkg(e.target.value)} /></div>
              <div><span className="text-[11px] text-slate-400">Rate per 1 000 cm³</span><input type="number" step="0.5" className={inputCls} value={rvol} onChange={e => setRvol(e.target.value)} /></div>
            </div>
            <p className="text-[11px] text-slate-400">Billed on greater of actual vs volumetric (cm³ ÷ 5 000). Min R 200/leg.</p>
          </div>

          {/* Tier table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{TYPE_LABELS[glassType]} markup tiers</h3>
              {canEdit && !editing && (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="text-left font-semibold pb-2">Cost range</th>
                  <th className="text-right font-semibold pb-2">Markup</th>
                  <th className="text-right font-semibold pb-2">GP %</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => {
                  const gp = r(t.pct / (1 + t.pct / 100), 1)
                  const active = t === calc.activeTier
                  return (
                    <tr key={i} className={`border-t border-slate-100 dark:border-slate-700 ${active ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                      <td className={`py-2 ${active ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
                        R {t.from === 0 ? '0' : fmt(t.from)} – {t.to >= 1e9 ? 'no limit' : 'R ' + fmt(t.to)}
                      </td>
                      <td className="py-2 text-right">
                        {editing ? (
                          <input type="number" value={t.pct} onChange={e => updateTierPct(i, e.target.value)}
                            className="w-16 h-8 px-2 text-sm text-right border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                        ) : (
                          <span className={active ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-slate-700 dark:text-slate-200'}>{t.pct}%</span>
                        )}
                      </td>
                      <td className={`py-2 text-right ${active ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>{gp}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {editing && (
              <div className="flex items-center gap-2 mt-3">
                <button onClick={saveTiers} disabled={saving} style={{ backgroundColor: '#FECD28' }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#111111] disabled:opacity-50">
                  <Check size={13} /> {saving ? 'Saving…' : 'Save tiers'}
                </button>
                <button onClick={() => { setEditing(false); if (LIVE) fetchGlassPricing().then(p => p && setPricing(p)) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                  Cancel
                </button>
                <button onClick={resetTiers} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 ml-auto">
                  <RotateCcw size={12} /> Reset to default
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: results ── */}
        <div className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Buy-in cost</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">{fmtR(cost)}</p>
              <p className="text-xs text-slate-400 mt-1">Goods excl. freight</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Shipping</p>
              <p className={`text-base font-bold ${calc.isZero ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-slate-100'}`}>{calc.isZero ? 'None' : fmtR(calc.totalShip)}</p>
              <p className="text-xs text-slate-400 mt-1">{calc.isZero ? 'Supplier direct' : `${calc.legs} leg${calc.legs > 1 ? 's' : ''}, ${calc.isByVol ? 'vol' : 'actual'} wt`}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-green-500 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Gross profit</p>
              <p className="text-base font-bold text-green-600 dark:text-green-400">{calc.gpPct}%</p>
              <p className="text-xs text-slate-400 mt-1">Margin on sell</p>
            </div>
            <div className="bg-[#111111] rounded-2xl p-4">
              <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Total to customer</p>
              <p className="text-base font-bold text-white">{fmtR(calc.totalSell)}</p>
              <p className="text-xs text-white/45 mt-1">{calc.multiplier}× buy-in</p>
            </div>
          </div>

          {/* Price build-up */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Price build-up</h3>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${TYPE_COLORS[glassType]}`}>{TYPE_LABELS[glassType]}</span>
            </div>
            <div className="px-5">
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm text-slate-500 dark:text-slate-400">Buy-in cost</span>
                <span className="text-sm text-slate-600 dark:text-slate-300">{fmtR(cost)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Markup <strong className="text-slate-700 dark:text-slate-200">{calc.activeTier.pct}%</strong> on cost</span>
                  <span className="block text-xs text-slate-400 mt-0.5">Active tier: R {fmt(calc.activeTier.from)} – {calc.activeTier.to >= 1e9 ? 'no limit' : 'R ' + fmt(calc.activeTier.to)}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fmtR(calc.markupAmt)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 -mx-5 px-5">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Goods selling price</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmtR(calc.sellPrice)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Shipping estimate {calc.isZero && <span className="text-xs text-green-600 dark:text-green-400">(supplier direct)</span>}</span>
                  {!calc.isZero && <span className="block text-xs text-slate-400 mt-0.5">{calc.legs} leg{calc.legs > 1 ? 's' : ''} · billed on {calc.isByVol ? 'volumetric' : 'actual'} weight ({calc.billableWt.toFixed(1)} kg)</span>}
                </div>
                <span className={`text-sm font-semibold ${calc.isZero ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>{calc.isZero ? 'R 0.00' : fmtR(calc.totalShip)}</span>
              </div>
              <div className="flex justify-between items-center py-3.5 bg-slate-50 dark:bg-slate-900/40 -mx-5 px-5">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Total to customer</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{fmtR(calc.totalSell)}</span>
              </div>
            </div>
          </div>

          {/* Packaging */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Packaging simulation</h3>
              {isLam && calc.crate && (
                <button onClick={printCuttingList} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <FileText size={12} /> Print cutting list
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Pack size (cm)', `${calc.pkgL} × ${calc.pkgW} × ${calc.pkgH}`],
                ['Total packed weight', `${calc.pkgWt.toFixed(1)} kg`],
                ['Billed weight', `${calc.billableWt.toFixed(1)} kg ${calc.isByVol ? '(vol)' : '(actual)'}`],
                ['Glass weight', `${calc.gw.toFixed(2)} kg`],
                ['Vol weight', `${calc.volWtKg.toFixed(1)} kg`],
                ['Volume', `${(calc.volCm3 / 1e6).toFixed(3)} m³`],
              ].map(([label, val]) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                  <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{val}</p>
                </div>
              ))}
            </div>

            {isLam && calc.crate && (
              <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">18mm Shutterply crate — cutting list <span className="text-amber-600 dark:text-amber-400">(150mm breadth)</span></p>
                <table className="w-full text-xs">
                  <thead><tr className="text-slate-400"><th className="text-left font-medium pb-1">Piece</th><th className="text-left font-medium pb-1">Dimensions (mm)</th><th className="text-right font-medium pb-1">Qty</th></tr></thead>
                  <tbody>
                    {calc.crate.cuts.map((c, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-1.5 text-slate-600 dark:text-slate-300">{c.label}</td>
                        <td className="py-1.5 text-slate-800 dark:text-slate-200 font-medium">{c.dim}</td>
                        <td className="py-1.5 text-right text-slate-800 dark:text-slate-200">{c.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-slate-400 mt-2">Crate timber: <strong className="text-slate-600 dark:text-slate-300">{calc.crate.crateWt.toFixed(2)} kg</strong> · Glass: <strong className="text-slate-600 dark:text-slate-300">{calc.gw.toFixed(2)} kg</strong> · Total packed: <strong className="text-slate-600 dark:text-slate-300">{calc.pkgWt.toFixed(2)} kg</strong></p>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3">
              {isLam ? 'Timber crate + glass. Billed on greater of actual vs volumetric weight.' : 'Aerothene edge protection, laid flat (+3 cm each side, 3 cm breadth). Weight = glass only.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
