import { supabase } from '../../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const STATUS_STYLES = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired:  'bg-yellow-100 text-yellow-700',
}

export default function QuotationDetail({ quotation, onBack, onEdit, onRefresh }) {
  const items       = quotation.quotation_items || []
  const subtotal    = items.reduce((s, i) => s + Number(i.total), 0)
  const discount    = Number(quotation.discount    || 0)
  const gstPercent  = Number(quotation.gst_percent ?? 18)
  const gstAmount   = Number(quotation.gst_amount  || 0)
  const cgst        = gstAmount / 2
  const sgst        = gstAmount / 2
  const afterDiscount = Math.max(0, subtotal - discount)

  async function setStatus(status) {
    await supabase.from('quotations').update({ status }).eq('id', quotation.id)
    onRefresh()
  }

  function downloadPDF() {
    const doc      = new jsPDF()
    const customer = quotation.customers

    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('QUOTATION', 14, 22)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(`No: ${quotation.quotation_number}`, 14, 32)
    doc.text(`Date: ${new Date(quotation.created_at).toLocaleDateString('en-IN')}`, 14, 38)
    if (quotation.valid_until) doc.text(`Valid Until: ${quotation.valid_until}`, 14, 44)

    if (customer) {
      doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      doc.text('Prepared For:', 120, 32)
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

    doc.text('Subtotal:', 120, y)
    doc.text(`Rs.${subtotal.toLocaleString('en-IN')}`, 195, y, { align: 'right' })
    y += 7

    if (discount > 0) {
      doc.text('Discount:', 120, y)
      doc.text(`-Rs.${discount.toLocaleString('en-IN')}`, 195, y, { align: 'right' })
      y += 7
    }

    doc.text('Taxable Amount:', 120, y)
    doc.text(`Rs.${afterDiscount.toLocaleString('en-IN')}`, 195, y, { align: 'right' })
    y += 8

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
    doc.text(`Rs.${Number(quotation.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 195, y, { align: 'right' })
    y += 10

    if (quotation.notes) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(`Notes: ${quotation.notes}`, 14, y)
    }

    doc.save(`${quotation.quotation_number}.pdf`)
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
          ← Back to Quotations
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(quotation)}
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
        {/* Header info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{quotation.quotation_number}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Created {new Date(quotation.created_at).toLocaleDateString('en-IN')}
                {quotation.valid_until && ` · Valid until ${quotation.valid_until}`}
              </p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full capitalize font-medium ${STATUS_STYLES[quotation.status] || ''}`}>
              {quotation.status}
            </span>
          </div>

          {quotation.customers && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-0.5">
              <p className="font-medium text-gray-900">{quotation.customers.name}</p>
              {quotation.customers.phone && <p>{quotation.customers.phone}</p>}
              {quotation.customers.email && <p>{quotation.customers.email}</p>}
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
              <span>₹{Number(quotation.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {quotation.notes && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
            <p className="text-sm text-gray-500">{quotation.notes}</p>
          </div>
        )}

        {/* Status actions */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {!['sent', 'accepted', 'rejected'].includes(quotation.status) && (
              <button
                onClick={() => setStatus('sent')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
              >
                Mark as Sent
              </button>
            )}
            {quotation.status === 'sent' && (
              <>
                <button
                  onClick={() => setStatus('accepted')}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition"
                >
                  Mark as Accepted
                </button>
                <button
                  onClick={() => setStatus('rejected')}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition"
                >
                  Mark as Rejected
                </button>
              </>
            )}
            {!['expired', 'accepted', 'rejected'].includes(quotation.status) && (
              <button
                onClick={() => setStatus('expired')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition"
              >
                Mark as Expired
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
