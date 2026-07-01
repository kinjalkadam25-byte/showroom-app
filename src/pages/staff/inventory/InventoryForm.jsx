import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

const STATUSES   = ['available', 'reserved', 'sold']
const FUEL_TYPES = ['diesel', 'petrol', 'electric', 'other']

export default function InventoryForm({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    make:           item?.make           || '',
    model:          item?.model          || '',
    year:           item?.year           || new Date().getFullYear(),
    hp:             item?.hp             || '',
    fuel_type:      item?.fuel_type      || 'diesel',
    chassis_number: item?.chassis_number || '',
    price:          item?.price          || '',
    status:         item?.status         || 'available',
    description:    item?.description    || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    if (!form.make || !form.model || !form.year) {
      setError('Make, model, and year are required.')
      return
    }

    setLoading(true)
    setError('')

    const payload = {
      make:           form.make,
      model:          form.model,
      year:           parseInt(form.year, 10),
      hp:             form.hp !== '' ? parseInt(form.hp, 10) : null,
      fuel_type:      form.fuel_type,
      chassis_number: form.chassis_number || null,
      price:          form.price !== '' ? parseFloat(form.price) : null,
      status:         form.status,
      description:    form.description || null,
    }

    if (item) {
      const { error: err } = await supabase.from('inventory').update(payload).eq('id', item.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { error: err } = await supabase.from('inventory').insert(payload)
      if (err) { setError(err.message); setLoading(false); return }
    }

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {item ? 'Edit Item' : 'Add Inventory Item'}
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
              <input
                name="make"
                value={form.make}
                onChange={handleChange}
                placeholder="e.g. Mahindra"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
              <input
                name="model"
                value={form.model}
                onChange={handleChange}
                placeholder="e.g. 575 DI"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
              <input
                name="year"
                type="number"
                value={form.year}
                onChange={handleChange}
                min="1990"
                max={new Date().getFullYear() + 1}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HP</label>
              <input
                name="hp"
                type="number"
                value={form.hp}
                onChange={handleChange}
                min="0"
                placeholder="e.g. 50"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
              <select
                name="fuel_type"
                value={form.fuel_type}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                {FUEL_TYPES.map(f => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chassis Number</label>
              <input
                name="chassis_number"
                value={form.chassis_number}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
              <input
                name="price"
                type="number"
                value={form.price}
                onChange={handleChange}
                min="0"
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
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
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
