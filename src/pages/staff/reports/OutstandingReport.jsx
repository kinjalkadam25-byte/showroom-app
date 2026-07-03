import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function getStatus(invoice) {
  if (invoice.due_date && new Date(invoice.due_date) < new Date()) return 'overdue'
  return 'pending'
}

const STATUS_STYLES = {
  overdue: 'bg-red-100 text-red-600',
  pending: 'bg-yellow-100 text-yellow-700',
}

export default function OutstandingReport() {
  const [invoices, setInvoices]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'overdue' | 'pending'

  useEffect(() => { fetchOutstanding() }, [])

  async function fetchOutstanding() {
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('invoices')
      .select('*, customers(name, phone, email)')
      .eq('paid', false)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (err) {
      setError('Failed to load outstanding payments.')
      setLoading(false)
      return
    }

    setInvoices(data || [])
    setLoading(false)
  }

  const filtered = invoices.filter(inv => {
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customers?.phone?.includes(search)

    const status = getStatus(inv)
    const matchesStatus = statusFilter === 'all' || status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Group by customer for the summary section
  const byCustomer = filtered.reduce((acc, inv) => {
    const id   = inv.customer_id
    const name = inv.customers?.name || 'Unknown'
    if (!acc[id]) acc[id] = { name, phone: inv.customers?.phone || '', total: 0, count: 0 }
    acc[id].total += Number(inv.total_amount || 0)
    acc[id].count += 1
    return acc
  }, {})

  const totalOutstanding = filtered.reduce((s, inv) => s + Number(inv.total_amount || 0), 0)
  const overdueCount     = filtered.filter(inv => getStatus(inv) === 'overdue').length
  const overdueAmount    = filtered
    .filter(inv => getStatus(inv) === 'overdue')
    .reduce((s, inv) => s + Number(inv.total_amount || 0), 0)

  function downloadPDF() {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const GRID = { theme: 'grid', styles: { lineColor: [180, 180, 180], lineWidth: 0.2 } }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Outstanding Payments Report', pageWidth / 2, 16, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2, 22, { align: 'center' })
    doc.setTextColor(0)

    // Summary row
    autoTable(doc, {
      startY: 27,
      ...GRID,
      head: [['Total Outstanding', 'Overdue Amount', 'Overdue Invoices', 'Total Invoices']],
      body: [[
        `Rs.${totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        `Rs.${overdueAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        overdueCount,
        filtered.length,
      ]],
      headStyles: { fillColor: [24, 24, 27], fontSize: 8 },
      bodyStyles: { fontSize: 9, fontStyle: 'bold' },
      margin: { left: 10, right: 10 },
    })

    // Per-invoice table
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      ...GRID,
      head: [['Invoice #', 'Customer', 'Phone', 'Invoice Date', 'Due Date', 'Amount (₹)', 'Status']],
      body: filtered.map(inv => [
        inv.invoice_number,
        inv.customers?.name || '—',
        inv.customers?.phone || '—',
        inv.invoice_date,
        inv.due_date || '—',
        Number(inv.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
        getStatus(inv).charAt(0).toUpperCase() + getStatus(inv).slice(1),
      ]),
      headStyles: { fillColor: [24, 24, 27], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        5: { halign: 'right' },
        6: { halign: 'center' },
      },
      margin: { left: 10, right: 10 },
    })

    doc.save(`outstanding-payments-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Outstanding Payments</h2>
          <p className="text-sm text-gray-500 mt-0.5">All unpaid invoices</p>
        </div>
        <button
          onClick={downloadPDF}
          disabled={loading || filtered.length === 0}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-40"
        >
          Download PDF
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Total Outstanding</p>
            <p className="text-xl font-bold text-gray-900">
              ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-red-100 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Overdue</p>
            <p className="text-xl font-bold text-red-600">
              ₹{overdueAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">{overdueCount} invoice{overdueCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-yellow-100 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Pending (not overdue)</p>
            <p className="text-xl font-bold text-yellow-600">
              ₹{(totalOutstanding - overdueAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">{filtered.length - overdueCount} invoice{(filtered.length - overdueCount) !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Customer summary (collapsed view) */}
      {!loading && !error && Object.keys(byCustomer).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">By Customer</p>
          <div className="divide-y divide-gray-100">
            {Object.values(byCustomer)
              .sort((a, b) => b.total - a.total)
              .map(c => (
                <div key={c.name} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone} · {c.count} invoice{c.count !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    ₹{c.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by invoice number, customer name, or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="all">All</option>
          <option value="overdue">Overdue only</option>
          <option value="pending">Pending only</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">
            {invoices.length === 0 ? 'No outstanding payments. All invoices are paid.' : 'No results match your search.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Invoice Date</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(inv => {
                const status = getStatus(inv)
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-900">{inv.customers?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.customers?.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.invoice_date}</td>
                    <td className={`px-4 py-3 font-medium ${status === 'overdue' ? 'text-red-600' : 'text-gray-600'}`}>
                      {inv.due_date || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      ₹{Number(inv.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Footer total */}
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">
                  Total ({filtered.length} invoice{filtered.length !== 1 ? 's' : ''})
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
