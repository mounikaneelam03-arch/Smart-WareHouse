import React, { useState } from 'react'
import { Plus, User, Award, ShieldAlert, ShoppingBag, ShoppingCart, Eye, Play, EyeOff } from 'lucide-react'

const PRIORITY_BADGES = {
  Critical: 'bg-rose-500/10 text-rose-400 border-rose-500/25 glow-red',
  High: 'bg-orange-500/10 text-orange-400 border-orange-500/25 glow-orange',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/25 glow-yellow',
  Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 glow-green'
}

const STATUS_STAGES = {
  Created: { label: 'Created', color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/5' },
  Allocated: { label: 'Allocated', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' },
  Picking: { label: 'Picking', color: 'text-blue-400 border-blue-500/30 bg-blue-500/5' },
  Packing: { label: 'Packing', color: 'text-purple-400 border-purple-500/30 bg-purple-500/5' },
  'Quality Check': { label: 'QA Check', color: 'text-amber-400 border-amber-500/30 bg-amber-500/5' },
  'Ready for Dispatch': { label: 'Ready', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5' },
  Dispatched: { label: 'Dispatched', color: 'text-slate-400 border-slate-700 bg-slate-800/10' }
}

function OrdersView({ orders = [], products = [], onRefresh, showToast, theme = 'light' }) {
  const [statusFilter, setStatusFilter] = useState('All')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState(null)
  
  // Create Order state
  const [customer, setCustomer] = useState('Netflix Logistics')
  const [customerType, setCustomerType] = useState('VIP')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(10)
  const [deliveryHours, setDeliveryHours] = useState(2)
  const [value, setValue] = useState(15000)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isLight = theme === 'light'
  const safeProducts = products || []
  const safeOrders = orders || []

  // Initial set of product selections
  React.useEffect(() => {
    if (safeProducts.length > 0 && !productId) {
      setProductId(safeProducts[0].id.toString())
    }
  }, [safeProducts, productId])

  // Pre-fill templates
  const applyTemplate = (type) => {
    if (safeProducts.length === 0) return

    if (type === 'VIP_SHORTAGE') {
      setCustomer('Google Inc.')
      setCustomerType('VIP')
      const laptop = safeProducts.find(p => p.sku === 'SKU-101') || safeProducts[0]
      if (laptop) setProductId(laptop.id.toString())
      setQuantity(10)
      setDeliveryHours(2)
      setValue(15000)
    } else if (type === 'STANDARD_PERIPHERAL') {
      setCustomer('John Smith')
      setCustomerType('Regular')
      const mouse = safeProducts.find(p => p.sku === 'SKU-102') || safeProducts[0]
      if (mouse) setProductId(mouse.id.toString())
      setQuantity(5)
      setDeliveryHours(48)
      setValue(350)
    } else if (type === 'PREMIUM_MONITOR') {
      setCustomer('SpaceX HQ')
      setCustomerType('Premium')
      const monitor = safeProducts.find(p => p.sku === 'SKU-103') || safeProducts[0]
      if (monitor) setProductId(monitor.id.toString())
      setQuantity(3)
      setDeliveryHours(12)
      setValue(2400)
    }
  }

  // Create Order Submit handler
  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (!productId) return

    setIsSubmitting(true)
    const requiredDate = new Date()
    requiredDate.setHours(requiredDate.getHours() + Number(deliveryHours))

    const orderData = {
      customer,
      required_delivery_date: requiredDate.toISOString(),
      order_value: Number(value),
      customer_type: customerType,
      items: [
        {
          product_id: Number(productId),
          quantity: Number(quantity)
        }
      ]
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      if (res.ok) {
        showToast("New Order registered and queued for priority allocation!", "success")
        setShowCreateModal(false)
        onRefresh()
      } else {
        const err = await res.json()
        showToast(`Failed to register order: ${err.detail || 'check parameters'}`, "error")
      }
    } catch (err) {
      showToast("Server connection error.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Advance pipeline status helper
  const handleStepOrder = async (orderId) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/step`, {
        method: 'POST'
      })
      if (res.ok) {
        showToast(`Advanced Order #${orderId} to next fulfillment stage.`, "success")
        onRefresh()
      } else {
        const data = await res.json()
        showToast(`Pipeline check: ${data.detail}`, "error")
      }
    } catch (err) {
      showToast("Server connection error.", "error")
    }
  }

  // Filter orders
  const filteredOrders = statusFilter === 'All' 
    ? orders 
    : orders.filter(o => o.status === statusFilter)

  return (
    <div className="space-y-6">
      
      {/* Header operations row */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/30 p-4 rounded-lg border border-slate-800">
        
        {/* Stage selection filters */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-gray-500 uppercase">PIPELINE FILTER:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 font-mono text-[11px] text-indigo-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="All">All Pipeline Stages</option>
            <option value="Created">Created (Waiting)</option>
            <option value="Allocated">Allocated</option>
            <option value="Picking">Picking</option>
            <option value="Packing">Packing</option>
            <option value="Quality Check">QA Check</option>
            <option value="Ready for Dispatch">Ready for Dispatch</option>
            <option value="Dispatched">Dispatched (Completed)</option>
          </select>
        </div>

        {/* Create Order button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold tracking-wider transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          CREATE ORDER
        </button>
      </div>

      {/* Orders Table Panel */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4 text-center">Class</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4 text-center">Priority</th>
                <th className="py-3 px-4 text-right">Value</th>
                <th className="py-3 px-4 text-center">Delivery Target</th>
                <th className="py-3 px-4 text-center">Pipeline State</th>
                <th className="py-3 px-4 text-center">Flow Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 font-mono text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-10 text-center text-slate-500">
                    No active fulfillment orders in this pipeline block.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isExpanded = expandedOrder === o.id
                  const hasShortage = o.items.some(i => i.allocated_quantity < i.quantity)
                  return (
                    <React.Fragment key={o.id}>
                      <tr className={`hover:bg-slate-900/10 transition-colors ${o.status === 'Dispatched' ? 'opacity-70' : ''}`}>
                        <td className="py-3.5 px-4 font-bold text-indigo-400">#{o.id}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-sans text-sm font-medium text-white">{o.customer}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Ingested: {new Date(o.order_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 text-[9px] rounded font-semibold ${
                            o.customer_type === 'VIP' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' :
                            o.customer_type === 'Premium' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                            'bg-slate-500/10 text-slate-400 border border-slate-500/25'
                          }`}>
                            {o.customer_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-white text-sm">{o.priority_score}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] border font-bold uppercase tracking-wider ${PRIORITY_BADGES[o.priority_level]}`}>
                            {o.priority_level}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-300 font-semibold">${o.order_value.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-center text-slate-400">
                          <div className="text-[11px] text-white">
                            {new Date(o.required_delivery_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-[9px] text-slate-500">
                            By {new Date(o.required_delivery_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] border font-medium uppercase ${STATUS_STAGES[o.status]?.color || 'text-slate-400'}`}>
                            {STATUS_STAGES[o.status]?.label || o.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 flex items-center justify-center gap-2">
                          <button
                            onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 transition cursor-pointer"
                            title={isExpanded ? "Hide Details" : "Show Details"}
                          >
                            {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          
                          {o.status !== 'Dispatched' && (
                            <button
                              onClick={() => handleStepOrder(o.id)}
                              className="flex items-center gap-1 px-2 py-1 text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded hover:bg-emerald-600 hover:text-white transition font-mono cursor-pointer"
                              title="Advance Order Pipeline Stage"
                            >
                              <Play className="h-2.5 w-2.5" />
                              STEP
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-900/25 border-b border-slate-850">
                          <td colSpan="9" className="py-4 px-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Items list */}
                              <div>
                                <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                                  <ShoppingBag className="h-3.5 w-3.5 text-indigo-400" />
                                  Ordered Line Items
                                </h4>
                                <div className="space-y-1.5">
                                  {o.items.map(item => {
                                    const shortage = item.quantity - item.allocated_quantity
                                    return (
                                      <div key={item.id} className="p-2 rounded bg-slate-950/40 border border-slate-850 flex justify-between items-center text-[11px]">
                                        <div>
                                          <span className="font-bold text-white">{item.sku}</span>
                                          <span className="text-gray-500 ml-2 font-sans">{item.product_name}</span>
                                        </div>
                                        <div className="flex gap-4 items-center">
                                          <span className="text-gray-500">Zone-Location: <strong className="text-indigo-400">{item.location}</strong></span>
                                          <span>Qty: <strong className="text-white">{item.quantity}</strong></span>
                                          <span>Allocated: <strong className={item.allocated_quantity === item.quantity ? "text-emerald-400" : "text-amber-400"}>
                                            {item.allocated_quantity}/{item.quantity}
                                          </strong></span>
                                          {shortage > 0 && (
                                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[9px] animate-pulse">
                                              Shortage: -{shortage}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Priority & Exception analysis */}
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                                    <Award className="h-3.5 w-3.5 text-indigo-400" />
                                    Decision Engine Scoring Audit
                                  </h4>
                                  <div className="p-2.5 rounded bg-slate-950/40 border border-slate-850 text-[11px] leading-relaxed text-slate-300">
                                    <strong className="text-indigo-300">Scoring breakdown:</strong> {o.priority_reason || "Calculated systematically based on urgencies."}
                                  </div>
                                </div>

                                {o.exceptions.length > 0 && (
                                  <div>
                                    <h4 className="font-bold text-[10px] text-rose-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                                      <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                                      Active Exceptions logged
                                    </h4>
                                    <div className="space-y-1.5">
                                      {o.exceptions.filter(exc => exc.status === 'Active').map(exc => (
                                        <div key={exc.id} className="p-2.5 rounded bg-rose-950/15 border border-rose-500/20 text-[11px] text-rose-200">
                                          <div className="font-bold text-rose-400 uppercase text-[9px] mb-1 font-mono">{exc.type}</div>
                                          <p className="leading-relaxed">{exc.description}</p>
                                          <div className="mt-1 font-mono text-[9px] text-rose-300/80">Rec: {exc.recommendation}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="glass-panel p-6 w-[450px] bg-[#0c1220] border-indigo-500/30 overflow-y-auto max-h-[90vh]">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingCart className="h-4.5 w-4.5 text-indigo-400" />
              INGEST NEW WORK ORDER
            </h3>
            
            {/* Quick Templates picker */}
            <div className="mb-4 p-3 rounded bg-slate-900/40 border border-slate-800 space-y-2">
              <label className="block text-[9px] font-mono text-slate-500 uppercase">
                LOAD DEMO TEMPLATE FOR SPEED
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyTemplate('VIP_SHORTAGE')}
                  className="px-2 py-1 text-[9px] font-mono rounded bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-600 hover:text-white cursor-pointer"
                >
                  VIP Shortage Laptop (Order #104)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('STANDARD_PERIPHERAL')}
                  className="px-2 py-1 text-[9px] font-mono rounded bg-slate-700/50 border border-slate-650 text-slate-300 hover:bg-slate-650 hover:text-white cursor-pointer"
                >
                  Standard Peripheral
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('PREMIUM_MONITOR')}
                  className="px-2 py-1 text-[9px] font-mono rounded bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-600 hover:text-white cursor-pointer"
                >
                  Premium Monitors
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Customer Account Priority
                  </label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Regular">Regular</option>
                    <option value="Premium">Premium (Tier 2)</option>
                    <option value="VIP">VIP (Tier 1)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Select Product SKU
                  </label>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {safeProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.sku} ({p.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Required Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Delivery Urgency (Hours Left)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={deliveryHours}
                    onChange={(e) => setDeliveryHours(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Estimated Order Value ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded cursor-pointer"
                >
                  Ingest Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default OrdersView
