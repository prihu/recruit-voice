const useCases = [
  'Interview Screening',
  'Candidate Qualification',
  'Availability Check',
  'Salary Discussion',
  'Location Verification',
  'Skills Assessment',
  'Language Proficiency',
  'Reference Checks',
  'Offer Discussion',
  'Onboarding Calls',
];

export function UseCaseMarquee() {
  const doubled = [...useCases, ...useCases];

  return (
    <section id="usecases" className="py-12 overflow-hidden border-y border-white/5">
      <div className="flex" style={{ animation: 'marquee 30s linear infinite' }}>
        {doubled.map((uc, i) => (
          <div key={i} className="flex-shrink-0 flex items-center gap-6 mx-6">
            <span className="text-2xl md:text-4xl font-bold text-white/10 whitespace-nowrap uppercase tracking-wider">
              {uc}
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
          </div>
        ))}
      </div>
    </section>
  );
}
