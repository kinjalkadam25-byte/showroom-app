import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import CustomerForm from './CustomerForm'
import CustomerDetail from './CustomerDetail'

export default function CustomerList() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  async function deleteCustomer(id) {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  // Show customer detail view
  if (selectedCustomer) {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        onBack={() => { setSelectedCustomer(null); fetchCustomers() }}
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Customers</h2>
        <button
          onClick={() => { setEditingCustomer(null); setShowForm(true) }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          + Add Customer
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, phone, or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No customers found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td
                    className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:underline"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{c.address || '—'}</td>
                  <td className="px-4 py-3 flex gap-3">
                    <button
                      onClick={() => { setEditingCustomer(c); setShowForm(true) }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCustomer(c.id)}
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

      {/* Add/Edit Form Modal */}
      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onClose={() => { setShowForm(false); setEditingCustomer(null) }}
          onSave={() => { setShowForm(false); setEditingCustomer(null); fetchCustomers() }}
        />
      )}
    </div>
  )
}
