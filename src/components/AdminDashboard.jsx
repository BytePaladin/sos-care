import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export default function AdminDashboard({ onShowToast, onLogout }) {
  const { isDark, toggleTheme } = useTheme();

  // Admin session state
  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem('sos_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active navigation section: 'analytics' | 'accounts' | 'staff_audit'
  const [activeTab, setActiveTab] = useState('analytics');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Analytics & Data state
  const [analytics, setAnalytics] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [staffAnalytics, setStaffAnalytics] = useState([]);
  const [staffActions, setStaffActions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // New staff registration form state
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    password: '',
    staffRole: 'Resident Physician',
  });
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  // Filter state for user directory
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Delete modal confirmation target
  const [deletingUser, setDeletingUser] = useState(null);

  // Fetch admin dashboard data
  const fetchAdminData = useCallback(async () => {
    if (!adminUser) return;
    // Only show loading initially if we have no data to prevent UI flashing during polling
    if (usersList.length === 0) setIsLoading(true);
    
    try {
      const [analyticsData, usersData, staffData, actionsData] = await Promise.all([
        api.getHospitalAnalytics().catch((err) => { console.error(err); return null; }),
        api.getAllUsers().catch((err) => { console.error(err); return null; }),
        api.getStaffAnalytics().catch((err) => { console.error(err); return null; }),
        api.getStaffActions().catch((err) => { console.error(err); return null; }),
      ]);

      if (analyticsData) setAnalytics(analyticsData);
      if (usersData) setUsersList(usersData);
      if (staffData) setStaffAnalytics(staffData);
      if (actionsData) setStaffActions(actionsData);
    } catch (err) {
      console.error('Failed to fetch admin data during poll', err);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUser]);

  useEffect(() => {
    if (adminUser) {
      fetchAdminData();
      // 15s auto-sync with visibility check to prevent exhausting free-tier limits when tab is inactive
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchAdminData();
        }
      }, 15000); 
      return () => clearInterval(interval);
    }
  }, [adminUser, fetchAdminData]);

  // Admin login handler
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword.trim()) {
      onShowToast?.('Please enter phone number and password', 'error');
      return;
    }

    setIsLoggingIn(true);
    try {
      const data = await api.adminLogin(loginPhone.trim(), loginPassword.trim());
      if (data.role !== 'admin') {
        throw new Error('Access denied: Account does not have administrator privileges');
      }
      setAdminUser(data);
      localStorage.setItem('sos_admin_user', JSON.stringify(data));
      onShowToast?.(`Welcome to Admin Control, ${data.name}!`, 'success');
    } catch (err) {
      onShowToast?.(err.message || 'Admin authentication failed', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickFill = (phone, pass) => {
    setLoginPhone(phone);
    setLoginPassword(pass);
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    localStorage.removeItem('sos_admin_user');
    localStorage.removeItem('sos_token_admin');
    localStorage.removeItem('sos_token');
    if (onLogout) onLogout();
    onShowToast?.('Admin session logged out safely', 'info');
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name.trim() || !newStaff.phone.trim() || !newStaff.password || !newStaff.staffRole) {
      onShowToast?.('Please fill out all staff fields', 'error');
      return;
    }

    setIsCreatingStaff(true);
    try {
      const created = await api.createStaff(
        newStaff.name.trim(),
        newStaff.phone.trim(),
        newStaff.password,
        newStaff.staffRole
      );
      onShowToast?.(`Staff account created for ${created.name}!`, 'success');
      setNewStaff({ name: '', phone: '', password: '', staffRole: 'Resident Physician' });
      fetchAdminData();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to create staff account', 'error');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingUser) return;
    try {
      const res = await api.deleteUserAccount(deletingUser._id);
      onShowToast?.(res.message || 'Account permanently deleted', 'success');
      setDeletingUser(null);
      fetchAdminData();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to delete account', 'error');
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                          (u.phone && u.phone.includes(userSearchQuery));
    if (!matchesSearch) return false;
    if (userRoleFilter === 'all') return true;
    return u.role === userRoleFilter;
  });

  // Dynamic Theme Classes matching StaffDashboard / LoginPage
  const pageBgClass = isDark ? 'bg-[#121212] text-white' : 'bg-[#ffffff] text-[#1f1f1f]';
  const sidebarBgClass = isDark ? 'bg-[#161616] border-neutral-800' : 'bg-[#f8f9fa] border-neutral-300';
  const headerBgClass = isDark ? 'bg-[#161616] border-neutral-800' : 'bg-[#f8f9fa] border-neutral-300';
  const cardBgClass = isDark ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-white border-neutral-300';
  const cardHoverClass = isDark ? 'hover:border-neutral-700' : 'hover:border-neutral-400';
  const inputBgClass = isDark ? 'bg-[#202124] border-neutral-800 text-white placeholder-neutral-400 focus:border-primary/50' : 'bg-white border-neutral-300 text-neutral-800 placeholder-neutral-500 focus:border-teal-500';
  const tableHeaderBgClass = isDark ? 'bg-[#121212] text-gray-400 border-neutral-800' : 'bg-neutral-100 text-neutral-600 border-neutral-300';
  const tableRowHoverClass = isDark ? 'hover:bg-neutral-800/50 border-neutral-800' : 'hover:bg-neutral-50 border-neutral-200';

  // -------------------------------------------------------------
  // VIEW 1: UNAUTHENTICATED ADMIN LOGIN SCREEN (Matches LoginPage exactly)
  // -------------------------------------------------------------
  if (!adminUser) {
    return (
      <div className="w-full min-h-screen flex flex-col justify-between bg-[#121212] text-white overflow-x-hidden animate-fade-in">
        {/* Top Header */}
        <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <img src="/kidney-hospital-logo.png" alt="Hospital Logo" className="h-10 w-10 object-cover rounded-full border border-primary/30" />
            <div>
              <h1 className="font-headline text-xl font-bold tracking-tight">S.O.S. Care</h1>
              <p className="text-[11px] text-[#80D5D4] font-semibold uppercase tracking-wider">Imaginary Kidney Hospital</p>
            </div>
          </div>
        </header>

        {/* Center Auth Card */}
        <main className="flex-grow flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 rounded-3xl border border-neutral-800 bg-[#1e1e1e] flex flex-col gap-6 relative animate-slide-up">
            <div className="text-center mt-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#121212] border border-neutral-800 flex items-center justify-center mb-4">
                <img src="/kidney-hospital-logo.png" alt="IKH Admin Logo" className="w-10 h-10 object-contain" />
              </div>
              <h2 className="font-headline text-2xl font-bold tracking-tight">Admin Control Portal</h2>
              <p className="text-xs text-gray-400 mt-1">Isolated Operations Desk</p>
            </div>

            <form onSubmit={handleAdminLogin} className="flex flex-col gap-5 w-full">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-gray-200">Administrator Phone</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    placeholder="01711112222"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#121212] border border-neutral-800 focus:border-primary focus:outline-none transition-colors text-white placeholder:text-gray-600"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-gray-200">Password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full h-12 pl-12 pr-12 rounded-xl bg-[#121212] border border-neutral-800 focus:border-primary focus:outline-none transition-colors text-white placeholder:text-gray-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-neutral-800 transition-colors text-gray-500"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-12 rounded-xl bg-primary text-white font-medium text-base hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoggingIn ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  'Sign In to Admin'
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-neutral-800 mt-2">
              <p className="text-xs font-semibold text-gray-400 mb-3 text-center">Quick Demo Access:</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('01711112222', 'admin123')}
                  className="p-3 rounded-xl border bg-[#121212] border-neutral-800 hover:border-primary text-emerald-400 text-xs font-medium flex justify-between items-center transition-colors cursor-pointer"
                >
                  <span>👨‍⚕️ Dr. Rafiqul Islam</span>
                  <span className="font-mono text-gray-400">01711112222</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('01811113333', 'admin123')}
                  className="p-3 rounded-xl border bg-[#121212] border-neutral-800 hover:border-primary text-emerald-400 text-xs font-medium flex justify-between items-center transition-colors cursor-pointer"
                >
                  <span>👩‍💼 Farhana Chowdhury</span>
                  <span className="font-mono text-gray-400">01811113333</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: AUTHENTICATED ADMIN DASHBOARD (Matches StaffDashboard layout)
  // -------------------------------------------------------------
  return (
    <div className={`w-full h-screen flex overflow-hidden transition-colors duration-300 ${pageBgClass}`}>
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ============================================================= */}
      {/* SIDEBAR                                                       */}
      {/* ============================================================= */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-80 shrink-0 flex flex-col border-r
          transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)]
          ${sidebarBgClass}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Admin Profile */}
        <div className={`p-5 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-300'} flex items-center gap-3`}>
          <img
            src="/kidney-hospital-logo.png"
            alt="Kidney Hospital Logo"
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-primary/30 shadow-sm"
          />
          <div className="min-w-0">
            <h3 className={`font-headline font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-[#1f1f1f]'}`}>
              {adminUser.name}
            </h3>
            <p className="text-[11px] text-[#889392] font-body truncate">{adminUser.staffRole || 'Administrator'}</p>
          </div>
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-neutral-500 uppercase px-3 block mb-2">
              Admin Portals
            </span>
            <div className="space-y-1">
              {[
                { id: 'analytics', label: '📊 Hospital Analytics' },
                { id: 'accounts', label: '👥 Account Management' },
                { id: 'staff_audit', label: '📑 Staff Audit Trail' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors
                    ${activeTab === item.id 
                      ? (isDark ? 'bg-primary-container text-on-primary-container' : 'bg-primary/10 text-primary font-semibold') 
                      : (isDark ? 'hover:bg-neutral-800 text-gray-300' : 'hover:bg-neutral-200/50 text-[#1f1f1f]')}
                  `}
                >
                  <span className="flex items-center gap-2">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Footer controls */}
        <div className={`border-t p-4 flex items-center justify-between ${isDark ? 'border-neutral-800' : 'border-neutral-300'}`}>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full cursor-pointer transition-colors flex items-center gap-2 text-xs font-medium ${isDark ? 'hover:bg-neutral-800 text-gray-300' : 'hover:bg-neutral-200 text-neutral-700'}`}
          >
            {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>

          <button
            onClick={handleAdminLogout}
            className="p-2 rounded-xl text-xs font-semibold hover:bg-error/10 text-error flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ============================================================= */}
      {/* MAIN SCREEN AREA                                              */}
      {/* ============================================================= */}
      <main className="flex-grow flex flex-col min-w-0">
        {/* Header Bar */}
        <header className={`h-16 border-b flex items-center px-6 justify-between shrink-0 ${headerBgClass}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h2 className="font-headline font-semibold text-lg flex items-center gap-2">
              Admin Operations
              <span className={`hidden sm:inline-block px-2.5 py-0.5 ml-2 text-[9px] uppercase font-bold tracking-wider rounded-full ${isDark ? 'bg-primary/20 text-[#80D5D4] border border-primary/30' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                IKH Network
              </span>
            </h2>
          </div>
          

        </header>

        {/* Dynamic Content Panels */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          
          {/* ============================================================ */}
          {/* TAB 1: HOSPITAL ANALYTICS OVERVIEW */}
          {/* ============================================================ */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
              <h3 className="font-headline font-semibold text-sm text-neutral-500 uppercase tracking-wider mb-2">Overview</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Patients', count: analytics?.users?.totalPatients ?? '0', color: isDark ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-white border-neutral-300' },
                  { label: 'Total Screenings', count: analytics?.screenings?.totalScreenings ?? '0', color: isDark ? 'bg-primary-container text-on-primary-container border-primary/20' : 'bg-primary/10 text-primary border-primary/20' },
                  { label: 'Red Alerts', count: analytics?.screenings?.redAlerts ?? '0', color: 'bg-error-container text-on-error-container border-error/20' },
                  { label: 'Active Chats', count: analytics?.sessions?.totalChatSessions ?? '0', color: isDark ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-white border-neutral-300' },
                ].map((stat, idx) => (
                  <div key={idx} className={`p-5 rounded-2xl border ${stat.color} elevation-1 transition-transform hover:scale-[1.02]`}>
                    <p className="text-xs font-headline font-semibold uppercase tracking-wider opacity-80">{stat.label}</p>
                    <p className="text-3xl font-headline font-bold mt-1">{stat.count}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className={`p-6 rounded-2xl border ${cardBgClass} elevation-1`}>
                  <h3 className="font-headline text-sm font-bold mb-6 uppercase tracking-wider text-neutral-500">Risk Category Distribution</h3>
                  <div className="space-y-5">
                    {[
                      { label: 'Red Alert', count: analytics?.screenings?.redAlerts ?? 0, color: 'bg-error', text: 'text-error' },
                      { label: 'Yellow Priority', count: analytics?.screenings?.yellowPriority ?? 0, color: 'bg-warning', text: 'text-warning' },
                      { label: 'Green Routine', count: analytics?.screenings?.greenRoutine ?? 0, color: 'bg-success', text: 'text-success' },
                    ].map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-xs font-semibold mb-1.5">
                          <span className={item.text}>{item.label}</span>
                          <span>{item.count} cases</span>
                        </div>
                        <div className={`w-full h-3 rounded-full overflow-hidden border ${isDark ? 'bg-[#121212] border-neutral-800' : 'bg-neutral-100 border-neutral-200'}`}>
                          <div
                            className={`${item.color} h-full transition-all duration-500`}
                            style={{
                              width: `${analytics?.screenings?.totalScreenings ? ((item.count / analytics.screenings.totalScreenings) * 100).toFixed(1) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border ${cardBgClass} elevation-1`}>
                  <h3 className="font-headline text-sm font-bold mb-6 uppercase tracking-wider text-neutral-500">Triage Queue Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Pending Review', count: analytics?.triageQueue?.pendingReviews ?? 0, color: 'text-warning' },
                      { label: 'Contacted', count: analytics?.triageQueue?.contactedPatients ?? 0, color: 'text-success' },
                      { label: 'Needs Review', count: analytics?.triageQueue?.needsReview ?? 0, color: 'text-primary' },
                      { label: 'Archived', count: analytics?.triageQueue?.falsePositives ?? 0, color: 'text-neutral-500' },
                    ].map((item, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border ${isDark ? 'bg-[#121212] border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className={`text-xs font-medium ${item.color}`}>{item.label}</div>
                        <div className="text-2xl font-extrabold mt-1 font-headline">{item.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: ACCOUNT MANAGEMENT */}
          {/* ============================================================ */}
          {activeTab === 'accounts' && (
            <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
              <h3 className="font-headline font-semibold text-sm text-neutral-500 uppercase tracking-wider mb-2">Staff Registration</h3>
              
              <div className={`p-6 rounded-2xl border ${cardBgClass} elevation-1`}>
                <form onSubmit={handleCreateStaff} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 opacity-90">Full Name</label>
                    <input
                      type="text"
                      placeholder="Dr. Example"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                      className={`w-full h-11 px-4 rounded-xl border text-xs outline-none transition-all ${inputBgClass}`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 opacity-90">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="01900000000"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                      className={`w-full h-11 px-4 rounded-xl border text-xs outline-none transition-all ${inputBgClass}`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 opacity-90">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      className={`w-full h-11 px-4 rounded-xl border text-xs outline-none transition-all ${inputBgClass}`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 opacity-90">Role</label>
                    <select
                      value={newStaff.staffRole}
                      onChange={(e) => setNewStaff({ ...newStaff, staffRole: e.target.value })}
                      className={`w-full h-11 px-3 rounded-xl border text-xs outline-none transition-all ${inputBgClass}`}
                    >
                      <option value="Chief Nephrologist">Chief Nephrologist</option>
                      <option value="Consultant Nephrologist">Consultant Nephrologist</option>
                      <option value="Resident Physician">Resident Physician</option>
                      <option value="Triage Specialist Nurse">Triage Specialist Nurse</option>
                    </select>
                  </div>
                  <div className="md:col-span-4 flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={isCreatingStaff}
                      className="h-11 px-6 bg-primary hover:bg-primary-hover text-on-primary font-medium rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                    >
                      {isCreatingStaff ? 'Registering...' : 'Register Staff Account'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-4 mt-8 mb-4">
                <h3 className="font-headline font-semibold text-sm text-neutral-500 uppercase tracking-wider">User Directory</h3>
                <div className="flex-1 max-w-sm mx-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search users by name or phone..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className={`w-full h-10 pl-10 pr-4 rounded-xl border text-xs outline-none transition-all ${inputBgClass}`}
                    />
                    <svg className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <div className={`flex p-1 rounded-xl border text-xs ${isDark ? 'bg-[#121212] border-neutral-800' : 'bg-neutral-100 border-neutral-300'}`}>
                  {['all', 'patient', 'staff', 'admin'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setUserRoleFilter(role)}
                      className={`px-4 py-1.5 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                        userRoleFilter === role
                          ? (isDark ? 'bg-primary-container text-on-primary-container' : 'bg-white shadow-sm text-neutral-900')
                          : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                      }`}
                    >
                      {role === 'all' ? 'All' : role}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`rounded-2xl border overflow-hidden ${cardBgClass} elevation-1`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b uppercase tracking-wider font-semibold ${tableHeaderBgClass}`}>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Phone</th>
                        <th className="py-3 px-4">Account</th>
                        <th className="py-3 px-4">Designation</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-neutral-800' : 'divide-neutral-200'}`}>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-neutral-500">No users found.</td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user._id} className={`transition-colors ${tableRowHoverClass}`}>
                            <td className="py-3 px-4 font-semibold">{user.name}</td>
                            <td className="py-3 px-4 font-mono text-neutral-500">{user.phone}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                user.role === 'admin' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                                user.role === 'staff' ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' :
                                'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-neutral-500">{user.staffRole || 'Patient'}</td>
                            <td className="py-3 px-4 text-right">
                              {user._id !== adminUser._id && user.role !== 'admin' && (
                                <button
                                  onClick={() => setDeletingUser(user)}
                                  className="px-3 py-1.5 text-error hover:bg-error/10 rounded-xl font-medium transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: STAFF AUDIT TRAIL */}
          {/* ============================================================ */}
          {activeTab === 'staff_audit' && (
            <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
              <h3 className="font-headline font-semibold text-sm text-neutral-500 uppercase tracking-wider mb-2">Staff Performance</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {staffAnalytics.map((staff) => (
                  <div key={staff._id} className={`p-4 rounded-2xl border ${cardBgClass} elevation-1 ${cardHoverClass} transition-colors`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-sm">{staff.name}</h4>
                        <p className="text-xs text-primary font-medium">{staff.staffRole}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-[#121212] border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="text-neutral-500 mb-1">Reviewed</div>
                        <div className="text-xl font-extrabold font-headline">{staff.reviewedCount}</div>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-[#121212] border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="text-neutral-500 mb-1">Actions</div>
                        <div className="text-xl font-extrabold text-primary font-headline">{staff.actionsLogged}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="font-headline font-semibold text-sm text-neutral-500 uppercase tracking-wider mb-2">System Audit Log</h3>
              <div className={`rounded-2xl border overflow-hidden ${cardBgClass} elevation-1`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b uppercase tracking-wider font-semibold ${tableHeaderBgClass}`}>
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Practitioner</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Patient</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Note</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-neutral-800' : 'divide-neutral-200'}`}>
                      {staffActions.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-neutral-500">No audit records found.</td>
                        </tr>
                      ) : (
                        staffActions.map((act) => (
                          <tr key={act._id} className={`transition-colors ${tableRowHoverClass}`}>
                            <td className="py-3 px-4 text-neutral-500 font-mono">
                              {new Date(act.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-semibold">{act.staffName || act.staffId?.name}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${isDark ? 'bg-neutral-800 text-neutral-300 border-neutral-700' : 'bg-neutral-200 text-neutral-700 border-neutral-300'}`}>
                                {act.actionType}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium">{act.submissionId?.patientName || '-'}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                                act.status === 'contacted' ? 'bg-success/15 text-success' :
                                act.status === 'needs_review' ? 'bg-warning/15 text-warning' :
                                isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200 text-neutral-600'
                              }`}>
                                {act.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-neutral-500 max-w-xs truncate">{act.note || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete User Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in">
          <div className={`p-6 rounded-3xl border ${cardBgClass} max-w-md w-full shadow-xl space-y-4 animate-scale-in`}>
            <h3 className="font-headline font-bold text-lg text-error">Delete Account</h3>
            <p className="text-sm text-neutral-500">
              Are you sure you want to delete <strong className={isDark ? 'text-white' : 'text-black'}>{deletingUser.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setDeletingUser(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-neutral-200 hover:bg-neutral-300 text-black'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-error hover:brightness-110 text-white rounded-xl text-sm font-semibold transition-colors shadow-md"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
