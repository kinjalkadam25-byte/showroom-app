import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Login from './pages/Login'
import StaffDashboard from './pages/staff/StaffDashboard'
import CustomerDashboard from './pages/customer/CustomerDashboard'

function RootRedirect() {
  const { user, role, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (role === 'staff') return <Navigate to="/staff" replace />
  if (role === 'customer') return <Navigate to="/customer" replace />

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">No role assigned. Contact admin.</p>
    </div>
  )
}

function LoginRoute() {
  const { user, role, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )

  if (user && role === 'staff') return <Navigate to="/staff" replace />
  if (user && role === 'customer') return <Navigate to="/customer" replace />

  return <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/staff/*"
            element={
              <ProtectedRoute allowedRole="staff">
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/*"
            element={
              <ProtectedRoute allowedRole="customer">
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
