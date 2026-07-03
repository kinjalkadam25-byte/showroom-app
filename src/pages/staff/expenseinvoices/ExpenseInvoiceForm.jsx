import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

const GST_RATES = [5, 12, 18, 28]

// VST Tillers Tractors Ltd details — hardcoded as receiver, never changes
const VST = {
  name:      'V.S.T. TILLERS TRACTORS LTD.',
  address:   'PLOT NO 1, DYAVASANDRA INDL. LAYOUT, WHITEFIELD ROAD, BANGALORE - 560048, KARNATAKA',
  gstin:     '29AAACV5930H1Z6',
  state:     'Karnataka',
  stateCode: '29',
}

function emptyLine() {
  return {
    description:      '',
    hsn_code:         '',
    quantity:         1,
    unit:             'NOS',
    unit_price:       '',
    discount_percent: 0,
    gst_percent:      18,
  }
}

export default function ExpenseInvoiceForm({ invoice, onBack, onSave }) {
  const [dealer, setDealer] = useState(null)
  const [form, setForm] = useState({
    invoice_date:       invoice?.invoice_date       || new Date().toISOString().slice(0, 10),
    po_no:              invoice?.po_no              || '',
    po_date:            invoice?.po_date            || '',
    transportation_mode: invoice?.transportation_mode || 'By road',
    vehicle_number:     invoice?.vehicle_number     || '',
    place_of_supply:    invoice?.place_of_supply    || 'Maharashtra',
    credit_date:        invoice?.credit_date        || '',
    fssai_no:           invoice?.fssai_no           || '',
    notes:              invoice?.notes              || '',
    other_charges:      invoice?.other_charges      ?? 0,
    round_off:          invoice?.round_off          ?? 0,
  })
  const [lineItems, setLineItems] = useState(
    invoice?.expense_invoice_items?.length > 0
      ? invoice.expense_invoice_items.map(i => ({
          description:      i.description,
          hsn_code:         i.hsn_code,
          quantity:         i.quantity,
          unit:             i.unit || 'NOS',
          unit_price:       i.unit_price,
          discount_percent: i.discount_percent || 0,
          gst_percent:      i.gst_percent ?? 18,
        }))
      : [emptyLine()]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    supabase.from('dealer_settings').select('*').limit(1).single()
      .then(({ data }) => setDealer(data))
  }, [])

  function handleFormChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function updateLineItem(index, field, value) {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function addLineItem() {
    setLineItems(prev => [...prev, emptyLine()])
  }

  function removeLineItem(index) {
    if (lineItems.length === 1) return
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  function computeLine(item) {
    const qty      = Number(item.quantity) || 0
    const rate     = Number(item.unit_price) || 0
    const gross    = qty * rate
    const discPct  = Number(item.discount_percent) || 0
    const taxable  = gross - (gross * discPct / 100)
    const gstPct   = Number(item.gst_percent) || 0
    const gstAmt   = taxable * (gstPct / 100)
    // Expense invoices to VST are interstate (Karnataka receiver, Maharashtra dealer)
    // so always IGST, never CGST+SGST
    return {
      gross,
      taxable,
      gstAmt,
      cgst: 0,
      sgst: 0,
      igst: gstAmt,
      total: taxable + gstAmt,
    }
  }

  const computedLines = lineItems.map(computeLine)
  const taxableTotal  = computedLines.reduce((s, l) => s + l.taxable, 0)
  const gstTotal      = computedLines.reduce((s, l) => s + l.gstAmt, 0)
  const otherCharges  = Number(form.other_charges || 0)
  const roundOff      = Number(form.round_off || 0)
  const grandTotal    = taxableTotal + gstTotal + otherCharges + roundOff

  async function handleSubmit() {
    if (lineItems.some(i => !i.description.trim())) {
      setError('Every line item needs a description.')
      return
    }
    if (lineItems.some(i => !i.hsn_code.trim())) {
      setError('Every line item needs an HSN code.')
      return
    }
    if (lineItems.some(i => Number(i.unit_price) <= 0)) {
      setError('Every line item needs a rate greater than 0.')
      return
    }

    setLoading(true)
    setError('')

    const payload = {
      invoice_number:      invoice?.invoice_number || '',
      invoice_date:        form.invoice_date,
      po_no:               form.po_no || null,
      po_date:             form.po_date || null,
      transportation_mode: form.transportation_mode || null,
      vehicle_number:      form.vehicle_number || null,
      place_of_supply:     form.place_of_supply || null,
      credit_date:         form.credit_date || null,
      fssai_no:            form.fssai_no || null,
      gstin_dealer:        dealer?.gstin || null,
      state_dealer:        dealer?.state || null,
      state_code_dealer:   dealer?.state_code || null,
      notes:               form.notes || null,
      other_charges:       otherCharges,
      round_off:           roundOff,
      taxable_total:       Number(taxableTotal.toFixed(2)),
      gst_total:           Number(gstTotal.toFixed(2)),
      total_amount:        Number(grandTotal.toFixed(2)),
    }

    let invoiceId = invoice?.id

    if (invoice) {
      const { error: err } = await supabase
        .from('expense_invoices').update(payload).eq('id', invoiceId)
      if (err) { setError(err.message); setLoading(false); return }
      await supabase.from('expense_invoice_items').delete().eq('expense_invoice_id', invoiceId)
    } else {
      const { data, error: err } = await supabase
        .from('expense_invoices').insert(payload).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      invoiceId = data.id
    }

    const itemsPayload = lineItems.map((item, i) => {
      const l = computedLines[i]
      return {
        expense_invoice_id: invoiceId,
        description:        item.description.trim(),
        hsn_code:           item.hsn_code.trim(),
        quantity:           Number(item.quantity),
        unit:               item.unit || 'NOS',
        unit_price:         Number(item.unit_price),
        gross_amount:       Number(l.gross.toFixed(2)),
        discount_percent:   Number(item.discount_percent) || 0,
        taxable_amount:     Number(l.taxable.toFixed(2)),
        gst_percent:        Number(item.gst_percent) || 0,
        cgst_amount:        0,
        sgst_amount:        0,
        igst_amount:        Number(l.igst.toFixed(2)),
        total:              Number(l.total.toFixed(2)),
      }
    })

    const { error: itemsErr } = await supabase
      .from('expense_invoice_items').insert(itemsPayload)
    if (itemsErr) { setError(itemsErr.message); setLoading(false); return }

    onSave()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        <h2 className="text-xl font-bold text-gray-900">
          {invoice ? `Edit ${invoice.invoice_number}` : 'New Expense Invoice'}
        </h2>
      </div>

      {/* VST receiver info — read-only, clearly labeled */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-blue-700 mb-1">Receiver (Billed To) — Fixed</p>
        <p className="text-sm font-medium text-gray-900">{VST.name}</p>
        <p className="text-xs text-gray-600">{VST.address}</p>
        <p className="text-xs text-gray-600">GSTIN: {VST.gstin} · {VST.state} · State Code: {VST.stateCode}</p>
        <p className="text-xs text-gray-400 mt-1">
          All expense invoices are sent to VST. IGST applies (interstate transaction).
        </p>
      </div>

      <div className="max-w-4xl space-y-5">
        {/* Document details */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Invoice Details</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
              <input type="date" name="invoice_date" value={form.invoice_date}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO No</label>
              <input name="po_no" value={form.po_no} onChange={handleFormChange}
                placeholder="Purchase order number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO Date</label>
              <input type="date" name="po_date" value={form.po_date} onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transportation Mode</label>
              <input name="transportation_mode" value={form.transportation_mode}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
              <input name="vehicle_number" value={form.vehicle_number} onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Place of Supply</label>
              <input name="place_of_supply" value={form.place_of_supply} onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Date</label>
              <input type="date" name="credit_date" value={form.credit_date} onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">FSSAI No</label>
              <input name="fssai_no" value={form.fssai_no} onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Other Charges (₹)</label>
              <input type="number" name="other_charges" value={form.other_charges}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Narration</label>
              <textarea name="notes" value={form.notes} onChange={handleFormChange} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Line Items</h3>
            <button onClick={addLineItem}
              className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1 rounded-lg transition">
              + Add Row
            </button>
          </div>

          <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-500 px-1">
            <span className="col-span-3">Description</span>
            <span className="col-span-1">HSN</span>
            <span className="col-span-1 text-center">Qty</span>
            <span className="col-span-1 text-center">Unit</span>
            <span className="col-span-2">Rate</span>
            <span className="col-span-1 text-center">Disc%</span>
            <span className="col-span-1 text-center">GST%</span>
            <span className="col-span-1 text-right">Taxable</span>
            <span className="col-span-1 text-right">Total</span>
          </div>

          <div className="space-y-2">
            {lineItems.map((item, index) => {
              const l = computedLines[index]
              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <input value={item.description}
                      onChange={e => updateLineItem(index, 'description', e.target.value)}
                      placeholder="e.g. BANNER BILL"
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-1">
                    <input value={item.hsn_code}
                      onChange={e => updateLineItem(index, 'hsn_code', e.target.value)}
                      placeholder="HSN"
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min="0.001" step="0.001" value={item.quantity}
                      onChange={e => updateLineItem(index, 'quantity', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-1">
                    <input value={item.unit}
                      onChange={e => updateLineItem(index, 'unit', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.001" value={item.unit_price}
                      onChange={e => updateLineItem(index, 'unit_price', e.target.value)}
                      placeholder="Rate"
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min="0" max="100" value={item.discount_percent}
                      onChange={e => updateLineItem(index, 'discount_percent', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-1">
                    <select value={item.gst_percent}
                      onChange={e => updateLineItem(index, 'gst_percent', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-1 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div className="col-span-1 text-right text-xs text-gray-600">
                    ₹{l.taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div className="col-span-1 text-right text-xs font-medium text-gray-900 flex items-center justify-end gap-1">
                    ₹{l.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    {lineItems.length > 1 && (
                      <button onClick={() => removeLineItem(index)}
                        className="text-red-400 hover:text-red-600 text-base leading-none ml-1">×</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Totals */}
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Amount</span>
              <span>₹{taxableTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IGST (interstate)</span>
              <span>₹{gstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Other Charges</span>
              <span>₹{otherCharges.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Round Off</span>
              <input type="number" step="0.01" name="round_off" value={form.round_off}
                onChange={handleFormChange}
                className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
              <span>Net Amount</span>
              <span>₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pb-8">
          <button onClick={onBack}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
            {loading ? 'Saving…' : invoice ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
