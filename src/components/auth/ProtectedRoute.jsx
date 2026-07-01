import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (allowedRole && role !== allowedRole) {
    // Redirect to correct dashboard based on actual role
    return <Navigate to={role === 'staff' ? '/staff' : '/customer'} replace />
  }

  return children
}
