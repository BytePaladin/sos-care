# S.O.S. Care - Frontend Engineering Code Segments

This document compiles the exact code blocks implementing the key features outlined in your Week 5 and Week 6 reports, complete with file paths and line numbers.

## Week 5: Core Architecture, Authentication & Clinical Triage

### 1. Multi-Role Scoped Token Authentication & Routing
**File:** `src/services/api.js`
Intelligently handles legacy session data while scoping session tokens strictly by the application portal route (`/ikh/admin`, `/staff`, or `/`).

*(Lines 3 - 23)*
```javascript
const getHeaders = () => {
  let token = sessionStorage.getItem('sos_token'); // Fallback legacy
  
  // Intelligent token selection based on route
  const path = window.location.pathname;
  if (path.startsWith('/ikh/admin')) {
    token = sessionStorage.getItem('sos_token_admin') || token;
  } else if (path.startsWith('/staff')) {
    token = sessionStorage.getItem('sos_token_staff') || token;
  } else {
    token = sessionStorage.getItem('sos_token_patient') || token;
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};
```

**File:** `src/services/api.js`
Storing the scoped tokens upon successful login verification:

*(Lines 40 - 53)*
```javascript
  login: async (phone, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await handleResponse(res, 'Login failed');
    if (data.token) {
      if (data.role === 'admin') sessionStorage.setItem('sos_token_admin', data.token);
      else if (data.role === 'staff') sessionStorage.setItem('sos_token_staff', data.token);
      else sessionStorage.setItem('sos_token_patient', data.token);
    }
    return data;
  }
```

### 2. Real-Time Patient AI Screening & Chat Synchronization
**File:** `src/components/Dashboard.jsx`
Optimistic UI chat updates, session creation, and API integration.

*(Lines 66 - 99)*
```javascript
  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    let currentSessionId = activeChatId;
    
    // Optimistic UI update for immediate user feedback
    const userMsg = { sender: 'user', text: trimmed, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    try {
      if (!currentSessionId) {
        // Create new session via API
        const newSession = await api.createChatSession();
        currentSessionId = newSession.sessionId;
        setActiveChatId(currentSessionId);
        // The newly created session comes with a bot greeting message
        setMessages((prev) => [...newSession.messages, userMsg]);
      }

      // Send the user message to the backend
      const updatedMessages = await api.sendChatMessage(currentSessionId, trimmed);
      
      // Update the chat window with the full conversation including the bot's response
      setMessages(updatedMessages);

      // Refresh the chat list in the sidebar to update previews
      await fetchChats();
    } catch (err) {
      console.error(err);
      alert('Failed to send message: ' + err.message);
    }
  };
```

**File:** `src/components/Dashboard.jsx`
Three-second automatic polling for live synchronization.

*(Lines 26 - 30)*
```javascript
  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 3000); // 3s auto-sync
    return () => clearInterval(interval);
  }, []);
```

### 3. Interactive Clinical Severity Override & Rationale Notes
**File:** `src/components/StaffDashboard.jsx`
Attending physician escalation workflow capturing clinical rationales.

*(Lines 216 - 231)*
```javascript
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
```

### 4. Clinical Triage Queue Priority Sorting & Auto-Polling
**File:** `src/components/StaffDashboard.jsx`
Logic for weighting Red > Yellow > Green severity.

*(Lines 95 - 109)*
```javascript
  // Dynamic Multi-Tier Priority Queue Sorting
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const severityWeight = { red: 3, yellow: 2, green: 1 };
    const weightDiff = (severityWeight[b.category] || 0) - (severityWeight[a.category] || 0);
    if (weightDiff !== 0) return weightDiff;
    return new Date(b.screenedAt) - new Date(a.screenedAt);
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (!cooldownRef.current) fetchData();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);
```

---

## Week 6: Enterprise Admin Portal, Analytics & System Optimization

### 1. Isolated Administrator Gateway & Session Management
**File:** `src/components/AdminDashboard.jsx`
Secure gateway handling role verification and independent token assignment.

*(Lines 92 - 108)*
```javascript
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const data = await api.adminLogin(loginPhone.trim(), loginPassword.trim());
      if (data.role !== 'admin') {
        throw new Error('Access denied: Account does not have administrator privileges');
      }
      setAdminUser(data);
      sessionStorage.setItem('sos_admin_user', JSON.stringify(data));
      onShowToast?.(`Welcome to Admin Control, ${data.name}!`, 'success');
    } catch (err) {
      onShowToast?.(err.message || 'Admin authentication failed', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };
```

### 2. Clinical Triage Concordance & Diagnostic Agreement Suite
**File:** `src/components/AdminDashboard.jsx`
Diagnostic analytics widgets tracking physician alignment rates against AI metrics.

*(Lines 557 - 572)*
```javascript
{/* Primary Concordance Metrics Trio */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* Overall Agreement Rate */}
  <div className="p-5 rounded-2xl border bg-[#181818]">
    <span className="text-xs font-semibold uppercase text-neutral-400">Concordance Rate</span>
    <div className="text-3xl font-bold mt-2">{analytics?.concordance?.overallConcordanceRate ?? 100}%</div>
    <div className="w-full h-1.5 rounded-full bg-neutral-800 mt-4 overflow-hidden">
      <div className="bg-primary h-full rounded-full" style={{ width: `${analytics?.concordance?.overallConcordanceRate ?? 100}%` }} />
    </div>
  </div>
  {/* Physician Escalation Counter */}
  <div className="p-5 rounded-2xl border bg-[#181818]">
    <span className="text-xs font-semibold uppercase text-neutral-400">Physician Escalations</span>
    <div className="text-3xl font-bold text-error mt-2">{analytics?.concordance?.escalationRate ?? 0}%</div>
  </div>
</div>
```

### 3. Staff Account Provisioning & User Directory
**File:** `src/components/AdminDashboard.jsx`
Form logic to generate hospital employee accounts.

*(Lines 131 - 147)*
```javascript
  const handleCreateStaff = async (e) => {
    e.preventDefault();
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
    } finally {
      setIsCreatingStaff(false);
    }
  };
```

### 4. Emergency Triage Data Purge Modal
**File:** `src/components/AdminDashboard.jsx`
Data-wipe operation enforcing a destructive reset mechanism.

*(Lines 168 - 181)*
```javascript
  const handleClearAllTriage = async () => {
    setIsClearingTriage(true);
    try {
      const res = await api.clearAllTriageData();
      onShowToast?.(res.message || 'All past triage records have been cleared', 'success');
      setShowClearTriageModal(false);
      setClearConfirmInput('');
      fetchAdminData();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to clear triage data', 'error');
    } finally {
      setIsClearingTriage(false);
    }
  };
```
