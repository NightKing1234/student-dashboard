import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import ClientDetail from './pages/ClientDetail'

export default function App() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-500">
        טוען…
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // מנהל-על (סבא) מגיע ישירות למסך ניהול הלקוחות. שאר המשתמשים —
  // לטבלת התלמידים. ההפרדה אכופה גם ב-RLS, לא רק בניתוב.
  const isSuperAdmin = profile?.role === 'super_admin'

  return (
    <Routes>
      <Route
        path="/login"
        element={<Navigate to={isSuperAdmin ? '/admin' : '/'} replace />}
      />
      <Route path="/" element={isSuperAdmin ? <Navigate to="/admin" replace /> : <Dashboard />} />
      <Route path="/students" element={<Dashboard />} />
      <Route path="/students/:code" element={<Dashboard />} />
      <Route
        path="/admin"
        element={isSuperAdmin ? <Admin /> : <Navigate to="/" replace />}
      />
      <Route
        path="/admin/client/:code"
        element={isSuperAdmin ? <ClientDetail /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to={isSuperAdmin ? '/admin' : '/'} replace />} />
    </Routes>
  )
}
