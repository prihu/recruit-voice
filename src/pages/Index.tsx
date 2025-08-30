import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Users,
  FileText,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Clock,
  TrendingUp,
  Zap,
  Globe,
  Shield
} from 'lucide-react';
import { CallMonitor } from '@/components/CallMonitor';
import { supabase } from '@/integrations/supabase/client';
import type { Screen } from '@/types';

export default function Index() {
  const [stats, setStats] = useState({
    activeRoles: 0,
    totalScreens: 0,
    pendingScreens: 0,
    passRate: 0,
    timeSaved: 0,
    recentActivity: [] as any[]
  });

  useEffect(() => {
    fetchAnalytics();
    fetchRecentActivity();
  }, []);

  const fetchAnalytics = async () => {
    const orgId = await getUserOrganization();
    if (!orgId) return;

    // Fetch active roles count
    const { count: rolesCount } = await supabase
      .from('roles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active');

    // Fetch screens stats
    const { data: screensData, count: totalScreens } = await supabase
      .from('screens')
      .select('status, outcome, duration_seconds', { count: 'exact' })
      .eq('organization_id', orgId);

    const pendingScreens = screensData?.filter(s => s.status === 'pending' || s.status === 'scheduled').length || 0;
    const passedScreens = screensData?.filter(s => s.outcome === 'pass').length || 0;
    const completedScreens = screensData?.filter(s => s.status === 'completed').length || 0;
    const passRate = completedScreens > 0 ? Math.round((passedScreens / completedScreens) * 100) : 0;

    // Calculate time saved (assuming 15 min per screen)
    const timeSaved = Math.round((totalScreens || 0) * 0.25); // 15 minutes = 0.25 hours

    setStats({
      activeRoles: rolesCount || 0,
      totalScreens: totalScreens || 0,
      pendingScreens,
      passRate,
      timeSaved,
      recentActivity: []
    });
  };

  const fetchRecentActivity = async () => {
    const orgId = await getUserOrganization();
    if (!orgId) return;

    const { data } = await supabase
      .from('screens')
      .select(`
        id,
        status,
        outcome,
        created_at,
        candidate:candidates(name),
        role:roles(title)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      const activities = data.map(screen => ({
        name: screen.candidate?.name || 'Unknown',
        role: screen.role?.title || 'Unknown Role',
        status: screen.status,
        outcome: screen.outcome,
        time: getRelativeTime(screen.created_at)
      }));
      
      setStats(prev => ({ ...prev, recentActivity: activities }));
    }
  };

  const getUserOrganization = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    return data?.organization_id;
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
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-primary p-8 text-primary-foreground">
          <div className="relative z-10">
            <Badge className="mb-4 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20">
              AI-Powered Recruitment
            </Badge>
            <h1 className="text-4xl font-bold mb-4">
              Automate Your Phone Screening Process
            </h1>
            <p className="text-xl mb-6 text-primary-foreground/90 max-w-2xl">
              Screen candidates efficiently with AI-powered voice calls. Ask standardized questions, 
              answer FAQs, and get transcribed, scored results automatically.
            </p>
            <div className="flex gap-3">
              <Link to="/roles">
                <Button size="lg" variant="secondary">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/screens">
                <Button size="lg" variant="outline" className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/10 rounded-full blur-2xl" />
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeRoles}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <TrendingUp className="w-3 h-3 inline mr-1" />
                Currently active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Screens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalScreens}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <Clock className="w-3 h-3 inline mr-1" />
                {stats.pendingScreens} pending
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.passRate}%</div>
              <p className="text-xs text-success mt-1">
                <CheckCircle className="w-3 h-3 inline mr-1" />
                {stats.passRate > 60 ? 'Above average' : 'Below average'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Time Saved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.timeSaved}h</div>
              <p className="text-xs text-muted-foreground mt-1">
                <Zap className="w-3 h-3 inline mr-1" />
                Total saved
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Platform Features</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-lg transition-all hover:translate-y-[-2px]">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <CardTitle>Role Configuration</CardTitle>
                <CardDescription>
                  Create screening roles with custom questions, FAQ responses, and scoring rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/roles">
                  <Button variant="ghost" className="p-0">
                    Manage Roles
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all hover:translate-y-[-2px]">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-primary-foreground" />
                </div>
                <CardTitle>Candidate Import</CardTitle>
                <CardDescription>
                  Bulk import candidates via CSV or integrate with your existing ATS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/candidates/import">
                  <Button variant="ghost" className="p-0">
                    Import Candidates
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all hover:translate-y-[-2px]">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center mb-3">
                  <Phone className="w-5 h-5 text-primary-foreground" />
                </div>
                <CardTitle>Automated Screening</CardTitle>
                <CardDescription>
                  AI-powered voice calls with real-time transcription and scoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/screens">
                  <Button variant="ghost" className="p-0">
                    View Screens
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Voice Solution Options */}
        <Card>
          <CardHeader>
            <CardTitle>Voice Call Integration Options</CardTitle>
            <CardDescription>
              Choose your preferred method for conducting screening calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Browser-Based Voice</h4>
                    <p className="text-sm text-muted-foreground">WebRTC powered conversations</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>ElevenLabs Conversational AI integration</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>No phone infrastructure needed</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Works directly in candidate's browser</span>
                  </div>
                </div>
                <Button className="w-full bg-gradient-primary border-0">
                  Configure Browser Voice
                </Button>
              </div>

              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Text Simulator</h4>
                    <p className="text-sm text-muted-foreground">Test conversations without voice</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Full conversation logic testing</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Instant setup, no configuration</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Perfect for demos and testing</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  Start Text Mode
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call Monitor */}
        <CallMonitor />

        {/* Recent Activity */}
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
                      {activity.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium">{activity.name}</p>
                      <p className="text-sm text-muted-foreground">{activity.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {activity.outcome && (
                      <Badge 
                        className={activity.outcome === 'pass' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}
                      >
                        {activity.outcome}
                      </Badge>
                    )}
                    <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'}>
                      {activity.status}
                    </Badge>
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