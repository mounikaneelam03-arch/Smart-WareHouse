import React, { useState } from 'react'
import { Search, RotateCcw, AlertTriangle, Play, Truck, HelpCircle, Plus, Boxes } from 'lucide-react'

function InventoryView({ products = [], onRefresh, showToast, theme = 'light' }) {
  const safeProducts = products || []
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [restockSku, setRestockSku] = useState(null)
  const [restockQty, setRestockQty] = useState(50)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // New Product form state
  const [newSku, setNewSku] = useState('SKU-106')
  const [newName, setNewName] = useState('Logitech C920 Pro HD Webcam')
  const [newCategory, setNewCategory] = useState('Peripherals')
  const [newLocation, setNewLocation] = useState('C3')
  const [newTotalStock, setNewTotalStock] = useState(25)
  const [newReorderLevel, setNewReorderLevel] = useState(10)
  const [newReorderQty, setNewReorderQty] = useState(50)

  // 1. Get Categories
  const categories = ['All', ...new Set(safeProducts.map(p => p.category))]

  // 2. Filter products safely
  const filteredProducts = safeProducts.filter(p => {
    const matchesSearch = (p.sku || '').toLowerCase().includes(search.toLowerCase()) || 
                          (p.name || '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  // 2. Add New Product Handler
  const handleAddProduct = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    const productPayload = {
      sku: newSku,
      name: newName,
      category: newCategory,
      location: newLocation,
      total_stock: Number(newTotalStock),
      reserved_stock: 0,
      reorder_level: Number(newReorderLevel),
      reorder_quantity: Number(newReorderQty),
      status: Number(newTotalStock) <= Number(newReorderLevel) ? 'Low Stock' : 'Healthy'
    }

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload)
      })

      if (res.ok) {
        showToast(`Successfully added stock for ${newSku} (${newName})!`, "success")
        setShowAddModal(false)
        onRefresh()
      } else {
        const err = await res.json()
        showToast(`Failed to add stock: ${err.detail || 'check parameters'}`, "error")
      }
    } catch (err) {
      showToast("Server connection error.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. Trigger Reorder API
  const handleReorder = async (sku, qty) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/products/reorder?sku=${sku}&qty=${qty}`, {
        method: 'POST'
      })
      if (res.ok) {
        showToast(`Stock replenishment order approved for ${sku}!`, "success")
        setRestockSku(null)
        onRefresh()
      } else {
        showToast("Failed to process reorder command.", "error")
      }
    } catch (err) {
      showToast("Server connection error.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4. Status Badge components
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Healthy':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 glow-green">
            🟢 HEALTHY
          </span>
        )
      case 'Low Stock':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-amber-500/10 text-amber-400 border border-amber-500/25 glow-yellow">
            🟡 LOW STOCK
          </span>
        )
      case 'Critical':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-orange-500/10 text-orange-400 border border-orange-500/25 glow-orange">
            🔴 CRITICAL
          </span>
        )
      case 'Out of Stock':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 glow-red animate-pulse">
            ⚫ OUT OF STOCK
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-slate-500/10 text-slate-400 border border-slate-500/25">
            UNKNOWN
          </span>
        )
    }
  }

  // Find products below reorder level for side advisory
  const lowStockProducts = safeProducts.filter(p => (p.available_stock || 0) <= (p.reorder_level || 0))

  return (
    <div className="space-y-6">
      
      {/* Search and Filters row */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/30 p-4 rounded-lg border border-slate-800">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by SKU or Product Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          {/* Category */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-gray-500">CATEGORY:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-[11px] text-indigo-300 focus:outline-none focus:border-indigo-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-gray-500">STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-[11px] text-indigo-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All</option>
              <option value="Healthy">Healthy</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Critical">Critical</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>

          {/* Clear Filters */}
          <button
            onClick={() => { setSearch(''); setCategoryFilter('All'); setStatusFilter('All'); }}
            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Reset Filters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Add New Stock Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-mono text-xs font-bold tracking-wider transition-all duration-200 shadow-md shadow-indigo-500/20 cursor-pointer ml-auto"
          >
            <Plus className="h-4 w-4" />
            <span>ADD NEW STOCK</span>
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Product Table (Takes 3 columns) */}
        <div className="lg:col-span-3 glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">SKU / ID</th>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4 text-center">Location</th>
                  <th className="py-3 px-4 text-right">Physical Stock</th>
                  <th className="py-3 px-4 text-right">Allocated</th>
                  <th className="py-3 px-4 text-right">Available</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-slate-500">
                      No matching inventory items registered in current sub-grid.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-300">{p.sku}</td>
                      <td className="py-3 px-4">
                        <div className="font-sans text-sm font-medium text-white">{p.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{p.category}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-400">{p.location}</td>
                      <td className="py-3 px-4 text-right text-gray-300">{p.total_stock}</td>
                      <td className="py-3 px-4 text-right text-indigo-300">{p.reserved_stock}</td>
                      <td className="py-3 px-4 text-right font-bold text-white">{p.available_stock}</td>
                      <td className="py-3 px-4 text-center">{renderStatusBadge(p.status)}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setRestockSku(p.sku)}
                          className="px-2 py-1 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-600 hover:text-white transition cursor-pointer"
                        >
                          RESTOCK
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Reorder Recommendations advisor */}
        <div className="glass-panel p-5 bg-slate-900/30 self-start space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            <h3 className="font-bold text-xs text-white font-mono uppercase tracking-wider">
              REORDER ADVISOR
            </h3>
          </div>

          <div className="space-y-4">
            {lowStockProducts.length === 0 ? (
              <div className="text-[11px] text-slate-500 font-mono leading-relaxed">
                All inventory items are currently above safety thresholds. Stock levels are healthy.
              </div>
            ) : (
              lowStockProducts.map(p => (
                <div key={p.id} className="p-3 rounded bg-amber-500/5 border border-amber-500/15 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-400">{p.sku}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Reorder Lvl: {p.reorder_level}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Available stock is <strong className="text-white">{p.available_stock}</strong>. Stock depleted below reorder safety margin.
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-500">Rec: +{p.reorder_quantity} units</span>
                    <button
                      onClick={() => handleReorder(p.sku, p.reorder_quantity)}
                      disabled={isSubmitting}
                      className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-slate-950 font-mono text-[9px] rounded transition cursor-pointer"
                    >
                      Restock
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Restock Modal Dialog */}
      {restockSku && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="glass-panel p-6 w-96 bg-[#0c1220] border-indigo-500/30">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
              <Truck className="h-4.5 w-4.5 text-indigo-400" />
              INVENTORY INBOUND LOGISTICS
            </h3>
            
            <div className="space-y-4">
              <div className="text-xs font-mono text-slate-400">
                Registering stock replenishment for product: <strong className="text-white font-sans">{restockSku}</strong>
              </div>
              
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1">
                  Replenishment Quantity (Units)
                </label>
                <input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded font-mono text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setRestockSku(null)}
                  className="px-3 py-1.5 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReorder(restockSku, restockQty)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded flex items-center gap-1.5 cursor-pointer"
                >
                  Confirm Inbound
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="glass-panel p-6 w-[450px] bg-[#0c1220] border-indigo-500/30 overflow-y-auto max-h-[90vh]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
              <Boxes className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
              ADD NEW INVENTORY STOCK / SKU
            </h3>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Product SKU Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. SKU-106"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Electronics, Peripherals"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                  Product Name / Description
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Dell UltraSharp 32 4K Monitor"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Warehouse Bin Location
                  </label>
                  <input
                    type="text"
                    required
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. A3, B2, C1"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Initial Physical Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newTotalStock}
                    onChange={(e) => setNewTotalStock(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Safety Reorder Level
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newReorderLevel}
                    onChange={(e) => setNewReorderLevel(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-slate-500 uppercase mb-1">
                    Reorder Batch Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newReorderQty}
                    onChange={(e) => setNewReorderQty(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded cursor-pointer shadow-md shadow-indigo-500/20"
                >
                  Add Inventory Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default InventoryView
