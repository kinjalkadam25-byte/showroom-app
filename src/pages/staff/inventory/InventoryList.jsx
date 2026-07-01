import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import InventoryForm from './InventoryForm'

const STATUS_STYLES = {
  available: 'bg-green-100 text-green-700',
  reserved:  'bg-yellow-100 text-yellow-700',
  sold:      'bg-gray-100 text-gray-500',
}

export default function InventoryList() {
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm]     = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    setFetchError('')
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('make', { ascending: true })
    if (error) {
      console.error('Inventory fetch error:', error)
      setFetchError(error.message)
    }
    setItems(data || [])
    setLoading(false)
  }

  async function deleteItem(id) {
    if (!confirm('Delete this inventory item? This cannot be undone.')) return
    await supabase.from('inventory').delete().eq('id', id)
    fetchItems()
  }

  const filtered = items.filter(item => {
    const matchesSearch =
      item.make.toLowerCase().includes(search.toLowerCase()) ||
      item.model.toLowerCase().includes(search.toLowerCase()) ||
      item.chassis_number?.toLowerCase().includes(search.toLowerCase()) ||
      String(item.year).includes(search)

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
        <button
          onClick={() => { setEditingItem(null); setShowForm(true) }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          + Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by make, model, year, or chassis number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      {/* Table */}
      {fetchError && (
        <p className="text-red-500 text-sm mb-4">Error loading inventory: {fetchError}</p>
      )}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No inventory items found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Make / Model</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">HP</th>
                <th className="px-4 py-3 font-medium">Fuel</th>
                <th className="px-4 py-3 font-medium">Chassis No.</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.make} {item.model}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.year}</td>
                  <td className="px-4 py-3 text-gray-600">{item.hp ? `${item.hp} HP` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{item.fuel_type || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.chassis_number || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.price != null ? `₹${Number(item.price).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[item.status] || 'bg-gray-100 text-gray-500'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-3">
                    <button
                      onClick={() => { setEditingItem(item); setShowForm(true) }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <InventoryForm
          item={editingItem}
          onClose={() => { setShowForm(false); setEditingItem(null) }}
          onSave={() => { setShowForm(false); setEditingItem(null); fetchItems() }}
        />
      )}
    </div>
  )
}
