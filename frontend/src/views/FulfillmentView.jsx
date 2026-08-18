import React, { useState, useEffect } from 'react'
import { FileCheck, Search, Clock, User, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react'

const PIPELINE_STAGES = [
  { id: 'Created', label: 'Order Ingested', detail: 'Order loaded and priority evaluated' },
  { id: 'Stock Allocated', label: 'Inventory Allocation', detail: 'Items reserved in locations A2/B1/C2' },
  { id: 'Picking', label: 'Picking Route Active', detail: 'Optimized route sequence generated' },
  { id: 'Packing', label: 'Packing & Checking', detail: 'Physical carton packed and verified' },
  { id: 'Quality Check', label: 'Quality Check Inspector', detail: 'Inspected for damage & count accuracy' },
  { id: 'Ready for Dispatch', label: 'Ready for Dispatch', detail: 'Staged at lane shipping docks' },
  { id: 'Dispatched', label: 'Dispatched & Shipped', detail: 'Loaded in carrier truck. Inventory deducted' }
]

function FulfillmentView({ orders = [], onRefresh, showToast, theme = 'light' }) {
  const safeOrders = orders || []
  const [selectedOrderId, setSelectedOrderId] = useState('')

  // Set default selected order
  useEffect(() => {
    if (safeOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(safeOrders[0].id.toString())
    }
  }, [safeOrders, selectedOrderId])

  const order = safeOrders.find(o => o.id.toString() === selectedOrderId)

  // Advanced progress check
  const getStageStatus = (stageId) => {
    if (!order) return 'pending'
    
    const statusMap = {
      'Created': 0,
      'Allocated': 1,
      'Picking': 2,
      'Packing': 3,
      'Quality Check': 4,
      'Ready for Dispatch': 5,
      'Dispatched': 6
    }

    const orderStatusNormalized = order.status === 'Created' ? 'Created' : order.status
    const orderStageIdx = statusMap[orderStatusNormalized] !== undefined ? statusMap[orderStatusNormalized] : 0
    const currentStageIdx = statusMap[stageId] !== undefined ? statusMap[stageId] : 0

    // Custom check: check if there's any active exception in this stage
    const hasActiveException = order.exceptions.some(
      exc => exc.status === 'Active' && 
      ((stageId === 'Stock Allocated' && exc.type === 'Stock Shortage') ||
       (stageId === 'Picking' && (exc.type === 'Damaged Item' || exc.type === 'Missing Item')))
    )

    if (hasActiveException) return 'exception'
    if (orderStageIdx > currentStageIdx) return 'completed'
    if (orderStageIdx === currentStageIdx) return 'active'
    return 'pending'
  }

  // Find log details for a stage
  const getStageLog = (stageId) => {
    if (!order) return null
    // Match log stage name
    const match = order.logs.find(l => {
      if (stageId === 'Created' && l.stage === 'Order Created') return true
      if (stageId === 'Stock Allocated' && l.stage === 'Stock Allocated') return true
      return l.stage === stageId
    })
    return match
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Selection Left Sidebar (Takes 1 column) */}
      <div className="glass-panel p-5 bg-[#0c1220]/40 space-y-4 self-start">
        <h3 className="font-bold text-xs text-white font-mono uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
          <FileCheck className="h-4.5 w-4.5 text-indigo-400" />
          Fulfillment Orders
        </h3>

        <div className="relative">
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
          >
            {orders.map(o => (
              <option key={o.id} value={o.id}>
                Order #{o.id} - {o.customer} ({o.status})
              </option>
            ))}
          </select>
        </div>

        {order && (
          <div className="p-3.5 rounded bg-slate-950/50 border border-slate-850 font-mono text-[11px] space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">CLIENT:</span>
              <strong className="text-white font-sans">{order.customer}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ACCOUNT TYPE:</span>
              <span className={order.customer_type === 'VIP' ? 'text-fuchsia-400 font-bold' : 'text-slate-300'}>
                {order.customer_type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PRIORITY LEVEL:</span>
              <strong className="text-rose-400">{order.priority_level} (Score: {order.priority_score})</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">EST VALUE:</span>
              <strong className="text-emerald-400">${order.order_value.toLocaleString()}</strong>
            </div>
            <div className="flex justify-between border-t border-slate-850 pt-2">
              <span className="text-slate-500">PIPELINE STATUS:</span>
              <span className="text-indigo-300 font-bold uppercase">{order.status}</span>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Tracking View (Takes 2 columns) */}
      <div className="lg:col-span-2 glass-panel p-5 bg-[#0c1220]/20 space-y-6">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h3 className="font-bold text-xs text-white font-mono uppercase tracking-wider">
            Fulfillment Stage Telemetry Path
          </h3>
          {order && (
            <span className="text-[10px] font-mono text-slate-500">
              ID: #{order.id} // SECURE AUDIT LOG
            </span>
          )}
        </div>

        {order ? (
          <div className="relative pl-6 space-y-6 border-l border-slate-800 ml-4 py-2">
            
            {PIPELINE_STAGES.map((stage, idx) => {
              const status = getStageStatus(stage.id)
              const log = getStageLog(stage.id)
              
              let markerStyle = 'bg-slate-900 border-slate-800'
              let textStyle = 'text-slate-500'
              
              if (status === 'completed') {
                markerStyle = 'bg-emerald-950 border-emerald-500 text-emerald-400 glow-green'
                textStyle = 'text-slate-300'
              } else if (status === 'active') {
                markerStyle = 'bg-indigo-950 border-indigo-500 text-indigo-400 glow-blue animate-pulse'
                textStyle = 'text-white font-semibold'
              } else if (status === 'exception') {
                markerStyle = 'bg-rose-950 border-rose-500 text-rose-400 glow-red animate-pulse'
                textStyle = 'text-rose-300 font-semibold'
              }

              return (
                <div key={stage.id} className="relative flex flex-col md:flex-row md:items-start justify-between gap-2 md:gap-6">
                  
                  {/* Marker Dot */}
                  <div className={`absolute -left-10 top-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center text-[10px] font-mono font-bold z-10 ${markerStyle}`}>
                    {status === 'completed' ? '✓' : idx + 1}
                  </div>

                  {/* Stage Label details */}
                  <div className="space-y-1 md:max-w-md">
                    <h4 className={`text-xs font-mono tracking-wide uppercase ${textStyle}`}>
                      {stage.label}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                      {stage.detail}
                    </p>

                    {/* Show exception warning if active shortage/damage */}
                    {status === 'exception' && (
                      <div className="mt-2 p-2 rounded bg-rose-950/15 border border-rose-500/20 text-[10px] text-rose-300 font-mono flex items-start gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>ANOMALY SUSPENSION DETECTED:</strong> Review the active exceptions logs or decision overrides.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Time and Worker metadata */}
                  <div className="font-mono text-[10px] text-right shrink-0 md:self-center">
                    {log ? (
                      <div className="space-y-1">
                        <span className="flex items-center justify-end gap-1 text-slate-400">
                          <Clock className="h-3 w-3" />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="flex items-center justify-end gap-1 text-indigo-400">
                          <User className="h-3 w-3" />
                          {log.worker || 'System Engine'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600 italic">Pending queue stage</span>
                    )}
                  </div>

                </div>
              )
            })}
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-600 font-mono text-xs">
            No active orders to track.
          </div>
        )}
      </div>

    </div>
  )
}

export default FulfillmentView
