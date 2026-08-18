import React from 'react'
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, Legend
} from 'recharts'
import { Activity, AlertTriangle, TrendingUp, Compass, Clock, CheckCircle } from 'lucide-react'

function AnalyticsView({ stats = {}, orders = [], products = [], theme = 'light' }) {
  const safeOrders = orders || []
  const safeProducts = products || []

  // Mock historical trends data
  const trendData = [
    { day: 'Mon', fulfillment_time: 48, order_volume: 12 },
    { day: 'Tue', fulfillment_time: 42, order_volume: 18 },
    { day: 'Wed', fulfillment_time: 55, order_volume: 15 },
    { day: 'Thu', fulfillment_time: 38, order_volume: 22 },
    { day: 'Fri', fulfillment_time: 32, order_volume: 30 },
    { day: 'Sat', fulfillment_time: 28, order_volume: 10 },
    { day: 'Sun', fulfillment_time: 30, order_volume: 8 }
  ]

  // Mock employee performance metrics
  const employeePerformance = [
    { name: 'Sarah Connor', items_picked: 142, speed_index: 96 },
    { name: 'Marcus Vance', items_picked: 118, speed_index: 88 },
    { name: 'Mike Tyson', items_packed: 210, speed_index: 94 },
    { name: 'Jessica Alba', items_inspected: 185, speed_index: 98 }
  ]

  // Calculate some analytics
  const totalShipped = safeOrders.filter(o => o.status === 'Dispatched').length
  const delayRate = safeOrders.length > 0 
    ? Math.round((safeOrders.filter(o => o.status !== 'Dispatched' && new Date(o.required_delivery_date) < new Date()).length / safeOrders.length) * 100)
    : 0

  return (
    <div className="space-y-6">
      
      {/* Dynamic Bottleneck Detector Panel */}
      <div className="glass-panel p-5 bg-slate-900/30 border-amber-500/20">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <AlertTriangle className="h-6 w-6 animate-bounce" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-amber-500 text-slate-950 font-bold">
                BOTTLENECK DETECTED
              </span>
              <span className="font-mono text-[10px] text-slate-500">Node #WH104_SOUTH</span>
            </div>
            
            <h4 className="font-bold text-sm text-white font-mono uppercase">
              Picking stage consumes 42% of average fulfillment cycle times
            </h4>
            
            <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-2xl">
              Analysis indicates delays in Zone B picking queues. System recommends route adjustments and assigning an additional picker during peak hours to accelerate dispatch lane staging.
            </p>
            
            <div className="p-3.5 rounded bg-amber-500/5 border border-amber-500/15 font-mono text-[11px] text-amber-300 max-w-xl">
              <strong>Recommended Action Plan:</strong> Optimize picking paths with nearest-neighbor algorithms (Completed) and allocate Picker Marcus Vance to Zone B.
            </div>
          </div>
        </div>
      </div>

      {/* Analytics KPIs row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="p-2.5 rounded bg-indigo-500/10 text-indigo-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-mono">AVG FULFILLMENT TIME</div>
            <div className="text-xl font-bold text-white font-mono">38.4 Mins</div>
            <span className="text-[9px] font-mono text-emerald-400">↓ 12% vs last week</span>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="p-2.5 rounded bg-blue-500/10 text-blue-400">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-mono">AVG PICKING SPEED</div>
            <div className="text-xl font-bold text-white font-mono">16.2 Mins</div>
            <span className="text-[9px] font-mono text-emerald-400">↓ 8% optimized routing</span>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="p-2.5 rounded bg-emerald-500/10 text-emerald-400">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-mono">QA APPROVE TIER</div>
            <div className="text-xl font-bold text-white font-mono">98.6%</div>
            <span className="text-[9px] font-mono text-slate-500">Target score: 98%</span>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="p-2.5 rounded bg-rose-500/10 text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-mono">DELIVERY DELAY TIER</div>
            <div className="text-xl font-bold text-rose-400 font-mono">{delayRate}%</div>
            <span className="text-[9px] font-mono text-rose-500">{stats.delayed_orders} order(s) overdue</span>
          </div>
        </div>
      </div>

      {/* Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Fulfillment Time trends */}
        <div className="glass-panel p-5 bg-[#0c1220]/40">
          <h3 className="font-bold text-xs text-white tracking-wider uppercase font-mono mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            Fulfillment Speeds & Order Ingestion (Weekly)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                <Line type="monotone" dataKey="fulfillment_time" name="Avg Speed (Mins)" stroke="#6366f1" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="order_volume" name="Orders Loaded" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Employee Performance indexes */}
        <div className="glass-panel p-5 bg-[#0c1220]/40">
          <h3 className="font-bold text-xs text-white tracking-wider uppercase font-mono mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-400" />
            Personnel Productivity Indices
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeePerformance} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                <Bar dataKey="items_picked" name="Items Picked/Packed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="speed_index" name="Efficiency Score (%)" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  )
}

export default AnalyticsView
