// Dashboard - moved from Index.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Phone, Users, FileText, ArrowRight, CheckCircle, Clock, TrendingUp, Zap
} from 'lucide-react';
import { CallMonitor } from '@/components/CallMonitor';
import { EnhancedAnalyticsDashboard } from '@/components/EnhancedAnalyticsDashboard';
import { useDemoAPI } from '@/hooks/useDemoAPI';

export default function Dashboard() {
  const demoAPI = useDemoAPI();
  const [stats, setStats] = useState({
    activeRoles: 0, totalScreens: 0, pendingScreens: 0, passRate: 0, timeSaved: 0, recentActivity: [] as any[]
  });

  useEffect(() => {
    fetchAnalytics();
    fetchRecentActivity();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const roles = await demoAPI.getRoles();
      const activeRoles = roles.filter((r: any) => r.status === 'active').length;
      const { screens } = await demoAPI.getScreenings();
      const totalScreens = screens.length;
      const pendingScreens = screens.filter((s: any) => s.status === 'pending' || s.status === 'scheduled').length;
      const passedScreens = screens.filter((s: any) => s.outcome === 'pass').length;
      const completedScreens = screens.filter((s: any) => s.status === 'completed').length;
      const passRate = completedScreens > 0 ? Math.round((passedScreens / completedScreens) * 100) : 0;
      const timeSaved = Math.round(totalScreens * 0.25);
      setStats({ activeRoles, totalScreens, pendingScreens, passRate, timeSaved, recentActivity: [] });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const { screens } = await demoAPI.getScreenings();
      const recentScreens = screens
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      const activities = recentScreens.map((screen: any) => ({
        name: screen.candidate?.name || 'Unknown',
        role: screen.role?.title || 'Unknown Role',
        status: screen.status,
        outcome: screen.outcome,
        time: getRelativeTime(screen.created_at)
      }));
      setStats(prev => ({ ...prev, recentActivity: activities }));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-xl bg-gradient-primary p-8 text-primary-foreground">
          <div className="relative z-10">
            <Badge className="mb-4 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20">
              AI-Powered Recruitment
            </Badge>
            <h1 className="text-4xl font-bold mb-4">Automate Your Phone Screening Process</h1>
            <p className="text-xl mb-6 text-primary-foreground/90 max-w-2xl">
              Screen candidates efficiently with AI-powered voice calls.
            </p>
            <div className="flex gap-3">
              <Link to="/roles"><Button size="lg" variant="secondary">Get Started <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
              <Link to="/screens"><Button size="lg" variant="outline" className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20">View Screens</Button></Link>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl" />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Active Roles', value: stats.activeRoles, sub: 'Currently active', icon: TrendingUp },
            { label: 'Total Screens', value: stats.totalScreens, sub: `${stats.pendingScreens} pending`, icon: Clock },
            { label: 'Pass Rate', value: `${stats.passRate}%`, sub: stats.passRate > 60 ? 'Above average' : 'Below average', icon: CheckCircle },
            { label: 'Time Saved', value: `${stats.timeSaved}h`, sub: 'Total saved', icon: Zap },
          ].map((s, i) => (
            <Card key={i}>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1"><s.icon className="w-3 h-3 inline mr-1" />{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Platform Features</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: FileText, title: 'Role Configuration', desc: 'Create screening roles with custom questions', link: '/roles', label: 'Manage Roles' },
              { icon: Users, title: 'Candidate Import', desc: 'Bulk import candidates via CSV', link: '/candidates/import', label: 'Import Candidates' },
              { icon: Phone, title: 'Automated Screening', desc: 'AI-powered voice calls with scoring', link: '/screens', label: 'View Screens' },
            ].map((f, i) => (
              <Card key={i} className="hover:shadow-lg transition-all hover:translate-y-[-2px]">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center mb-3">
                    <f.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <CardTitle>{f.title}</CardTitle>
                  <CardDescription>{f.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to={f.link}><Button variant="ghost" className="p-0">{f.label} <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <CallMonitor />
        <EnhancedAnalyticsDashboard />

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest screening sessions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.length > 0 ? stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-card-hover transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                      {activity.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium">{activity.name}</p>
                      <p className="text-sm text-muted-foreground">{activity.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {activity.outcome && (
                      <Badge className={activity.outcome === 'pass' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                        {activity.outcome}
                      </Badge>
                    )}
                    <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'}>{activity.status}</Badge>
                    <span className="text-sm text-muted-foreground">{activity.time}</span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
