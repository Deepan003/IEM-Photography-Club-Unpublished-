import { Navigate } from 'react-router-dom'

// Coordinators now use the unified MemberDashboard at /dashboard
export default function CoordinatorDashboard() {
  return <Navigate to="/dashboard" replace />
}
