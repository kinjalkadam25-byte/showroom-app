import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

const CATEGORIES = {
  credit: [
    { value: 'sale',             label: 'Sale' },
    { value: 'service',          label: 'Service Income' },
    { value: 'payment_received', label: 'Payment Received' },
    { value: 'other',            label: 'Other Income' },
  ],
  debit: [
    { value: 'expense',  label: 'Expense' },
    { value: 'purchase', label: 'Purchase' },
    { value: 'salary',   label: 'Salary' },
    { value: 'other',    label: 'Other' },
  ],
}

export default function LedgerForm({ entry, onClose, onSave }) {
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({
    date:        entry?.date        || new Date().toISOString().slice(0, 10),
    type:        entry?.type        || 'credit',
    amount:      entry?.amount      || '',
    description: entry?.description || '',
    category:    entry?.category    || 'sale',
    customer_id: entry?.customer_id || '',
    reference:   entry?.reference   || '',
    notes:       entry?.notes       || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    supabase.from('customers').select('id, name').order('name')
      .then(({ data }) => setCustomers(data || []))
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => {
      const updated = { ...f, [name]: value }
      // Reset category when type changes to avoid invalid combinations
      if (name === 'type') {
        updated.category = value === 'credit' ? 'sale' : 'expense'
      }
      return updated
    })
  }

  async function handleSubmit() {
    if (!form.description.trim()) { setError('Description is required.'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('Amount must be greater than 0.'); return }

    setLoading(true)
    setError('')

    const payload = {
      date:        form.date,
      type:        form.type,
      amount:      Number(form.amount),
      description: form.description.trim(),
      category:    form.category,
      customer_id: form.customer_id || null,
      reference:   form.reference || null,
      notes:       form.notes || null,
    }

    if (entry) {
      const { error: err } = await supabase.from('ledger_entries').update(payload).eq('id', entry.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { error: err } = await supabase.from('ledger_entries').insert(payload)
      if (err) { setError(err.message); setLoading(false); return }
    }

    onSave()
  }

  const categories = CATEGORIES[form.type] || CATEGORIES.credit

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {entry ? 'Edit Entry' : 'New Ledger Entry'}
        </h3>

        <div className="space-y-3">
          {/* Type toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {['credit', 'debit'].map(t => (
              <button
                key={t}
                onClick={() => handleChange({ target: { name: 'type', value: t } })}
                className={`flex-1 py-2 text-sm font-medium capitalize transition ${
                  form.type === t
                    ? t === 'credit'
                      ? 'bg-green-600 text-white'
                      : 'bg-red-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'credit' ? '+ Credit (Money In)' : '− Debit (Money Out)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                name="amount"
                min="0"
                value={form.amount}
                onChange={handleChange}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="e.g. Payment received for INV-0001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                {categories.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input
                name="reference"
                value={form.reference}
                onChange={handleChange}
                placeholder="e.g. INV-0001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select
              name="customer_id"
              value={form.customer_id}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">No customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
