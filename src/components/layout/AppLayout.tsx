import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Users,
  FileText,
  Phone,
  Settings,
  BarChart3,
  Upload,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickActionsMenu } from '@/components/QuickActionsMenu';
import { BulkScreeningModal } from '@/components/BulkScreeningModal';
import { Badge } from '@/components/ui/badge';
import { useDemoAPI } from '@/hooks/useDemoAPI';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [activeScreensCount, setActiveScreensCount] = useState(0);
  const [showBulkScreening, setShowBulkScreening] = useState(false);
  const demoAPI = useDemoAPI();

  useEffect(() => {
    // Fetch initial count of active screens
    const fetchActiveScreens = async () => {
      try {
        const screenings = await demoAPI.getScreenings();
        const activeCount = screenings?.screens?.filter((s: any) => 
          s.status === 'in_progress' || s.status === 'scheduled'
        ).length || 0;
        setActiveScreensCount(activeCount);
      } catch (error) {
        console.error('Error fetching active screens:', error);
      }
    };

    fetchActiveScreens();

    // Poll for updates every 5 seconds in demo mode
    const interval = setInterval(fetchActiveScreens, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    {
      title: 'Roles',
      href: '/roles',
      icon: FileText,
      badge: null
    },
    {
      title: 'Import Candidates',
      href: '/candidates/import',
      icon: Upload,
      badge: null
    },
    {
      title: 'Screens',
      href: '/screens',
      icon: Phone,
      badge: activeScreensCount > 0 ? `${activeScreensCount} active` : null
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
      badge: null
    }
  ];

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="flex h-16 items-center px-4 gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">AI Screener</span>
          </Link>

          <nav className="flex items-center gap-1 ml-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
                {item.badge && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-accent text-accent-foreground rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <QuickActionsMenu onOpenBulkScreening={() => setShowBulkScreening(true)} />
            <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
              JD
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Bulk Screening Modal */}
      <BulkScreeningModal 
        open={showBulkScreening} 
        onOpenChange={setShowBulkScreening} 
      />
    </div>
  );
}