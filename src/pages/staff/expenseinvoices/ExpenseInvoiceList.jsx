import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import ExpenseInvoiceForm from './ExpenseInvoiceForm'
import ExpenseInvoiceDetail from './ExpenseInvoiceDetail'

export default function ExpenseInvoiceList() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [view, setView]         = useState('list') // 'list' | 'form' | 'detail'
  const [selected, setSelected] = useState(null)
  const [editing, setEditing]   = useState(null)

  useEffect(() => { fetchInvoices() }, [])

  async function fetchInvoices() {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('expense_invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) { setError('Failed to load expense invoices.'); setLoading(false); return }
    setInvoices(data || [])
    setLoading(false)
  }

  async function openDetail(inv) {
    const { data } = await supabase
      .from('expense_invoices')
      .select('*, expense_invoice_items(*)')
      .eq('id', inv.id)
      .single()
    setSelected(data)
    setView('detail')
  }

  async function openEdit(inv) {
    const { data } = await supabase
      .from('expense_invoices')
      .select('*, expense_invoice_items(*)')
      .eq('id', inv.id)
      .single()
    setEditing(data)
    setView('form')
  }

  async function deleteInvoice(id) {
    if (!confirm('Delete this expense invoice? This cannot be undone.')) return
    const { error: err } = await supabase.from('expense_invoices').delete().eq('id', id)
    if (err) { alert('Failed to delete: ' + err.message); return }
    fetchInvoices()
  }

  const filtered = invoices.filter(inv =>
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.po_no?.toLowerCase().includes(search.toLowerCase())
  )

  if (view === 'form') {
    return (
      <ExpenseInvoiceForm
        invoice={editing}
        onBack={() => { setView('list'); setEditing(null) }}
        onSave={() => { setView('list'); setEditing(null); fetchInvoices() }}
      />
    )
  }

  if (view === 'detail') {
    return (
      <ExpenseInvoiceDetail
        invoice={selected}
        onBack={() => { setView('list'); setSelected(null) }}
        onEdit={inv => { setEditing(inv); setView('form') }}
        onRefresh={async () => {
          const { data } = await supabase
            .from('expense_invoices')
            .select('*, expense_invoice_items(*)')
            .eq('id', selected.id)
            .single()
          setSelected(data)
          fetchInvoices()
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Expense Invoices</h2>
          <p className="text-sm text-gray-500 mt-0.5">B2B invoices sent to VST Tillers Tractors Ltd</p>
        </div>
        <button
          onClick={() => { setEditing(null); setView('form') }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          + New Expense Invoice
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by invoice number or PO number…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">
          {invoices.length === 0 ? 'No expense invoices yet.' : 'No results match your search.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">PO No</th>
                <th className="px-4 py-3 font-medium">Place of Supply</th>
                <th className="px-4 py-3 font-medium text-right">Net Amount</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50 transition">
                  <td
                    className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:underline"
                    onClick={() => openDetail(inv)}
                  >
                    {inv.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inv.invoice_date}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.po_no || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.place_of_supply || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    ₹{Number(inv.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
