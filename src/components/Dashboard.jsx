import { useState, useRef, useEffect } from 'react';
import { cannedResponses, mockRecentChats } from '../data/mockData';
import { useTheme } from '../context/ThemeContext';

export default function Dashboard({ userName, onOpenSettings, onLogout }) {
  const { isDark } = useTheme();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  /* ── Auto-scroll on new messages ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Auto-resize textarea (1→5 rows) ── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxH = 5 * 24; // ~5 rows
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
  }, [inputText]);

  /* ── Helpers ── */
  const sendMessage = (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    setTimeout(() => {
      const reply =
        cannedResponses[Math.floor(Math.random() * cannedResponses.length)];
      setMessages((prev) => [...prev, { role: 'bot', text: reply }]);
    }, 800);
  };

  const handleSend = () => sendMessage(inputText);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveChat(null);
    setSidebarOpen(false);
  };

  const handleSelectChat = (idx) => {
    setActiveChat(idx);
    setSidebarOpen(false);
  };

  const filteredChats = mockRecentChats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const currentTitle =
    activeChat !== null ? mockRecentChats[activeChat]?.title : 'New Chat';

  const suggestions = [
    'What are early signs of kidney disease?',
    'How do I read my lab results?',
    'Tell me about GFR levels',
    'What lifestyle changes help kidney health?',
  ];

  /* ================================================================== */
  return (
    <div className={`w-full h-screen flex overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#121212] text-white' : 'bg-[#ffffff] text-[#1f1f1f]'}`}>
      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ============================================================= */}
      {/* LEFT SIDEBAR                                                   */}
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
        {/* ── Top section ── */}
        <div className="p-4 space-y-3">
          {/* New Chat FAB */}
          <button
            onClick={handleNewChat}
            className={`
              w-full flex items-center gap-3
              rounded-2xl px-5 py-3.5 font-headline font-semibold text-[15px]
              shadow-md hover:shadow-lg hover:brightness-95 active:scale-[.98]
              transition-all duration-200 cursor-pointer elevation-1
              ${isDark ? 'bg-primary-container text-on-primary-container' : 'bg-[#c2e7ff] text-[#041e49]'}
            `}
          >
            {/* Plus icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>

          {/* Search input */}
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-outline' : 'text-neutral-500'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`
                w-full rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all duration-200
                ${isDark 
                  ? 'bg-[#202124] text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary/40 border border-transparent' 
                  : 'bg-white border border-neutral-300 text-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-teal-500'}
              `}
            />
          </div>
        </div>

        {/* ── Recent chats list ── */}
        <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5 scrollbar-thin">
          {filteredChats.map((chat, idx) => {
            const isActive = activeChat === idx;
            return (
              <button
                key={idx}
                onClick={() => handleSelectChat(idx)}
                className={`
                  w-full text-left rounded-xl p-3 cursor-pointer
                  transition-all duration-200 group
                  ${isDark 
                    ? (isActive ? 'bg-surface-container-high' : 'hover:bg-surface-container-high/60') 
                    : (isActive ? 'bg-[#e3e3e3]' : 'hover:bg-[#e3e3e3]/60')}
                `}
              >
                <p className={`font-medium text-sm truncate ${isDark ? 'text-gray-200' : 'text-[#1f1f1f]'}`}>
                  {chat.title}
                </p>
                <p className={`text-xs mt-1 truncate ${isDark ? 'text-gray-400' : 'text-[#5f6368]'}`}>
                  {chat.preview}
                </p>
              </button>
            );
          })}

          {filteredChats.length === 0 && (
            <p className={`text-center text-sm py-8 ${isDark ? 'text-outline' : 'text-neutral-500'}`}>
              No chats found
            </p>
          )}
        </nav>

        {/* ── Bottom user section ── */}
        <div className={`border-t p-4 flex items-center gap-3 ${isDark ? 'border-neutral-800' : 'border-neutral-300'}`}>
          {/* Avatar circle */}
          <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-headline font-bold text-sm shrink-0">
            {userName?.charAt(0)?.toUpperCase() || 'U'}
          </div>

          <span className={`flex-1 font-headline font-medium text-sm truncate ${isDark ? 'text-on-surface' : 'text-[#1f1f1f]'}`}>
            {userName}
          </span>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${isDark ? 'hover:bg-surface-container-high text-on-surface' : 'hover:bg-[#e3e3e3] text-neutral-800'}`}
            aria-label="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className={`p-2 rounded-full hover:bg-error/10 transition-all duration-200 cursor-pointer group ${isDark ? 'text-on-surface' : 'text-neutral-800'}`}
            aria-label="Logout"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 group-hover:text-error transition-colors duration-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ============================================================= */}
      {/* MAIN CHAT AREA                                                 */}
      {/* ============================================================= */}
      <main className="flex-grow flex flex-col min-w-0">
        {/* ── Top bar ── */}
        <header className={`h-16 border-b flex items-center px-4 shrink-0 transition-colors duration-300 ${isDark ? 'bg-[#161616] border-neutral-800' : 'bg-[#f8f9fa] border-neutral-300'}`}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className={`lg:hidden p-2 -ml-1 mr-2 rounded-full transition-all duration-200 cursor-pointer ${isDark ? 'hover:bg-surface-container-high text-on-surface' : 'hover:bg-[#e3e3e3] text-neutral-800'}`}
            aria-label="Open sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h2 className={`flex-1 text-center font-headline font-semibold truncate ${isDark ? 'text-on-surface' : 'text-[#1f1f1f]'}`}>
            {currentTitle}
          </h2>

          {/* Spacer to balance hamburger on mobile */}
          <div className="w-9 lg:hidden" />
        </header>

        {/* ── Messages area ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto p-4 pb-2 space-y-4">
            {/* ── Welcome screen (no messages) ── */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                {/* Logo */}
                <img
                  src="/sos-logo.png"
                  alt="S.O.S. Logo"
                  className="w-16 h-16 mb-5 rounded-2xl shadow-lg"
                />

                <h2 className={`font-headline text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-[#1f1f1f]'}`}>
                  Hello, {userName} 👋
                </h2>
                <p className={`text-sm mb-8 text-center max-w-md ${isDark ? 'text-gray-400' : 'text-[#444746]'}`}>
                  I'm your S.O.S. health assistant. Ask me anything about
                  symptoms, lab results, or kidney health.
                </p>

                {/* Suggestion chips */}
                <div className="flex flex-wrap justify-center gap-2.5 max-w-lg">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className={`
                        rounded-2xl px-4 py-2.5 text-sm transition-all duration-200 cursor-pointer active:scale-[.97]
                        ${isDark 
                          ? 'bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high hover:border-primary/40 hover:shadow-md' 
                          : 'bg-[#f0f4f9] hover:bg-[#e3e3e3] text-[#1f1f1f] font-medium border border-transparent'}
                      `}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Message bubbles ── */}
            {messages.map((msg, idx) =>
              msg.role === 'user' ? (
                /* User message */
                <div
                  key={idx}
                  className="flex justify-end animate-slide-up"
                >
                  <div className={`max-w-[80%] rounded-2xl rounded-br-md px-4 py-3 shadow-sm ${isDark ? 'bg-primary-container text-on-primary-container' : 'bg-[#c2e7ff] text-[#041e49]'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  </div>
                </div>
              ) : (
                /* Bot message */
                <div
                  key={idx}
                  className="flex justify-start gap-2.5 animate-slide-up"
                >
                  {/* S.O.S. avatar */}
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                    <img
                      src="/sos-logo.png"
                      alt="S.O.S."
                      className="w-5 h-5 rounded-full"
                    />
                  </div>

                  <div className={`max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm ${isDark ? 'bg-surface-container-high text-on-surface' : 'bg-[#f0f4f9] text-[#1f1f1f]'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  </div>
                </div>
              ),
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Bottom input bar ── */}
        <div className={`border-t transition-colors duration-300 ${isDark ? 'border-neutral-800 bg-[#161616]' : 'border-neutral-300 bg-[#ffffff]'}`}>
          <div className="max-w-3xl mx-auto p-4 flex flex-col gap-2">
            <div className={`
              w-full max-w-3xl mx-auto rounded-full px-6 py-3 flex items-center justify-between transition-shadow duration-200 
              ${isDark 
                ? 'bg-[#202124] border border-neutral-700 focus-within:ring-1 focus-within:ring-primary' 
                : 'bg-[#f0f4f9] border border-transparent focus-within:ring-2 focus-within:ring-teal-500'}
            `}>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Type your symptoms or questions…"
                className={`
                  bg-transparent focus:outline-none w-full resize-none leading-6 max-h-[120px] pt-1
                  ${isDark ? 'text-white placeholder-neutral-400' : 'text-[#1f1f1f] placeholder-neutral-500'}
                `}
              />

              {/* Send button */}
              {inputText.trim() && (
                <button
                  onClick={handleSend}
                  className="
                    rounded-full bg-primary text-on-primary
                    p-2 ml-2 shrink-0
                    hover:brightness-110 active:scale-95
                    transition-all duration-200 cursor-pointer
                    shadow-sm animate-fade-in
                  "
                  aria-label="Send message"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405z" />
                  </svg>
                </button>
              )}
            </div>

            <p className={`text-[11px] text-center mt-2.5 select-none ${isDark ? 'text-outline' : 'text-[#747775]'}`}>
              S.O.S. may provide general info only — always consult your doctor.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
