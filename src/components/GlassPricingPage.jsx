import { useState, useEffect, useMemo } from 'react'
import { Calculator, Pencil, Check, X, RotateCcw } from 'lucide-react'
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

const fmtR = (n) => 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (n) => Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 })
const r = (n, d = 2) => +Number(n).toFixed(d)

export default function GlassPricingPage() {
  const { can } = useAuth()
  const canEdit = can('canAdmin')

  const [pricing, setPricing] = useState(DEFAULT_PRICING)
  const [glassType, setGlassType] = useState('flat_tough')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [len, setLen] = useState(1200)
  const [wid, setWid] = useState(600)
  const [thk, setThk] = useState(6)
  const [gwt, setGwt] = useState(12)
  const [cost, setCost] = useState(3500)

  useEffect(() => {
    if (!LIVE) return
    fetchGlassPricing().then(p => { if (p) setPricing(p) }).catch(err => console.error('Load glass pricing failed:', err))
  }, [])

  const tiers = pricing[glassType] || []
  const isLam = glassType === 'laminated'

  // ── Calculations ──
  const calc = useMemo(() => {
    const L = +len || 0, W = +wid || 0, T = +thk || 0, gw = +gwt || 0, c = +cost || 0

    // Packaging simulation (size + weight reference only — no shipping cost)
    const crateThk = isLam ? 25 : 0
    const padCm = 8
    const pkgL = Math.ceil(L / 10 + padCm * 2 + crateThk * 2 / 10 + (isLam ? 10 : 0))
    const pkgW = Math.ceil(W / 10 + padCm * 2 + crateThk * 2 / 10 + (isLam ? 10 : 0))
    const pkgH = Math.ceil(T / 10 + padCm + (isLam ? 30 : 20) + crateThk * 2 / 10 + (isLam ? 10 : 0))

    const foamDensity = 0.03, crateDensity = 0.6
    let pkgWt = gw
    const foamVol = (pkgL * pkgW * pkgH) / 1000 - (L / 10 * W / 10 * T / 10) / 1000
    pkgWt += foamVol * foamDensity
    if (isLam) {
      const crateWood = 2 * ((pkgL * pkgH + pkgW * pkgH) * crateThk) / 1000
      pkgWt += crateWood * crateDensity
    }
    pkgWt = r(pkgWt, 1)
    const volCm3 = pkgL * pkgW * pkgH

    // Markup
    let activeTier = tiers[tiers.length - 1] || { from: 0, to: 1e9, pct: 0 }
    for (const t of tiers) { if (c >= t.from && c < t.to) { activeTier = t; break } }
    const markupAmt = r(c * (activeTier.pct / 100), 2)
    const sellPrice = r(c + markupAmt, 2)
    const gpPct = sellPrice > 0 ? r(markupAmt / sellPrice * 100, 1) : 0
    const multiplier = c > 0 ? r(sellPrice / c, 2) : 0

    return { pkgL, pkgW, pkgH, pkgWt, volCm3, activeTier, markupAmt, sellPrice, gpPct, multiplier }
  }, [len, wid, thk, gwt, cost, tiers, isLam])

  // ── Tier editing ──
  const updateTierPct = (idx, value) => {
    setPricing(prev => {
      const next = { ...prev, [glassType]: prev[glassType].map((t, i) => i === idx ? { ...t, pct: +value } : t) }
      return next
    })
  }

  const saveTiers = async () => {
    setSaving(true)
    try {
      if (LIVE) await saveGlassPricing(pricing)
      setEditing(false)
    } catch (err) {
      alert('Save failed: ' + err.message)
    } finally { setSaving(false) }
  }

  const resetTiers = () => {
    setPricing(prev => ({ ...prev, [glassType]: DEFAULT_PRICING[glassType].map(t => ({ ...t })) }))
  }

  const inputCls = "w-full h-10 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#FECD28] focus:ring-1 focus:ring-[#FECD28]/30"
  const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Calculator size={22} className="text-slate-400" /> Glass Pricing Calculator
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Stepped markup on buy-in cost. Markup % steps down as item value rises.</p>
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
                  Laminated — a timber crate is included in the packaging simulation.
                </p>
              )}
            </div>

            {/* Dimensions */}
            <div>
              <label className={labelCls}>Glass dimensions</label>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-[11px] text-slate-400">Length (mm)</span><input type="number" className={inputCls} value={len} onChange={e => setLen(e.target.value)} /></div>
                <div><span className="text-[11px] text-slate-400">Width (mm)</span><input type="number" className={inputCls} value={wid} onChange={e => setWid(e.target.value)} /></div>
                <div><span className="text-[11px] text-slate-400">Thick (mm)</span><input type="number" className={inputCls} value={thk} onChange={e => setThk(e.target.value)} /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Glass weight (kg)</label><input type="number" step="0.1" className={inputCls} value={gwt} onChange={e => setGwt(e.target.value)} /></div>
              <div><label className={labelCls}>Buy-in cost (ZAR)</label><input type="number" className={inputCls} value={cost} onChange={e => setCost(e.target.value)} /></div>
            </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Buy-in cost</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{fmtR(cost)}</p>
              <p className="text-xs text-slate-400 mt-1">Goods excl. freight</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-green-500 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Gross profit</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{calc.gpPct}%</p>
              <p className="text-xs text-slate-400 mt-1">Margin on sell price</p>
            </div>
            <div className="bg-[#111111] rounded-2xl p-4 col-span-2 sm:col-span-1">
              <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Selling price</p>
              <p className="text-lg font-bold text-white">{fmtR(calc.sellPrice)}</p>
              <p className="text-xs text-white/45 mt-1">{calc.multiplier}× buy-in cost</p>
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
              <div className="flex justify-between items-center py-3.5 bg-slate-50 dark:bg-slate-900/40 -mx-5 px-5">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Goods selling price</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{fmtR(calc.sellPrice)}</span>
              </div>
            </div>
          </div>

          {/* Packaging simulation */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Packaging simulation (reference)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                <p className="text-[11px] text-slate-400 mb-0.5">Pack size (cm)</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{calc.pkgL}×{calc.pkgW}×{calc.pkgH}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                <p className="text-[11px] text-slate-400 mb-0.5">Est. packed weight</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{calc.pkgWt.toFixed(1)} <span className="text-[11px] text-slate-400">kg</span></p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                <p className="text-[11px] text-slate-400 mb-0.5">Volume</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{(calc.volCm3 / 1e6).toFixed(3)} <span className="text-[11px] text-slate-400">m³</span></p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              {isLam ? 'Includes timber crate + foam inner padding.' : 'Foam & bubble-wrap padding only.'} Shipping cost is not included in this version.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
