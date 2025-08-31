import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  X, 
  Clock, 
  Phone, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Activity,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

export function ScreeningQueue() {
  const [bulkOperations, setBulkOperations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBulkOperations();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('bulk-operations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bulk_operations'
        },
        () => {
          fetchBulkOperations();
        }
      )
      .subscribe();

    // Also subscribe to screens table for progress updates
    const screensChannel = supabase
      .channel('screens-bulk-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'screens',
          filter: 'bulk_operation_id=not.is.null'
        },
        () => {
          fetchBulkOperations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(screensChannel);
    };
  }, []);

  const fetchBulkOperations = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: orgData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!orgData) return;

      const { data: operations, error } = await supabase
        .from('bulk_operations')
        .select(`
          *,
          roles (
            title,
            location
          ),
          screens!bulk_operation_id (
            id,
            status,
            outcome
          )
        `)
        .eq('organization_id', orgData.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate real-time stats for each operation
      const operationsWithStats = operations?.map(op => {
        const screens = op.screens || [];
        const completed = screens.filter((s: any) => s.status === 'completed').length;
        const inProgress = screens.filter((s: any) => s.status === 'in_progress').length;
        const failed = screens.filter((s: any) => s.status === 'failed').length;
        
        return {
          ...op,
          completed_count: completed,
          in_progress_count: inProgress,
          failed_count: failed,
          progress: op.total_count > 0 ? ((completed + failed) / op.total_count) * 100 : 0
        };
      }) || [];

      setBulkOperations(operationsWithStats);
    } catch (error) {
      console.error('Error fetching bulk operations:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handlePause = async (operationId: string) => {
    try {
      const { error } = await supabase
        .from('bulk_operations')
        .update({ status: 'paused' })
        .eq('id', operationId);

      if (error) throw error;

      toast({
        title: 'Operation Paused',
        description: 'The bulk screening operation has been paused',
      });
    } catch (error) {
      console.error('Error pausing operation:', error);
      toast({
        title: 'Error',
        description: 'Failed to pause operation',
        variant: 'destructive',
      });
    }
  };

  const handleResume = async (operationId: string) => {
    try {
      const { error } = await supabase
        .from('bulk_operations')
        .update({ status: 'in_progress' })
        .eq('id', operationId);

      if (error) throw error;

      // Trigger the edge function to resume processing
      await supabase.functions.invoke('process-bulk-screenings', {
        body: {
          bulk_operation_id: operationId,
          action: 'resume'
        }
      });

      toast({
        title: 'Operation Resumed',
        description: 'The bulk screening operation has been resumed',
      });
    } catch (error) {
      console.error('Error resuming operation:', error);
      toast({
        title: 'Error',
        description: 'Failed to resume operation',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (operationId: string) => {
    try {
      const { error } = await supabase
        .from('bulk_operations')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', operationId);

      if (error) throw error;

      toast({
        title: 'Operation Cancelled',
        description: 'The bulk screening operation has been cancelled',
      });
    } catch (error) {
      console.error('Error cancelling operation:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel operation',
        variant: 'destructive',
      });
    }
  };

  const handleRetryFailed = async (operationId: string) => {
    try {
      // Get failed screens for this operation
      const { data: failedScreens, error: fetchError } = await supabase
        .from('screens')
        .select('candidate_id')
        .eq('bulk_operation_id', operationId)
        .eq('status', 'failed');

      if (fetchError) throw fetchError;

      if (!failedScreens || failedScreens.length === 0) {
        toast({
          title: 'No Failed Calls',
          description: 'There are no failed calls to retry',
        });
        return;
      }

      // Trigger retry for failed screens
      const { error } = await supabase.functions.invoke('process-bulk-screenings', {
        body: {
          bulk_operation_id: operationId,
          action: 'retry_failed',
          candidate_ids: failedScreens.map(s => s.candidate_id)
        }
      });

      if (error) throw error;

      toast({
        title: 'Retrying Failed Calls',
        description: `Retrying ${failedScreens.length} failed calls`,
      });
    } catch (error) {
      console.error('Error retrying failed calls:', error);
      toast({
        title: 'Error',
        description: 'Failed to retry calls',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <Activity className="h-4 w-4 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'paused':
        return <Pause className="h-4 w-4" />;
      case 'cancelled':
        return <X className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-secondary text-secondary-foreground';
      case 'in_progress':
        return 'bg-primary/10 text-primary';
      case 'completed':
        return 'bg-success/10 text-success';
      case 'failed':
        return 'bg-destructive/10 text-destructive';
      case 'paused':
        return 'bg-warning/10 text-warning';
      case 'cancelled':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Screening Queue</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRefreshing(true);
            fetchBulkOperations();
          }}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {bulkOperations.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No bulk screening operations in queue. Start a new bulk screening to see it here.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {bulkOperations.map((operation) => (
            <Card key={operation.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(operation.status)}>
                      {getStatusIcon(operation.status)}
                      <span className="ml-1 capitalize">
                        {operation.status.replace('_', ' ')}
                      </span>
                    </Badge>
                    <CardTitle className="text-base">
                      {operation.roles?.title || 'Unknown Role'}
                    </CardTitle>
                  </div>
                  <div className="flex gap-2">
                    {operation.status === 'in_progress' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePause(operation.id)}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {operation.status === 'paused' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResume(operation.id)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {operation.failed_count > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetryFailed(operation.id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    {['pending', 'in_progress', 'paused'].includes(operation.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(operation.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription>
                  Started {format(new Date(operation.created_at), 'MMM d, h:mm a')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Progress value={operation.progress} className="h-2" />
                  
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{operation.total_count}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium text-success">
                        {operation.completed_count}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">In Progress</span>
                      <span className="font-medium text-primary">
                        {operation.in_progress_count}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Failed</span>
                      <span className="font-medium text-destructive">
                        {operation.failed_count}
                      </span>
                    </div>
                  </div>

                  {operation.settings?.batch_size && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>Batch size: {operation.settings.batch_size} concurrent calls</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}