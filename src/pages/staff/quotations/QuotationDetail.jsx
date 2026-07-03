import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { amountToWordsINR } from '../../../lib/amountToWords'

const STATUS_STYLES = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired:  'bg-yellow-100 text-yellow-700',
}

const GST_RATES = [5, 12, 18, 28]

export default function QuotationDetail({ quotation, onBack, onEdit, onRefresh }) {
  const [dealer, setDealer] = useState(null)

  useEffect(() => {
    supabase.from('dealer_settings').select('*').limit(1).single()
      .then(({ data }) => setDealer(data))
  }, [])

  const items = quotation.quotation_items || []

  const taxableTotal = items.reduce((s, i) => s + Number(i.taxable_amount || 0), 0)
  const gstTotal      = items.reduce((s, i) => s + Number(i.cgst_amount || 0) + Number(i.sgst_amount || 0) + Number(i.igst_amount || 0), 0)
  const otherCharges  = Number(quotation.other_charges || 0)
  const roundOff      = Number(quotation.round_off || 0)
  const netAmount     = Number(quotation.total_amount || (taxableTotal + gstTotal + otherCharges + roundOff))

  // Slab matrix: sum taxable/cgst/sgst/igst per GST rate across line items
  const slabs = GST_RATES.reduce((acc, rate) => {
    acc[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    return acc
  }, {})
  items.forEach(item => {
    const rate = Number(item.gst_percent) || 0
    if (slabs[rate]) {
      slabs[rate].taxable += Number(item.taxable_amount || 0)
      slabs[rate].cgst    += Number(item.cgst_amount || 0)
      slabs[rate].sgst    += Number(item.sgst_amount || 0)
      slabs[rate].igst    += Number(item.igst_amount || 0)
    }
  })
  const slabGstTotal = GST_RATES.reduce((s, r) => s + slabs[r].cgst + slabs[r].sgst + slabs[r].igst, 0)

  async function setStatus(status) {
    await supabase.from('quotations').update({ status }).eq('id', quotation.id)
    onRefresh()
  }

  function downloadPDF() {
    const doc = new jsPDF()
    const customer = quotation.customers
    const pageWidth = doc.internal.pageSize.getWidth()

    // ---------- Header ----------
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(dealer?.business_name || 'Business Name', pageWidth / 2, 15, { align: 'center' })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    if (dealer?.address) doc.text(dealer.address, pageWidth / 2, 21, { align: 'center' })

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text('QUOTATION', pageWidth / 2, 30, { align: 'center' })

    doc.setDrawColor(180)
    doc.line(10, 34, pageWidth - 10, 34)

    // ---------- Two-column party details ----------
    let y = 40
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)

    const leftX = 12
    const rightX = 108

    doc.text(`Quotation No : ${quotation.quotation_number}`, leftX, y)
    doc.text(`Name : ${customer?.name || ''}`, rightX, y)
    y += 6
    doc.text(`Quotation Date : ${new Date(quotation.created_at).toLocaleDateString('en-IN')}`, leftX, y)
    doc.text(`Address : ${quotation.customer_address || ''}`, rightX, y)
    y += 6
    doc.text(`State : ${dealer?.state || ''}`, leftX, y)
    doc.text(`Mobile No : ${quotation.customer_phone || ''}`, rightX, y)
    y += 6
    doc.text(`State Code : ${dealer?.state_code || ''}`, leftX, y)
    doc.text(`GSTIN : ${quotation.customer_gstin || ''}`, rightX, y)
    y += 6
    doc.text(`GSTIN : ${dealer?.gstin || ''}`, leftX, y)
    doc.text(`PAN No : ${quotation.customer_pan || ''}`, rightX, y)
    y += 6
    doc.text('', leftX, y)
    doc.text(`State : ${quotation.customer_state || ''}`, rightX, y)
    y += 6
    doc.text(`State Code : ${quotation.customer_state_code || ''}`, rightX, y)

    y += 6
    doc.setDrawColor(180)
    doc.line(10, y, pageWidth - 10, y)
    y += 4

    // ---------- Line items table ----------
    autoTable(doc, {
      startY: y,
      head: [['Sr No', 'Particulars', 'HSN', 'Qty', 'Rate', 'Total', 'Disc%', 'Taxable Amt', 'GST%', 'GST Amt', 'Total']],
      body: items.map((item, i) => {
        const gross = Number(item.quantity) * Number(item.unit_price)
        const gstAmt = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0)
        return [
          i + 1,
          item.description,
          item.hsn_code || '',
          item.quantity,
          Number(item.unit_price).toLocaleString('en-IN'),
          gross.toLocaleString('en-IN'),
          `${Number(item.discount_percent || 0)}%`,
          Number(item.taxable_amount || 0).toLocaleString('en-IN'),
          `${Number(item.gst_percent || 0)}%`,
          gstAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
          Number(item.total).toLocaleString('en-IN'),
        ]
      }),
      headStyles: { fillColor: [24, 24, 27], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8 },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'center' },
        7: { halign: 'right' },
        8: { halign: 'center' },
        9: { halign: 'right' },
        10: { halign: 'right' },
      },
    })

    let cursorY = doc.lastAutoTable.finalY + 6

    // ---------- GST slab matrix ----------
    autoTable(doc, {
      startY: cursorY,
      head: [['GST Slab', ...GST_RATES.map(r => `${r}%`), 'Total']],
      body: [
        ['Taxable', ...GST_RATES.map(r => slabs[r].taxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })), taxableTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })],
        ['SGST+CGST', ...GST_RATES.map(r => (slabs[r].cgst + slabs[r].sgst).toLocaleString('en-IN', { maximumFractionDigits: 0 })), (gstTotal - GST_RATES.reduce((s, r) => s + slabs[r].igst, 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })],
        ['IGST', ...GST_RATES.map(r => slabs[r].igst.toLocaleString('en-IN', { maximumFractionDigits: 0 })), GST_RATES.reduce((s, r) => s + slabs[r].igst, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })],
      ],
      headStyles: { fillColor: [80, 80, 80], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 0: { cellWidth: 24 } },
      margin: { right: pageWidth / 2 },
      tableWidth: pageWidth / 2 - 15,
    })

    // ---------- Totals box (right side, next to slab matrix) ----------
    const totalsX = pageWidth / 2 + 5
    let totalsY = cursorY + 6
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)

    const totalsRows = [
      ['Total Amount', taxableTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })],
      ['GST', gstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })],
      ['Other Charges', otherCharges.toLocaleString('en-IN')],
      ['Round Off', roundOff.toLocaleString('en-IN')],
    ]
    totalsRows.forEach(([label, val]) => {
      doc.text(label, totalsX, totalsY)
      doc.text(val, pageWidth - 12, totalsY, { align: 'right' })
      totalsY += 6
    })
    doc.setFont('helvetica', 'bold')
    doc.text('Net Amount', totalsX, totalsY)
    doc.text(netAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 }), pageWidth - 12, totalsY, { align: 'right' })

    cursorY = Math.max(doc.lastAutoTable.finalY, totalsY) + 10

    // ---------- Amount in words ----------
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Amount (in words):', 12, cursorY)
    doc.setFont('helvetica', 'normal')
    doc.text(`Rs. ${amountToWordsINR(netAmount)} Only`, 55, cursorY)
    cursorY += 8

    doc.setDrawColor(180)
    doc.line(10, cursorY, pageWidth - 10, cursorY)
    cursorY += 6

    // ---------- Declaration + Terms (two columns) ----------
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Declaration', 12, cursorY)
    doc.text('Terms & Conditions', 108, cursorY)
    cursorY += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(60)
    const declLines = doc.splitTextToSize(dealer?.declaration_text || '', 90)
    const termsLines = doc.splitTextToSize(dealer?.terms_text || '', 90)
    doc.text(declLines, 12, cursorY)
    doc.text(termsLines, 108, cursorY)

    cursorY += Math.max(declLines.length, termsLines.length) * 4 + 6

    // ---------- Bank details ----------
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Bank Details', 12, cursorY)
    cursorY += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(`Bank Name: ${dealer?.bank_name || ''}`, 12, cursorY)
    cursorY += 4.5
    doc.text(`IFSC Code: ${dealer?.ifsc_code || ''}`, 12, cursorY)
    cursorY += 4.5
    doc.text(`Account No: ${dealer?.account_no || ''}`, 12, cursorY)

    // ---------- Signatory ----------
    doc.setFontSize(8)
    doc.text('Receiver Signatory', 60, cursorY + 20, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.text(`For ${dealer?.business_name || ''}`, 150, cursorY + 5, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.text('Authorised Signatory', 150, cursorY + 20, { align: 'center' })

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
              {quotation.customer_phone && <p>{quotation.customer_phone}</p>}
              {quotation.customer_gstin && <p>GSTIN: {quotation.customer_gstin}</p>}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">HSN</th>
                <th className="px-3 py-2 font-medium text-center">Qty</th>
                <th className="px-3 py-2 font-medium text-center">Disc%</th>
                <th className="px-3 py-2 font-medium text-center">GST%</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-gray-900">{item.description}</td>
                  <td className="px-3 py-2 text-gray-500 font-mono">{item.hsn_code}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{item.discount_percent}%</td>
                  <td className="px-3 py-2 text-center text-gray-600">{item.gst_percent}%</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    ₹{Number(item.total).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-5 py-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Amount</span>
              <span>₹{taxableTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>GST</span>
              <span>₹{gstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
              <span>Net Amount</span>
              <span>₹{netAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <p className="text-xs text-gray-400 pt-1">
              {amountToWordsINR(netAmount)} Rupees Only
            </p>
          </div>
        </div>

        {quotation.notes && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
            <p className="text-sm text-gray-500">{quotation.notes}</p>
          </div>
        )}

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
