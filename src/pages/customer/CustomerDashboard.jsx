import { useAuth } from '../../context/AuthContext'

export default function CustomerDashboard() {
  const { signOut, user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">My Showroom</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-red-500 hover:text-red-700">
            Sign out
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-100 px-6 flex gap-6 text-sm font-medium text-gray-500">
        {['My Cars', 'Invoices', 'Service Bookings', 'Reminders'].map(tab => (
          <button
            key={tab}
            className="py-3 border-b-2 border-transparent hover:text-gray-900 hover:border-gray-900 transition"
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="p-6">
        <p className="text-gray-400 text-sm">Select a section from the tabs above.</p>
      </main>
    </div>
  )
}
