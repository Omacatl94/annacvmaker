import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import Header from './components/Header';
import Landing from './pages/Landing';
import Waitlist from './pages/Waitlist';
import Profile from './pages/Profile';
import Genera from './pages/Genera';
import Candidature from './pages/Candidature';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Legal from './pages/Legal';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Caricamento...</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/privacy" element={<Legal page="privacy" />} />
        <Route path="/terms" element={<Legal page="terms" />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  }

  if (user.status === 'waitlist') {
    return (
      <Routes>
        <Route path="/privacy" element={<Legal page="privacy" />} />
        <Route path="/terms" element={<Legal page="terms" />} />
        <Route path="*" element={<Waitlist />} />
      </Routes>
    );
  }

  return (
    <>
      <Header />
      <div className="tab-content">
        <Routes>
          <Route path="/" element={<Profile />} />
          <Route path="/genera" element={<Genera />} />
          <Route path="/candidature" element={<Candidature />} />
          <Route path="/account" element={<Account />} />
          {user.role === 'admin' && <Route path="/admin" element={<Admin />} />}
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </AuthProvider>
  );
}
