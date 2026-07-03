import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function InvoiceForm({ invoice, onBack, onSave }) {
  const [customers, setCustomers]       = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [form, setForm] = useState({
    customer_id:   invoice?.customer_id   || '',
    invoice_date:  invoice?.invoice_date  || new Date().toISOString().slice(0, 10),
    due_date:      invoice?.due_date      || '',
    notes:         invoice?.notes         || '',
    discount:      invoice?.discount      ?? 0,
    paid:          invoice?.paid          ?? false,
    gst_percent:   invoice?.gst_percent   ?? 18,
    is_interstate: invoice?.is_interstate ?? false,
  })
  const [lineItems, setLineItems] = useState(
    invoice?.invoice_items?.length > 0
      ? invoice.invoice_items.map(i => ({
          inventory_id: i.inventory_id || '',
          description:  i.description,
          hsn_code:     i.hsn_code || '8701',
          quantity:     i.quantity,
          unit_price:   i.unit_price,
        }))
      : [{ inventory_id: '', description: '', hsn_code: '8701', quantity: 1, unit_price: '' }]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('id, name').order('name'),
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
            hsn_code:    inv.hsn_code || '8701',
          }
        }
      }
      return next
    })
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { inventory_id: '', description: '', hsn_code: '8701', quantity: 1, unit_price: '' }])
  }

  function removeLineItem(index) {
    if (lineItems.length === 1) return
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal    = lineItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price) || 0), 0)
  const afterDiscount = Math.max(0, subtotal - Number(form.discount || 0))
  const gstPercent   = Number(form.gst_percent || 0)
  const gstAmount    = afterDiscount * (gstPercent / 100)
  const cgstAmount   = form.is_interstate ? 0 : gstAmount / 2
  const sgstAmount   = form.is_interstate ? 0 : gstAmount / 2
  const igstAmount   = form.is_interstate ? gstAmount : 0
  const total        = afterDiscount + gstAmount

  async function handleSubmit() {
    if (!form.customer_id) { setError('Please select a customer.'); return }
    if (lineItems.some(i => !i.description.trim() || Number(i.unit_price) <= 0)) {
      setError('Each line item needs a description and a price greater than 0.')
      return
    }

    setLoading(true)
    setError('')

    const payload = {
      customer_id:   form.customer_id,
      invoice_date:  form.invoice_date,
      due_date:      form.due_date || null,
      notes:         form.notes || null,
      discount:      Number(form.discount || 0),
      gst_percent:   gstPercent,
      cgst_amount:   Number(cgstAmount.toFixed(2)),
      sgst_amount:   Number(sgstAmount.toFixed(2)),
      igst_amount:   Number(igstAmount.toFixed(2)),
      is_interstate: form.is_interstate,
      total_amount:  Number(total.toFixed(2)),
      paid:          form.paid,
    }

    let invoiceId = invoice?.id

    if (invoice) {
      const { error: err } = await supabase.from('invoices').update(payload).eq('id', invoiceId)
      if (err) { setError(err.message); setLoading(false); return }
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    } else {
      const { data, error: err } = await supabase.from('invoices').insert(payload).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      invoiceId = data.id
    }

    const itemsPayload = lineItems.map(item => ({
      invoice_id:   invoiceId,
      inventory_id: item.inventory_id || null,
      description:  item.description.trim(),
      hsn_code:     item.hsn_code || '8701',
      quantity:     Number(item.quantity),
      unit_price:   Number(item.unit_price),
      total:        Number(item.quantity) * Number(item.unit_price),
    }))

    const { error: itemsErr } = await supabase.from('invoice_items').insert(itemsPayload)
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
          {invoice ? `Edit ${invoice.invoice_number}` : 'New Invoice'}
        </h2>
      </div>

      <div className="max-w-3xl space-y-5">
        {/* Details */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select
                name="customer_id"
                value={form.customer_id}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">Select customer…</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
              <input
                type="date"
                name="invoice_date"
                value={form.invoice_date}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
              <input
                type="number"
                name="gst_percent"
                min="0"
                max="28"
                step="0.5"
                value={form.gst_percent}
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

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleFormChange}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="paid"
                name="paid"
                checked={form.paid}
                onChange={handleFormChange}
                className="w-4 h-4 rounded border-gray-300 accent-gray-900"
              />
              <label htmlFor="paid" className="text-sm font-medium text-gray-700">Mark as paid</label>
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
            <span className="col-span-3">Inventory (optional)</span>
            <span className="col-span-3">Description</span>
            <span className="col-span-1">HSN</span>
            <span className="col-span-1 text-center">Qty</span>
            <span className="col-span-2">Unit Price</span>
            <span className="col-span-2 text-right">Amount</span>
          </div>

          <div className="space-y-2">
            {lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <select
                    value={item.inventory_id}
                    onChange={e => updateLineItem(index, 'inventory_id', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="">Custom</option>
                    {inventoryItems.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.make} {inv.model} ({inv.year})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3">
                  <input
                    value={item.description}
                    onChange={e => updateLineItem(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div className="col-span-1">
                  <input
                    value={item.hsn_code}
                    onChange={e => updateLineItem(index, 'hsn_code', e.target.value)}
                    placeholder="8701"
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

                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    value={item.unit_price}
                    onChange={e => updateLineItem(index, 'unit_price', e.target.value)}
                    placeholder="₹ 0"
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div className="col-span-1 text-right text-sm text-gray-600">
                  ₹{(Number(item.quantity) * Number(item.unit_price) || 0).toLocaleString('en-IN')}
                </div>

                <div className="col-span-1 flex justify-center">
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeLineItem(index)}
                      className="text-red-400 hover:text-red-600 text-xl leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Discount (₹)</span>
              <input
                type="number"
                min="0"
                name="discount"
                value={form.discount}
                onChange={handleFormChange}
                className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Taxable Amount</span>
              <span>₹{afterDiscount.toLocaleString('en-IN')}</span>
            </div>
            {form.is_interstate ? (
              <div className="flex justify-between text-gray-600">
                <span>IGST ({gstPercent}%)</span>
                <span>₹{igstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>CGST ({(gstPercent / 2).toFixed(1)}%)</span>
                  <span>₹{cgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST ({(gstPercent / 2).toFixed(1)}%)</span>
                  <span>₹{sgstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
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
            {loading ? 'Saving…' : invoice ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
