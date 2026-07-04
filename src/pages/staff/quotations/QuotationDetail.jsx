import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { amountToWordsINR } from '../../../lib/amountToWords'
import { VST_LOGO_BASE64 } from '../../../lib/logoBase64'

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
    const pageWidth  = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10

    // Colour constants — identical to expense invoice for visual consistency
    const DARK_RED  = [211, 47, 47]    // #D32F2F — company name, signatory
    const MAROON    = [120, 20, 20]    // QUOTATION title
    const BEIGE     = [248, 235, 207]  // #F8EBCF — header strip + all section headers
    const TBL_BLACK = [30, 30, 30]
    const BORDER    = [180, 180, 180]

    const GRID = {
      theme: 'grid',
      styles: { lineColor: BORDER, lineWidth: 0.2 },
    }

    // ---------- Beige header strip ----------
    doc.setFillColor(...BEIGE)
    doc.rect(margin - 2, 8, pageWidth - (margin - 2) * 2, 28, 'F')

    // VST Shakti logo — top left
    doc.addImage(VST_LOGO_BASE64, 'PNG', margin, 9, 22, 22)

    // Company name — dark red bold
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK_RED)
    doc.text(dealer?.business_name?.toUpperCase() || 'Business Name', pageWidth / 2, 19, { align: 'center' })

    // Address — small grey
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    if (dealer?.address) doc.text(dealer.address, pageWidth / 2, 25, { align: 'center' })

    // QUOTATION — dark maroon
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...MAROON)
    doc.text('QUOTATION', pageWidth / 2, 32, { align: 'center' })

    // Divider below strip
    doc.setDrawColor(...BORDER)
    doc.line(margin - 2, 37, pageWidth - margin + 2, 37)

    // ---------- Seller / Buyer details as a bordered grid table ----------
    // Explicit fixed rows so seller and buyer columns never look interchangeable —
    // each row is labeled inline, and a header row names whose details are whose.
    autoTable(doc, {
      startY: 40,
      ...GRID,
      head: [['Seller Details', 'Buyer Details']],
      body: [
        [`Quotation No: ${quotation.quotation_number}`, `Name: ${customer?.name || ''}`],
        [`Quotation Date: ${new Date(quotation.created_at).toLocaleDateString('en-IN')}`, `Address: ${quotation.customer_address || ''}`],
        [`State: ${dealer?.state || ''}   State Code: ${dealer?.state_code || ''}`, `Mobile No: ${quotation.customer_phone || ''}`],
        [`GSTIN: ${dealer?.gstin || ''}`, `GSTIN: ${quotation.customer_gstin || '—'}`],
        [`PAN No: ${dealer?.pan_no || ''}`, `PAN No: ${quotation.customer_pan || '—'}`],
        ['', `State: ${quotation.customer_state || '—'}   State Code: ${quotation.customer_state_code || '—'}`],
      ],
      headStyles: { fillColor: BEIGE, textColor: TBL_BLACK, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: TBL_BLACK },
      columnStyles: { 0: { cellWidth: (pageWidth - margin * 2) / 2 }, 1: { cellWidth: (pageWidth - margin * 2) / 2 } },
      margin: { left: margin, right: margin },
    })

    let cursorY = doc.lastAutoTable.finalY + 4

    // ---------- Line items table ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      head: [['Sr No', 'Particulars', 'HSN', 'Qty', 'Rate', 'Total', 'Disc%', 'Taxable Amt', 'GST%', 'GST Amt', 'Total']],
      body: items.map((item, i) => {
        const gross = Number(item.quantity) * Number(item.unit_price)
        const gstAmt = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0)
        return [
          i + 1,
          item.description,
          item.hsn_code || '—',
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
      headStyles: { fillColor: BEIGE, textColor: TBL_BLACK, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: TBL_BLACK },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'center' },
        7: { halign: 'right' },
        8: { halign: 'center' },
        9: { halign: 'right' },
        10: { halign: 'right' },
      },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 4

    // ---------- GST slab matrix + Totals box, side by side, both bordered ----------
    const halfWidth = (pageWidth - margin * 2 - 4) / 2

    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      head: [['GST Slab', ...GST_RATES.map(r => `${r}%`), 'Total']],
      body: [
        ['Taxable', ...GST_RATES.map(r => slabs[r].taxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })), taxableTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })],
        ['SGST+CGST', ...GST_RATES.map(r => (slabs[r].cgst + slabs[r].sgst).toLocaleString('en-IN', { maximumFractionDigits: 0 })), (gstTotal - GST_RATES.reduce((s, r) => s + slabs[r].igst, 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })],
        ['IGST', ...GST_RATES.map(r => slabs[r].igst.toLocaleString('en-IN', { maximumFractionDigits: 0 })), GST_RATES.reduce((s, r) => s + slabs[r].igst, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })],
      ],
      headStyles: { fillColor: BEIGE, textColor: TBL_BLACK, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: TBL_BLACK },
      columnStyles: { 0: { cellWidth: 20 } },
      margin: { left: margin },
      tableWidth: halfWidth,
    })

    const slabTableEndY = doc.lastAutoTable.finalY

    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      head: [['Summary', '']],
      body: [
        ['Total Amount', taxableTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })],
        ['GST', gstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })],
        ['Other Charges', otherCharges.toLocaleString('en-IN')],
        ['Round Off', roundOff.toLocaleString('en-IN')],
        ['Net Amount', netAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })],
      ],
      headStyles: { fillColor: BEIGE, textColor: TBL_BLACK, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: TBL_BLACK },
      columnStyles: { 0: { fontStyle: 'normal' }, 1: { halign: 'right' } },
      didParseCell: (data) => {
        // Bold the Net Amount row to match the reference document's emphasis
        if (data.row.index === 4 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: margin + halfWidth + 4 },
      tableWidth: halfWidth,
    })

    cursorY = Math.max(slabTableEndY, doc.lastAutoTable.finalY) + 5

    // ---------- Amount in words (bordered single-row box) ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      body: [[`Amount (in words): Rs. ${amountToWordsINR(netAmount)} Only`]],
      bodyStyles: { fontSize: 8, fontStyle: 'bold' },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 4

    // ---------- Declaration + Terms & Conditions (bordered, side by side) ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      head: [['Declaration', 'Terms & Conditions']],
      body: [[dealer?.declaration_text || '', dealer?.terms_text || '']],
      headStyles: { fillColor: BEIGE, textColor: TBL_BLACK, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: TBL_BLACK },
      columnStyles: { 0: { cellWidth: (pageWidth - margin * 2) / 2 }, 1: { cellWidth: (pageWidth - margin * 2) / 2 } },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 4

    // ---------- Bank details (bordered) ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      head: [['Bank Details', '']],
      body: [
        ['Bank Name', dealer?.bank_name || ''],
        ['IFSC Code', dealer?.ifsc_code || ''],
        ['Account No', dealer?.account_no || ''],
      ],
      headStyles: { fillColor: BEIGE, textColor: TBL_BLACK, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: TBL_BLACK },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 4

    // ---------- Signatory row ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      body: [
        ['Receiver Signatory', `For ${dealer?.business_name || ''}`],
        ['', 'Authorised Signatory'],
      ],
      bodyStyles: { fontSize: 8, minCellHeight: 12, textColor: TBL_BLACK },
      columnStyles: {
        0: { cellWidth: (pageWidth - margin * 2) / 2, valign: 'bottom' },
        1: { cellWidth: (pageWidth - margin * 2) / 2, halign: 'center', valign: 'bottom' },
      },
      didParseCell: (data) => {
        if (data.row.index === 0 && data.column.index === 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = DARK_RED
        }
      },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY

    // ---------- Outer page border ----------
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.4)
    doc.rect(margin - 2, 8, pageWidth - (margin - 2) * 2, Math.min(cursorY + 4, pageHeight - 12) - 8)

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
