import { useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleNavigate = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handleLogin = useCallback((user) => {
    setLoggedInUser(user);
    setCurrentPage('dashboard');
    showToast(`Welcome back, ${user.name}!`, 'success');
  }, [showToast]);

  const handleLogout = useCallback(() => {
    setLoggedInUser(null);
    setCurrentPage('landing');
    showToast('You have been logged out', 'info');
  }, [showToast]);

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={handleNavigate} />;
      case 'login':
        return (
          <LoginPage
            onNavigate={handleNavigate}
            onLogin={handleLogin}
            onShowToast={showToast}
          />
        );
      case 'signup':
        return (
          <SignUpPage
            onNavigate={handleNavigate}
            onShowToast={showToast}
          />
        );
      case 'dashboard':
        return (
          <Dashboard
            userName={loggedInUser?.name || 'Patient'}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogout={handleLogout}
          />
        );
      default:
        return <LandingPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <>
      <div className="transition-all duration-300">
        {renderPage()}
      </div>

      {/* Settings Modal — accessible from Dashboard */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onShowToast={showToast}
      />

      {/* Global Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
