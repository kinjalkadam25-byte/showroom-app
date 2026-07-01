import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import QuotationForm from './QuotationForm'
import QuotationDetail from './QuotationDetail'

const STATUS_STYLES = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired:  'bg-yellow-100 text-yellow-700',
}

export default function QuotationList() {
  const [quotations, setQuotations]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView]               = useState('list') // 'list' | 'detail' | 'form'
  const [selected, setSelected]       = useState(null)
  const [editing, setEditing]         = useState(null)

  useEffect(() => { fetchQuotations() }, [])

  async function fetchQuotations() {
    setLoading(true)
    const { data } = await supabase
      .from('quotations')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
    setQuotations(data || [])
    setLoading(false)
  }

  async function openDetail(q) {
    const { data } = await supabase
      .from('quotations')
      .select('*, customers(name, phone, email), quotation_items(*)')
      .eq('id', q.id)
      .single()
    setSelected(data)
    setView('detail')
  }

  async function openEdit(q) {
    const { data } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', q.id)
      .single()
    setEditing(data)
    setView('form')
  }

  async function refreshDetail() {
    const { data } = await supabase
      .from('quotations')
      .select('*, customers(name, phone, email), quotation_items(*)')
      .eq('id', selected.id)
      .single()
    setSelected(data)
    fetchQuotations()
  }

  async function deleteQuotation(id) {
    if (!confirm('Delete this quotation? This cannot be undone.')) return
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) { alert(`Failed to delete quotation: ${error.message}`); return }
    fetchQuotations()
  }

  const filtered = quotations.filter(q => {
    const matchesSearch =
      q.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.customers?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (view === 'form') {
    return (
      <QuotationForm
        quotation={editing}
        onBack={() => { setView('list'); setEditing(null) }}
        onSave={() => { setView('list'); setEditing(null); fetchQuotations() }}
      />
    )
  }

  if (view === 'detail') {
    return (
      <QuotationDetail
        quotation={selected}
        onBack={() => { setView('list'); setSelected(null) }}
        onEdit={q => { setEditing(q); setView('form') }}
        onRefresh={refreshDetail}
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Quotations</h2>
        <button
          onClick={() => { setEditing(null); setView('form') }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          + New Quotation
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by quotation number or customer…"
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
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No quotations found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Quotation #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Valid Until</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 transition">
                  <td
                    className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:underline"
                    onClick={() => openDetail(q)}
                  >
                    {q.quotation_number}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{q.customers?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(q.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{q.valid_until || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    ₹{Number(q.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[q.status] || ''}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-3">
                    <button
                      onClick={() => openEdit(q)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteQuotation(q.id)}
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
    </div>
  )
}
