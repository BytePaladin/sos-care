import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { api } from '../services/api';

export default function ReportsTab({ isDark, analytics, usersList, staffAnalytics, staffActions }) {
  const [reportType, setReportType] = useState('analytics');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [patientChats, setPatientChats] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    if (reportType === 'patient' && selectedEntityId) {
      setIsLoadingChats(true);
      api.getUserChatsByAdmin(selectedEntityId)
        .then(setPatientChats)
        .catch(console.error)
        .finally(() => setIsLoadingChats(false));
    } else {
      setPatientChats([]);
    }
  }, [reportType, selectedEntityId]);

  const generatePDF = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#1e1e1e' : '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`IKH_Report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderReportContent = () => {
    switch (reportType) {
      case 'analytics':
        return (
          <div className={`space-y-6 p-8 ${isDark ? 'text-white bg-[#1e1e1e]' : 'text-black bg-white'}`}>
            <div className={`text-center border-b pb-4 mb-6 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>
              <h2 className="text-2xl font-bold">Hospital Analytics Report</h2>
              <p className={isDark ? 'text-neutral-400' : 'text-gray-500'}>Generated on {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className={`border p-4 rounded ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className="font-semibold text-lg mb-2">Patients Summary</h3>
                <ul className="space-y-2">
                  <li>Total Patients: {analytics?.users?.totalPatients || 0}</li>
                  <li>Triage Queue Contacted: {analytics?.triageQueue?.contactedPatients || 0}</li>
                </ul>
              </div>
              <div className={`border p-4 rounded ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className="font-semibold text-lg mb-2">Staff Summary</h3>
                <ul className="space-y-2">
                  <li>Total Staff: {analytics?.users?.totalStaff || 0}</li>
                  <li>Total Admins: {analytics?.users?.totalAdmins || 0}</li>
                </ul>
              </div>
            </div>
          </div>
        );
      
      case 'patient':
        const patient = usersList.find(u => u._id === selectedEntityId);
        if (!patient) return <div className={`p-8 ${isDark ? 'text-white bg-[#1e1e1e]' : 'text-black bg-white'}`}>Please select a patient.</div>;
        
        return (
          <div className={`space-y-6 p-8 ${isDark ? 'text-white bg-[#1e1e1e]' : 'text-black bg-white'}`}>
             <div className={`text-center border-b pb-4 mb-6 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>
              <h2 className="text-2xl font-bold">Patient Report</h2>
              <p className={isDark ? 'text-neutral-400' : 'text-gray-500'}>Generated on {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className={`border p-4 rounded ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50'}`}>
              <h3 className="font-semibold text-lg mb-4">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><strong>Name:</strong> {patient.name}</div>
                <div><strong>Phone:</strong> {patient.phone}</div>
                <div><strong>Role:</strong> {patient.role}</div>
                <div><strong>Joined:</strong> {new Date(patient.createdAt).toLocaleDateString()}</div>
                <div><strong>Triage Status:</strong> {patient.triage?.reviewStatus || 'N/A'}</div>
                <div><strong>Severity:</strong> {patient.triage?.severityCategory || 'Uncategorized'}</div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="font-semibold text-lg mb-4">Chat History</h3>
              {isLoadingChats ? (
                <p>Loading chats...</p>
              ) : patientChats.length === 0 ? (
                <p>No chats found for this patient.</p>
              ) : (
                <div className="space-y-6">
                  {patientChats.map((chat) => (
                    <div key={chat._id} className={`border p-4 rounded ${isDark ? 'border-neutral-700 bg-neutral-800/50' : 'border-gray-200 bg-white'}`}>
                      <div className="font-semibold mb-3 border-b pb-2">Session: {new Date(chat.createdAt).toLocaleString()} - <span className="font-normal italic text-sm">{chat.title}</span></div>
                      <div className="space-y-3">
                        {chat.messages?.map((msg, i) => (
                          <div key={i} className={`p-3 rounded-lg text-sm ${msg.sender === 'bot' || msg.sender === 'system' ? (isDark ? 'bg-neutral-800' : 'bg-gray-100') : msg.sender === 'staff' ? (isDark ? 'bg-amber-900/30 text-amber-100' : 'bg-amber-100 text-amber-900') : (isDark ? 'bg-primary/20 text-primary-200' : 'bg-primary/10 text-primary')}`}>
                            <strong className="block mb-1">{msg.sender === 'user' ? patient.name : msg.sender === 'staff' ? 'Staff' : msg.sender === 'system' ? 'System' : 'AI Assistant'}:</strong> 
                            {msg.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'staff':
        const staff = usersList.find(u => u._id === selectedEntityId);
        if (!staff) return <div className="p-8 text-black bg-white">Please select a staff member.</div>;
        
        const staffActionLog = staffActions?.filter(action => action.staffId?._id === staff._id) || [];

        return (
          <div className={`space-y-6 p-8 ${isDark ? 'text-white bg-[#1e1e1e]' : 'text-black bg-white'}`}>
            <div className={`text-center border-b pb-4 mb-6 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>
              <h2 className="text-2xl font-bold">Staff Audit Report</h2>
              <p className={isDark ? 'text-neutral-400' : 'text-gray-500'}>Generated on {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className={`border p-4 rounded mb-6 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'}`}>
              <h3 className="font-semibold text-lg mb-4">Staff Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><strong>Name:</strong> {staff.name}</div>
                <div><strong>Role:</strong> {staff.staffRole || staff.role}</div>
                <div><strong>Joined:</strong> {new Date(staff.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-4">Activity Log</h3>
            {staffActionLog.length > 0 ? (
              <table className={`w-full text-left border-collapse ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>
                <thead>
                  <tr className={isDark ? 'bg-neutral-800' : 'bg-gray-100'}>
                    <th className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>Date</th>
                    <th className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>Action</th>
                    <th className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {staffActionLog.map((action, idx) => (
                    <tr key={idx}>
                      <td className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>{new Date(action.timestamp).toLocaleString()}</td>
                      <td className={`border p-2 font-medium ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>{action.actionType}</td>
                      <td className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>{action.details || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No recorded activities found for this staff member.</p>
            )}
          </div>
        );

      case 'audits':
        return (
          <div className={`space-y-6 p-8 ${isDark ? 'text-white bg-[#1e1e1e]' : 'text-black bg-white'}`}>
            <div className={`text-center border-b pb-4 mb-6 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>
              <h2 className="text-2xl font-bold">Overall Staff Audit Report</h2>
              <p className={isDark ? 'text-neutral-400' : 'text-gray-500'}>Generated on {new Date().toLocaleDateString()}</p>
            </div>
            
            <table className={`w-full text-left border-collapse ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>
              <thead>
                <tr className={isDark ? 'bg-neutral-800' : 'bg-gray-100'}>
                  <th className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>Date</th>
                  <th className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>Staff Member</th>
                  <th className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {staffActions?.slice(0, 50).map((action, idx) => (
                  <tr key={idx}>
                    <td className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>{new Date(action.timestamp).toLocaleString()}</td>
                    <td className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>{action.staffId?.name || 'Unknown'}</td>
                    <td className={`border p-2 ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>{action.actionType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`text-sm mt-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>* Showing up to 50 recent actions.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`p-6 rounded-2xl ${isDark ? 'bg-[#1e1e1e] border-neutral-800 text-white' : 'bg-white border-neutral-300 text-neutral-900'} border shadow-sm`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-xl font-bold font-headline">Generate Reports</h2>
          <p className="text-sm text-gray-500 mt-1 font-body">Download PDF reports for various hospital metrics.</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={generatePDF}
            disabled={isGenerating || (reportType === 'patient' && !selectedEntityId) || (reportType === 'staff' && !selectedEntityId)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${isGenerating || (reportType === 'patient' && !selectedEntityId) || (reportType === 'staff' && !selectedEntityId)
                ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-600'
                : 'bg-primary text-white hover:bg-primary-hover shadow-md hover:shadow-lg'
              }
            `}
          >
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setSelectedEntityId('');
            }}
            className={`w-full p-2.5 rounded-xl border outline-none transition-colors ${
              isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
            }`}
          >
            <option value="analytics">Overall Analytics</option>
            <option value="patient">Individual Patient</option>
            <option value="staff">Individual Staff Audit</option>
            <option value="audits">Overall Audits</option>
          </select>
        </div>

        {reportType === 'patient' && (
          <div>
            <label className="block text-sm font-medium mb-2">Select Patient</label>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className={`w-full p-2.5 rounded-xl border outline-none transition-colors ${
                isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
              }`}
            >
              <option value="">-- Choose a patient --</option>
              {usersList?.filter(u => u.role === 'patient').map(p => (
                <option key={p._id} value={p._id}>{p.name} ({p.phone})</option>
              ))}
            </select>
          </div>
        )}

        {reportType === 'staff' && (
          <div>
            <label className="block text-sm font-medium mb-2">Select Staff</label>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className={`w-full p-2.5 rounded-xl border outline-none transition-colors ${
                isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
              }`}
            >
              <option value="">-- Choose a staff member --</option>
              {usersList?.filter(u => u.role === 'staff' || u.role === 'admin').map(s => (
                <option key={s._id} value={s._id}>{s.name} ({s.staffRole || s.role})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className={`border border-dashed rounded-xl p-4 overflow-x-auto ${isDark ? 'border-neutral-700 bg-neutral-900/50' : 'border-gray-300 bg-gray-50'}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Report Preview</h3>
        <div className={`border shadow-sm max-w-full overflow-hidden flex justify-center p-4 ${isDark ? 'border-neutral-800 bg-neutral-900' : 'bg-white'}`}>
          <div ref={reportRef} className={`w-[800px] max-w-full ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
            {renderReportContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
