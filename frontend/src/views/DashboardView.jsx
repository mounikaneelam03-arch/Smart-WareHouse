import React from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { 
  AlertTriangle, 
  Clock, 
  Boxes, 
  Brain, 
  Compass, 
  ClipboardList, 
  TrendingUp, 
  CheckCircle,
  ChevronRight
} from 'lucide-react'

const PRIORITY_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#10b981'
}

function DashboardView({ stats, products = [], orders = [], exceptions = [], setView, theme = 'light' }) {
  const isLight = theme === 'light'
  const safeOrders = orders || []
  const safeProducts = products || []
  const safeExceptions = exceptions || []

  if (!stats) return null

  // 1. Chart Data: Orders by status
  const ordersByStatusData = [
    { name: 'Created', value: safeOrders.filter(o => o.status === 'Created').length },
    { name: 'Allocated', value: safeOrders.filter(o => o.status === 'Allocated').length },
    { name: 'Picking', value: safeOrders.filter(o => o.status === 'Picking').length },
    { name: 'Packing', value: safeOrders.filter(o => o.status === 'Packing').length },
    { name: 'QA Check', value: safeOrders.filter(o => o.status === 'Quality Check').length },
    { name: 'Ready', value: safeOrders.filter(o => o.status === 'Ready for Dispatch').length },
    { name: 'Dispatched', value: safeOrders.filter(o => o.status === 'Dispatched').length }
  ]

  // 2. Chart Data: Orders by priority
  const priorityCounts = safeOrders.reduce((acc, curr) => {
    acc[curr.priority_level] = (acc[curr.priority_level] || 0) + 1
    return acc
  }, {})
  const priorityData = Object.keys(priorityCounts).map(key => ({
    name: key,
    value: priorityCounts[key]
  }))

  const PASTEL_PRIORITY_COLORS = {
    Critical: '#f87171',
    High: '#fb923c',
    Medium: '#fbbf24',
    Low: '#34d399'
  }

  const DARK_PRIORITY_COLORS = {
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#10b981'
  }

  const priorityColors = isLight ? PASTEL_PRIORITY_COLORS : DARK_PRIORITY_COLORS

  return (
    <div className="space-y-6">
      
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Orders Card */}
        <div className={`glass-panel p-4 flex flex-col justify-between h-28 border-l-4 ${isLight ? 'border-l-indigo-500 bg-indigo-50/40' : 'border-l-indigo-500'}`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400">
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase">TOTAL INGESTED</span>
            <ClipboardList className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{stats.total_orders}</div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Orders loaded in system</p>
          </div>
        </div>

        {/* Active Exceptions */}
        <div className={`glass-panel p-4 flex flex-col justify-between h-28 border-l-4 ${
          stats.active_exceptions > 0 
            ? (isLight ? 'border-l-rose-500 bg-rose-50/50' : 'border-l-rose-500') 
            : (isLight ? 'border-l-slate-300' : 'border-l-slate-800')
        }`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400">
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase">ACTIVE EXCEPTIONS</span>
            <AlertTriangle className={`h-4 w-4 ${stats.active_exceptions > 0 ? 'text-rose-600 dark:text-rose-500 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono ${stats.active_exceptions > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {stats.active_exceptions}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Blocked tasks requiring action</p>
          </div>
        </div>

        {/* Low Stock Indicators */}
        <div className={`glass-panel p-4 flex flex-col justify-between h-28 border-l-4 ${
          stats.low_stock_products > 0 
            ? (isLight ? 'border-l-amber-500 bg-amber-50/50' : 'border-l-amber-500') 
            : (isLight ? 'border-l-slate-300' : 'border-l-slate-800')
        }`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400">
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase">STOCK WARNINGS</span>
            <Boxes className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono">{stats.low_stock_products}</div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Products below reorder level</p>
          </div>
        </div>

        {/* Delayed Orders */}
        <div className={`glass-panel p-4 flex flex-col justify-between h-28 border-l-4 ${
          stats.delayed_orders > 0 
            ? (isLight ? 'border-l-red-500 bg-red-50/50' : 'border-l-red-500') 
            : (isLight ? 'border-l-slate-300' : 'border-l-slate-800')
        }`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400">
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase">DELAYS / OVERDUE</span>
            <Clock className={`h-4 w-4 ${stats.delayed_orders > 0 ? 'text-red-600 dark:text-red-500 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono ${stats.delayed_orders > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
              {stats.delayed_orders}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Orders past delivery date</p>
          </div>
        </div>

        {/* Dispatched count */}
        <div className={`glass-panel p-4 flex flex-col justify-between h-28 border-l-4 ${isLight ? 'border-l-emerald-500 bg-emerald-50/40' : 'border-l-emerald-500'}`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400">
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase">DISPATCHED SHIPPED</span>
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{stats.dispatched_orders}</div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">Successfully fulfilled orders</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Analytical Charts & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recommendations */}
        <div className={`glass-panel p-5 flex flex-col justify-between border-indigo-500/20 ${isLight ? 'bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-white' : 'bg-slate-900/40'}`}>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-wide uppercase font-mono">
                🤖 SMART RECOMMENDATIONS
              </h3>
            </div>
            <div className="space-y-3">
              {stats.smart_recommendations.map((rec, idx) => (
                <div key={idx} className={`p-3.5 rounded-xl flex items-start gap-2.5 text-xs transition-all ${
                  isLight 
                    ? 'bg-white/90 border border-indigo-100 text-slate-800 shadow-sm' 
                    : 'bg-indigo-950/20 border border-indigo-500/10 text-indigo-200'
                }`}>
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0 mt-1" />
                  <p className="leading-relaxed font-medium">{rec}</p>
                </div>
              ))}
            </div>
          </div>
          
          <button
            onClick={() => setView('decision-center')}
            className={`w-full flex items-center justify-between px-4 py-2.5 mt-6 rounded-lg font-mono text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer shadow-md ${
              isLight 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/20' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <span>RESOLVE IN DECISION CENTER</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Right Column: Graphs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Fulfillment bottlenecks */}
            <div className={`glass-panel p-5 ${isLight ? 'bg-white/80' : 'bg-[#0c1220]/40'}`}>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white tracking-wider uppercase font-mono mb-4 flex items-center gap-2">
                <Compass className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                FULFILLMENT QUEUES BY STAGE
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersByStatusData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <XAxis dataKey="name" stroke={isLight ? "#475569" : "#64748b"} fontSize={9} fontClassName="font-mono" />
                    <YAxis stroke={isLight ? "#475569" : "#64748b"} fontSize={9} fontClassName="font-mono" allowDecimals={false} />
                    <Tooltip contentStyle={isLight ? { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, color: '#0f172a', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } : { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]}>
                      {ordersByStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          index === 0 ? '#818cf8' : 
                          index === 1 ? '#34d399' : 
                          index === 2 ? '#60a5fa' : 
                          index === 3 ? '#c084fc' : 
                          index === 4 ? '#fbbf24' : 
                          index === 5 ? '#38bdf8' : '#94a3b8'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Orders by priority */}
            <div className={`glass-panel p-5 ${isLight ? 'bg-white/80' : 'bg-[#0c1220]/40'}`}>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white tracking-wider uppercase font-mono mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                ACTIVE ORDER PRIORITY SPREAD
              </h3>
              {priorityData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-400 font-mono text-xs">
                  No Active Orders Loaded
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={priorityColors[entry.name] || '#818cf8'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={isLight ? { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, color: '#0f172a', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } : { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                      <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', color: isLight ? '#334155' : '#94a3b8' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Operational Flow Pipeline Visualizer */}
      <div className={`glass-panel p-5 ${isLight ? 'bg-white/80' : 'bg-[#0c1220]/40'}`}>
        <h3 className="font-bold text-xs text-slate-900 dark:text-white tracking-wider uppercase font-mono mb-6 flex items-center gap-2">
          <span>⚙️ WAREHOUSE WORKFLOW PIPELINE PROGRESS</span>
        </h3>
        
        {/* Pipeline visualizer rows */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          {[
            { label: 'Order Created', count: safeOrders.filter(o => o.status === 'Created').length, color: isLight ? 'border-indigo-200 text-indigo-900 bg-indigo-50/80' : 'border-indigo-500/40 text-indigo-400 bg-indigo-500/5' },
            { label: 'Stock Allocated', count: safeOrders.filter(o => o.status === 'Allocated').length, color: isLight ? 'border-emerald-200 text-emerald-900 bg-emerald-50/80' : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' },
            { label: 'Picking Queue', count: safeOrders.filter(o => o.status === 'Picking').length, color: isLight ? 'border-blue-200 text-blue-900 bg-blue-50/80' : 'border-blue-500/40 text-blue-400 bg-blue-500/5' },
            { label: 'Packing Queue', count: safeOrders.filter(o => o.status === 'Packing').length, color: isLight ? 'border-purple-200 text-purple-900 bg-purple-50/80' : 'border-purple-500/40 text-purple-400 bg-purple-500/5' },
            { label: 'Quality Check', count: safeOrders.filter(o => o.status === 'Quality Check').length, color: isLight ? 'border-amber-200 text-amber-900 bg-amber-50/80' : 'border-amber-500/40 text-amber-400 bg-amber-500/5' },
            { label: 'Ready Dispatch', count: safeOrders.filter(o => o.status === 'Ready for Dispatch').length, color: isLight ? 'border-sky-200 text-sky-900 bg-sky-50/80' : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/5' },
            { label: 'Dispatched', count: safeOrders.filter(o => o.status === 'Dispatched').length, color: isLight ? 'border-slate-200 text-slate-700 bg-slate-100' : 'border-slate-700/40 text-slate-400 bg-slate-800/10' }
          ].map((stage, idx) => (
            <div key={idx} className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-center relative shadow-sm ${stage.color}`}>
              {idx < 6 && (
                <div className="hidden md:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-slate-400 dark:text-slate-700 font-mono font-bold text-xs">
                  →
                </div>
              )}
              <span className="font-mono text-[9px] uppercase font-bold tracking-wide leading-tight">{stage.label}</span>
              <span className="text-xl font-bold font-mono">{stage.count}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

export default DashboardView
