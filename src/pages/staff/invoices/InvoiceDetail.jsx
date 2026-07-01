import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

export default function InvoiceDetail({ invoice, onBack, onEdit, onRefresh }) {
  const [updating, setUpdating] = useState(false)

  const items       = invoice.invoice_items || []
  const subtotal    = items.reduce((s, i) => s + Number(i.total), 0)
  const discount    = Number(invoice.discount    || 0)
  const gstPercent  = Number(invoice.gst_percent ?? 18)
  const gstAmount   = Number(invoice.gst_amount  || 0)
  const cgst        = gstAmount / 2
  const sgst        = gstAmount / 2
  const afterDiscount = Math.max(0, subtotal - discount)
  const status      = getStatus(invoice)

  async function togglePaid() {
    setUpdating(true)
    const markingPaid = !invoice.paid
    await supabase.from('invoices').update({ paid: markingPaid }).eq('id', invoice.id)
    if (markingPaid) {
      await supabase.from('ledger_entries').insert({
        type:        'credit',
        category:    'payment_received',
        amount:      invoice.total_amount,
        customer_id: invoice.customer_id || null,
        reference:   invoice.invoice_number,
        description: `Payment received for ${invoice.invoice_number}`,
        date:        new Date().toISOString().slice(0, 10),
      })
    }
    setUpdating(false)
    onRefresh()
  }

  function downloadPDF() {
    const doc      = new jsPDF()
    const customer = invoice.customers

    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 14, 22)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(`No: ${invoice.invoice_number}`, 14, 32)
    doc.text(`Date: ${invoice.invoice_date}`, 14, 38)
    if (invoice.due_date) doc.text(`Due: ${invoice.due_date}`, 14, 44)

    if (customer) {
      doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      doc.text('Bill To:', 120, 32)
      doc.setFont('helvetica', 'normal')
      doc.text(customer.name || '', 120, 38)
      if (customer.phone) doc.text(customer.phone, 120, 44)
      if (customer.email) doc.text(customer.email, 120, 50)
    }

    autoTable(doc, {
      startY: 60,
      head: [['#', 'Description', 'Qty', 'Unit Price (Rs.)', 'Amount (Rs.)']],
      body: items.map((item, i) => [
        i + 1,
        item.description,
        item.quantity,
        Number(item.unit_price).toLocaleString('en-IN'),
        Number(item.total).toLocaleString('en-IN'),
      ]),
      headStyles: { fillColor: [24, 24, 27], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10 },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    })

    let y = doc.lastAutoTable.finalY + 10
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'normal')

    const row = (label, value, bold = false) => {
      if (bold) doc.setFont('helvetica', 'bold')
      else      doc.setFont('helvetica', 'normal')
      doc.text(label, 120, y)
      doc.text(value, 195, y, { align: 'right' })
      y += 7
    }

    row('Subtotal:', `Rs.${subtotal.toLocaleString('en-IN')}`)
    if (discount > 0) row('Discount:', `-Rs.${discount.toLocaleString('en-IN')}`)
    row('Taxable Amount:', `Rs.${afterDiscount.toLocaleString('en-IN')}`)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(`CGST (${gstPercent / 2}%):`, 120, y)
    doc.text(`Rs.${cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 195, y, { align: 'right' })
    y += 6
    doc.text(`SGST (${gstPercent / 2}%):`, 120, y)
    doc.text(`Rs.${sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 195, y, { align: 'right' })
    y += 8

    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Total:', 120, y)
    doc.text(`Rs.${Number(invoice.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 195, y, { align: 'right' })
    y += 10

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`, 14, y)
    if (invoice.notes) doc.text(`Notes: ${invoice.notes}`, 14, y + 7)

    doc.save(`${invoice.invoice_number}.pdf`)
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
          ← Back to Invoices
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(invoice)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Edit
          </button>
          <button
            onClick={downloadPDF}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {invoice.invoice_date}
                {invoice.due_date && ` · Due ${invoice.due_date}`}
              </p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full capitalize font-medium ${STATUS_STYLES[status]}`}>
              {status}
            </span>
          </div>

          {invoice.customers && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-0.5">
              <p className="font-medium text-gray-900">{invoice.customers.name}</p>
              {invoice.customers.phone && <p>{invoice.customers.phone}</p>}
              {invoice.customers.email && <p>{invoice.customers.email}</p>}
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium text-center">Qty</th>
                <th className="px-5 py-3 font-medium text-right">Unit Price</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-5 py-3 text-gray-900">{item.description}</td>
                  <td className="px-5 py-3 text-center text-gray-600">{item.quantity}</td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    ₹{Number(item.unit_price).toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    ₹{Number(item.total).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-5 py-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <span>-₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Taxable Amount</span>
              <span>₹{afterDiscount.toLocaleString('en-IN')}</span>
            </div>

            <div className="border-t border-gray-100 pt-2 space-y-1.5">
              <div className="flex justify-between text-gray-600">
                <span>GST ({gstPercent}%)</span>
                <span>₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs pl-4">
                <span>CGST ({gstPercent / 2}%)</span>
                <span>₹{cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs pl-4">
                <span>SGST ({gstPercent / 2}%)</span>
                <span>₹{sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>₹{Number(invoice.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
            <p className="text-sm text-gray-500">{invoice.notes}</p>
          </div>
        )}

        {/* Payment action */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Payment</p>
          <button
            onClick={togglePaid}
            disabled={updating}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
              invoice.paid
                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {invoice.paid ? 'Mark as Unpaid' : 'Mark as Paid'}
          </button>
        </div>
      </div>
    </div>
  )
}
