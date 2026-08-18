import React, { useState, useEffect } from 'react'
import { 
  LayoutDashboard, 
  Boxes, 
  ShoppingCart, 
  BrainCircuit, 
  Compass, 
  AlertTriangle, 
  TrendingUp, 
  FileCheck,
  RefreshCw,
  Clock,
  CheckCircle2,
  Server,
  Activity,
  Sun,
  Moon
} from 'lucide-react'

// Sub-views
import DashboardView from './views/DashboardView'
import InventoryView from './views/InventoryView'
import OrdersView from './views/OrdersView'
import DecisionCenterView from './views/DecisionCenterView'
import PickingPackingView from './views/PickingPackingView'
import ExceptionsView from './views/ExceptionsView'
import FulfillmentView from './views/FulfillmentView'
import AnalyticsView from './views/AnalyticsView'

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('aetherops_theme') || 'light')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [exceptions, setExceptions] = useState([])
  const [decisions, setDecisions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dbConnected, setDbConnected] = useState(true)
  const [toast, setToast] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Toggle Theme between Light Pastel and Dark Cyber
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    localStorage.setItem('aetherops_theme', nextTheme)
  }

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  // Load all platform data
  const loadData = async () => {
    try {
      const [statsRes, prodRes, ordRes, excRes, decRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/products'),
        fetch('/api/orders'),
        fetch('/api/exceptions'),
        fetch('/api/decision-center')
      ])

      if (statsRes.ok && prodRes.ok && ordRes.ok && excRes.ok && decRes.ok) {
        const statsData = await statsRes.json()
        const prodData = await prodRes.json()
        const ordData = await ordRes.json()
        const excData = await excRes.json()
        const decData = await decRes.json()

        setStats(statsData)
        setProducts(prodData)
        setOrders(ordData)
        setExceptions(excData)
        setDecisions(decData)
        setDbConnected(true)
      } else {
        setDbConnected(false)
      }
    } catch (err) {
      console.error("Failed to load operations data:", err)
      setDbConnected(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Initial load and sync interval
  useEffect(() => {
    loadData()
    const syncInterval = setInterval(loadData, 5000) // Poll every 5s
    return () => clearInterval(syncInterval)
  }, [])

  // Trigger full reset for demo scenario
  const resetDemo = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      if (res.ok) {
        showToast("System database successfully reset to demo starting state!", "success")
        loadData()
        setActiveTab('dashboard')
      } else {
        showToast("Error resetting database.", "error")
      }
    } catch (err) {
      showToast("Connection to backend server failed.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // Render correct content
  const renderContent = () => {
    if (isLoading && !stats) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
          <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
          <p className="text-gray-400 font-mono">Synchronizing telemetry data...</p>
        </div>
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardView stats={stats} products={products} orders={orders} exceptions={exceptions} setView={setActiveTab} theme={theme} />
      case 'inventory':
        return <InventoryView products={products} onRefresh={loadData} showToast={showToast} theme={theme} />
      case 'orders':
        return <OrdersView orders={orders} products={products} onRefresh={loadData} showToast={showToast} theme={theme} />
      case 'decision-center':
        return <DecisionCenterView decisions={decisions} onRefresh={loadData} showToast={showToast} theme={theme} />
      case 'picking-packing':
        return <PickingPackingView orders={orders} onRefresh={loadData} showToast={showToast} theme={theme} />
      case 'exceptions':
        return <ExceptionsView exceptions={exceptions} onRefresh={loadData} showToast={showToast} theme={theme} />
      case 'fulfillment':
        return <FulfillmentView orders={orders} onRefresh={loadData} showToast={showToast} theme={theme} />
      case 'analytics':
        return <AnalyticsView stats={stats} orders={orders} products={products} theme={theme} />
      default:
        return <DashboardView stats={stats} products={products} orders={orders} exceptions={exceptions} setView={setActiveTab} theme={theme} />
    }
  }

  // Navigation Items setup
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'inventory', label: 'Inventory', icon: Boxes, badge: stats?.low_stock_products || null, badgeColor: theme === 'light' ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold' : 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, badge: stats?.pending_orders || null, badgeColor: theme === 'light' ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    { id: 'decision-center', label: 'Decision Center', icon: BrainCircuit, badge: decisions?.length || null, badgeColor: theme === 'light' ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse' : 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' },
    { id: 'picking-packing', label: 'Picking & Packing', icon: Compass, badge: (stats?.orders_picking || 0) + (stats?.orders_packing || 0) || null, badgeColor: theme === 'light' ? 'bg-sky-100 text-sky-800 border-sky-300 font-bold' : 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { id: 'exceptions', label: 'Exception Center', icon: AlertTriangle, badge: stats?.active_exceptions || null, badgeColor: theme === 'light' ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold' : 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
    { id: 'fulfillment', label: 'Fulfillment', icon: FileCheck, badge: null },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, badge: null }
  ]

  return (
    <div className={`flex h-screen font-sans overflow-hidden ${theme === 'light' ? 'light-mode' : 'dark-mode'}`}>
      
      {/* Toast Banner */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl transition-all duration-300 font-mono text-sm ${
          toast.type === 'success' ? (theme === 'light' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300') :
          toast.type === 'error' ? (theme === 'light' ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-rose-950/80 border-rose-500/40 text-rose-300') :
          (theme === 'light' ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300')
        }`}>
          <div className={`h-2.5 w-2.5 rounded-full ${
            toast.type === 'success' ? 'bg-emerald-500' :
            toast.type === 'error' ? 'bg-rose-500' : 'bg-indigo-500'
          }`} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 border-r border-slate-800 bg-[#0c1220]/90 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Brand */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3 bg-slate-900/20">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-500">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wider text-slate-900 dark:text-white">AETHEROPS</h1>
              <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">SMART WAREHOUSE PLATFORM</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium font-mono transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? (theme === 'light' ? 'bg-indigo-100/90 text-indigo-900 border-l-4 border-indigo-600 font-bold shadow-sm' : 'bg-indigo-600/15 text-indigo-300 border-l-2 border-indigo-500')
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-gray-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && (
                    <span className={`px-2 py-0.5 text-[9px] rounded-full border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20 space-y-3 font-mono text-[10px] text-gray-500">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Server className={`h-3 w-3 ${dbConnected ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}`} />
              CORE TELEMETRY
            </span>
            <span className={dbConnected ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
              {dbConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800/40 pt-2">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              SYSTEM TIME
            </span>
            <span className="text-slate-600 dark:text-gray-400 font-bold">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER TOP NAV */}
        <header className="h-16 border-b border-slate-800 bg-[#0c1220]/75 backdrop-blur flex items-center justify-between px-6 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
              {navItems.find(n => n.id === activeTab)?.label.toUpperCase()} CONTROL CONSOLE
            </h2>
            <p className="text-[10px] font-mono text-slate-500 dark:text-gray-500">
              Autonomous Dispatching Node #WH104_SOUTH
            </p>
          </div>

          {/* Controls & Theme Switcher */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[11px] font-bold transition-all duration-200 cursor-pointer shadow-sm ${
                theme === 'light' 
                  ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 shadow-amber-500/10' 
                  : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60'
              }`}
              title="Switch Color Theme"
            >
              {theme === 'light' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-500 fill-amber-400 animate-spin-slow" />
                  <span>PASTEL LIGHT</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400" />
                  <span>DARK CYBER</span>
                </>
              )}
            </button>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-800" />

            <button
              onClick={resetDemo}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                theme === 'light'
                  ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800'
                  : 'bg-indigo-500/10 hover:bg-indigo-500/25 border-indigo-500/35 text-indigo-300'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              RESET DEMO
            </button>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-800" />

            <div className={`px-3 py-1.5 rounded-lg border font-mono text-[10px] font-semibold flex items-center gap-1.5 ${
              theme === 'light'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              AI AUTO-RESOLVER ACTIVE
            </div>
          </div>
        </header>

        {/* WORKSPACE AREA */}
        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default App
