import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { amountToWordsINR } from '../../../lib/amountToWords'

const GST_RATES = [5, 12, 18, 28]

const VST = {
  name:      'V.S.T. TILLERS TRACTORS LTD.',
  address:   'PLOT NO 1, DYAVASANDRA INDL. LAYOUT, WHITEFIELD ROAD',
  city:      'BANGLORE- 560048, KARNATAKA',
  gstin:     '29AAACV5930H1Z6',
  state:     'Karnataka',
  stateCode: '29',
}

export default function ExpenseInvoiceDetail({ invoice, onBack, onEdit, onRefresh }) {
  const [dealer, setDealer] = useState(null)

  useEffect(() => {
    supabase.from('dealer_settings').select('*').limit(1).single()
      .then(({ data }) => setDealer(data))
  }, [])

  const items = invoice.expense_invoice_items || []

  const taxableTotal = items.reduce((s, i) => s + Number(i.taxable_amount || 0), 0)
  const igstTotal    = items.reduce((s, i) => s + Number(i.igst_amount || 0), 0)
  const otherCharges = Number(invoice.other_charges || 0)
  const roundOff     = Number(invoice.round_off || 0)
  const netAmount    = Number(invoice.total_amount || (taxableTotal + igstTotal + otherCharges + roundOff))

  // Slab matrix — always IGST since VST is interstate
  const slabs = GST_RATES.reduce((acc, r) => {
    acc[r] = { taxable: 0, igst: 0 }
    return acc
  }, {})
  items.forEach(item => {
    const rate = Number(item.gst_percent) || 0
    if (slabs[rate]) {
      slabs[rate].taxable += Number(item.taxable_amount || 0)
      slabs[rate].igst    += Number(item.igst_amount || 0)
    }
  })

  function downloadPDF() {
    const doc       = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin    = 10
    const GRID = {
      theme: 'grid',
      styles: { lineColor: [150, 150, 150], lineWidth: 0.2, fontSize: 8 },
    }

    // ---------- Header ----------
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 0, 0)
    doc.text(dealer?.business_name?.toUpperCase() || 'SHREE SAGAR AUTOMOBILES, SATARA', pageWidth / 2, 16, { align: 'center' })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    if (dealer?.address) doc.text(dealer.address, pageWidth / 2, 22, { align: 'center' })

    // VST Shakti logo placeholder text (left)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text('VST SHAKTI', margin, 30)

    // TAX INVOICE (center)
    doc.setFontSize(13)
    doc.text('TAX INVOICE', pageWidth / 2, 30, { align: 'center' })

    // CREDIT MEMO (right)
    doc.setFontSize(9)
    doc.text('CREDIT MEMO', pageWidth - margin, 30, { align: 'right' })

    doc.setDrawColor(150)
    doc.line(margin, 33, pageWidth - margin, 33)

    // ---------- Invoice meta + transport details ----------
    const metaY = 37
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)

    // Left column
    const lx = margin
    doc.text(`Invoice No  : ${invoice.invoice_number}`, lx, metaY)
    doc.text(`Inv. Date    : ${invoice.invoice_date}`, lx, metaY + 5)
    doc.text(`Po No        : ${invoice.po_no || ''}`, lx, metaY + 10)
    doc.text(`Po Date      : ${invoice.po_date || ''}`, lx, metaY + 15)
    doc.text(`GSTIN        : ${dealer?.gstin || ''}`, lx, metaY + 20)

    // State / FSS AI line
    doc.text(`${dealer?.state || ''}`, lx + 45, metaY + 15)
    doc.text(`${dealer?.state_code || ''}`, lx + 68, metaY + 15)
    doc.text(`FSSAI No :`, lx + 75, metaY + 20)

    // Right column — transport details
    const rx = 108
    doc.text(`Transportation Mode : ${invoice.transportation_mode || ''}`, rx, metaY)
    doc.text(`Vehicle Number      :`, rx, metaY + 5)
    doc.text(`Date of Supply      : ${invoice.invoice_date}`, rx, metaY + 10)
    doc.text(`Place Of Supply     : ${invoice.place_of_supply || ''}`, rx, metaY + 15)
    doc.text(`Credit Date         : ${invoice.credit_date || ''}`, rx, metaY + 20)

    doc.setFont('helvetica', 'bold')
    doc.text('Original Copy', pageWidth - margin, metaY, { align: 'right' })

    doc.setDrawColor(150)
    doc.line(margin, metaY + 25, pageWidth - margin, metaY + 25)

    // ---------- Receiver / Consignee details grid ----------
    autoTable(doc, {
      startY: metaY + 28,
      ...GRID,
      head: [['Details of Receiver | Billed to:', 'Details of Consignee | Shipped to:']],
      body: [
        [`Name      : ${VST.name}`, 'Name      :'],
        [`Address   : ${VST.address}`, 'Address   :'],
        [`             ${VST.city}`, ''],
        [`Mobile No : ${VST.gstin}  GSTIN : ${VST.gstin}`, 'Mobile No :'],
        [`FSSAI No  :                    ${VST.state}        ${VST.stateCode}`, `State     :                State Code:`],
      ],
      headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: (pageWidth - margin * 2) / 2 },
        1: { cellWidth: (pageWidth - margin * 2) / 2 },
      },
      margin: { left: margin, right: margin },
    })

    let cursorY = doc.lastAutoTable.finalY + 3

    // ---------- Line items table ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      head: [['Sr\nNo', 'Particulars', 'HSN', 'Qty.', 'Rate', 'Total', 'Disc\n(%)', 'Taxable\nAmount', 'Gst\nRate', 'Amt.', 'Total']],
      body: [
        ...items.map((item, i) => {
          const gross  = Number(item.quantity) * Number(item.unit_price)
          const gstAmt = Number(item.igst_amount || 0)
          return [
            i + 1,
            `${item.description}\n[${item.unit || 'NOS'}]`,
            item.hsn_code || '',
            `${Number(item.quantity).toFixed(2)} NOS`,
            Number(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 3 }),
            gross.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            `${Number(item.discount_percent || 0).toFixed(1)}`,
            Number(item.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            `${Number(item.gst_percent || 0)} %`,
            gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          ]
        }),
        // Total row
        ['', 'Total', '', '', '', taxableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), '', taxableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), '', igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })],
      ],
      headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
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
      didParseCell: (data) => {
        // Bold the Total row
        if (data.row.index === items.length && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 3

    // ---------- GST slab matrix — drawn manually because autoTable can't merge cells ----------
    // Layout matches reference exactly:
    // Row 0 (header):  [Gst] [  5%  ] [  12%  ] [  18%  ] [  28%  ] [Total]
    // Row 1 (subhead): [   ] [S2.5|C2.5] [S6|C6] [S9|C9] [S14|C14] [    ]
    // Row 2 (data):    [   ] [val|val] [val|val] [val|val] [val|val] [val ]
    // Row 3: SGst+CGst ...
    // Row 4: IGst ...

    const slabX     = margin
    const slabW     = (pageWidth - margin * 2) * 0.6
    const totalsX   = slabX + slabW + 3
    const totalsW   = (pageWidth - margin * 2) * 0.4 - 3

    // Column widths: [label | 5%(S|C) | 12%(S|C) | 18%(S|C) | 28%(S|C) | total]
    const labelW  = 18
    const slabPairW = (slabW - labelW - 18) / 4 // width for each slab pair (S+C)
    const halfW   = slabPairW / 2
    const totalColW = 18

    const rowH     = 5.5
    const subRowH  = 4.5
    const dataRowH = 4.5

    doc.setDrawColor(150)
    doc.setLineWidth(0.2)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'bold')

    // Helper: draw a cell (border + centered text)
    function cell(x, y, w, h, text, align = 'center', bold = false) {
      doc.rect(x, y, w, h)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1 : x + 1
      const ty = y + h / 2 + 1.5
      doc.text(String(text), tx, ty, { align })
    }

    // ---- Row 0: merged slab headers ----
    let cx = slabX
    cell(cx, cursorY, labelW, rowH, 'Gst', 'center', true)
    cx += labelW
    ;[['5%', slabPairW], ['12%', slabPairW], ['18%', slabPairW], ['28%', slabPairW]].forEach(([label, w]) => {
      cell(cx, cursorY, w, rowH, label, 'center', true)
      cx += w
    })
    cell(cx, cursorY, totalColW, rowH, 'Total', 'center', true)

    // ---- Row 1: S%/C% sub-headers ----
    const subY = cursorY + rowH
    cx = slabX
    cell(cx, subY, labelW, subRowH, '', 'center', false)
    cx += labelW
    ;[['S 2.5%', 'C 2.5%'], ['S 6%', 'C 6%'], ['S 9%', 'C 9%'], ['S 14%', 'C 14%']].forEach(([s, c]) => {
      cell(cx, subY, halfW, subRowH, s, 'center', true)
      cell(cx + halfW, subY, halfW, subRowH, c, 'center', true)
      cx += slabPairW
    })
    cell(cx, subY, totalColW, subRowH, '', 'center', false)

    // ---- Helper to format slab value ----
    function fmt(n) { return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }

    // ---- Rows 2–4: data ----
    const dataRows = [
      {
        label: '',
        values: GST_RATES.map(r => [fmt(slabs[r].igst / 2), fmt(slabs[r].igst / 2)]),
        total: fmt(igstTotal / 2), // half shown in this unlabeled row (matches reference)
      },
      {
        label: 'SGst+CGst',
        values: GST_RATES.map(() => ['0.00', '0.00']),
        total: '0.00',
      },
      {
        label: 'IGst',
        values: GST_RATES.map(r => [fmt(slabs[r].igst), '']),
        total: fmt(igstTotal),
      },
    ]

    let dataY = subY + subRowH
    dataRows.forEach(row => {
      cx = slabX
      cell(cx, dataY, labelW, dataRowH, row.label, 'left', false)
      cx += labelW
      row.values.forEach(([s, c]) => {
        cell(cx, dataY, halfW, dataRowH, s, 'center', false)
        cell(cx + halfW, dataY, halfW, dataRowH, c, 'center', false)
        cx += slabPairW
      })
      cell(cx, dataY, totalColW, dataRowH, row.total, 'center', false)
      dataY += dataRowH
    })

    const slabEndY = dataY

    // ---------- Totals box (right side, drawn as autoTable — no merge issues here) ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      body: [
        ['TotalAmount', netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })],
        ['Disc', '0.00 %    0.00'],
        ['Other Charges', fmt(otherCharges)],
        ['Round Off  +', fmt(roundOff)],
        ['Net Amount', netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })],
      ],
      bodyStyles: { fontSize: 7 },
      didParseCell: (data) => {
        if (data.row.index === 4) data.cell.styles.fontStyle = 'bold'
        if (data.column.index === 1) data.cell.styles.halign = 'right'
      },
      margin: { left: totalsX },
      tableWidth: totalsW,
    })

    cursorY = Math.max(slabEndY, doc.lastAutoTable.finalY) + 3

    // ---------- Pre/Paid/Curr amounts row ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      body: [[
        `Pre. Rem.Amt : 0.00`,
        `Paid Amt .: 0.00`,
        `Curr. Bill Rem. Amt : ${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        `Total Outs Amt: ${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      ]],
      bodyStyles: { fontSize: 7 },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 3

    // ---------- Narration ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      body: [[`Narration : ${invoice.notes || ''}`]],
      bodyStyles: { fontSize: 7 },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 3

    // ---------- Amount in words ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      body: [[`Amount (in words):-`, `Rs.${amountToWordsINR(netAmount)} Only`]],
      bodyStyles: { fontSize: 8, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 40 } },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 3

    // ---------- Declaration + Terms ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      head: [['Declaration', 'TERMS & CONDITIONS :']],
      body: [[dealer?.declaration_text || '', dealer?.terms_text || '']],
      headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, minCellHeight: 18 },
      columnStyles: {
        0: { cellWidth: (pageWidth - margin * 2) / 2 },
        1: { cellWidth: (pageWidth - margin * 2) / 2 },
      },
      margin: { left: margin, right: margin },
    })

    cursorY = doc.lastAutoTable.finalY + 3

    // ---------- Bank + Signatory ----------
    autoTable(doc, {
      startY: cursorY,
      ...GRID,
      body: [
        [`Bank Name:  ${dealer?.bank_name_expense || dealer?.bank_name || '[BANK DETAILS PENDING]'}`, `For ${dealer?.business_name?.toUpperCase() || ''},`],
        [`IFSC Code:  ${dealer?.ifsc_code_expense || dealer?.ifsc_code || '[IFSC PENDING]'}`, ''],
        [`Account No: ${dealer?.account_no_expense || dealer?.account_no || '[ACCOUNT NO PENDING]'}`, ''],
        ['Receiver Signatory', 'Authorised Signatory'],
      ],
      bodyStyles: { fontSize: 7 },
      didParseCell: (data) => {
        if (data.row.index === 0 && data.column.index === 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = [180, 0, 0]
        }
        if (data.row.index === 3) {
          data.cell.styles.minCellHeight = 16
          data.cell.styles.valign = 'bottom'
          if (data.column.index === 1) data.cell.styles.halign = 'right'
        }
      },
      columnStyles: {
        0: { cellWidth: (pageWidth - margin * 2) / 2 },
        1: { cellWidth: (pageWidth - margin * 2) / 2 },
      },
      margin: { left: margin, right: margin },
    })

    // Outer border
    doc.setDrawColor(120)
    doc.setLineWidth(0.3)
    doc.rect(margin - 2, 8, pageWidth - (margin - 2) * 2, doc.lastAutoTable.finalY - 6)

    doc.save(`${invoice.invoice_number}.pdf`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to Expense Invoices
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
        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {invoice.invoice_date}
                {invoice.po_no && ` · PO: ${invoice.po_no}`}
                {invoice.credit_date && ` · Credit: ${invoice.credit_date}`}
              </p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${invoice.paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {invoice.paid ? 'Paid' : 'Unpaid'}
            </span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-0.5">
            <p className="font-medium text-gray-900">{VST.name}</p>
            <p>{VST.address}, {VST.city}</p>
            <p>GSTIN: {VST.gstin}</p>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">HSN</th>
                <th className="px-4 py-3 font-medium text-center">Qty</th>
                <th className="px-4 py-3 font-medium text-center">GST%</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.hsn_code}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.quantity} {item.unit}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.gst_percent}%</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    ₹{Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Amount</span>
              <span>₹{taxableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IGST</span>
              <span>₹{igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            {otherCharges > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Other Charges</span>
                <span>₹{otherCharges.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
              <span>Net Amount</span>
              <span>₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <p className="text-xs text-gray-400">
              {amountToWordsINR(netAmount)} Rupees Only
            </p>
          </div>
        </div>

        {invoice.notes && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Narration</p>
            <p className="text-sm text-gray-500">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
