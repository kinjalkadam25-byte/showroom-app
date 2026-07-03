import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired']
const GST_RATES = [5, 12, 18, 28]

function emptyLine() {
  return {
    inventory_id: '',
    description: '',
    hsn_code: '8432',
    quantity: 1,
    unit_price: '',
    discount_percent: 0,
    gst_percent: 18,
  }
}

export default function QuotationForm({ quotation, onBack, onSave }) {
  const [customers, setCustomers]         = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [form, setForm] = useState({
    customer_id:         quotation?.customer_id         || '',
    status:               quotation?.status               || 'draft',
    valid_until:          quotation?.valid_until          || '',
    notes:                quotation?.notes                || '',
    is_interstate:        quotation?.is_interstate        ?? false,
    other_charges:        quotation?.other_charges        ?? 0,
    round_off:            quotation?.round_off            ?? 0,
    customer_gstin:       quotation?.customer_gstin       || '',
    customer_state:       quotation?.customer_state       || '',
    customer_state_code:  quotation?.customer_state_code  || '',
    customer_pan:         quotation?.customer_pan         || '',
    customer_address:     quotation?.customer_address     || '',
    customer_phone:       quotation?.customer_phone       || '',
  })
  const [lineItems, setLineItems] = useState(
    quotation?.quotation_items?.length > 0
      ? quotation.quotation_items.map(i => ({
          inventory_id:      i.inventory_id || '',
          description:       i.description,
          hsn_code:          i.hsn_code || '8432',
          quantity:          i.quantity,
          unit_price:        i.unit_price,
          discount_percent:  i.discount_percent || 0,
          gst_percent:       i.gst_percent ?? 18,
        }))
      : [emptyLine()]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('id, name, phone, address').order('name'),
      supabase.from('inventory').select('id, make, model, year, price, hsn_code').order('make'),
    ]).then(([{ data: c }, { data: inv }]) => {
      setCustomers(c || [])
      setInventoryItems(inv || [])
    })
  }, [])

  function handleFormChange(e) {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [e.target.name]: value }))
  }

  function selectCustomer(customerId) {
    const c = customers.find(c => c.id === customerId)
    setForm(f => ({
      ...f,
      customer_id: customerId,
      // Only prefill if empty, so re-selecting doesn't clobber manual edits
      customer_address: f.customer_address || c?.address || '',
      customer_phone:   f.customer_phone   || c?.phone   || '',
    }))
  }

  function updateLineItem(index, field, value) {
    setLineItems(prev => {
      const next = prev.map((item, i) => i === index ? { ...item, [field]: value } : item)
      if (field === 'inventory_id' && value) {
        const inv = inventoryItems.find(i => i.id === value)
        if (inv) {
          next[index] = {
            ...next[index],
            description: `${inv.make} ${inv.model} (${inv.year})`,
            unit_price:  inv.price ?? '',
            hsn_code:    inv.hsn_code || '8432',
          }
        }
      }
      return next
    })
  }

  function addLineItem() {
    setLineItems(prev => [...prev, emptyLine()])
  }

  function removeLineItem(index) {
    if (lineItems.length === 1) return
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  // Per-line computed values, mirroring the reference document's columns:
  // Total (qty*rate) -> Disc% -> Taxable Amount -> Gst Rate/Amt -> Total
  function computeLine(item) {
    const qty     = Number(item.quantity) || 0
    const rate    = Number(item.unit_price) || 0
    const gross   = qty * rate
    const discPct = Number(item.discount_percent) || 0
    const taxable = gross - (gross * discPct / 100)
    const gstPct  = Number(item.gst_percent) || 0
    const gstAmt  = taxable * (gstPct / 100)
    const cgst    = form.is_interstate ? 0 : gstAmt / 2
    const sgst    = form.is_interstate ? 0 : gstAmt / 2
    const igst    = form.is_interstate ? gstAmt : 0
    const total   = taxable + gstAmt
    return { gross, taxable, gstAmt, cgst, sgst, igst, total }
  }

  const computedLines = lineItems.map(computeLine)
  const taxableTotal  = computedLines.reduce((s, l) => s + l.taxable, 0)
  const gstTotal      = computedLines.reduce((s, l) => s + l.gstAmt, 0)
  const otherCharges  = Number(form.other_charges || 0)
  const roundOff      = Number(form.round_off || 0)
  const grandTotal    = taxableTotal + gstTotal + otherCharges + roundOff

  // Slab matrix: group by GST rate for the 5/12/18/28 breakdown
  const slabs = GST_RATES.reduce((acc, rate) => {
    acc[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    return acc
  }, {})
  lineItems.forEach((item, i) => {
    const rate = Number(item.gst_percent) || 0
    if (slabs[rate]) {
      const l = computedLines[i]
      slabs[rate].taxable += l.taxable
      slabs[rate].cgst    += l.cgst
      slabs[rate].sgst    += l.sgst
      slabs[rate].igst    += l.igst
    }
  })

  async function handleSubmit() {
    if (!form.customer_id) { setError('Please select a customer.'); return }
    if (lineItems.some(i => !i.description.trim() || Number(i.unit_price) <= 0)) {
      setError('Each line item needs a description and a price greater than 0.')
      return
    }

    setLoading(true)
    setError('')

    const payload = {
      customer_id:          form.customer_id,
      status:                form.status,
      valid_until:           form.valid_until || null,
      notes:                 form.notes || null,
      is_interstate:         form.is_interstate,
      other_charges:         otherCharges,
      round_off:             roundOff,
      customer_gstin:        form.customer_gstin || null,
      customer_state:        form.customer_state || null,
      customer_state_code:   form.customer_state_code || null,
      customer_pan:          form.customer_pan || null,
      customer_address:      form.customer_address || null,
      customer_phone:        form.customer_phone || null,
      taxable_total:         Number(taxableTotal.toFixed(2)),
      gst_total:             Number(gstTotal.toFixed(2)),
      total_amount:          Number(grandTotal.toFixed(2)),
      discount:              0, // superseded by per-line discount_percent; kept for backward compat
    }

    let quotationId = quotation?.id

    if (quotation) {
      const { error: err } = await supabase.from('quotations').update(payload).eq('id', quotationId)
      if (err) { setError(err.message); setLoading(false); return }
      await supabase.from('quotation_items').delete().eq('quotation_id', quotationId)
    } else {
      const { data, error: err } = await supabase.from('quotations').insert(payload).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      quotationId = data.id
    }

    const itemsPayload = lineItems.map((item, i) => {
      const l = computedLines[i]
      return {
        quotation_id:      quotationId,
        inventory_id:      item.inventory_id || null,
        description:       item.description.trim(),
        hsn_code:          item.hsn_code || '8432',
        quantity:          Number(item.quantity),
        unit_price:        Number(item.unit_price),
        discount_percent:  Number(item.discount_percent) || 0,
        taxable_amount:    Number(l.taxable.toFixed(2)),
        gst_percent:       Number(item.gst_percent) || 0,
        cgst_amount:       Number(l.cgst.toFixed(2)),
        sgst_amount:       Number(l.sgst.toFixed(2)),
        igst_amount:       Number(l.igst.toFixed(2)),
        total:             Number(l.total.toFixed(2)),
      }
    })

    const { error: itemsErr } = await supabase.from('quotation_items').insert(itemsPayload)
    if (itemsErr) { setError(itemsErr.message); setLoading(false); return }

    onSave()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">
          ← Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">
          {quotation ? `Edit ${quotation.quotation_number}` : 'New Quotation'}
        </h2>
      </div>

      <div className="max-w-4xl space-y-5">
        {/* Customer + tax details */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Customer & Tax Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select
                value={form.customer_id}
                onChange={e => selectCustomer(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">Select customer…</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address (on document)</label>
              <input
                name="customer_address"
                value={form.customer_address}
                onChange={handleFormChange}
                placeholder="e.g. AT/POST-GAVADI TAL-JAWALI, DIST-SATARA"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No</label>
              <input
                name="customer_phone"
                value={form.customer_phone}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer GSTIN</label>
              <input
                name="customer_gstin"
                value={form.customer_gstin}
                onChange={handleFormChange}
                placeholder="Leave blank if unregistered"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer State</label>
              <input
                name="customer_state"
                value={form.customer_state}
                onChange={handleFormChange}
                placeholder="e.g. Maharashtra"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State Code</label>
              <input
                name="customer_state_code"
                value={form.customer_state_code}
                onChange={handleFormChange}
                placeholder="e.g. 27"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN No</label>
              <input
                name="customer_pan"
                value={form.customer_pan}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="is_interstate"
                name="is_interstate"
                checked={form.is_interstate}
                onChange={handleFormChange}
                className="w-4 h-4 rounded border-gray-300 accent-gray-900"
              />
              <label htmlFor="is_interstate" className="text-sm font-medium text-gray-700">
                Interstate sale (IGST instead of CGST+SGST)
              </label>
            </div>
          </div>
        </div>

        {/* Document details */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Document Details</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
              <input
                type="date"
                name="valid_until"
                value={form.valid_until}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Other Charges (₹)</label>
              <input
                type="number"
                name="other_charges"
                value={form.other_charges}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleFormChange}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Line Items</h3>
            <button
              onClick={addLineItem}
              className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1 rounded-lg transition"
            >
              + Add Row
            </button>
          </div>

          <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-500 px-1">
            <span className="col-span-2">Inventory</span>
            <span className="col-span-2">Description</span>
            <span className="col-span-1">HSN</span>
            <span className="col-span-1 text-center">Qty</span>
            <span className="col-span-1">Rate</span>
            <span className="col-span-1 text-center">Disc%</span>
            <span className="col-span-1 text-center">GST%</span>
            <span className="col-span-2 text-right">Taxable</span>
            <span className="col-span-1 text-right">Total</span>
          </div>

          <div className="space-y-2">
            {lineItems.map((item, index) => {
              const l = computedLines[index]
              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <select
                      value={item.inventory_id}
                      onChange={e => updateLineItem(index, 'inventory_id', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    >
                      <option value="">Custom</option>
                      {inventoryItems.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.make} {inv.model} ({inv.year})</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <input
                      value={item.description}
                      onChange={e => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div className="col-span-1">
                    <input
                      value={item.hsn_code}
                      onChange={e => updateLineItem(index, 'hsn_code', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div className="col-span-1">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateLineItem(index, 'quantity', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div className="col-span-1">
                    <input
                      type="number"
                      min="0"
                      value={item.unit_price}
                      onChange={e => updateLineItem(index, 'unit_price', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div className="col-span-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={item.discount_percent}
                      onChange={e => updateLineItem(index, 'discount_percent', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div className="col-span-1">
                    <select
                      value={item.gst_percent}
                      onChange={e => updateLineItem(index, 'gst_percent', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-1 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    >
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>

                  <div className="col-span-2 text-right text-xs text-gray-600">
                    ₹{l.taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>

                  <div className="col-span-1 text-right text-xs font-medium text-gray-900 flex items-center justify-end gap-1">
                    ₹{l.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    {lineItems.length > 1 && (
                      <button
                        onClick={() => removeLineItem(index)}
                        className="text-red-400 hover:text-red-600 text-base leading-none ml-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* GST Slab Matrix preview */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">GST Slab Breakdown</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Slab</th>
                    {GST_RATES.map(r => <th key={r} className="px-2 py-1.5 text-right">{r}%</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-2 py-1.5 text-gray-500">Taxable</td>
                    {GST_RATES.map(r => (
                      <td key={r} className="px-2 py-1.5 text-right text-gray-700">
                        {slabs[r].taxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 text-gray-500">
                      {form.is_interstate ? 'IGST' : 'CGST+SGST'}
                    </td>
                    {GST_RATES.map(r => (
                      <td key={r} className="px-2 py-1.5 text-right text-gray-700">
                        {(form.is_interstate ? slabs[r].igst : slabs[r].cgst + slabs[r].sgst)
                          .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Amount</span>
              <span>₹{taxableTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total GST</span>
              <span>₹{gstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Other Charges</span>
              <span>₹{otherCharges.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Round Off</span>
              <input
                type="number"
                step="0.01"
                name="round_off"
                value={form.round_off}
                onChange={handleFormChange}
                className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
              <span>Net Amount</span>
              <span>₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pb-8">
          <button
            onClick={onBack}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : quotation ? 'Update Quotation' : 'Create Quotation'}
          </button>
        </div>
      </div>
    </div>
  )
}
