import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import LedgerForm from './LedgerForm'

const CATEGORY_LABELS = {
  sale:             'Sale',
  service:          'Service',
  payment_received: 'Payment Received',
  expense:          'Expense',
  purchase:         'Purchase',
  salary:           'Salary',
  other:            'Other',
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

export default function LedgerList() {
  const [entries, setEntries]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [month, setMonth]           = useState(currentMonth())
  const [typeFilter, setTypeFilter] = useState('all')
  const [showForm, setShowForm]     = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)

  useEffect(() => { fetchEntries() }, [month])

  async function fetchEntries() {
    setLoading(true)
    const from = `${month}-01`
    const to   = new Date(month.slice(0, 4), month.slice(5, 7), 0)
                   .toISOString().slice(0, 10) // last day of month

    const { data } = await supabase
      .from('ledger_entries')
      .select('*, customers(name)')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })

    setEntries(data || [])
    setLoading(false)
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this ledger entry?')) return
    const { error } = await supabase.from('ledger_entries').delete().eq('id', id)
    if (error) { alert(`Failed to delete entry: ${error.message}`); return }
    fetchEntries()
  }

  const filtered = typeFilter === 'all'
    ? entries
    : entries.filter(e => e.type === typeFilter)

  const totalCredits = entries.filter(e => e.type === 'credit').reduce((s, e) => s + Number(e.amount), 0)
  const totalDebits  = entries.filter(e => e.type === 'debit').reduce((s, e) => s + Number(e.amount), 0)
  const netBalance   = totalCredits - totalDebits

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Ledger</h2>
        <button
          onClick={() => { setEditingEntry(null); setShowForm(true) }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          + New Entry
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total In</p>
          <p className="text-xl font-bold text-green-600">₹{totalCredits.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total Out</p>
          <p className="text-xl font-bold text-red-500">₹{totalDebits.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Net Balance</p>
          <p className={`text-xl font-bold ${netBalance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
            {netBalance < 0 ? '−' : ''}₹{Math.abs(netBalance).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="all">All</option>
          <option value="credit">Credits</option>
          <option value="debit">Debits</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No entries for this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{entry.date}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{entry.description}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {CATEGORY_LABELS[entry.category] || entry.category}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{entry.customers?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{entry.reference || '—'}</td>
                  <td className={`px-4 py-3 font-semibold text-right whitespace-nowrap ${
                    entry.type === 'credit' ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {entry.type === 'credit' ? '+' : '−'}₹{Number(entry.amount).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 flex gap-3">
                    <button
                      onClick={() => { setEditingEntry(entry); setShowForm(true) }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
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
        <LedgerForm
          entry={editingEntry}
          onClose={() => { setShowForm(false); setEditingEntry(null) }}
          onSave={() => { setShowForm(false); setEditingEntry(null); fetchEntries() }}
        />
      )}
    </div>
  )
}
