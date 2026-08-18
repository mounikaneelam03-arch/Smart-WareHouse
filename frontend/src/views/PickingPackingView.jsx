import React, { useState, useEffect } from 'react'
import { Compass, Box, User, ArrowRight, CheckSquare, Square, Check, RefreshCw } from 'lucide-react'

// Coordinate positions for visual layout drawing:
// Grid is 5x5:
// (0, 0) = Receiving
// (4, 4) = Packing
// Columns correspond to Zones: 1=A, 2=B, 3=C
// Rows correspond to Shelves: 1, 2, 3
const GRID_COORDS = {
  'Receiving': { x: 0, y: 4, label: 'RCV' },
  'Packing Station': { x: 4, y: 4, label: 'PCK' },
  'A1': { x: 1, y: 1, label: 'A1' }, 'A2': { x: 1, y: 2, label: 'A2' }, 'A3': { x: 1, y: 3, label: 'A3' },
  'B1': { x: 2, y: 1, label: 'B1' }, 'B2': { x: 2, y: 2, label: 'B2' }, 'B3': { x: 2, y: 3, label: 'B3' },
  'C1': { x: 3, y: 1, label: 'C1' }, 'C2': { x: 3, y: 2, label: 'C2' }, 'C3': { x: 3, y: 3, label: 'C3' }
}

function PickingPackingView({ orders = [], onRefresh, showToast, theme = 'light' }) {
  const safeOrders = orders || []
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [routeInfo, setRouteInfo] = useState(null)
  const [packedItems, setPackedItems] = useState({}) // item_id -> boolean
  const [isStepping, setIsStepping] = useState(false)

  // Filter orders by Picking or Packing statuses
  const pickingOrders = safeOrders.filter(o => o.status === 'Picking')
  const packingOrders = safeOrders.filter(o => o.status === 'Packing')

  // Set default selected order
  useEffect(() => {
    if (pickingOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(pickingOrders[0].id.toString())
    } else if (safeOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(safeOrders[0].id.toString())
    }
  }, [safeOrders, pickingOrders, selectedOrderId])

  // Fetch route optimization path for selected order
  const fetchRoute = async (orderId) => {
    if (!orderId) return
    try {
      const res = await fetch(`/api/orders/${orderId}/picking-route`)
      if (res.ok) {
        const data = await res.json()
        setRouteInfo(data)
      }
    } catch (err) {
      console.error("Failed to load picking route:", err)
    }
  }

  useEffect(() => {
    if (selectedOrderId) {
      fetchRoute(selectedOrderId)
    }
  }, [selectedOrderId, orders])

  // Advance stage (Complete Picking -> move to Packing, or Complete Packing -> QA)
  const handleStepStage = async (orderId, targetStage) => {
    setIsStepping(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/step`, {
        method: 'POST'
      })
      if (res.ok) {
        showToast(`Order #${orderId} progressed to ${targetStage}!`, "success")
        setPackedItems({})
        onRefresh()
      } else {
        showToast("Error advancing order.", "error")
      }
    } catch (err) {
      showToast("Server connection error.", "error")
    } finally {
      setIsStepping(false)
    }
  }

  // Packing Checklist Toggle
  const togglePacked = (itemId) => {
    setPackedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }

  // Grid visual helper: check if location is on optimized path
  const getPathOrder = (loc) => {
    if (!routeInfo || !routeInfo.optimized_route) return -1
    return routeInfo.optimized_route.indexOf(loc)
  }

  // Render Grid Layout cells
  const renderWarehouseGrid = () => {
    const gridRows = []
    // 5x5 grid cells
    for (let y = 0; y < 5; y++) {
      const rowCells = []
      for (let x = 0; x < 5; x++) {
        // Find which location matches coordinates
        const locEntry = Object.entries(GRID_COORDS).find(([name, coord]) => coord.x === x && coord.y === y)
        const locName = locEntry ? locEntry[0] : null
        const pathIndex = locName ? getPathOrder(locName) : -1
        const isOnPath = pathIndex !== -1

        let bgStyle = 'bg-slate-900/40 text-slate-600 border-slate-800'
        let borderStyle = 'border border-slate-850'
        
        if (locName === 'Receiving') {
          bgStyle = isOnPath ? 'bg-indigo-950 text-indigo-400 border-indigo-500/50' : 'bg-slate-950 text-slate-500 border-slate-800'
        } else if (locName === 'Packing Station') {
          bgStyle = isOnPath ? 'bg-purple-950 text-purple-400 border-purple-500/50' : 'bg-slate-950 text-slate-500 border-slate-800'
        } else if (isOnPath) {
          bgStyle = 'bg-blue-950 text-blue-300 border-blue-500/45 glow-blue'
        } else if (locName) {
          bgStyle = 'bg-slate-950/60 text-slate-400 border-slate-800'
        }

        rowCells.push(
          <div 
            key={`${x}-${y}`} 
            className={`h-11 rounded flex flex-col items-center justify-center font-mono text-[9px] relative transition-all duration-300 ${bgStyle} ${borderStyle}`}
          >
            {locName ? (
              <>
                <span className="font-bold">{GRID_COORDS[locName].label}</span>
                {isOnPath && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-indigo-500 text-white font-bold rounded-full flex items-center justify-center text-[8px] border border-slate-900">
                    {pathIndex}
                  </span>
                )}
              </>
            ) : (
              <span className="opacity-0">.</span>
            )}
          </div>
        )
      }
      gridRows.push(
        <div key={y} className="grid grid-cols-5 gap-3">
          {rowCells}
        </div>
      )
    }
    return <div className="space-y-3 p-3 bg-slate-950/40 border border-slate-900 rounded-lg">{gridRows}</div>
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      
      {/* COLUMN 1: PICKING OPTIMIZER */}
      <div className="glass-panel p-5 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-bold text-xs text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <Compass className="h-4.5 w-4.5 text-blue-400" />
            Optimized Picking Routes
          </h3>
          
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-[10px] text-blue-400 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select Order Path...</option>
            {orders.filter(o => o.status !== 'Dispatched').map(o => (
              <option key={o.id} value={o.id}>
                Order #{o.id} ({o.status} - {o.customer})
              </option>
            ))}
          </select>
        </div>

        {routeInfo && routeInfo.optimized_route ? (
          <div className="space-y-5">
            
            {/* Visual Warehouse Grid */}
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-2">
                <span>WAREHOUSE MAP // SOUTH LAYOUT GRID</span>
                <span>0=Start, Last=Finish</span>
              </div>
              {renderWarehouseGrid()}
            </div>

            {/* Path description */}
            <div className="p-3.5 rounded bg-blue-950/15 border border-blue-500/20 space-y-3 font-mono text-xs">
              <div className="font-bold text-blue-400 uppercase text-[10px]">
                🤖 Route Optimization Dispatch
              </div>
              <div className="flex flex-wrap items-center gap-2 text-indigo-300">
                {routeInfo.optimized_route.map((loc, idx) => (
                  <React.Fragment key={idx}>
                    <span className={`px-2 py-0.5 rounded ${loc === 'Receiving' ? 'bg-slate-800' : loc === 'Packing Station' ? 'bg-slate-800' : 'bg-blue-600/25 border border-blue-500/30 font-bold'}`}>
                      {loc}
                    </span>
                    {idx < routeInfo.optimized_route.length - 1 && <ArrowRight className="h-3 w-3 text-slate-600" />}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Manhattan routing distance minimized. Picker sequence prioritized to restrict zone crossing.
              </p>

              {/* Action Button: Finish Picking */}
              {orders.find(o => o.id === routeInfo.order_id)?.status === 'Picking' && (
                <div className="pt-2">
                  <button
                    onClick={() => handleStepStage(routeInfo.order_id, 'Packing')}
                    disabled={isStepping}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded transition cursor-pointer"
                  >
                    Complete Picking & Send to Packing
                  </button>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-600 font-mono text-xs">
            Select an order to calculate picking route.
          </div>
        )}
      </div>

      {/* COLUMN 2: PACKING STATION */}
      <div className="glass-panel p-5 space-y-5">
        <h3 className="font-bold text-xs text-white font-mono uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-800">
          <Box className="h-4.5 w-4.5 text-purple-400" />
          Packing Station Workstation
        </h3>

        {packingOrders.length === 0 ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-500">
              <Box className="h-6 w-6" />
            </div>
            <div className="font-mono text-xs text-slate-500">
              Packing queue empty. Waiting for picker dispatch batches.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {packingOrders.map(order => {
              const allChecked = order.items.every(item => packedItems[item.id])
              return (
                <div key={order.id} className="p-4 rounded-lg bg-[#0c1220] border border-slate-800 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-white font-mono">Order #{order.id}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Client: {order.customer}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      PACKING QUEUE
                    </span>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-2">
                    <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                      Item Packing Verification Checklist
                    </span>
                    {order.items.map(item => (
                      <div
                        key={item.id}
                        onClick={() => togglePacked(item.id)}
                        className={`p-2.5 rounded border flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                          packedItems[item.id]
                            ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-300'
                            : 'bg-slate-950 border-slate-850 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {packedItems[item.id] ? (
                            <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-500 shrink-0" />
                          )}
                          <span>{item.sku}</span>
                          <span className="text-[10px] text-slate-500 font-sans">{item.product_name}</span>
                        </div>
                        <span>Pack Qty: <strong>{item.allocated_quantity}</strong></span>
                      </div>
                    ))}
                  </div>

                  {/* Packing Submit */}
                  <div>
                    <button
                      onClick={() => handleStepStage(order.id, 'Quality Check')}
                      disabled={!allChecked || isStepping}
                      className={`w-full py-2 font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        allChecked
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow shadow-emerald-950'
                          : 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <Check className="h-4.5 w-4.5" />
                      Confirm Packing & Route to QA Inspector
                    </button>
                    {!allChecked && (
                      <span className="block text-center text-[9px] font-mono text-slate-500 mt-2">
                        Verify and check off all line items to authorize QA routing.
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

export default PickingPackingView
