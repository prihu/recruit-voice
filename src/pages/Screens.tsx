import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search,
  Filter,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlayCircle,
  Download,
  BarChart3,
  Loader2,
  RefreshCw,
  Users
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDemoAPI } from '@/hooks/useDemoAPI';
import { toast } from '@/hooks/use-toast';
import { ExportDialog } from '@/components/ExportDialog';
import { BulkScreeningModal } from '@/components/BulkScreeningModal';
import { ScreeningQueue } from '@/components/ScreeningQueue';
import { supabase } from '@/integrations/supabase/client';

interface Screen {
  id: string;
  status: string;
  attempts: number;
  score: number | null;
  outcome: string | null;
  screening_type: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
  candidate: {
    id: string;
    name: string;
    phone: string;
    email: string;
  } | null;
  role: {
    id: string;
    title: string;
    location: string;
    call_window: any;
  } | null;
}

export default function Screens() {
  const demoAPI = useDemoAPI();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [bulkScreeningOpen, setBulkScreeningOpen] = useState(false);

  const fetchScreens = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { screens } = await demoAPI.getScreenings();
      
      // Sort by updated_at descending
      const sortedScreens = screens.sort((a: any, b: any) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      setScreens(sortedScreens);
    } catch (error: any) {
      console.error('Error fetching screens:', error);
      toast({
        title: "Error",
        description: "Failed to load screening sessions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScreens();
    // Note: Realtime subscriptions removed for demo mode
    // In demo mode, users can manually refresh to see updates
  }, []);

  const handleRecoverStuckCalls = async () => {
    setRecovering(true);
    try {
      const { data, error } = await supabase.functions.invoke('recover-stuck-screens', { body: {} });
      if (error) throw error;

      toast({
        title: "Recovery Complete",
        description: `Recovered ${data?.recovered ?? 0} screens, ${data?.failed ?? 0} failed`,
      });

      // Refresh the screens list
      await fetchScreens(false);
    } catch (error: any) {
      console.error('Recovery error:', error);
      toast({
        title: "Recovery Failed",
        description: error.message || "Failed to recover stuck calls",
        variant: "destructive"
      });
    } finally {
      setRecovering(false);
    }
  };

  const filteredScreens = screens.filter(screen => {
    const matchesSearch = 
      screen.candidate?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      screen.role?.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || screen.status === statusFilter;
    const matchesOutcome = outcomeFilter === 'all' || screen.outcome === outcomeFilter;

    return matchesSearch && matchesStatus && matchesOutcome;
  });

  const stats = {
    total: screens.length,
    inProgress: screens.filter(s => s.status === 'in_progress').length,
    passRate: screens.filter(s => s.outcome === 'pass').length / screens.filter(s => s.outcome).length * 100 || 0,
    avgScore: screens.reduce((acc, s) => acc + (s.score || 0), 0) / screens.filter(s => s.score).length || 0
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'in_progress':
        return <PlayCircle className="w-4 h-4" />;
      case 'pending':
      case 'scheduled':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success text-success-foreground';
      case 'failed':
      case 'incomplete':
        return 'bg-destructive text-destructive-foreground';
      case 'in_progress':
        return 'bg-primary text-primary-foreground';
      case 'pending':
      case 'scheduled':
        return 'bg-warning text-warning-foreground';
      default:
        return '';
    }
  };

  const getOutcomeColor = (outcome?: string | null) => {
    switch (outcome) {
      case 'pass':
        return 'bg-success text-success-foreground';
      case 'fail':
        return 'bg-destructive text-destructive-foreground';
      case 'maybe':
        return 'bg-warning text-warning-foreground';
      case 'incomplete':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Screening Sessions</h1>
            <p className="text-muted-foreground mt-2">
              Monitor and manage all candidate screening calls
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => fetchScreens(false)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
            {stats.inProgress > 0 && (
              <Button 
                variant="outline" 
                onClick={handleRecoverStuckCalls}
                disabled={recovering}
              >
                {recovering ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-2" />
                )}
                Recover Stuck Calls
              </Button>
            )}
            <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              onClick={() => setBulkScreeningOpen(true)}
              className="bg-gradient-primary border-0"
            >
              <Users className="w-4 h-4 mr-2" />
              Bulk Screening
            </Button>
            <Link to="/roles">
              <Button variant="outline">
                <Phone className="w-4 h-4 mr-2" />
                Individual Screen
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Screens</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <PlayCircle className="w-8 h-8 text-warning" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
                <p className="text-2xl font-bold">
                  {Math.round(stats.passRate)}%
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">
                  {Math.round(stats.avgScore)}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                {Math.round(stats.avgScore)}
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by candidate or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="fail">Fail</SelectItem>
              <SelectItem value="maybe">Maybe</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Screens Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScreens.map((screen) => (
                <TableRow key={screen.id} className="hover:bg-card-hover">
                  <TableCell>
                    <div>
                      <p className="font-medium">{screen.candidate?.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{screen.candidate?.phone || 'No phone'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{screen.role?.title || 'Unknown Role'}</p>
                      <p className="text-sm text-muted-foreground">{screen.role?.location || 'No location'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(screen.status)}>
                      {getStatusIcon(screen.status)}
                      <span className="ml-1">{screen.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{screen.attempts}</span>
                    <span className="text-muted-foreground">/{screen.role?.call_window?.maxAttempts || 3}</span>
                  </TableCell>
                  <TableCell>
                    {screen.score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                          {Math.round(screen.score)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {screen.outcome ? (
                      <Badge className={getOutcomeColor(screen.outcome)}>
                        {screen.outcome}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(screen.updated_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link to={`/screens/${screen.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Empty State */}
        {filteredScreens.length === 0 && (
          <Card className="p-12 text-center">
            <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No screening sessions found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all' || outcomeFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Launch your first screening session to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && outcomeFilter === 'all' && (
              <Link to="/roles">
                <Button className="bg-gradient-primary border-0">
                  <Phone className="w-4 h-4 mr-2" />
                  Launch First Screen
                </Button>
              </Link>
            )}
          </Card>
        )}
        
        {/* Screening Queue */}
        <Card>
          <div className="p-6">
            <ScreeningQueue />
          </div>
        </Card>
        
        {/* Export Dialog */}
        <ExportDialog 
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          screenCount={filteredScreens.length}
        />
        
        {/* Bulk Screening Modal */}
        <BulkScreeningModal
          open={bulkScreeningOpen}
          onOpenChange={setBulkScreeningOpen}
          onSuccess={() => {
            setBulkScreeningOpen(false);
            fetchScreens(false);
          }}
        />
      </div>
    </AppLayout>
  );
}