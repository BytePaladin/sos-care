import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const SettingsModal = ({ isOpen, onClose, onShowToast }) => {
  const { isDark, toggleTheme } = useTheme();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  const handleSendFeedback = () => {
    if (feedbackText.trim()) {
      // TODO: Dispatch feedback to hospital email (hospital@kidneycareimag.com)
      // and S.O.S. Care service provider email (support@sos-care.com) concurrently
      onShowToast('Feedback sent successfully!', 'success');
      setFeedbackText('');
      setShowFeedback(false);
    }
  };

  const handleCancelFeedback = () => {
    setFeedbackText('');
    setShowFeedback(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-low rounded-3xl p-6 w-full max-w-md mx-4 elevation-3 animate-scale-in relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-full hover:bg-surface-container-high p-2 text-on-surface transition-colors duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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

        {/* 1. Appearance Section */}
        <div className="border-b border-outline-variant pb-5 mb-5">
          <p className="font-medium text-sm text-outline uppercase tracking-wider mb-3">
            Appearance
          </p>
          <div className="flex items-center justify-between">
            <span className="text-on-surface font-body">Dark Mode</span>
            <button
              onClick={toggleTheme}
              className={`w-14 h-7 rounded-full relative transition-all duration-300 ${
                isDark ? 'bg-primary' : 'bg-outline-variant'
              }`}
              aria-label="Toggle dark mode"
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                  isDark ? 'left-7' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 2. Feedback Section */}
        <div className="border-b border-outline-variant pb-5 mb-5">
          <p className="font-medium text-sm text-outline uppercase tracking-wider mb-3">
            Feedback
          </p>
          <button
            onClick={() => setShowFeedback((prev) => !prev)}
            className="w-full rounded-2xl bg-surface-container-high text-on-surface py-3 hover:bg-surface-container-highest transition-colors duration-200 font-body"
          >
            Send Feedback
          </button>

          {showFeedback && (
            <div className="mt-4 animate-slide-up">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Tell us about your experience..."
                className="rounded-2xl bg-surface-container border border-outline-variant p-4 w-full h-32 resize-none focus:border-primary focus:outline-none text-on-surface font-body transition-colors duration-200"
              />
              <div className="flex gap-3 justify-end mt-3">
                <button
                  onClick={handleCancelFeedback}
                  className="rounded-2xl border border-outline-variant px-6 py-2 text-on-surface hover:bg-surface-container transition-colors duration-200 font-body"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendFeedback}
                  className="rounded-2xl bg-primary text-on-primary px-6 py-2 hover:bg-primary-hover transition-colors duration-200 font-body"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Help Section */}
        <div className="pb-2">
          <p className="font-medium text-sm text-outline uppercase tracking-wider mb-3">
            Help &amp; Support
          </p>
          <button
            onClick={() => setShowHelp((prev) => !prev)}
            className="w-full rounded-2xl bg-surface-container-high text-on-surface py-3 hover:bg-surface-container-highest transition-colors duration-200 font-body"
          >
            Get Help
          </button>

          {showHelp && (
            <div className="mt-4 animate-slide-up bg-surface-container rounded-2xl p-4">
              {/* Hospital Helpline */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🏥</span>
                  <span className="font-body font-semibold text-on-surface">
                    Imaginary Kidney Care Hospital
                  </span>
                </div>
                <p className="text-primary font-mono text-sm ml-8">
                  +1-800-KIDNEY-1
                </p>
                <p className="text-outline text-xs ml-8">
                  Available: 24/7 Emergency Line
                </p>
              </div>

              <div className="border-t border-outline-variant my-4" />

              {/* Technical Support */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🛟</span>
                  <span className="font-body font-semibold text-on-surface">
                    S.O.S. Technical Support
                  </span>
                </div>
                <p className="text-primary font-mono text-sm ml-8">
                  +1-800-SOS-HELP
                </p>
                <p className="text-outline text-xs ml-8">
                  Available: Mon-Fri, 9AM-6PM
                </p>
              </div>
            </div>
          )}
        </div>

        {/* App Version */}
        <p className="text-xs text-outline mt-4 text-center font-body">
          S.O.S. v1.0.0
        </p>
      </div>
    </div>
  );
};

export default SettingsModal;
