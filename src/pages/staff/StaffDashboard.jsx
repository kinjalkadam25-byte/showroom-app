import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import CustomerList from './customers/CustomerList'
import InventoryList from './inventory/InventoryList'
import QuotationList from './quotations/QuotationList'
import InvoiceList from './invoices/InvoiceList'
import ReminderList from './reminders/ReminderList'
import LedgerList from './ledger/LedgerList'
import OutstandingReport from './reports/OutstandingReport'
import ExpenseInvoiceList from './expenseinvoices/ExpenseInvoiceList'

const TABS = ['Customers', 'Inventory', 'Quotations', 'Invoices', 'Reminders', 'Ledger', 'Outstanding', 'Expense Invoices']

export default function StaffDashboard() {
  const { signOut, user } = useAuth()
  const [activeTab, setActiveTab] = useState('Customers')

  function renderTab() {
    switch (activeTab) {
      case 'Customers':  return <CustomerList />
      case 'Inventory':  return <InventoryList />
      case 'Quotations': return <QuotationList />
      case 'Invoices':   return <InvoiceList />
      case 'Reminders':  return <ReminderList />
      case 'Ledger':     return <LedgerList />
      case 'Outstanding': return <OutstandingReport />
      case 'Expense Invoices': return <ExpenseInvoiceList />
      default:           return <p className="text-gray-400 text-sm">Coming soon.</p>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Staff Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-red-500 hover:text-red-700">
            Sign out
          </button>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="bg-white border-b border-gray-100 px-6 flex gap-6 text-sm font-medium text-gray-500 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === tab
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="p-6">
        {renderTab()}
      </main>
    </div>
  )
}
