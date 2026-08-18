import React, { useState } from 'react'
import { AlertTriangle, CheckCircle, HelpCircle, Activity, Play } from 'lucide-react'

function ExceptionsView({ exceptions = [], onRefresh, showToast, theme = 'light' }) {
  const safeExceptions = exceptions || []
  const [resolvingId, setResolvingId] = useState(null)
  const [resolutionAction, setResolutionAction] = useState('Replaced damaged item using available inventory stock')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Trigger Resolution API
  const handleResolve = async (id) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/exceptions/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: resolutionAction })
      })

      if (res.ok) {
        showToast("Anomaly exception resolved! Inventory reallocations recalculated.", "success")
        setResolvingId(null)
        onRefresh()
      } else {
        showToast("Failed to resolve exception record.", "error")
      }
    } catch (err) {
      showToast("Server connection error.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Pre-fill resolution template based on type
  const openResolveDialog = (exc) => {
    setResolvingId(exc.id)
    if (exc.type === 'Damaged Item') {
      setResolutionAction('Replaced damaged item using available warehouse stock.')
    } else if (exc.type === 'Missing Item') {
      setResolutionAction('Searched alternative location. Adjusted location record mapping.')
    } else if (exc.type === 'Stock Shortage') {
      setResolutionAction('Replenished inventory stock levels and completed allocation.')
    } else {
      setResolutionAction('Anomaly inspected and cleared manually by warehouse operator.')
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Exceptions Intro Card */}
      <div className="glass-panel p-5 bg-slate-900/20 flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex gap-3 items-start">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white tracking-wide uppercase">
              ANOMALY & EXCEPTION RESOLUTION HUB
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans mt-0.5">
              Review active bottlenecks, damaged items, and missing physical inventory. Execute corrective protocols to resume order fulfillment streams.
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-center shrink-0">
          <div className="px-4 py-2 bg-rose-950/15 border border-rose-500/20 text-rose-400 rounded">
            <div className="text-xl font-bold font-mono">
              {safeExceptions.filter(e => e.status === 'Active').length}
            </div>
            <div className="text-[9px] font-mono text-slate-500 uppercase">ACTIVE ANOMALIES</div>
          </div>
          <div className="px-4 py-2 bg-emerald-950/15 border border-emerald-500/20 text-emerald-400 rounded">
            <div className="text-xl font-bold font-mono">
              {safeExceptions.filter(e => e.status === 'Resolved').length}
            </div>
            <div className="text-[9px] font-mono text-slate-500 uppercase">RESOLVED HISTORY</div>
          </div>
        </div>
      </div>

      {/* Exceptions log list */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Log ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Context</th>
                <th className="py-3 px-4">Exception Type</th>
                <th className="py-3 px-4">Incident Log Detail</th>
                <th className="py-3 px-4">Recommended Protocol</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 font-mono text-xs">
              {safeExceptions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-slate-500">
                    No exception logs registered in the operations feed.
                  </td>
                </tr>
              ) : (
                safeExceptions.map(exc => (
                  <tr key={exc.id} className={`hover:bg-slate-900/10 transition-colors ${exc.status === 'Resolved' ? 'opacity-60 bg-slate-950/20' : ''}`}>
                    <td className="py-3.5 px-4 text-slate-400 font-bold">#EX-{exc.id}</td>
                    <td className="py-3.5 px-4 text-slate-500 text-[10px]">
                      {new Date(exc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4">
                      {exc.order_id ? (
                        <span className="text-indigo-400 font-semibold">Order #{exc.order_id}</span>
                      ) : exc.product_sku ? (
                        <span className="text-amber-400 font-semibold">{exc.product_sku}</span>
                      ) : (
                        <span className="text-slate-500">Global Node</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] border font-bold uppercase ${
                        exc.type === 'Damaged Item' ? 'bg-orange-500/10 text-orange-400 border-orange-500/25 glow-orange' :
                        exc.type === 'Stock Shortage' ? 'bg-rose-500/10 text-rose-400 border-rose-500/25 glow-red' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/25'
                      }`}>
                        {exc.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-sans max-w-[200px] leading-relaxed">
                      {exc.description}
                    </td>
                    <td className="py-3.5 px-4 text-indigo-300 font-sans max-w-[200px] leading-relaxed italic text-[11px]">
                      {exc.recommendation || "System default inspect and resolve."}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {exc.status === 'Active' ? (
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          RESOLVED
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {exc.status === 'Active' ? (
                        <button
                          onClick={() => openResolveDialog(exc)}
                          className="px-2.5 py-1 text-[10px] bg-rose-600/10 border border-rose-600/30 text-rose-400 rounded hover:bg-rose-600 hover:text-white transition cursor-pointer"
                        >
                          RESOLVE
                        </button>
                      ) : (
                        <div className="text-[10px] text-slate-500 font-sans max-w-[120px] truncate" title={exc.resolution_action}>
                          {exc.resolution_action}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolving Drawer Dialog */}
      {resolvingId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="glass-panel p-6 w-[400px] bg-[#0c1220] border-rose-500/30">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
              ANOMALY PROTOCOL ACTIONS
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                  Log corrective action notes
                </label>
                <textarea
                  rows="3"
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded font-sans text-xs text-white focus:outline-none focus:border-rose-500 leading-relaxed"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-850">
                <button
                  onClick={() => setResolvingId(null)}
                  className="px-3 py-1.5 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResolve(resolvingId)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded flex items-center gap-1.5 cursor-pointer"
                >
                  Confirm Resolution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default ExceptionsView
