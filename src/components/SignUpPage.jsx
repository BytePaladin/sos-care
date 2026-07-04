import { useState, useEffect } from 'react';
import { MOCK_OTP, registeredPhones, mockUsers } from '../data/mockData';

const SignUpPage = ({ onNavigate, onShowToast }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(60);
  const [timerActive, setTimerActive] = useState(false);

  /* ── Password strength criteria ── */
  const criteria = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(password) },
    { label: 'Contains a lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Contains an uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains a special character (!@#$%^&*…)', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password) },
  ];

  const allCriteriaMet = criteria.every((c) => c.met);
  const formValid = fullName.trim() !== '' && phone.trim() !== '' && allCriteriaMet;

  /* ── OTP countdown timer ── */
  useEffect(() => {
    if (!timerActive) return;
    if (timer <= 0) {
      setTimerActive(false);
      return;
    }
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timerActive, timer]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const startTimer = () => {
    setTimer(60);
    setTimerActive(true);
  };

  /* ── Handlers ── */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formValid) return;

    if (registeredPhones.has(phone.trim())) {
      onShowToast('This phone number is already registered', 'error');
      return;
    }

    setShowOtp(true);
    startTimer();
  };

  const handleVerify = () => {
    if (otp === MOCK_OTP) {
      mockUsers.push({ name: fullName.trim(), phone: phone.trim(), password });
      registeredPhones.add(phone.trim());
      onShowToast('Account created successfully! Please log in.', 'success');
      onNavigate('login');
    } else {
      onShowToast('Invalid OTP. Please try again.', 'error');
    }
  };

  const handleResend = () => {
    if (timer > 0) return;
    startTimer();
  };

  /* ── Render ── */
  return (
    <div className="w-full min-h-screen flex flex-col justify-between bg-[#121212] text-white overflow-x-hidden animate-fade-in">
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-3xl border border-neutral-800 bg-[#1e1e1e] flex flex-col gap-6 relative animate-slide-up">
          
          {/* Back arrow */}
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="absolute top-6 left-6 text-gray-400 hover:text-white transition-colors"
            aria-label="Back to login"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Title */}
          <div className="text-center mt-6">
            <h1 className="font-headline text-2xl font-bold text-white">Create Account</h1>
            <p className="text-gray-400 text-sm mt-1">Join Imaginary Kidney Care Hospital</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            {/* ── Full Name ── */}
            <div className="flex flex-col gap-2 w-full">
              <label htmlFor="signup-name" className="text-sm font-medium text-gray-200">
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full h-12 px-4 rounded-xl bg-[#121212] border border-neutral-800 focus:border-primary focus:outline-none transition-colors text-white placeholder:text-gray-600"
              />
            </div>

            {/* ── Phone Number ── */}
            <div className="flex flex-col gap-2 w-full">
              <label htmlFor="signup-phone" className="text-sm font-medium text-gray-200">
                Phone Number
              </label>
              <input
                id="signup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                maxLength={15}
                className="w-full h-12 px-4 rounded-xl bg-[#121212] border border-neutral-800 focus:border-primary focus:outline-none transition-colors text-white placeholder:text-gray-600"
              />
            </div>

            {/* ── Password ── */}
            <div className="flex flex-col gap-2 w-full relative">
              <label htmlFor="signup-password" className="text-sm font-medium text-gray-200">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full h-12 px-4 pr-12 rounded-xl bg-[#121212] border border-neutral-800 focus:border-primary focus:outline-none transition-colors text-white placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.243 4.243L17.657 17.657M17.657 17.657L21 21m-4.343-4.343a3 3 0 01-4.243-4.243" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* ── Password strength checklist (Absolute placeholder logic) ── */}
              <div className="min-h-[100px] w-full">
                {password.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {criteria.map((c) => (
                      <li
                        key={c.label}
                        className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
                          c.met ? 'text-green-400' : 'text-gray-500'
                        }`}
                      >
                        <span className="font-bold text-sm leading-none">{c.met ? '✓' : '✗'}</span>
                        <span>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── Submit / Continue button ── */}
            {!showOtp && (
              <button
                type="submit"
                disabled={!formValid}
                className={`w-full h-12 rounded-xl font-medium text-white transition-colors mt-2 ${
                  formValid
                    ? 'bg-primary hover:bg-primary-hover cursor-pointer'
                    : 'bg-primary opacity-50 cursor-not-allowed'
                }`}
              >
                Continue
              </button>
            )}
          </form>

          {/* ── OTP Verification section ── */}
          {showOtp && (
            <div className="mt-2 animate-slide-up space-y-4">
              <div className="border-t border-neutral-800 pt-5">
                <h2 className="font-headline text-lg font-semibold text-white">
                  Enter Verification Code
                </h2>
                <p className="text-gray-400 text-xs mt-1">
                  A 6-digit OTP has been sent to your phone
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    placeholder="------"
                    className="flex-1 h-12 px-4 rounded-xl bg-[#121212] border border-neutral-800 focus:border-primary focus:outline-none transition-colors text-white text-center tracking-[0.5em] text-2xl font-mono placeholder:tracking-[0.5em]"
                  />
                  <span className="text-sm font-mono text-gray-500 tabular-nums w-14 text-center shrink-0">
                    {formatTime(timer)}
                  </span>
                </div>

                {/* Resend OTP */}
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={timer > 0}
                    className={`text-xs font-medium transition-colors ${
                      timer > 0
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-primary cursor-pointer hover:underline'
                    }`}
                  >
                    Resend OTP
                  </button>
                </div>

                {/* Verify button */}
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={otp.length !== 6}
                  className={`mt-4 w-full h-12 rounded-xl font-medium text-white transition-colors ${
                    otp.length === 6
                      ? 'bg-primary hover:bg-primary-hover cursor-pointer'
                      : 'bg-primary opacity-50 cursor-not-allowed'
                  }`}
                >
                  Verify
                </button>
              </div>
            </div>
          )}

          {/* ── Bottom link ── */}
          <p className="text-center text-sm text-gray-500 mt-2">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-primary font-medium hover:underline transition-colors cursor-pointer"
            >
              Log In
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignUpPage;
