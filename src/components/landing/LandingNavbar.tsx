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
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'bg-background border-b-2 border-border shadow-xs' : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary flex items-center justify-center border-2 border-border shadow-2xs">
            <Phone className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-foreground font-bold text-lg">AI Screener</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-foreground font-medium px-4 py-2 border-2 border-border hover:shadow-xs transition-all">
            Login
          </Link>
          <Link to="/dashboard" className="text-sm bg-primary text-primary-foreground font-bold px-5 py-2 border-2 border-border shadow-xs hover:shadow-sm transition-all">
            Get Started
          </Link>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background border-t-2 border-border px-6 py-4 space-y-3">
          {links.map(l => (
            <a key={l.href} href={l.href} className="block text-muted-foreground hover:text-foreground py-2 font-medium" onClick={() => setMobileOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link to="/dashboard" className="block text-center bg-primary text-primary-foreground font-bold py-2.5 border-2 border-border shadow-xs mt-4">
            Get Started
          </Link>
        </div>
      )}
    </header>
  );
}
