import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useContext } from 'react';

import Sidebar       from './components/layout/Sidebar';
import MobileTopbar  from './components/layout/MobileTopbar';

import Login         from './pages/Login';
import Dashboard     from './pages/Dashboard';
import Finance       from './pages/Finance';
import Psychology    from './pages/Psychology';
import Health        from './pages/Health';
import Consciousness from './pages/Consciousness';
import Badges        from './pages/Badges';
import Settings      from './pages/Settings';

function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <MobileTopbar />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Pubblica */}
            <Route path="/auth" element={<Login />} />

            {/* Private */}
            <Route path="/dashboard" element={
              <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
            } />
            <Route path="/finance" element={
              <ProtectedRoute><AppLayout><Finance /></AppLayout></ProtectedRoute>
            } />
            <Route path="/psychology" element={
              <ProtectedRoute><AppLayout><Psychology /></AppLayout></ProtectedRoute>
            } />
            <Route path="/health" element={
              <ProtectedRoute><AppLayout><Health /></AppLayout></ProtectedRoute>
            } />
            <Route path="/consciousness" element={
              <ProtectedRoute><AppLayout><Consciousness /></AppLayout></ProtectedRoute>
            } />
            <Route path="/badges" element={
              <ProtectedRoute><AppLayout><Badges /></AppLayout></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
