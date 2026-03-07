import { Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Why Us', href: '#whyus' },
  ],
  Platform: [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Roles', href: '/roles' },
    { label: 'Screens', href: '/screens' },
    { label: 'Settings', href: '/settings' },
  ],
};

export function LandingFooter() {
  return (
    <footer className="border-t-2 border-border px-6 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary flex items-center justify-center border-2 border-border shadow-2xs">
                <Phone className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-foreground font-bold">AI Screener</span>
            </Link>
            <p className="text-sm text-muted-foreground">Automate phone screening with AI. Built for India.</p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-bold text-foreground mb-4">{title}</h4>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t-2 border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© 2026 AI Screener. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground">Twitter</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground">LinkedIn</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
