import { Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = {
  Product: ['Features', 'Pricing', 'Integrations', 'API Docs'],
  Company: ['About Us', 'Careers', 'Blog', 'Contact'],
  Resources: ['Documentation', 'Help Center', 'Community', 'Status'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Security', 'GDPR'],
};

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 px-6 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Phone className="w-4 h-4 text-black" />
              </div>
              <span className="text-white font-bold">AI Screener</span>
            </Link>
            <p className="text-sm text-white/30">Automate phone screening with AI. Built for India.</p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link}>
                    <a href="#" className="text-sm text-white/30 hover:text-white/60 transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/20">© 2026 AI Screener. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-white/20 hover:text-white/40">Twitter</a>
            <a href="#" className="text-xs text-white/20 hover:text-white/40">LinkedIn</a>
            <a href="#" className="text-xs text-white/20 hover:text-white/40">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
