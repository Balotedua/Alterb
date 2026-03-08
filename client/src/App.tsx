import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';

// Lazy-loaded pages
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Finance = lazy(() => import('@/pages/Finance'));
const Psychology = lazy(() => import('@/pages/Psychology'));
const Health = lazy(() => import('@/pages/Health'));
const Consciousness = lazy(() => import('@/pages/Consciousness'));
const Badges = lazy(() => import('@/pages/Badges'));
const Settings = lazy(() => import('@/pages/Settings'));
const Routine = lazy(() => import('@/pages/Routine'));
const News = lazy(() => import('@/pages/News'));
const Career = lazy(() => import('@/pages/Career'));
const Chatbot = lazy(() => import('@/pages/Chatbot'));

function PageLoader() {
  return (
    <div className="page-loader" aria-busy="true" aria-label="Caricamento...">
      <span className="page-loader__spinner" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Pubblica */}
              <Route path="/auth" element={<Login />} />

              {/* Private: ProtectedRoute wrappa il layout con Outlet */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/finance" element={<Finance />} />
                  <Route path="/psychology" element={<Psychology />} />
                  <Route path="/health" element={<Health />} />
                  <Route path="/consciousness" element={<Consciousness />} />
                  <Route path="/badges" element={<Badges />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/routine" element={<Routine />} />
                  <Route path="/news" element={<News />} />
                  <Route path="/career" element={<Career />} />
                  <Route path="/chatbot" element={<Chatbot />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
