import React, { useState } from 'react'
import { Brain, ShieldAlert, AlertTriangle, UserCheck, PlayCircle, RefreshCw } from 'lucide-react'

const SEVERITY_CARD_STYLES = {
  Critical: 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60 shadow-lg shadow-rose-950/20',
  High: 'border-orange-500/40 bg-orange-500/5 hover:border-orange-500/60 shadow-lg shadow-orange-950/20',
  Warning: 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60',
  Info: 'border-indigo-500/40 bg-indigo-500/5 hover:border-indigo-500/60'
}

const SEVERITY_BADGES = {
  Critical: 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse',
  High: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  Warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Info: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
}

function DecisionCenterView({ decisions = [], onRefresh, showToast, theme = 'light' }) {
  const safeDecisions = decisions || []
  const [executingId, setExecutingId] = useState(null)

  const handleExecute = async (id, action) => {
    setExecutingId(id)
    try {
      const res = await fetch('/api/decision-center/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      })

      if (res.ok) {
        const data = await res.json()
        showToast(data.message, "success")
        onRefresh()
      } else {
        showToast("Error executing operational override.", "error")
      }
    } catch (err) {
      showToast("Server connection error.", "error")
    } finally {
      setExecutingId(null)
    }
  }

  // Filter types
  const shortages = safeDecisions.filter(d => d.type === 'Stock Shortage')
  const reorders = safeDecisions.filter(d => d.type === 'Reorder Recommendation')
  const bottlenecks = safeDecisions.filter(d => d.type !== 'Stock Shortage' && d.type !== 'Reorder Recommendation')

  return (
    <div className="space-y-6">
      
      {/* Header Explainer Card */}
      <div className="p-4 rounded-lg bg-indigo-950/25 border border-indigo-500/30 flex gap-4 items-start">
        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <Brain className="h-6 w-6 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white tracking-wide uppercase">
            SMART DECISION ENGINE // AI RECOMMENDATION LAYER
          </h3>
          <p className="text-xs text-indigo-200/90 leading-relaxed font-sans">
            The decision engine detects active anomalies and computes optimal solutions. Managers must review and authorize recommendations to override standard allocation queues and restore operations flow.
          </p>
        </div>
      </div>

      {decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 glass-panel border-dashed border-slate-800 text-center space-y-3">
          <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <UserCheck className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white font-mono uppercase">All Node Operations Clear</h4>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Zero pending exceptions. Operations are executing standard routines.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* 1. Critical Decisions (Stock Shortages) */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs text-rose-400 font-mono uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              🚨 Critical Stock Allocation ({shortages.length})
            </h3>
            {shortages.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-600 border border-slate-850 rounded">
                No active stock shortages.
              </div>
            ) : (
              shortages.map(d => (
                <div key={d.id} className={`glass-panel p-4 flex flex-col justify-between h-[230px] border-l-2 transition-all ${SEVERITY_CARD_STYLES[d.severity]}`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white text-xs">{d.title}</span>
                      <span className={`px-2 py-0.5 text-[8px] font-mono rounded ${SEVERITY_BADGES[d.severity]}`}>
                        {d.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                      {d.description}
                    </p>
                    <div className="p-2 rounded bg-slate-950/40 border border-slate-900 font-mono text-[10px] text-indigo-300">
                      <strong>Proposal:</strong> {d.recommendation}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-3 border-t border-slate-800/40 mt-auto">
                    <button
                      onClick={() => handleExecute(d.id, "Reject")}
                      className="px-2.5 py-1.5 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-mono rounded cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleExecute(d.id, "Accept")}
                      disabled={executingId !== null}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white text-[10px] font-bold font-mono rounded flex items-center gap-1 cursor-pointer"
                    >
                      {executingId === d.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                      Accept Allocation
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 2. Reorder Advisor (Replenishments) */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs text-amber-400 font-mono uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              📦 Supply Line Replenishment ({reorders.length})
            </h3>
            {reorders.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-600 border border-slate-850 rounded">
                All stock balances above reorder parameters.
              </div>
            ) : (
              reorders.map(d => (
                <div key={d.id} className={`glass-panel p-4 flex flex-col justify-between h-[230px] border-l-2 transition-all ${SEVERITY_CARD_STYLES[d.severity]}`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white text-xs">{d.title}</span>
                      <span className={`px-2 py-0.5 text-[8px] font-mono rounded ${SEVERITY_BADGES[d.severity]}`}>
                        {d.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                      {d.description}
                    </p>
                    <div className="p-2 rounded bg-slate-950/40 border border-slate-900 font-mono text-[10px] text-indigo-300">
                      <strong>Advisor:</strong> {d.recommendation}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-3 border-t border-slate-800/40 mt-auto">
                    <button
                      onClick={() => handleExecute(d.id, "Dismiss")}
                      className="px-2.5 py-1.5 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-mono rounded cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleExecute(d.id, "Approve")}
                      disabled={executingId !== null}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-slate-950 text-[10px] font-bold font-mono rounded flex items-center gap-1 cursor-pointer"
                    >
                      {executingId === d.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                      Approve Reorder
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 3. Operational Bottlenecks & Personnel */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs text-indigo-400 font-mono uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
              <Brain className="h-4 w-4 text-indigo-400" />
              👷 Operations & Staff Routing ({bottlenecks.length})
            </h3>
            {bottlenecks.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-600 border border-slate-850 rounded">
                Picking, packing and inspection queues running within nominal bounds.
              </div>
            ) : (
              bottlenecks.map(d => (
                <div key={d.id} className={`glass-panel p-4 flex flex-col justify-between h-[230px] border-l-2 transition-all ${SEVERITY_CARD_STYLES[d.severity]}`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white text-xs">{d.title}</span>
                      <span className={`px-2 py-0.5 text-[8px] font-mono rounded ${SEVERITY_BADGES[d.severity]}`}>
                        {d.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                      {d.description}
                    </p>
                    <div className="p-2 rounded bg-slate-950/40 border border-slate-900 font-mono text-[10px] text-indigo-300">
                      <strong>Resolution:</strong> {d.recommendation}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-3 border-t border-slate-800/40 mt-auto">
                    <button
                      onClick={() => handleExecute(d.id, "Dismiss")}
                      className="px-2.5 py-1.5 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-mono rounded cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleExecute(d.id, "Accept")}
                      disabled={executingId !== null}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-bold font-mono rounded flex items-center gap-1 cursor-pointer"
                    >
                      {executingId === d.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                      Optimize Staff
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

    </div>
  )
}

export default DecisionCenterView
