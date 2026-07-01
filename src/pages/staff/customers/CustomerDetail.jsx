import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function CustomerDetail({ customer, onBack }) {
  const [tractors, setTractors] = useState([])
  const [invoices, setInvoices] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)

    const [{ data: t }, { data: i }, { data: b }] = await Promise.all([
      supabase
        .from('customer_cars')
        .select('*, inventory(*)')
        .eq('customer_id', customer.id),
      supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customer.id)
        .order('invoice_date', { ascending: false }),
      supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', customer.id)
        .order('scheduled_date', { ascending: false }),
    ])

    setTractors(t || [])
    setInvoices(i || [])
    setBookings(b || [])
    setLoading(false)
  }

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-900 mb-4 flex items-center gap-1"
      >
        ← Back to Customers
      </button>

      {/* Customer info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          <p>📞 {customer.phone}</p>
          {customer.email && <p>✉️ {customer.email}</p>}
          {customer.address && <p>📍 {customer.address}</p>}
          {customer.notes && <p className="text-gray-400 mt-2">{customer.notes}</p>}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="space-y-6">

          {/* Tractors */}
          <Section title="Tractors Purchased" count={tractors.length}>
            {tractors.length === 0 ? (
              <Empty text="No tractors purchased yet." />
            ) : (
              <div className="divide-y divide-gray-100">
                {tractors.map(t => (
                  <div key={t.id} className="py-3 text-sm">
                    <p className="font-medium text-gray-900">
                      {t.inventory?.make} {t.inventory?.model} ({t.inventory?.year})
                    </p>
                    <p className="text-gray-500">
                      Purchased: {t.purchase_date || '—'} · ₹{t.purchase_price?.toLocaleString('en-IN') || '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Invoices */}
          <Section title="Invoices" count={invoices.length}>
            {invoices.length === 0 ? (
              <Empty text="No invoices yet." />
            ) : (
              <div className="divide-y divide-gray-100">
                {invoices.map(inv => (
                  <div key={inv.id} className="py-3 text-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                      <p className="text-gray-500">{inv.invoice_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">₹{inv.total_amount?.toLocaleString('en-IN')}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${inv.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {inv.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Service Bookings */}
          <Section title="Service Bookings" count={bookings.length}>
            {bookings.length === 0 ? (
              <Empty text="No service bookings yet." />
            ) : (
              <div className="divide-y divide-gray-100">
                {bookings.map(b => (
                  <div key={b.id} className="py-3 text-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{b.service_type}</p>
                      <p className="text-gray-500">{b.scheduled_date}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      b.status === 'completed' ? 'bg-green-100 text-green-700' :
                      b.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                      b.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

        </div>
      )}
    </div>
  )
}

function Section({ title, count, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="font-semibold text-gray-900 mb-3">
        {title}
        <span className="ml-2 text-xs text-gray-400 font-normal">{count}</span>
      </h3>
      {children}
    </div>
  )
}

function Empty({ text }) {
  return <p className="text-sm text-gray-400">{text}</p>
}
