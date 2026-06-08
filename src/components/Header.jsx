import { useState, useEffect, useRef } from 'react'
import { RefreshCw, LogOut, Moon, Sun, Maximize, Minimize, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

export default function Header({ activeTab, setActiveTab, onRefresh, refreshing, dark, toggleDark, notifications }) {
  const { user, logout, can } = useAuth()
  const [isFs, setIsFs] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOrdersOpen(false)
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

  const ordersActive = activeTab === 'orders' || activeTab === 'upload' || activeTab === 'history'

  const flatTabs = [
    { key: 'staged',   label: 'Staged',     show: true },
    { key: 'dispatch', label: 'Dispatch',   show: can('canDispatch') },
    { key: 'wh',       label: 'WH Uploads', show: can('canView') },
    { key: 'admin',    label: 'Admin',      show: can('canAdmin') },
  ].filter(t => t.show)

  const btnCls = (active) =>
    `px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-150 ${
      active ? '' : 'text-black/50 hover:text-black hover:bg-black/10'
    }`

  return (
    <header style={{ backgroundColor: '#FECD28' }} className="sticky top-0 z-30 shadow-md overflow-visible">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          <div className="flex items-center">
            <img src="/Cabglass_logo_PNG.avif" alt="CabGlass" className="h-8 w-auto" style={{ filter: 'brightness(0)' }} />
          </div>

          <nav className="flex items-center gap-1">

            {/* Orders dropdown */}
            {can('canView') && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setOrdersOpen(o => !o)}
                  style={ordersActive ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                  className={`flex items-center gap-1 ${btnCls(ordersActive)}`}
                >
                  Orders <ChevronDown size={13} className={`transition-transform duration-150 ${ordersOpen ? 'rotate-180' : ''}`} />
                </button>

                {ordersOpen && (
                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[130px] z-[100]">
                    <button
                      onClick={() => { setActiveTab('orders'); setOrdersOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors
                        ${activeTab === 'orders'
                          ? 'bg-[#FECD28]/20 text-[#111111] dark:text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      Orders
                    </button>
                    {can('canUpload') && (
                      <button
                        onClick={() => { setActiveTab('upload'); setOrdersOpen(false) }}
                        className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors
                          ${activeTab === 'upload'
                            ? 'bg-[#FECD28]/20 text-[#111111] dark:text-white font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        Upload
                      </button>
                    )}
                    {can('canView') && (
                      <button
                        onClick={() => { setActiveTab('history'); setOrdersOpen(false) }}
                        className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors
                          ${activeTab === 'history'
                            ? 'bg-[#FECD28]/20 text-[#111111] dark:text-white font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        History
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Flat tabs */}
            {flatTabs.map(({ key, label }) => {
              const active = activeTab === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={active ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                  className={btnCls(active)}
                >
                  {label}
                </button>
              )
            })}
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
                canTest={can('canAdmin')}
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
