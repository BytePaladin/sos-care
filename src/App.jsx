import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Dashboard from './components/Dashboard';
import StaffDashboard from './components/StaffDashboard';
import AdminDashboard from './components/AdminDashboard';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';

function AppRoutes({ loggedInUser, setLoggedInUser, showToast, settingsOpen, setSettingsOpen }) {
  const navigate = useNavigate();

  const handleNavigate = useCallback((page) => {
    switch (page) {
      case 'landing':
        navigate('/');
        break;
      case 'login':
        navigate('/login');
        break;
      case 'signup':
        navigate('/signup');
        break;
      case 'dashboard':
        if (loggedInUser?.role === 'staff') {
          navigate('/staff');
        } else if (loggedInUser?.role === 'admin') {
          navigate('/ikh/admin');
        } else {
          navigate('/dashboard');
        }
        break;
      case 'staff':
        navigate('/staff');
        break;
      default:
        navigate('/');
    }
  }, [navigate, loggedInUser]);

  const handleLogin = useCallback((user) => {
    setLoggedInUser(user);
    if (user.role === 'staff') {
      navigate('/staff');
    } else if (user.role === 'admin') {
      navigate('/ikh/admin');
    } else {
      navigate('/dashboard');
    }
    showToast(`Welcome back, ${user.name}!`, 'success');
  }, [navigate, setLoggedInUser, showToast]);

  const handleLogout = useCallback(() => {
    setLoggedInUser(null);
    localStorage.removeItem('sos_token_patient');
    localStorage.removeItem('sos_token_staff');
    localStorage.removeItem('sos_token_admin');
    localStorage.removeItem('sos_token');
    localStorage.removeItem('sos_admin_user');
    navigate('/login');
    showToast('You have been logged out', 'info');
  }, [navigate, setLoggedInUser, showToast]);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage onNavigate={handleNavigate} />} />
        <Route
          path="/login"
          element={
            <LoginPage
              onNavigate={handleNavigate}
              onLogin={handleLogin}
              onShowToast={showToast}
            />
          }
        />
        <Route
          path="/signup"
          element={
            <SignUpPage
              onNavigate={handleNavigate}
              onShowToast={showToast}
            />
          }
        />
        <Route
          path="/dashboard"
          element={
            <Dashboard
              userName={loggedInUser?.name || 'Patient'}
              onOpenSettings={() => setSettingsOpen(true)}
              onLogout={handleLogout}
            />
          }
        />
        <Route
          path="/staff"
          element={
            <StaffDashboard
              user={loggedInUser || { id: 'doc-1', name: 'Dr. Nusrat Jahan', role: 'staff' }}
              onOpenSettings={() => setSettingsOpen(true)}
              onLogout={handleLogout}
            />
          }
        />
        {/* Secret Isolated Admin Portal Route */}
        <Route
          path="/ikh/admin"
          element={
            <AdminDashboard
              onShowToast={showToast}
              onLogout={handleLogout}
            />
          }
        />
        {/* Fallback for unmapped URLs */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onShowToast={showToast}
      />
    </>
  );
}

export default function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes
          loggedInUser={loggedInUser}
          setLoggedInUser={setLoggedInUser}
          showToast={showToast}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />
        {/* Global Toast */}
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onClose={hideToast}
        />
      </BrowserRouter>
    </ThemeProvider>
  );
}
