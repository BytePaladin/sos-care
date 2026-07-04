export default function HospitalCard({ name, specialty, description, logo, emoji, featured, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative pt-8 p-6 flex flex-col justify-between rounded-3xl min-h-[240px] w-full border border-neutral-800 transition-all duration-300 cursor-pointer text-left
        ${featured
          ? 'bg-[#1e1e1e] ring-1 ring-primary hover:scale-[1.02]'
          : 'bg-[#121212] hover:bg-[#161616]'
        }`}
      aria-label={`Select ${name}`}
    >
      {featured && (
        <span className="absolute top-3 right-4 bg-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-teal-500/30">
          Featured
        </span>
      )}

      <div className="flex flex-col items-start gap-4 flex-grow min-h-0">
        {/* Logo or Emoji */}
        <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden
          ${featured ? 'bg-white/90' : 'bg-neutral-800'}`}>
          {logo ? (
            <img src={logo} alt={`${name} logo`} className="w-14 h-14 object-contain" />
          ) : (
            <span className="text-3xl">{emoji}</span>
          )}
        </div>

        <div className="flex-1 w-full min-w-0">
          <h3 className="font-headline font-bold text-lg leading-tight text-white break-words">
            {name}
          </h3>
          <span className="inline-block mt-2 text-xs font-medium px-3 py-1 rounded-full bg-neutral-800 text-gray-300">
            {specialty}
          </span>
          <p className="mt-3 text-sm leading-relaxed text-gray-400 break-words">
            {description}
          </p>
        </div>
      </div>

      {/* Bottom CTA hint */}
      <div className={`mt-4 flex items-center gap-2 text-sm font-medium transition-all duration-300
        ${featured ? 'text-on-primary-container' : 'text-primary opacity-0 group-hover:opacity-100'}`}>
        {featured ? 'Get Started' : 'Coming Soon'}
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
