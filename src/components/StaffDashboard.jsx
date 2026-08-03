import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { mockScreenedPatients, mockStaffUsers } from '../data/mockData';

export default function StaffDashboard({ user, onOpenSettings, onLogout }) {
  const { isDark } = useTheme();

  // Load patients and staff from API
  const [patients, setPatients] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [currentUser, setCurrentUser] = useState(user);
  
  // Prevent polling from overwriting optimistic updates with stale data
  const cooldownRef = useRef(false);

  const fetchBackendData = useCallback(async () => {
    if (cooldownRef.current) return;
    
    try {
      const livePatients = await api.getPatients();
      if (Array.isArray(livePatients)) {
        setPatients(livePatients);
      }
    } catch (err) {
      console.error('Failed to fetch patients', err);
    }

    try {
      const liveStaff = await api.getStaffMembers();
      if (Array.isArray(liveStaff)) {
        setStaffList(liveStaff);
        const found = liveStaff.find((s) => s.id === user.id);
        if (found) setCurrentUser(found);
      }
    } catch (err) {
      console.error('Failed to fetch staff members', err);
    }
  }, [user.id]);

  // Fetch live data from backend API on mount & set 10s polling interval
  // We check visibilityState to prevent exhausting free-tier Serverless limits when tab is in background
  useEffect(() => {
    fetchBackendData();
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchBackendData();
      }
    }, 10000);
    return () => clearInterval(intervalId);
  }, [fetchBackendData]);

  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  
  // Navigation filters
  // activeTab can be: 'all_active', 'active_red', 'active_yellow', 'active_green', 'all_reviewed', 'reviewed_red', 'reviewed_other', 'forwarded'
  const [activeTab, setActiveTab] = useState('all_active');

  // Input states for patient review
  const [reviewComment, setReviewComment] = useState('');
  const [forwardTargetId, setForwardTargetId] = useState('');
  const [newNoteText, setNewNoteText] = useState('');

  // Triage Category Escalation / De-escalation states
  const [pendingNewCategory, setPendingNewCategory] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverridingCategory, setIsOverridingCategory] = useState(false);

  // Telegram alert modal state
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [tempOptIn, setTempOptIn] = useState(currentUser.telegramOptIn);
  const [tempChatId, setTempChatId] = useState(currentUser.telegramChatId || '');
  const [testStatus, setTestStatus] = useState('');

  // Update temp state when currentUser changes
  useEffect(() => {
    setTempOptIn(currentUser.telegramOptIn);
    setTempChatId(currentUser.telegramChatId || '');
  }, [currentUser]);

  // Removed local storage sync for patients

  // Telegram alert integration for unreviewed red-flagged patients
  useEffect(() => {
    const triggerTelegramAlerts = async () => {
      // Opt-in check
      if (!currentUser.telegramOptIn) return;

      const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
      const chatId = currentUser.telegramChatId || import.meta.env.VITE_TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        console.warn('Telegram credentials missing for automated alerts.');
        return;
      }

      // Check which patients have already been alerted to avoid duplication
      const sentAlerts = JSON.parse(localStorage.getItem('sos_sent_alerts') || '[]');
      
      // Find unalerted, pending red patients
      const pendingReds = patients.filter(
        (p) => p.category === 'red' && p.reviewStatus === 'pending' && !sentAlerts.includes(p.id)
      );

      if (pendingReds.length === 0) return;

      const newAlertedIds = [...sentAlerts];

      for (const patient of pendingReds) {
        try {
          const message = `🚨 *S.O.S. Care Triage Alert*\n\n*Critical patient awaiting review!*\n\n*Name:* ${patient.name}\n*Phone:* \`${patient.phone}\`\n*Category:* RED 🔴\n*Screened:* ${new Date(patient.screenedAt).toLocaleString()}\n\n_Please log in to review._`;
          
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
          });

          if (res.ok) {
            newAlertedIds.push(patient.id);
            console.log(`Alert sent for patient ${patient.name}`);
          } else {
            console.error('Failed to send Telegram alert:', await res.text());
          }
        } catch (err) {
          console.error('Network error sending Telegram alert:', err);
        }
      }

      localStorage.setItem('sos_sent_alerts', JSON.stringify(newAlertedIds));
    };

    triggerTelegramAlerts();
  }, [patients, user]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Status handlers
  const handleMarkContacted = async (patientId) => {
    if (!reviewComment.trim()) return;

    try {
      const updated = await api.updatePatientStatus(patientId, 'contacted', reviewComment.trim(), null);
      setPatients((prev) => prev.map((p) => (p.id === patientId ? updated : p)));
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to update patient status: ' + err.message);
    }
    setReviewComment('');
  };

  const handleMarkFalsePositive = async (patientId) => {
    try {
      const updated = await api.updatePatientStatus(patientId, 'false_positive', 'Marked as false positive/archived', null);
      setPatients((prev) => prev.map((p) => (p.id === patientId ? updated : p)));
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to archive patient: ' + err.message);
    }
  };

  const handleForwardPatient = async (patientId) => {
    if (!forwardTargetId) return;

    const targetStaff = staffList.find((s) => s.id === forwardTargetId);

    try {
      const updated = await api.updatePatientStatus(patientId, 'needs_review', `Forwarded to ${targetStaff?.name || 'Practitioner'}`, forwardTargetId);
      setPatients((prev) => prev.map((p) => (p.id === patientId ? updated : p)));
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to forward patient: ' + err.message);
    }
    setForwardTargetId('');
  };

  const handleAddNote = async (patientId) => {
    if (!newNoteText.trim()) return;

    try {
      const updated = await api.addPatientNote(patientId, newNoteText.trim());
      setPatients((prev) => prev.map((p) => (p.id === patientId ? updated : p)));
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to add note: ' + err.message);
    }
    setNewNoteText('');
  };

  // Re-open review flow (allows changing state)
  const handleResetStatus = async (patientId) => {
    try {
      const updated = await api.updatePatientStatus(patientId, 'pending', '', null);
      setPatients((prev) => prev.map((p) => (p.id === patientId ? updated : p)));
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 3000);
    } catch (err) {
      setPatients((prevPatients) =>
        prevPatients.map((p) => (p.id === patientId ? { ...p, reviewStatus: 'pending', forwardedTo: null } : p))
      );
    }
  };

  // Escalate / De-escalate Triage Category
  const handleUpdateSeverity = async (patientId, newCategory, reason = '') => {
    setIsOverridingCategory(true);
    try {
      const updated = await api.updatePatientSeverity(patientId, newCategory, reason);
      setPatients((prev) => prev.map((p) => (p.id === patientId ? updated : p)));
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 3000);
      setPendingNewCategory(null);
      setOverrideReason('');
    } catch (err) {
      console.error(err);
      alert('Failed to update triage category: ' + err.message);
    } finally {
      setIsOverridingCategory(false);
    }
  };

  const handleSaveTelegramSettings = async () => {
    try {
      const updated = await api.updateTelegram(tempOptIn, tempChatId.trim());
      setCurrentUser(updated);
    } catch (err) {
      const updatedUser = { ...currentUser, telegramOptIn: tempOptIn, telegramChatId: tempChatId.trim() };
      setCurrentUser(updatedUser);
    }
    
    setIsTelegramModalOpen(false);
  };

  const handleTestTelegram = async (testChatId) => {
    if (!testChatId) {
      setTestStatus('Enter a chat ID first.');
      return;
    }
    setTestStatus('Sending...');
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      setTestStatus('VITE_TELEGRAM_BOT_TOKEN missing in env.');
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: testChatId,
          text: `🔔 *S.O.S. Care Test Alert*\n\nThis is a test notification confirming your Telegram alert configuration is working.`,
          parse_mode: 'Markdown'
        })
      });
      if (res.ok) {
        setTestStatus('Success! Check Telegram.');
      } else {
        const errorData = await res.json().catch(() => ({}));
        setTestStatus(`Failed: ${errorData.description || res.statusText}`);
      }
    } catch (err) {
      setTestStatus('Network error.');
    }
  };

  // Filters calculation
  const getFilteredPatients = () => {
    // Search query filter
    let list = patients.filter((p) => {
      const matchName = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchPhone = p.phone.includes(searchQuery);
      return matchName || matchPhone;
    });

    // Sidebar tab filter
    switch (activeTab) {
      case 'all_active':
        list = list.filter((p) => p.reviewStatus === 'pending');
        break;
      case 'active_red':
        list = list.filter((p) => p.reviewStatus === 'pending' && p.category === 'red');
        break;
      case 'active_yellow':
        list = list.filter((p) => p.reviewStatus === 'pending' && p.category === 'yellow');
        break;
      case 'active_green':
        list = list.filter((p) => p.reviewStatus === 'pending' && p.category === 'green');
        break;
      case 'all_reviewed':
        list = list.filter((p) => p.reviewStatus !== 'pending');
        break;
      case 'reviewed_red':
        list = list.filter((p) => p.reviewStatus !== 'pending' && p.category === 'red');
        break;
      case 'reviewed_other':
        list = list.filter((p) => p.reviewStatus !== 'pending' && p.category !== 'red');
        break;
      case 'forwarded':
        list = list.filter((p) => p.forwardedTo === user.id);
        break;
      default:
        break;
    }

    // Sorting: Red unreviewed first, then Yellow unreviewed, then Green unreviewed, then reviewed ones
    return [...list].sort((a, b) => {
      // Prioritize pending status
      const aPending = a.reviewStatus === 'pending' ? 1 : 0;
      const bPending = b.reviewStatus === 'pending' ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;

      // Prioritize Category Priority
      const categoryOrder = { red: 3, yellow: 2, green: 1 };
      const aVal = categoryOrder[a.category] || 0;
      const bVal = categoryOrder[b.category] || 0;
      if (aVal !== bVal) return bVal - aVal;

      // Sort by newest screened time
      return new Date(b.screenedAt) - new Date(a.screenedAt);
    });
  };

  const filteredPatients = getFilteredPatients();

  // Counts for Badges
  const getCounts = () => {
    const active = patients.filter((p) => p.reviewStatus === 'pending');
    const reviewed = patients.filter((p) => p.reviewStatus !== 'pending');
    return {
      activeAll: active.length,
      activeRed: active.filter((p) => p.category === 'red').length,
      activeYellow: active.filter((p) => p.category === 'yellow').length,
      activeGreen: active.filter((p) => p.category === 'green').length,
      reviewedAll: reviewed.length,
      reviewedRed: reviewed.filter((p) => p.category === 'red').length,
      reviewedOther: reviewed.filter((p) => p.category !== 'red').length,
      forwarded: patients.filter((p) => p.forwardedTo === user.id).length,
    };
  };

  const counts = getCounts();

  return (
    <div className={`w-full h-screen flex overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#121212] text-white' : 'bg-[#ffffff] text-[#1f1f1f]'}`}>
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
          ${isDark ? 'bg-[#161616] border-neutral-800' : 'bg-[#f8f9fa] border-neutral-300'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Clinician Profile */}
        <div className={`p-5 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-300'} flex items-center gap-3`}>
          <img
            src="/kidney-hospital-logo.png"
            alt="Kidney Hospital Logo"
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-primary/30 shadow-sm"
          />
          <div className="min-w-0">
            <h3 className={`font-headline font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-[#1f1f1f]'}`}>
              {user.name}
            </h3>
            <p className="text-[11px] text-[#889392] font-body truncate">{user.role}</p>
          </div>
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          {/* Active Folder */}
          <div>
            <span className="text-[11px] font-bold tracking-wider text-neutral-500 uppercase px-3 block mb-2">
              Active Triage
            </span>
            <div className="space-y-1">
              {[
                { id: 'all_active', label: 'All Active', count: counts.activeAll, dot: null },
                { id: 'active_red', label: 'Red Alerts', count: counts.activeRed, dot: '🔴' },
                { id: 'active_yellow', label: 'Yellow Priority', count: counts.activeYellow, dot: '🟡' },
                { id: 'active_green', label: 'Green Routine', count: counts.activeGreen, dot: '🟢' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSelectedPatientId(null);
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
                    {item.dot && <span>{item.dot}</span>}
                    {item.label}
                  </span>
                  {item.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.id === 'active_red' 
                        ? 'bg-error text-on-error animate-pulse-red' 
                        : (isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200 text-neutral-600')
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Reviewed Folder */}
          <div>
            <span className="text-[11px] font-bold tracking-wider text-neutral-500 uppercase px-3 block mb-2">
              Reviewed Folder
            </span>
            <div className="space-y-1">
              {[
                { id: 'all_reviewed', label: 'All Reviewed', count: counts.reviewedAll },
                { id: 'reviewed_red', label: 'Reviewed Red', count: counts.reviewedRed, dot: '🔴' },
                { id: 'reviewed_other', label: 'Reviewed Other', count: counts.reviewedOther, dot: '🟡/🟢' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSelectedPatientId(null);
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
                    {item.dot && <span className="opacity-70">{item.dot}</span>}
                    {item.label}
                  </span>
                  {item.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200 text-neutral-600'}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Forwarded Queue */}
          <div>
            <span className="text-[11px] font-bold tracking-wider text-neutral-500 uppercase px-3 block mb-2">
              My Desk
            </span>
            <div className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab('forwarded');
                  setSelectedPatientId(null);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors
                  ${activeTab === 'forwarded' 
                    ? (isDark ? 'bg-primary-container text-on-primary-container' : 'bg-primary/10 text-primary font-semibold') 
                    : (isDark ? 'hover:bg-neutral-800 text-gray-300' : 'hover:bg-neutral-200/50 text-[#1f1f1f]')}
                `}
              >
                <span className="flex items-center gap-2">
                  📥 Forwarded to Me
                </span>
                {counts.forwarded > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-on-primary">
                    {counts.forwarded}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setIsTelegramModalOpen(true);
                  setSidebarOpen(false);
                  setTestStatus('');
                }}
                className={`
                  w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors
                  ${isDark ? 'hover:bg-neutral-800 text-gray-300' : 'hover:bg-neutral-200/50 text-[#1f1f1f]'}
                `}
              >
                <span className="flex items-center gap-2">
                  📢 Telegram Alerts
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  currentUser.telegramOptIn 
                    ? 'bg-success/15 text-success border border-success/20' 
                    : (isDark ? 'bg-neutral-800 text-neutral-500 border border-neutral-700' : 'bg-neutral-200 text-neutral-500')
                }`}>
                  {currentUser.telegramOptIn ? 'Opt-In' : 'Off'}
                </span>
              </button>
            </div>
          </div>
        </nav>

        {/* Footer controls */}
        <div className={`border-t p-4 flex items-center justify-between ${isDark ? 'border-neutral-800' : 'border-neutral-300'}`}>
          <button
            onClick={onOpenSettings}
            className={`p-2 rounded-full cursor-pointer transition-colors flex items-center gap-2 text-xs font-medium ${isDark ? 'hover:bg-neutral-800 text-gray-300' : 'hover:bg-neutral-200 text-neutral-700'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>

          <button
            onClick={onLogout}
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
        <header className={`h-16 border-b flex items-center px-6 justify-between shrink-0 ${isDark ? 'bg-[#161616] border-neutral-800' : 'bg-[#f8f9fa] border-neutral-300'}`}>
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
              Clinical Triage Desk
            </h2>
          </div>
          
          {/* Header search bar */}
          {!selectedPatientId && (
            <div className="relative w-72 max-w-xs hidden sm:block">
              <input
                type="text"
                placeholder="Search patient name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full text-xs rounded-xl pl-9 pr-3 py-2 outline-none border transition-all ${
                  isDark
                    ? 'bg-[#202124] border-neutral-800 text-white placeholder-neutral-400 focus:border-primary/50'
                    : 'bg-white border-neutral-300 text-neutral-800 placeholder-neutral-500 focus:border-teal-500'
                }`}
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </header>

        {/* Dynamic Panels */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!selectedPatientId ? (
            /* ========================================================= */
            /* PATIENT LIST VIEW                                         */
            /* ========================================================= */
            <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-thin">
              
              {/* Triage Stats summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Pending Red Alerts', count: counts.activeRed, color: 'bg-error-container text-on-error-container border-error/20' },
                  { label: 'Pending Yellows', count: counts.activeYellow, color: 'bg-warning-container text-on-warning-container border-warning/20' },
                  { label: 'Pending Greens', count: counts.activeGreen, color: 'bg-success-container text-on-success-container border-success/20' },
                ].map((stat, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border ${stat.color} elevation-1`}>
                    <p className="text-xs font-headline font-semibold uppercase tracking-wider opacity-80">{stat.label}</p>
                    <p className="text-3xl font-headline font-bold mt-1">{stat.count}</p>
                  </div>
                ))}
              </div>

              {/* Patient list container */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-headline font-semibold text-sm text-neutral-500 uppercase tracking-wider">
                    {activeTab.replace('_', ' ')} Queue ({filteredPatients.length})
                  </h3>
                </div>

                {filteredPatients.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-neutral-300 dark:border-neutral-800 rounded-3xl">
                    <span className="text-4xl">🏥</span>
                    <h4 className="font-headline font-semibold text-base mt-3">No Patients found</h4>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">No patient fits the current search parameters or category filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredPatients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => setSelectedPatientId(patient.id)}
                        className={`
                          w-full flex items-center justify-between p-4 rounded-2xl border text-left cursor-pointer transition-all elevation-1 hover:translate-x-1 overflow-hidden relative pl-6
                          ${isDark ? 'bg-[#1e1e1e] border-neutral-800 hover:border-neutral-700' : 'bg-white border-neutral-300 hover:border-neutral-400'}
                        `}
                      >
                        {/* Solid color left bar */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          patient.category === 'red' ? 'bg-error' : patient.category === 'yellow' ? 'bg-warning' : 'bg-success'
                        }`} />

                        <div className="space-y-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-headline font-semibold text-sm text-on-surface truncate">
                              {patient.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              patient.category === 'red'
                                ? 'bg-error/15 text-error border border-error/25'
                                : patient.category === 'yellow'
                                ? 'bg-warning/15 text-warning border border-warning/25'
                                : 'bg-success/15 text-success border border-success/25'
                            }`}>
                              {patient.category}
                            </span>
                            {patient.reviewStatus === 'pending' && patient.category === 'red' && (
                              <span className="w-2 h-2 rounded-full bg-error animate-pulse-red" />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                            <span>📱 {patient.phone}</span>
                            <span>⏱️ Screened {new Date(patient.screenedAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Review badge */}
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                            patient.reviewStatus === 'pending'
                              ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                              : patient.reviewStatus === 'contacted'
                              ? 'bg-success-container text-on-success-container border border-success/20'
                              : patient.reviewStatus === 'false_positive'
                              ? 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                              : 'bg-primary-container text-on-primary-container'
                          }`}>
                            {patient.reviewStatus.replace('_', ' ')}
                          </span>

                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* ========================================================= */
            /* PATIENT PROFILE & DETAILS DETAIL VIEW                      */
            /* ========================================================= */
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Back to list and patient profiles */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-r dark:border-neutral-800">
                {/* Back controls */}
                <div className={`p-4 border-b flex items-center gap-3 shrink-0 ${isDark ? 'bg-[#1a1a1a] border-neutral-800' : 'bg-neutral-100 border-neutral-300'}`}>
                  <button
                    onClick={() => setSelectedPatientId(null)}
                    className={`p-2 rounded-full cursor-pointer transition-colors ${isDark ? 'hover:bg-neutral-800 text-white' : 'hover:bg-neutral-200 text-neutral-800'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h3 className="font-headline font-bold text-sm">{selectedPatient.name}</h3>
                    <p className="text-xs text-neutral-500">Registered Phone: <span className="font-mono select-all font-semibold">{selectedPatient.phone}</span></p>
                  </div>
                </div>

                {/* Patient chat logs */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                  <div className="text-center my-3">
                    <span className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase px-3 py-1 bg-neutral-200 dark:bg-neutral-800 rounded-full">
                      🤖 Screener Chat Log
                    </span>
                  </div>

                  {selectedPatient.chatHistory && selectedPatient.chatHistory.length > 0 ? (
                    selectedPatient.chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                        {msg.role !== 'user' && (
                          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                            🤖
                          </div>
                        )}
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                          msg.role === 'user'
                            ? (isDark ? 'bg-primary-container text-on-primary-container' : 'bg-primary/10 text-primary')
                            : (isDark ? 'bg-[#202124] text-gray-200' : 'bg-[#f1f3f4] text-neutral-800')
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-neutral-500 italic py-8">No screener log recorded.</p>
                  )}
                </div>

                {/* Staff Clinical Notes Panel */}
                <div className={`p-4 border-t shrink-0 flex flex-col gap-3 ${isDark ? 'bg-[#161616] border-neutral-800' : 'bg-[#f8f9fa] border-neutral-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Clinical Logs & Notes</span>
                  </div>

                  {/* Scrollable mini notes log */}
                  {selectedPatient.notes && selectedPatient.notes.length > 0 ? (
                    <div className="max-h-28 overflow-y-auto space-y-2 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2 bg-surface-container scrollbar-thin">
                      {selectedPatient.notes.map((note, idx) => (
                        <div key={idx} className="text-xs text-left">
                          <p className="text-neutral-500 font-semibold flex justify-between">
                            <span>✏️ {note.author}</span>
                            <span className="text-[10px] font-normal">{new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </p>
                          <p className="text-on-surface mt-0.5 pl-4">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-500 italic">No notes added yet.</p>
                  )}

                  {/* Add note interface */}
                  <div className="flex gap-2">
                    <textarea
                      rows={1}
                      placeholder="Write medical note details..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className={`flex-1 text-xs rounded-xl p-2 bg-transparent border outline-none resize-none ${
                        isDark ? 'border-neutral-800 focus:border-primary/50 text-white' : 'border-neutral-300 focus:border-teal-500 text-neutral-800'
                      }`}
                    />
                    <button
                      onClick={() => handleAddNote(selectedPatient.id)}
                      disabled={!newNoteText.trim()}
                      className="px-4 py-2 rounded-xl bg-primary text-on-primary font-semibold text-xs transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Add Note
                    </button>
                  </div>
                </div>
              </div>

              {/* Medical actions and controls panel */}
              <div className={`w-full lg:w-80 shrink-0 p-6 flex flex-col gap-6 overflow-y-auto scrollbar-thin ${isDark ? 'bg-[#161616]' : 'bg-[#f8f9fa]'}`}>
                {/* Triage Category & Interactive Clinical Severity Override */}
                <div className={`p-4 rounded-2xl border ${
                  selectedPatient.category === 'red' 
                    ? 'border-error/30 bg-error/5' 
                    : selectedPatient.category === 'yellow' 
                    ? 'border-warning/30 bg-warning/5' 
                    : 'border-success/30 bg-success/5'
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-neutral-400">
                      Triage Category
                    </h3>
                    {/* Provenance Badge */}
                    {selectedPatient.doctorOverride?.isOverridden ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                        <span>👨‍⚕️</span> Overridden
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                        <span>🤖</span> AI Output
                      </span>
                    )}
                  </div>

                  {/* Current Active Category Pill */}
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                        selectedPatient.category === 'red' ? 'bg-error animate-pulse-red' : selectedPatient.category === 'yellow' ? 'bg-warning' : 'bg-success'
                      }`} />
                      <span className="font-headline font-black uppercase text-sm tracking-wide">
                        {selectedPatient.category} Priority
                      </span>
                    </div>

                    {selectedPatient.doctorOverride?.isOverridden && (
                      <span className="text-[10px] text-neutral-400">
                        Initial: <span className="font-semibold uppercase">{selectedPatient.initialCategory || 'green'}</span>
                      </span>
                    )}
                  </div>

                  {/* Doctor Override Details if active */}
                  {selectedPatient.doctorOverride?.isOverridden && selectedPatient.doctorOverride?.overriddenByName && (
                    <div className="mt-2 pt-2 border-t dark:border-neutral-800/60 text-[11px] text-neutral-400 space-y-0.5">
                      <p>
                        By <span className="font-semibold text-on-surface">{selectedPatient.doctorOverride.overriddenByName}</span>
                        {selectedPatient.doctorOverride.overriddenAt && (
                          <span> • {new Date(selectedPatient.doctorOverride.overriddenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </p>
                      {selectedPatient.doctorOverride.reason && (
                        <p className="italic text-neutral-300">"{selectedPatient.doctorOverride.reason}"</p>
                      )}
                    </div>
                  )}

                  {/* Interactive Severity Override Action Controls */}
                  <div className="mt-4 pt-3 border-t dark:border-neutral-800">
                    <p className="text-[11px] font-bold text-neutral-400 mb-2 flex items-center justify-between">
                      <span>Clinical Severity Override</span>
                      <span className="text-[10px] font-normal text-neutral-500">Escalate / De-escalate</span>
                    </p>

                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Red Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPatient.category === 'red') return;
                          setPendingNewCategory('red');
                        }}
                        disabled={isOverridingCategory || selectedPatient.category === 'red'}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer disabled:cursor-default ${
                          selectedPatient.category === 'red'
                            ? 'bg-error text-white shadow-sm ring-2 ring-error/40 opacity-95'
                            : pendingNewCategory === 'red'
                            ? 'bg-error/20 border-2 border-error text-error font-extrabold'
                            : 'border border-error/30 hover:bg-error/15 text-error/90 hover:text-error'
                        }`}
                        title="Escalate to Red Alert"
                      >
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-error inline-block" />
                          Red
                        </span>
                        <span className="text-[9px] font-medium opacity-80">
                          {selectedPatient.category === 'red' ? 'Active' : '🔺 Escalate'}
                        </span>
                      </button>

                      {/* Yellow Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPatient.category === 'yellow') return;
                          setPendingNewCategory('yellow');
                        }}
                        disabled={isOverridingCategory || selectedPatient.category === 'yellow'}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer disabled:cursor-default ${
                          selectedPatient.category === 'yellow'
                            ? 'bg-warning text-black shadow-sm ring-2 ring-warning/40 opacity-95'
                            : pendingNewCategory === 'yellow'
                            ? 'bg-warning/20 border-2 border-warning text-warning font-extrabold'
                            : 'border border-warning/30 hover:bg-warning/15 text-warning/90 hover:text-warning'
                        }`}
                        title="Change to Yellow Priority"
                      >
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-warning inline-block" />
                          Yellow
                        </span>
                        <span className="text-[9px] font-medium opacity-80">
                          {selectedPatient.category === 'yellow'
                            ? 'Active'
                            : selectedPatient.category === 'green'
                            ? '🔺 Escalate'
                            : '🔻 De-escalate'}
                        </span>
                      </button>

                      {/* Green Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPatient.category === 'green') return;
                          setPendingNewCategory('green');
                        }}
                        disabled={isOverridingCategory || selectedPatient.category === 'green'}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer disabled:cursor-default ${
                          selectedPatient.category === 'green'
                            ? 'bg-success text-white shadow-sm ring-2 ring-success/40 opacity-95'
                            : pendingNewCategory === 'green'
                            ? 'bg-success/20 border-2 border-success text-success font-extrabold'
                            : 'border border-success/30 hover:bg-success/15 text-success/90 hover:text-success'
                        }`}
                        title="De-escalate to Green Routine"
                      >
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-success inline-block" />
                          Green
                        </span>
                        <span className="text-[9px] font-medium opacity-80">
                          {selectedPatient.category === 'green' ? 'Active' : '🔻 De-escalate'}
                        </span>
                      </button>
                    </div>

                    {/* Quick Confirmation Prompt when a new tier is selected */}
                    {pendingNewCategory && pendingNewCategory !== selectedPatient.category && (
                      <div className={`mt-3 p-3 rounded-xl border animate-fade-in ${
                        isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-on-surface">
                            {['red', 'yellow'].indexOf(pendingNewCategory) > ['red', 'yellow'].indexOf(selectedPatient.category) || (selectedPatient.category === 'green' && pendingNewCategory !== 'green')
                              ? '🔺 Escalate'
                              : '🔻 De-escalate'}{' '}
                            to <span className="uppercase font-black">{pendingNewCategory}</span>?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingNewCategory(null);
                              setOverrideReason('');
                            }}
                            className="text-neutral-400 hover:text-on-surface text-xs"
                          >
                            ✕
                          </button>
                        </div>

                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="Optional clinical rationale / notes..."
                          className={`w-full px-2.5 py-1.5 rounded-lg text-xs border mb-2.5 outline-none focus:ring-1 focus:ring-primary ${
                            isDark ? 'bg-[#121212] border-neutral-700 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                          }`}
                        />

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateSeverity(selectedPatient.id, pendingNewCategory, overrideReason)}
                            disabled={isOverridingCategory}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-white cursor-pointer disabled:opacity-50 ${
                              pendingNewCategory === 'red' ? 'bg-error hover:bg-error/90' : pendingNewCategory === 'yellow' ? 'bg-warning text-black hover:bg-warning/90' : 'bg-success hover:bg-success/90'
                            }`}
                          >
                            {isOverridingCategory ? 'Saving...' : 'Confirm Re-classification'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingNewCategory(null);
                              setOverrideReason('');
                            }}
                            disabled={isOverridingCategory}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border dark:border-neutral-700 text-neutral-400 hover:text-on-surface cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t dark:border-neutral-800 pt-4">
                  <h3 className="font-headline font-bold text-sm">Action Status</h3>
                  
                  {selectedPatient.reviewStatus !== 'pending' ? (
                    /* Reviewed Patient Details Display */
                    <div className="mt-3 p-4 rounded-2xl border border-success/20 bg-success-container/10 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-success">✓</span>
                        <p className="text-xs font-semibold">Triage Reviewed</p>
                      </div>
                      <div className="text-xs text-neutral-400 space-y-1">
                        <p>Status: <span className="font-bold text-on-surface capitalize">{selectedPatient.reviewStatus.replace('_', ' ')}</span></p>
                        <p>Reviewed By: <span className="font-bold text-on-surface">{staffList.find(s=>s.id === selectedPatient.reviewedBy)?.name || 'Doctor'}</span></p>
                        {selectedPatient.reviewedAt && (
                          <p>Time: <span className="font-bold text-on-surface">{new Date(selectedPatient.reviewedAt).toLocaleString()}</span></p>
                        )}
                        {selectedPatient.reviewComment && (
                          <p className="border-t dark:border-neutral-800 mt-2 pt-2 text-on-surface italic">
                            "{selectedPatient.reviewComment}"
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleResetStatus(selectedPatient.id)}
                        className={`w-full py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer mt-2 text-center block ${
                          isDark ? 'border-neutral-800 hover:bg-neutral-800 text-white' : 'border-neutral-300 hover:bg-neutral-200 text-neutral-800'
                        }`}
                      >
                        Edit / Reset Status
                      </button>
                    </div>
                  ) : (
                    /* Active Pending Review Panel controls */
                    <div className="mt-3 space-y-4">
                      {/* Mark contacted flow */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase">1. Patient Contacted</span>
                        <input
                          type="text"
                          placeholder="Add comment (e.g. Advised clinic visit)"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className={`w-full text-xs rounded-xl p-2.5 bg-transparent border outline-none ${
                            isDark ? 'border-neutral-800 focus:border-primary/50 text-white' : 'border-neutral-300 focus:border-teal-500 text-neutral-800'
                          }`}
                        />
                        <button
                          onClick={() => handleMarkContacted(selectedPatient.id)}
                          disabled={!reviewComment.trim()}
                          className="w-full py-2.5 rounded-xl bg-success text-on-success font-semibold text-xs transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Mark Contacted
                        </button>
                      </div>

                      {/* Mark false positive */}
                      <div className="border-t dark:border-neutral-800 pt-4 space-y-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase">2. Triage Check</span>
                        <button
                          onClick={() => handleMarkFalsePositive(selectedPatient.id)}
                          className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer text-center ${
                            isDark ? 'border-neutral-800 hover:bg-neutral-800 text-white' : 'border-neutral-300 hover:bg-neutral-200 text-neutral-800'
                          }`}
                        >
                          Mark False Positive
                        </button>
                      </div>

                      {/* Forward patient */}
                      <div className="border-t dark:border-neutral-800 pt-4 space-y-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase">3. Forward to Doctor</span>
                        <select
                          value={forwardTargetId}
                          onChange={(e) => setForwardTargetId(e.target.value)}
                          className={`w-full text-xs rounded-xl p-2.5 border outline-none ${
                            isDark 
                              ? 'border-neutral-800 bg-[#161616] focus:border-primary/50 text-white' 
                              : 'border-neutral-300 bg-white focus:border-teal-500 text-neutral-800'
                          }`}
                        >
                          <option value="" className={isDark ? 'bg-[#161616] text-white' : 'bg-white text-neutral-800'}>
                            Select Practitioner
                          </option>
                          {staffList
                            .filter((s) => s.id !== user.id)
                            .map((staff) => (
                              <option 
                                key={staff.id} 
                                value={staff.id}
                                className={isDark ? 'bg-[#161616] text-white' : 'bg-white text-neutral-800'}
                              >
                                {staff.name} ({staff.role})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleForwardPatient(selectedPatient.id)}
                          disabled={!forwardTargetId}
                          className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-xs transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Forward Patient
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Telegram Alert Settings Modal */}
      {isTelegramModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
          onClick={() => setIsTelegramModalOpen(false)}
        >
          <div
            className="bg-surface-container-low rounded-3xl p-6 w-full max-w-md mx-4 elevation-3 animate-scale-in relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline text-lg font-bold text-on-surface">
                📢 Telegram Alert Settings
              </h2>
              <button
                onClick={() => setIsTelegramModalOpen(false)}
                className="rounded-full hover:bg-surface-container-high p-2 text-on-surface transition-colors duration-200 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-on-surface opacity-80 leading-relaxed mb-4 font-body">
              When a patient is screened as <span className="text-error font-bold font-headline">RED Category</span>, S.O.S. Care will automatically push an alert with their name and phone number to your configured Telegram account.
            </p>

            <div className="space-y-4">
              {/* Toggle switch */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface font-body">Enable Telegram Alerts</span>
                <button
                  onClick={() => setTempOptIn(!tempOptIn)}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 cursor-pointer ${
                    tempOptIn ? 'bg-primary' : 'bg-outline-variant'
                  }`}
                  aria-label="Toggle Telegram alerts"
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
                      tempOptIn ? 'left-6.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Chat ID Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-outline uppercase font-headline">Telegram Chat ID</label>
                <input
                  type="text"
                  placeholder="Enter your chat ID (e.g. 123456789)"
                  value={tempChatId}
                  onChange={(e) => setTempChatId(e.target.value.replace(/\D/g, ''))}
                  disabled={!tempOptIn}
                  className="w-full text-xs rounded-xl p-2.5 bg-surface-container border border-outline-variant outline-none transition-colors font-body text-on-surface placeholder:text-outline disabled:opacity-40"
                />
                <div className="text-xs text-on-surface leading-relaxed font-body mt-2 space-y-1.5">
                  <p className="font-bold text-on-surface">How to get your numeric Chat ID:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-on-surface font-medium">
                    <li>Open Telegram and search for <strong className="text-primary hover:underline">@userinfobot</strong>.</li>
                    <li>Send any message or click <strong>Start</strong>.</li>
                    <li>Copy the numeric <strong>Id</strong> it replies with (e.g. <code className="font-mono text-primary bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant">987654321</code>) and paste it above.</li>
                  </ol>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2.5 font-bold">⚠️ Important: You must also start a chat with your S.O.S. Care bot first so it has permission to message you.</p>
                </div>
              </div>

              {/* Test Notification buttons */}
              {tempOptIn && tempChatId && (
                <div className="flex items-center justify-between border-t border-b border-outline-variant/30 py-3 mt-2">
                  <span className="text-[11px] text-on-surface opacity-80 font-body font-medium">{testStatus || 'Ready to test configuration'}</span>
                  <button
                    onClick={() => handleTestTelegram(tempChatId)}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-bold cursor-pointer transition-colors font-body"
                  >
                    Send Test
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setIsTelegramModalOpen(false)}
                  className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer font-body"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTelegramSettings}
                  className="rounded-xl bg-primary text-on-primary px-5 py-2 hover:bg-primary-hover font-semibold text-xs transition-colors cursor-pointer font-body"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
