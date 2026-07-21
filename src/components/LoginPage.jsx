import { useState } from 'react';
import { api } from '../services/api';
import { mockUsers as defaultUsers, mockStaffUsers } from '../data/mockData';

export default function LoginPage({ onNavigate, onLogin, onShowToast }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phone.trim() || !password.trim()) {
      onShowToast('Please fill in all fields', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const user = await api.login(phone.trim(), password.trim());
      onLogin(user);
      onShowToast(`Welcome back, ${user.name}!`, 'success');
    } catch (err) {
      // Fallback to local storage if offline
      const storedUsers = JSON.parse(localStorage.getItem('sos_users') || 'null') || defaultUsers;
      const storedStaff = JSON.parse(localStorage.getItem('sos_users_staff') || 'null') || mockStaffUsers;

      const staffUser = storedStaff.find((u) => u.phone === phone && u.password === password);
      if (staffUser) {
        onLogin({ ...staffUser, role: 'staff' });
        setIsLoading(false);
        return;
      }

      const patientUser = storedUsers.find((u) => u.phone === phone && u.password === password);
      if (patientUser) {
        onLogin({ ...patientUser, role: 'patient' });
      } else {
        onShowToast(err.message || 'Invalid phone number or password', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col justify-between bg-[#121212] text-white overflow-x-hidden animate-fade-in">
      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-6">
        {/* Card Constraints */}
        <div className="w-full max-w-md p-8 rounded-3xl border border-neutral-800 bg-[#1e1e1e] flex flex-col gap-6 relative animate-slide-up">
          
          {/* Back Button */}
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group absolute top-6 left-6"
          >
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>

          {/* Header */}
          <div className="text-center mt-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#121212] border border-neutral-800 flex items-center justify-center mb-4">
              <img src="/kidney-hospital-logo.png" alt="" className="w-10 h-10 object-contain" />
            </div>
            <h2 className="font-headline text-2xl font-bold text-white">Sign In</h2>
            <p className="text-gray-400 text-sm mt-1">Enter your credentials to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            {/* Phone Number */}
            <div className="flex flex-col gap-2 w-full">
              <label htmlFor="login-phone" className="text-sm font-medium text-gray-200">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <input
                  id="login-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#121212] border border-neutral-800 focus:border-primary focus:outline-none transition-colors text-white placeholder:text-gray-600"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2 w-full">
              <label htmlFor="login-password" className="text-sm font-medium text-gray-200">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-12 pl-12 pr-12 rounded-xl bg-[#121212] border border-neutral-800 focus:border-primary focus:outline-none transition-colors text-white placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-neutral-800 transition-colors text-gray-500"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-white font-medium text-base hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Sign Up Link */}
          <button
            onClick={() => onNavigate('signup')}
            className="w-full h-12 rounded-xl border border-primary text-primary font-medium hover:bg-primary/10 transition-colors"
          >
            Create New Account
          </button>

          {/* Demo Credentials Hint */}
          <div className="p-4 rounded-xl bg-[#121212] border border-neutral-800 text-xs text-gray-400 w-full space-y-2">
            <div>
              <p className="font-medium text-gray-300 mb-1">Demo Patient:</p>
              <p>Phone: <span className="font-mono text-primary">01700000000</span></p>
              <p>Password: <span className="font-mono text-primary">Demo@1234</span></p>
            </div>
            <div className="border-t border-neutral-800 pt-2">
              <p className="font-medium text-gray-300 mb-1">Demo Medical Staff:</p>
              <p>Phone: <span className="font-mono text-primary">01800000000</span> (Dr. Nusrat)</p>
              <p>Phone: <span className="font-mono text-primary">01900000000</span> (Dr. Tanvir)</p>
              <p>Password: <span className="font-mono text-primary">Staff@1234</span></p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
