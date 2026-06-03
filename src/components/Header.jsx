import { useState, useEffect } from 'react'
import { RefreshCw, LogOut, Moon, Sun, Maximize, Minimize } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Header({ activeTab, setActiveTab, onRefresh, refreshing, dark, toggleDark }) {
  const { user, logout, can } = useAuth()
  const [isFs, setIsFs] = useState(false)

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
    } else {
      document.documentElement.requestFullscreen?.()
    }
  }

  const tabs = [
    { key: 'orders',    label: 'Orders',    show: can('canView') },
    { key: 'history',   label: 'History',   show: can('canView') },
    { key: 'upload',    label: 'Upload',    show: can('canUpload') },
    { key: 'staged',    label: 'Staged',    show: true },
    { key: 'dispatch',  label: 'Dispatch',  show: can('canDispatch') },
    { key: 'admin',     label: 'Admin',     show: can('canAdmin') },
  ].filter(t => t.show)

  return (
    <header style={{ backgroundColor: '#FECD28' }} className="sticky top-0 z-30 shadow-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          <div className="flex items-center">
            <img src="/Cabglass_logo_PNG.avif" alt="CabGlass" className="h-8 w-auto" style={{ filter: 'brightness(0)' }} />
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin max-w-[50vw]">
            {tabs.map(({ key, label }) => {
              const active = activeTab === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={active ? { backgroundColor: '#111111', color: '#FECD28' } : {}}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-150
                    ${!active ? 'text-black/50 hover:text-black hover:bg-black/10' : ''}`}
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
