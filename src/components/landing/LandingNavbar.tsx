import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Use Cases', href: '#usecases' },
    { label: 'Why Us', href: '#whyus' },
    { label: 'Testimonials', href: '#testimonials' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Phone className="w-4 h-4 text-black" />
          </div>
          <span className="text-white font-bold text-lg">AI Screener</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-white/70 hover:text-white px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-all">
            Login
          </Link>
          <Link to="/dashboard" className="text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-5 py-2 rounded-lg transition-colors">
            Get Started
          </Link>
        </div>

        <button className="md:hidden text-white" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 px-6 py-4 space-y-3">
          {links.map(l => (
            <a key={l.href} href={l.href} className="block text-white/70 hover:text-white py-2" onClick={() => setMobileOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link to="/dashboard" className="block text-center bg-emerald-500 text-black font-semibold py-2.5 rounded-lg mt-4">
            Get Started
          </Link>
        </div>
      )}
    </header>
  );
}
