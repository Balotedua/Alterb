import { Toaster } from 'sonner';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { NebulaCore } from '@/components/nebula/NebulaCore';
import LoginScreen from '@/components/auth/LoginScreen';

function PageLoader() {
  return (
    <div className="page-loader" aria-busy="true" aria-label="Caricamento...">
      <span className="page-loader__spinner" />
    </div>
  );
}

/** Inner component — rendered inside AuthProvider so useAuth() is available. */
function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  return user ? <NebulaCore /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Toaster
          position="top-right"
          toastOptions={{ unstyled: true }}
          richColors={false}
        />
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
