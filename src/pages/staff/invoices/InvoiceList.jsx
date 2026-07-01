import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import InvoiceForm from './InvoiceForm'
import InvoiceDetail from './InvoiceDetail'

function getStatus(invoice) {
  if (invoice.paid) return 'paid'
  if (invoice.due_date && new Date(invoice.due_date) < new Date()) return 'overdue'
  return 'unpaid'
}

const STATUS_STYLES = {
  paid:    'bg-green-100 text-green-700',
  unpaid:  'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-600',
}

export default function InvoiceList() {
  const [invoices, setInvoices]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView]                 = useState('list') // 'list' | 'detail' | 'form'
  const [selected, setSelected]         = useState(null)
  const [editing, setEditing]           = useState(null)

  useEffect(() => { fetchInvoices() }, [])

  async function fetchInvoices() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
    setInvoices(data || [])
    setLoading(false)
  }

  async function openDetail(inv) {
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name, phone, email), invoice_items(*)')
      .eq('id', inv.id)
      .single()
    setSelected(data)
    setView('detail')
  }

  async function openEdit(inv) {
    const { data } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', inv.id)
      .single()
    setEditing(data)
    setView('form')
  }

  async function refreshDetail() {
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name, phone, email), invoice_items(*)')
      .eq('id', selected.id)
      .single()
    setSelected(data)
    fetchInvoices()
  }

  async function deleteInvoice(id) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) { alert(`Failed to delete invoice: ${error.message}`); return }
    fetchInvoices()
  }

  const filtered = invoices.filter(inv => {
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customers?.name?.toLowerCase().includes(search.toLowerCase())
    const status = getStatus(inv)
    const matchesStatus = statusFilter === 'all' || status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (view === 'form') {
    return (
      <InvoiceForm
        invoice={editing}
        onBack={() => { setView('list'); setEditing(null) }}
        onSave={() => { setView('list'); setEditing(null); fetchInvoices() }}
      />
    )
  }

  if (view === 'detail') {
    return (
      <InvoiceDetail
        invoice={selected}
        onBack={() => { setView('list'); setSelected(null) }}
        onEdit={inv => { setEditing(inv); setView('form') }}
        onRefresh={refreshDetail}
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Invoices</h2>
        <button
          onClick={() => { setEditing(null); setView('form') }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          + New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by invoice number or customer…"
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
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No invoices found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(inv => {
                const status = getStatus(inv)
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition">
                    <td
                      className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:underline"
                      onClick={() => openDetail(inv)}
                    >
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.customers?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.invoice_date}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.due_date || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-3">
                      <button
                        onClick={() => openEdit(inv)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteInvoice(inv.id)}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
