import { useState, useEffect, useRef } from 'react'
import { RefreshCw, LogOut, Moon, Sun, Maximize, Minimize, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

export default function Header({ activeTab, setActiveTab, onRefresh, refreshing, dark, toggleDark, notifications }) {
  const { user, logout, perm } = useAuth()
  const [isFs, setIsFs] = useState(false)
  const [openMenu, setOpenMenu] = useState(null) // 'orders' | 'warehouse' | 'general' | null
  const navRef = useRef(null)

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Close any open dropdown when clicking outside the nav
  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
    } else {
      document.documentElement.requestFullscreen?.()
    }
  }

  const isDispatchRole = user?.role === 'dispatch'

  const ordersActive = activeTab === 'orders' || activeTab === 'upload' || activeTab === 'history'
  const warehouseActive = activeTab === 'staged' || activeTab === 'dispatch' || activeTab === 'wh'
  const generalActive = activeTab === 'pricing'

  // Items that live under the Warehouse dropdown (non-dispatch roles)
  const warehouseItems = [
    { key: 'staged',   label: 'Staged',     show: perm('staged', 'view') },
    { key: 'dispatch', label: 'Dispatch',   show: perm('dispatch', 'view') },
    { key: 'wh',       label: 'WH Uploads', show: perm('wh', 'view') },
  ].filter(t => t.show)

  // Items under the General dropdown
  const generalItems = [
    { key: 'pricing', label: 'Pricing', show: perm('pricing', 'view') },
  ].filter(t => t.show)

  const btnCls = (active) =>
    `px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-150 ${
      active ? '' : 'text-black/50 hover:text-black hover:bg-black/10'
    }`

  const itemCls = (active) =>
    `w-full text-left px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2
      ${active
        ? 'bg-[#FECD28]/20 text-[#111111] dark:text-white font-semibold'
        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`

  const goTab = (key) => { setActiveTab(key); setOpenMenu(null) }

  return (
    <header style={{ backgroundColor: '#FECD28' }} className="sticky top-0 z-30 shadow-md overflow-visible">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          <div className="flex items-center">
            <img src="/Cabglass_logo_PNG.avif" alt="CabGlass" className="h-8 w-auto" style={{ filter: 'brightness(0)' }} />
          </div>

          <nav className="flex items-center gap-1" ref={navRef}>

            {/* Orders dropdown — unchanged */}
            {(perm('orders', 'view') || perm('upload', 'view')) && (
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(m => m === 'orders' ? null : 'orders')}
                  style={ordersActive ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                  className={`flex items-center gap-1 ${btnCls(ordersActive)}`}
                >
                  Orders <ChevronDown size={13} className={`transition-transform duration-150 ${openMenu === 'orders' ? 'rotate-180' : ''}`} />
                </button>

                {openMenu === 'orders' && (
                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[130px] z-[100]">
                    {perm('orders', 'view') && (
                      <button onClick={() => goTab('orders')} className={itemCls(activeTab === 'orders')}>
                        Orders
                      </button>
                    )}
                    {perm('upload', 'view') && (
                      <button onClick={() => goTab('upload')} className={itemCls(activeTab === 'upload')}>
                        Upload
                      </button>
                    )}
                    {perm('orders', 'view') && (
                      <button onClick={() => goTab('history')} className={itemCls(activeTab === 'history')}>
                        History
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Warehouse — dispatch role sees Staged & Dispatch as flat mains; everyone else gets a dropdown */}
            {isDispatchRole ? (
              <>
                {perm('staged', 'view') && (
                  <button
                    onClick={() => setActiveTab('staged')}
                    style={activeTab === 'staged' ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                    className={btnCls(activeTab === 'staged')}
                  >
                    Staged
                  </button>
                )}
                {perm('dispatch', 'view') && (
                  <button
                    onClick={() => setActiveTab('dispatch')}
                    style={activeTab === 'dispatch' ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                    className={btnCls(activeTab === 'dispatch')}
                  >
                    Dispatch
                  </button>
                )}
              </>
            ) : warehouseItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(m => m === 'warehouse' ? null : 'warehouse')}
                  style={warehouseActive ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                  className={`flex items-center gap-1 ${btnCls(warehouseActive)}`}
                >
                  Warehouse <ChevronDown size={13} className={`transition-transform duration-150 ${openMenu === 'warehouse' ? 'rotate-180' : ''}`} />
                </button>

                {openMenu === 'warehouse' && (
                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[140px] z-[100]">
                    {warehouseItems.map(({ key, label }) => (
                      <button key={key} onClick={() => goTab(key)} className={itemCls(activeTab === key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* General dropdown — Pricing (gated) */}
            {generalItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(m => m === 'general' ? null : 'general')}
                  style={generalActive ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                  className={`flex items-center gap-1 ${btnCls(generalActive)}`}
                >
                  General <ChevronDown size={13} className={`transition-transform duration-150 ${openMenu === 'general' ? 'rotate-180' : ''}`} />
                </button>
                {openMenu === 'general' && (
                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[140px] z-[100]">
                    {generalItems.map(({ key, label }) => (
                      <button key={key} onClick={() => goTab(key)} className={itemCls(activeTab === key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Admin — flat main */}
            {perm('admin', 'view') && (
              <button
                onClick={() => setActiveTab('admin')}
                style={activeTab === 'admin' ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                className={btnCls(activeTab === 'admin')}
              >
                Admin
              </button>
            )}
          </nav>

          <div className="flex items-center gap-1">
            {/* User info */}
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <div className="w-7 h-7 rounded-full bg-black/10 flex items-center justify-center text-xs font-bold text-[#111111]">
                {user?.name?.charAt(0) ?? '?'}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-[#111111]">{user?.name}</p>
                <p className="text-[10px] text-black/50 capitalize">{user?.role}</p>
              </div>
            </div>

            {notifications && (
              <NotificationBell
                notifications={notifications.notifications}
                unreadCount={notifications.unreadCount}
                isRead={notifications.isRead}
                onMarkRead={notifications.markRead}
                onMarkAllRead={notifications.markAllRead}
                onSelect={notifications.onSelect}
                onSendTest={notifications.sendTest}
                canTest={perm('admin', 'view')}
              />
            )}

            <button onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'}
              className="p-2 rounded-md text-black/50 hover:text-black hover:bg-black/10 transition-colors">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button onClick={toggleFullscreen} title={isFs ? 'Exit fullscreen' : 'Fullscreen'}
              className="p-2 rounded-md text-black/50 hover:text-black hover:bg-black/10 transition-colors">
              {isFs ? <Minimize size={15} /> : <Maximize size={15} />}
            </button>

            <button onClick={onRefresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-black/50 hover:text-black hover:bg-black/10 transition-colors disabled:opacity-40">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            <button onClick={logout} title="Sign out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-black/50 hover:text-black hover:bg-black/10 transition-colors">
              <LogOut size={14} />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  )
}
