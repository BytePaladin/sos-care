import { hospitals } from '../data/mockData';
import HospitalCard from './HospitalCard';

export default function LandingPage({ onNavigate }) {
  return (
    <div className="w-full min-h-screen flex flex-col justify-between bg-[#121212] text-white overflow-x-hidden animate-fade-in">
      {/* Top Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <img src="/sos-logo.png" alt="S.O.S. Logo" className="h-10 w-10 object-contain" />
          <h1 className="font-headline text-xl md:text-2xl font-bold text-white tracking-tight">
            S.O.S. Care
          </h1>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col items-center text-center justify-center max-w-4xl mx-auto my-12 px-4 gap-4 animate-slide-up">
        <h2 className="font-headline text-4xl md:text-5xl font-bold text-white leading-tight">
          Your Health,{' '}
          <span className="text-primary">Intelligently</span>{' '}
          Screened
        </h2>
        <p className="text-lg text-gray-300 leading-relaxed">
          Choose your healthcare provider to begin an AI-powered symptom screening experience. 
          Get personalized guidance and connect with specialists faster.
        </p>

        {/* Floating pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {['AI-Powered', 'HIPAA Compliant', '24/7 Available', 'Multi-Specialty'].map((tag) => (
            <span key={tag} className="px-4 py-2 rounded-full bg-neutral-800 text-white text-sm font-medium">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Hospital Cards Grid */}
      <section className="w-full flex flex-col items-center flex-grow">
        <h3 className="font-headline text-xl font-semibold text-white mb-6 block text-left w-full max-w-7xl mx-auto px-6">
          Select a Healthcare Provider
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl mx-auto px-6 mb-12">
          {hospitals.map((hospital) => (
            <HospitalCard
              key={hospital.id}
              name={hospital.name}
              specialty={hospital.specialty}
              description={hospital.description}
              logo={hospital.logo}
              emoji={hospital.emoji}
              featured={hospital.featured}
              onClick={() => {
                if (hospital.featured) {
                  onNavigate('login');
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 w-full">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/sos-logo.png" alt="S.O.S. Care" className="h-6 w-6 object-contain opacity-60" />
            <span className="text-sm text-gray-500">© 2026 S.O.S. Care</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <span className="hover:text-primary cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-primary cursor-pointer transition-colors">Terms of Service</span>
            <span className="hover:text-primary cursor-pointer transition-colors">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
